/*
 * ioBroker.desktop-control – controls Windows PCs running the DesktopControl agent via MQTT.
 * Protocol: docs/PROTOCOL.md. Devices, states and commands are created from the agent's info manifest.
 */

import * as utils from '@iobroker/adapter-core';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { startBroker, type RunningBroker } from './lib/broker';
import { normalizeMac, sendWol } from './lib/wol';
import { Correlator } from './lib/correlator';
import {
	commandForStateWrite,
	commandDataPoints,
	commandKind,
	findStateDef,
	type Manifest,
	type ManifestCommand,
	normalizeManifest,
	parseCommandParams,
	parseOnline,
	parseResult,
	parseScreenshot,
	stateFromResult,
	parseTopic,
	parseValue,
	pathToId,
	type ResultMessage,
	sanitizeSegment,
	stateCommon,
	text,
} from './lib/protocol';

/** data point (in the cmd channel) with the result of the last command */
const RESULT = 'result';

/** what the adapter knows about one agent */
interface Device {
	/** agent id as used in the topics */
	topicId: string;
	/** object id below the adapter namespace */
	objId: string;
	/** last info manifest */
	manifest?: Manifest;
	/** online as reported by the agent */
	online: boolean;
	/** MAC address for Wake-on-LAN (kept in the device object, so it also works after a restart while the PC is off) */
	mac?: string;
	/** broadcast address of the PC's network */
	broadcast?: string;
}

/** data point (in the cmd channel) that wakes the PC via Wake-on-LAN; handled by the adapter, not the agent */
const WAKE = 'wake';

/** commands the dialog timeout applies to */
const DIALOG_COMMANDS = ['ask'];

