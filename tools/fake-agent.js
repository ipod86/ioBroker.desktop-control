'use strict';

/*
 * Fake DesktopControl agent for tests without Windows (protocol: docs/PROTOCOL.md).
 * Announces a small manifest, publishes some states and answers the commands ping, volume, mute,
 * screenshot and ask.
 *
 * CLI: node tools/fake-agent.js [mqtt://host:1883] [device id] [topic base]
 */

const mqtt = require('mqtt');

// 1x1 transparent PNG
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64',
);

// manifest as the real agent sends it, built from docs/protocol.json (states and commands)
const PROTOCOL = require('../docs/protocol.json');

/**
 * Manifest for a device id
 *
 * @param {string} device device id
 * @param {string} base topic base
 */
function manifest(device, base) {
	return {
		protocol: PROTOCOL.protocol || 1,
		app: 'WinCtl',
		version: '0.0.0-fake',
		device_id: device,
		base_topic: base,
		hostname: 'FAKE-PC',
		user: 'tester',
		os: 'Windows 11 (fake)',
		ip: '192.0.2.10',
		started: new Date().toISOString(),
		security: { allow_any_run: false, allow_shell: false, apps: ['notepad', 'calc'], disabled_commands: ['beep'] },
		hotkeys: {},
		events: ['lock', 'unlock', 'hotkey'],
		states: PROTOCOL.states,
		commands: PROTOCOL.commands,
	};
}

/**
 * Starts the fake agent.
 *
 * @param {{url?: string, device?: string, base?: string}} [opts] options
 * @returns {Promise<{client: import('mqtt').MqttClient, stop: () => Promise<void>, state: Record<string, unknown>}>} agent
 */
async function startFakeAgent(opts = {}) {
	const url = opts.url || 'mqtt://127.0.0.1:1883';
	const device = opts.device || 'fake-pc';
	const base = opts.base || 'winctl';
	const t = `${base}/${device}`;
	const state = { locked: false, volume: 40, muted: false, keep_awake: false, cpu: 7, 'disk/C_used_percent': 55 };

	const client = await mqtt.connectAsync(url, {
		clientId: `fake-agent-${device}`,
		will: { topic: `${t}/online`, payload: 'false', retain: true, qos: 1 },
	});
	// states are plain text (true/false, number, string), everything else JSON
	const pub = (topic, value, retain = false) =>
		client.publishAsync(
			topic,
			typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value),
			{
				retain,
				qos: 1,
			},
		);
	const result = (id, cmd, ok, data, error) =>
		pub(`${t}/result`, { id: id ?? null, cmd, ok, data, error, ts: new Date().toISOString() });

	await pub(`${t}/info`, manifest(device, base), true);
	for (const [k, v] of Object.entries(state)) {
		await pub(`${t}/state/${k}`, String(v), true);
	}
	await pub(`${t}/online`, 'true', true);
	await client.subscribeAsync([`${t}/cmd/#`, `${base}/all/cmd/#`], { qos: 1 });

	client.on('message', async (topic, payload) => {
		const command = topic.split('/').pop();
		let p = {};
		const raw = payload.toString();
		try {
			const j = JSON.parse(raw || '{}');
			p = j && typeof j === 'object' ? j : { value: j };
		} catch {
			p = { value: raw }; // short form
		}
		const id = p.id;
		switch (command) {
			case 'ping':
				return result(id, command, true, 'pong');
			case 'lock':
				state.locked = true;
				await pub(`${t}/state/locked`, 'true', true);
				await pub(`${t}/event/lock`, { ts: new Date().toISOString() });
				return result(id, command, true);
			case 'volume':
				state.volume = Number(p.level ?? p.value);
				await pub(`${t}/state/volume`, String(state.volume), true);
				return result(id, command, true, { level: state.volume });
			case 'mute':
				state.muted = String(p.state ?? p.value) === 'true';
				await pub(`${t}/state/muted`, String(state.muted), true);
				return result(id, command, true, { muted: state.muted });
			case 'keep_awake':
				state.keep_awake = p.state === true || String(p.state ?? p.value) === 'true';
				await pub(`${t}/state/keep_awake`, String(state.keep_awake), true);
				return result(id, command, true);
			case 'speak':
				return result(id, command, true, { text: p.text ?? p.value });
			case 'screenshot':
				// raw image bytes, plus the result
				await pub(`${t}/screenshot`, PNG);
				return result(id, command, true, { width: 1, height: 1, format: 'png' });
			case 'ask':
				return result(id, command, true, { button: 'Ja', index: 0, text: null });
			default:
				return result(id, command, false, undefined, `unknown command ${command}`);
		}
	});

	return {
		client,
		state,
		stop: async () => {
			await pub(`${t}/online`, 'false', true);
			await client.endAsync();
		},
	};
}

module.exports = { startFakeAgent, manifest };

if (require.main === module) {
	const [url, device, base] = process.argv.slice(2);
	startFakeAgent({ url, device, base })
		.then(() => console.log(`fake agent "${device || 'fake-pc'}" running – Ctrl+C to stop`))
		.catch(e => {
			console.error(e.message);
			process.exit(1);
		});
}