class DesktopControl extends utils.Adapter {
	private client?: MqttClient;
	private base = 'winctl';
	private correlator!: Correlator;
	/** topicId → device */
	private readonly devices = new Map<string, Device>();
	/** objId → topicId */
	private readonly byObjId = new Map<string, string>();
	/** object ids already created/updated in this run */
	private readonly known = new Set<string>();
	private lastError = '';
	private broker?: RunningBroker;
	/** messages are handled one after another, so a manifest is complete before the states that follow it */
	private queue: Promise<void> = Promise.resolve();

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'desktop-control',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		await this.setState('info.connection', false, true);
		this.correlator = new Correlator({
			set: (cb, ms) => this.setTimeout(cb, ms),
			clear: handle => this.clearTimeout(handle as ioBroker.Timeout),
		});
		this.base = String(this.config.topicBase || 'winctl').replace(/^\/+|\/+$/g, '') || 'winctl';
		const cfg = this.config;
		if (await this.migrateConfig()) {
			return; // the changed instance object restarts the adapter
		}
		// instances from before the built-in broker: keep an entered external broker
		const mode = cfg.brokerMode || (cfg.host ? 'external' : 'internal');
		if (mode === 'internal') {
			const port = Number(cfg.port) || 1886;
			try {
				this.broker = await startBroker({
					port,
					bind: cfg.bind || '0.0.0.0',
					username: cfg.username,
					password: cfg.password,
				});
			} catch (e) {
				this.log.error(
					`Cannot start the built-in MQTT broker on port ${port}: ${(e as Error).message} – is the port used by another program?`,
				);
				return;
			}
			this.log.info(`Built-in MQTT broker listens on ${cfg.bind || '0.0.0.0'}:${port}`);
		} else if (!cfg.host) {
			this.log.error('No MQTT broker configured – please enter the broker host in the adapter settings.');
			return;
		}
		// file storage for screenshots (writeFile needs a meta object with the instance name)
		// the admin file browser shows common.name as the folder title, so it starts with the instance name
		await this.extendForeignObjectAsync(this.namespace, {
			type: 'meta',
			common: { name: `${this.namespace} (screenshots)`, type: 'meta.user' },
			native: {},
		});
		await this.restoreDevices();
		await this.subscribeStatesAsync('*');
		this.connect();
	}

	/**
	 * Moves settings of older versions to the current names: the built-in broker used `brokerPort`/`brokerBind`
	 * and `port` was the port of an existing broker. Returns true when the instance object was changed.
	 */
	private async migrateConfig(): Promise<boolean> {
		const cfg = this.config;
		if (cfg.brokerPort == null && cfg.brokerBind == null) {
			return false;
		}
		this.log.info(
			'Moving broker settings to the new names (port/bind = built-in broker, hostPort = existing broker)',
		);
		await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, {
			native: {
				port: Number(cfg.brokerPort) || 1886,
				bind: cfg.brokerBind || '0.0.0.0',
				hostPort: Number(cfg.port) || 1883,
				brokerPort: null,
				brokerBind: null,
			},
		});
		return true;
	}

	/** Reads the devices created in earlier runs (topic id is stored in native) */
	private async restoreDevices(): Promise<void> {
		const objs = await this.getAdapterObjectsAsync();
		for (const [id, obj] of Object.entries(objs)) {
			const rel = id.slice(this.namespace.length + 1);
			if (obj.type === 'device' && rel !== 'all' && !rel.includes('.')) {
				const native = (obj.native ?? {}) as { topicId?: string; mac?: string; broadcast?: string };
				const topicId = String(native.topicId || rel);
				this.devices.set(topicId, {
					topicId,
					objId: rel,
					online: false,
					mac: normalizeMac(native.mac) ?? undefined,
					broadcast: native.broadcast || undefined,
				});
				this.byObjId.set(rel, topicId);
				// the retained "online" message sets the real value after connecting
				await this.setState(`${rel}.online`, false, true);
			}
		}
	}

	private connect(): void {
		const cfg = this.config;
		// with the built-in broker the adapter connects locally without TLS
		const local = !!this.broker;
		const tls = !local && cfg.tls;
		const options: IClientOptions = {
			host: local ? '127.0.0.1' : cfg.host,
			port: local ? Number(cfg.port) || 1886 : Number(cfg.hostPort) || (tls ? 8883 : 1883),
			protocol: tls ? 'mqtts' : 'mqtt',
			username: cfg.username || undefined,
			password: cfg.password || undefined,
			clientId: cfg.clientId || `iobroker_${this.namespace}_${Math.random().toString(16).slice(2, 8)}`,
			rejectUnauthorized: cfg.rejectUnauthorized !== false,
			reconnectPeriod: 5000,
			connectTimeout: 10000,
			clean: true,
		};
		this.log.info(`Connecting to MQTT broker ${options.protocol}://${options.host}:${options.port}`);
		const client = mqtt.connect(options);
		this.client = client;
		client.on('connect', () => {
			this.lastError = '';
			this.log.info('Connected to the MQTT broker');
			void this.setState('info.connection', true, true);
			const b = this.base;
			client.subscribe(
				[
					`${b}/+/online`,
					`${b}/+/info`,
					`${b}/+/state/#`,
					`${b}/+/event/#`,
					`${b}/+/result`,
					`${b}/+/screenshot`,
				],
				{ qos: 1 },
				err => err && this.log.warn(`Subscribe failed: ${err.message}`),
			);
		});
		client.on('close', () => void this.setState('info.connection', false, true));
		client.on('offline', () => void this.setState('info.connection', false, true));
		client.on('error', err => {
			// the client reconnects by itself; log each different error once
			if (err.message !== this.lastError) {
				this.lastError = err.message;
				this.log.warn(`MQTT: ${err.message}`);
			}
		});
		client.on('message', (topic, payload) => {
			this.queue = this.queue
				.then(() => this.handleMessage(topic, payload))
				.catch(e => this.log.warn(`Message ${topic}: ${(e as Error).message}`));
		});
	}

	/**
	 * Creates or updates an object once per run (extendObject keeps user changes like custom settings)
	 *
	 * @param id object id
	 * @param obj object
	 */
	private async ensureObject(id: string, obj: ioBroker.PartialObject): Promise<void> {
		if (this.known.has(id)) {
			return;
		}
		await this.extendObjectAsync(id, obj);
		this.known.add(id);
	}

	/**
	 * Creates a folder for every level between base and the state id (e.g. `state.disk` for `state.disk.c_free_gb`),
	 * so the object tree has no gaps
	 *
	 * @param base existing parent (e.g. `<pc>.state`)
	 * @param id full state id below base
	 */
	private async ensureParents(base: string, id: string): Promise<void> {
		const parts = id.slice(base.length + 1).split('.');
		let cur = base;
		for (const p of parts.slice(0, -1)) {
			cur = `${cur}.${p}`;
			await this.ensureObject(cur, { type: 'folder', common: { name: p }, native: {} });
		}
	}

	/**
	 * Device for an agent id (creates the base objects on first contact)
	 *
	 * @param topicId agent id
	 */
	private async ensureDevice(topicId: string): Promise<Device> {
		let dev = this.devices.get(topicId);
		if (!dev) {
			let objId = sanitizeSegment(topicId);
			while (this.byObjId.has(objId) && this.byObjId.get(objId) !== topicId) {
				objId += '_';
			}
			dev = { topicId, objId, online: false };
			this.devices.set(topicId, dev);
			this.byObjId.set(objId, topicId);
		}
		const o = dev.objId;
		await this.ensureObject(o, { type: 'device', common: { name: topicId }, native: { topicId } });
		await this.ensureObject(`${o}.online`, {
			type: 'state',
			common: { name: 'Online', type: 'boolean', role: 'indicator.reachable', read: true, write: false },
			native: {},
		});
		for (const [ch, name] of [
			['info', 'Information'],
			['state', 'States'],
			['cmd', 'Commands'],
			['event', 'Events'],
		]) {
			await this.ensureObject(`${o}.${ch}`, { type: 'channel', common: { name }, native: {} });
		}
		await this.ensureObject(`${o}.cmd.${RESULT}`, {
			type: 'state',
			common: { name: 'Last command result', type: 'string', role: 'json', read: true, write: false },
			native: {},
		});
		await this.ensureObject(`${o}.lastSeen`, {
			type: 'state',
			common: {
				name: 'Last message from the agent',
				type: 'number',
				role: 'value.time',
				read: true,
				write: false,
			},
			native: {},
		});
		return dev;
	}

	/**
	 * @param topic MQTT topic
	 * @param payload raw payload
	 */
	private async handleMessage(topic: string, payload: Buffer): Promise<void> {
		const parsed = parseTopic(this.base, topic);
		if (!parsed) {
			return;
		}
		const dev = await this.ensureDevice(parsed.device);
		const o = dev.objId;
		const body = payload.toString('utf8');
		if (parsed.kind !== 'online' || parseOnline(body)) {
			await this.setStateChangedAsync(`${o}.lastSeen`, Date.now(), true);
		}
		switch (parsed.kind) {
			case 'online': {
				dev.online = parseOnline(body);
				await this.setState(`${o}.online`, dev.online, true);
				if (!dev.online) {
					this.correlator.rejectAll('device offline', dev.topicId);
				}
				break;
			}
			case 'info': {
				let raw: unknown;
				try {
					raw = JSON.parse(body);
				} catch {
					this.log.warn(`${dev.topicId}: invalid info manifest`);
					return;
				}
				dev.manifest = normalizeManifest(raw);
				await this.applyManifest(dev);
				break;
			}
			case 'state': {
				const def = findStateDef(dev.manifest, parsed.path);
				const value = parseValue(body, def?.type);
				const id = `${o}.state.${pathToId(parsed.path)}`;
				await this.ensureParents(`${o}.state`, id);
				await this.ensureObject(id, {
					type: 'state',
					common: stateCommon(parsed.path, def, value),
					native: {},
				});
				await this.setState(id, value, true);
				break;
			}
			case 'event': {
				const id = `${o}.event.${pathToId(parsed.path)}`;
				await this.ensureParents(`${o}.event`, id);
				await this.ensureObject(id, {
					type: 'state',
					common: { name: `Event ${parsed.path}`, type: 'string', role: 'json', read: true, write: false },
					native: {},
				});
				// events can repeat with the same payload, so always write
				await this.setState(id, body, true);
				break;
			}
			case 'result': {
				const result = parseResult(body);
				if (result) {
					this.correlator.resolve(result);
					await this.setState(`${o}.cmd.${RESULT}`, JSON.stringify(result), true);
					const st = stateFromResult(result);
					if (st && this.known.has(`${o}.state.${st.path}`)) {
						await this.setStateChangedAsync(`${o}.state.${st.path}`, st.value, true);
					}
				}
				break;
			}
			case 'screenshot': {
				const img = parseScreenshot(payload);
				if (!img) {
					this.log.warn(`${dev.topicId}: screenshot in unknown format`);
					return;
				}
				const file = `screenshots/${o}.${img.ext}`;
				await this.writeFileAsync(this.namespace, file, img.data);
				const id = `${o}.screenshot`;
				await this.ensureObject(id, {
					type: 'state',
					common: {
						name: 'Last screenshot (file)',
						type: 'string',
						role: 'text.url',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setState(id, `/${this.namespace}/${file}`, true);
				if (img.id) {
					this.correlator.resolve({
						id: img.id,
						command: 'screenshot',
						ok: true,
						result: `/${this.namespace}/${file}`,
					});
				}
				break;
			}
		}
	}

	/**
	 * Creates info, state and command objects from the manifest
	 *
	 * @param dev device
	 */
	private async applyManifest(dev: Device): Promise<void> {
		const m = dev.manifest;
		if (!m) {
			return;
		}
		const o = dev.objId;
		dev.mac = normalizeMac(m.mac) ?? dev.mac;
		dev.broadcast = m.broadcast || dev.broadcast;
		await this.extendObjectAsync(o, {
			common: { name: m.hostname || dev.topicId },
			native: { topicId: dev.topicId, mac: dev.mac ?? '', broadcast: dev.broadcast ?? '' },
		});
		const infos: [string, string, string][] = [
			['hostname', 'Host name', 'info.name'],
			['ip', 'IP address', 'info.ip'],
			['version', 'Agent version', 'info.firmware'],
			['os', 'Operating system', 'text'],
			['user', 'Logged-in user', 'text'],
			['started', 'Agent started', 'date'],
			['mac', 'MAC address', 'info.mac'],
		];
		for (const [key, name, role] of infos) {
			await this.ensureObject(`${o}.info.${key}`, {
				type: 'state',
				common: { name, type: 'string', role, read: true, write: false },
				native: {},
			});
			await this.setStateChangedAsync(
				`${o}.info.${key}`,
				key === 'mac' ? (dev.mac ?? '') : (m[key as keyof Manifest] as string),
				true,
			);
		}
		await this.ensureObject(`${o}.info.apps`, {
			type: 'state',
			common: {
				name: 'Allowed programs (aliases for run/open)',
				type: 'string',
				role: 'json',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setStateChangedAsync(`${o}.info.apps`, JSON.stringify(m.apps), true);
		if (m.protocol > 1) {
			this.log.warn(
				`${dev.topicId}: agent uses protocol ${m.protocol}, this adapter knows protocol 1 – please update the adapter`,
			);
		}
		// announced states (dynamic ones like disk/<laufwerk>_free_gb are created on first value)
		for (const s of m.states.filter(st => !st.pattern)) {
			const id = `${o}.state.${pathToId(s.path)}`;
			this.known.delete(id); // manifest may have changed type/role
			await this.ensureParents(`${o}.state`, id);
			await this.ensureObject(id, { type: 'state', common: stateCommon(s.path, s), native: {} });
		}
		// commands: button or JSON, dangerous ones only via sendTo; remove commands the agent no longer has
		const wanted = new Set<string>([`${o}.cmd.${RESULT}`]);
		for (const c of m.commands) {
			for (const dp of commandDataPoints(c)) {
				const id = `${o}.cmd.${sanitizeSegment(c.name)}${dp.suffix}`;
				if (id === `${o}.cmd.${RESULT}`) {
					continue; // name is taken by the result data point
				}
				wanted.add(id);
				this.known.delete(id);
				await this.ensureObject(id, {
					type: 'state',
					common: this.commandCommon(c, dp.kind, m.apps),
					native: { command: c.name },
				});
			}
		}
		// Wake-on-LAN: the adapter sends it itself, so it also works while the PC is off
		if (dev.mac) {
			wanted.add(`${o}.cmd.${WAKE}`);
			await this.ensureObject(`${o}.cmd.${WAKE}`, {
				type: 'state',
				common: this.wakeCommon(),
				native: {},
			});
		}
		const existing = await this.getObjectViewAsync('system', 'state', {
			startkey: `${this.namespace}.${o}.cmd.`,
			endkey: `${this.namespace}.${o}.cmd.香`,
		});
		for (const row of existing.rows) {
			const rel = row.id.slice(this.namespace.length + 1);
			if (!wanted.has(rel)) {
				await this.delObjectAsync(rel);
				this.known.delete(rel);
			}
		}
		await this.updateBroadcastCommands();
		this.log.info(
			`${dev.topicId}: ${m.hostname || '?'} (agent ${m.version || '?'}), ${m.states.length} states, ${m.commands.length} commands`,
		);
	}

	/**
	 * common of a command data point
	 *
	 * @param c command
	 * @param kind button or json
	 * @param apps aliases of the agent (selection list for run)
	 */
	private commandCommon(c: ManifestCommand, kind: 'button' | 'json', apps?: string[]): ioBroker.StateCommon {
		// description, options (* = required) and an example, so the data point explains itself in the object browser
		const desc = [
			c.description,
			c.params.length ? `Options: ${c.params.map(p => `${p.name}${p.required ? '*' : ''}`).join(', ')}` : '',
			kind === 'json' && c.examples.length ? `Example: ${c.examples[c.examples.length > 1 ? 1 : 0]}` : '',
			kind === 'button' && c.params.length ? `Runs with the defaults; options via ${c.name}_json` : '',
		]
			.filter(Boolean)
			.join(' | ');
		return kind === 'button'
			? { name: c.name, desc, type: 'boolean', role: 'button', read: false, write: true }
			: {
					name: commandKind(c) === 'both' ? `${c.name} (options)` : c.name,
					desc,
					type: 'string',
					role: 'json',
					read: true,
					write: true,
					def: '{}',
					// run: the aliases of the agent as a selection list (short form)
					...(c.name === 'run' && apps?.length ? { states: Object.fromEntries(apps.map(a => [a, a])) } : {}),
				};
	}

	/** common of the Wake-on-LAN button */
	private wakeCommon(): ioBroker.StateCommon {
		return {
			name: 'Wake-on-LAN',
			desc: 'Switches the PC on via Wake-on-LAN (works while the PC is off; Wake-on-LAN must be enabled in BIOS/network card)',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
		};
	}

	/**
	 * Wakes a PC via Wake-on-LAN
	 *
	 * @param dev device
	 * @returns addresses the packet was sent to
	 */
	private async wake(dev: Device): Promise<string[]> {
		if (!dev.mac) {
			throw new Error(`${dev.topicId}: MAC address unknown – the agent has to be connected once`);
		}
		const sent = await sendWol(dev.mac, [dev.broadcast ?? '', '255.255.255.255']);
		this.log.info(`${dev.topicId}: Wake-on-LAN sent to ${dev.mac} via ${sent.join(', ')}`);
		return sent;
	}

	/** all.cmd.*: commands every device can do the same way (union of the non-dangerous commands) */
	private async updateBroadcastCommands(): Promise<void> {
		const cmds = new Map<string, ManifestCommand>();
		for (const d of this.devices.values()) {
			for (const c of d.manifest?.commands ?? []) {
				if (commandDataPoints(c).length && !cmds.has(c.name)) {
					cmds.set(c.name, c);
				}
			}
		}
		if (!cmds.size) {
			return;
		}
		await this.ensureObject('all', { type: 'device', common: { name: 'All PCs (broadcast)' }, native: {} });
		await this.ensureObject('all.cmd', { type: 'channel', common: { name: 'Commands to all PCs' }, native: {} });
		if ([...this.devices.values()].some(d => d.mac)) {
			await this.ensureObject(`all.cmd.${WAKE}`, { type: 'state', common: this.wakeCommon(), native: {} });
		}
		for (const c of cmds.values()) {
			for (const dp of commandDataPoints(c)) {
				await this.ensureObject(`all.cmd.${sanitizeSegment(c.name)}${dp.suffix}`, {
					type: 'state',
					common: this.commandCommon(c, dp.kind),
					native: { command: c.name },
				});
			}
		}
	}

	/**
	 * Sends a command to one agent and waits for its result.
	 *
	 * @param topicId agent id
	 * @param command command name
	 * @param params parameters
	 * @param timeoutMs timeout (default from the settings)
	 */
	private async sendCommand(
		topicId: string,
		command: string,
		params: Record<string, unknown>,
		timeoutMs?: number,
	): Promise<ResultMessage> {
		const dev = this.devices.get(topicId);
		if (!dev) {
			throw new Error(`unknown device "${topicId}"`);
		}
		if (!dev.online) {
			throw new Error(`device "${topicId}" is offline`);
		}
		if (!this.client?.connected) {
			throw new Error('not connected to the MQTT broker');
		}
		const defaultS = DIALOG_COMMANDS.includes(command)
			? this.config.askTimeout || 120
			: this.config.cmdTimeout || 10;
		const { id, promise } = this.correlator.create(topicId, timeoutMs ?? defaultS * 1000);
		await this.client.publishAsync(`${this.base}/${topicId}/cmd/${command}`, JSON.stringify({ ...params, id }), {
			qos: 1,
		});
		return promise;
	}

	/**
	 * Sends a command to all agents (no result)
	 *
	 * @param command command name
	 * @param params parameters
	 */
	private async broadcast(command: string, params: Record<string, unknown>): Promise<void> {
		if (!this.client?.connected) {
			throw new Error('not connected to the MQTT broker');
		}
		await this.client.publishAsync(`${this.base}/all/cmd/${command}`, JSON.stringify(params), { qos: 1 });
	}

	/**
	 * Commands and writable states from ioBroker (ack=false only)
	 *
	 * @param id state id
	 * @param state state
	 */
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (!state || state.ack) {
			return;
		}
		const rel = id.slice(this.namespace.length + 1);
		const parts = rel.split('.');
		try {
			if (parts[1] === 'cmd' && parts[2] === WAKE && parts.length === 3) {
				const targets =
					parts[0] === 'all'
						? [...this.devices.values()].filter(d => d.mac && !d.online)
						: [...this.devices.values()].filter(d => d.objId === parts[0]);
				for (const d of targets) {
					await this.wake(d);
				}
				await this.setState(rel, state.val, true);
				return;
			}
			if (parts[1] === 'cmd' && parts.length === 3 && parts[2] !== RESULT) {
				const obj = await this.getObjectAsync(rel);
				const command = String((obj?.native as { command?: string } | undefined)?.command || parts[2]);
				// command definition (for the short form): from this device, for "all" from any device
				const def = [...this.devices.values()]
					.filter(d => parts[0] === 'all' || d.objId === parts[0])
					.map(d => d.manifest?.commands.find(c => c.name === command))
					.find(c => c);
				const params = parseCommandParams(state.val, def);
				if (typeof params === 'string') {
					throw new Error(params);
				}
				if (parts[0] === 'all') {
					await this.broadcast(command, params);
					await this.setState(rel, state.val, true);
					return;
				}
				const topicId = this.byObjId.get(parts[0]);
				if (!topicId) {
					throw new Error('unknown device');
				}
				await this.setState(rel, state.val, true);
				const result = await this.sendCommand(topicId, command, params);
				if (!result.ok) {
					this.log.warn(`${topicId}: ${command} failed: ${result.error || 'unknown error'}`);
				}
				return;
			}
			if (parts[1] === 'state' && parts.length >= 3) {
				const topicId = this.byObjId.get(parts[0]);
				const dev = topicId ? this.devices.get(topicId) : undefined;
				if (!dev) {
					return;
				}
				// state ids use "." for the agent's "/" (writable states are top level, e.g. volume)
				const path = parts.slice(2).join('/');
				const cmd = commandForStateWrite(dev.manifest, path, state.val);
				if (!cmd) {
					this.log.warn(`${rel} is not writable`);
					return;
				}
				const result = await this.sendCommand(dev.topicId, cmd.command, cmd.params);
				if (!result.ok) {
					this.log.warn(`${dev.topicId}: ${cmd.command} failed: ${result.error || 'unknown error'}`);
				}
			}
		} catch (e) {
			this.log.warn(`${rel}: ${(e as Error).message}`);
		}
	}

	/**
	 * sendTo interface:
	 * - "cmd" { device, command, params?, timeout? } → result of the agent (device "all" = broadcast)
	 * - "devices" → list of known devices
	 *
	 * @param obj message
	 */
	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (!obj?.callback) {
			return;
		}
		const reply = (response: unknown): void => {
			this.sendTo(obj.from, obj.command, response as ioBroker.MessagePayload, obj.callback);
		};
		const msg = (obj.message ?? {}) as Record<string, unknown>;
		if (obj.command === 'devices') {
			reply(
				[...this.devices.values()].map(d => ({
					device: d.topicId,
					objId: d.objId,
					hostname: d.manifest?.hostname ?? '',
					online: d.online,
					commands: d.manifest?.commands.map(c => c.name) ?? [],
				})),
			);
			return;
		}
		if (obj.command !== 'cmd') {
			reply({ ok: false, error: `unknown command "${obj.command}"` });
			return;
		}
		const device = text(msg.device);
		const command = text(msg.command);
		if (!device || !command) {
			reply({ ok: false, error: 'device and command are required' });
			return;
		}
		/**
		 * Parameters: object, or a plain value for the command's primary parameter (short form)
		 *
		 * @param topicId device whose manifest describes the command (any device for "all")
		 */
		const paramsFor = (topicId?: string): Record<string, unknown> => {
			if (msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params)) {
				return msg.params as Record<string, unknown>;
			}
			if (msg.params === undefined || msg.params === null) {
				return {};
			}
			const def = [...this.devices.values()]
				.filter(d => !topicId || d.topicId === topicId)
				.map(d => d.manifest?.commands.find(c => c.name === command))
				.find(c => c);
			const p = parseCommandParams(msg.params as ioBroker.StateValue, def);
			if (typeof p === 'string') {
				throw new Error(p);
			}
			return p;
		};
		try {
			if (device === 'all' && command === WAKE) {
				const offline = [...this.devices.values()].filter(d => d.mac && !d.online);
				for (const d of offline) {
					await this.wake(d);
				}
				reply({ ok: true, command: WAKE, result: { woken: offline.map(d => d.topicId) } });
				return;
			}
			if (device === 'all') {
				const params = paramsFor();
				await this.broadcast(command, params);
				reply({ ok: true, broadcast: true });
				return;
			}
			const topicId = this.resolveDevice(device);
			if (command === WAKE) {
				const sent = await this.wake(this.devices.get(topicId)!);
				reply({ ok: true, command: WAKE, result: { sent } });
				return;
			}
			const params = paramsFor(topicId);
			const timeout = typeof msg.timeout === 'number' && msg.timeout > 0 ? msg.timeout : undefined;
			const result = await this.sendCommand(topicId, command, params, timeout);
			reply(result);
		} catch (e) {
			reply({ ok: false, command, error: (e as Error).message });
		}
	}

	/**
	 * Device by agent id, object id or host name
	 *
	 * @param name device name as given in sendTo
	 */
	private resolveDevice(name: string): string {
		if (this.devices.has(name)) {
			return name;
		}
		const byObj = this.byObjId.get(name);
		if (byObj) {
			return byObj;
		}
		for (const d of this.devices.values()) {
			if (d.manifest?.hostname && d.manifest.hostname.toLowerCase() === name.toLowerCase()) {
				return d.topicId;
			}
		}
		throw new Error(`unknown device "${name}"`);
	}

	private async onUnload(callback: () => void): Promise<void> {
		try {
			this.correlator?.rejectAll('adapter stopped');
			this.client?.end(true);
			// wait until the built-in broker has released its port (compact mode restarts in the same process)
			await this.broker?.close();
			await this.setState('info.connection', false, true);
		} catch {
			// ignore, the adapter is stopping anyway
		} finally {
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new DesktopControl(options);
} else {
	// otherwise start the instance directly
	(() => new DesktopControl())();
}
