/**
 * Pure functions for the DesktopControl MQTT protocol (see docs/PROTOCOL.md): topic parsing,
 * id mapping, manifest normalisation and object definitions. No ioBroker or MQTT dependencies,
 * so everything here is unit tested.
 */

import { OFFICIAL_ROLES } from './roles';

/** Kind of message a topic carries */
export type TopicKind = 'online' | 'info' | 'state' | 'event' | 'result' | 'screenshot';

/** Parsed topic */
export interface ParsedTopic {
	/** agent id as used in the topic */
	device: string;
	/** message kind */
	kind: TopicKind;
	/** state path or event name (with "/"), empty for the other kinds */
	path: string;
}

/** One state as announced in the manifest */
export interface ManifestState {
	/** state path, for dynamic states the pattern as announced ("disk/<laufwerk>_free_gb") */
	path: string;
	/** ioBroker type */
	type: ioBroker.CommonType;
	/** ioBroker role */
	role: string;
	/** display name */
	name: string;
	/** description from the agent */
	description: string;
	/** unit */
	unit?: string;
	/** minimum */
	min?: number;
	/** maximum */
	max?: number;
	/** can be changed from ioBroker */
	writable: boolean;
	/** dynamic states: matches the concrete paths ("disk/C_free_gb"); undefined for fixed states */
	pattern?: RegExp;
}

/** One command parameter */
export interface ManifestParam {
	/** display name */
	name: string;
	/** ioBroker type */
	type: string;
	/** must be given */
	required: boolean;
	/** allowed values */
	enum?: string[];
	/** default value of the agent */
	default?: unknown;
}

/** One command as announced in the manifest */
export interface ManifestCommand {
	/** display name */
	name: string;
	/** parameters */
	params: ManifestParam[];
	/** only reachable via sendTo */
	dangerous: boolean;
	/** needs a logged-in desktop */
	needsGui: boolean;
	/** description */
	description: string;
	/** parameter a plain value is mapped to (short form) */
	primary?: string;
	/** example payloads (JSON or short form) */
	examples: string[];
	/** switched off in the agent config (DisabledCommands) */
	disabled: boolean;
}

/** Normalised manifest */
export interface Manifest {
	/** host name */
	hostname: string;
	/** IP address */
	ip: string;
	/** agent version */
	version: string;
	/** operating system */
	os: string;
	/** logged-in user */
	user: string;
	/** agent id from the config */
	deviceId: string;
	/** start time of the agent (ISO) */
	started: string;
	/** protocol version */
	protocol: number;
	/** run/open aliases allowed by the agent config */
	apps: string[];
	/** agent may start any program (not only aliases) */
	allowAnyRun: boolean;
	/** announced states */
	states: ManifestState[];
	/** announced commands */
	commands: ManifestCommand[];
	/** announced events */
	events: string[];
}

/**
 * Any value as text ("" for null/undefined, JSON for objects)
 *
 * @param v value
 */
export function text(v: unknown): string {
	if (v === undefined || v === null) {
		return '';
	}
	if (typeof v === 'object') {
		return JSON.stringify(v);
	}
	if (typeof v === 'string') {
		return v;
	}
	return typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint' ? v.toString() : '';
}

const KINDS: TopicKind[] = ['online', 'info', 'state', 'event', 'result', 'screenshot'];

/** characters ioBroker does not allow in ids (same set as adapter.FORBIDDEN_CHARS) */
const FORBIDDEN = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;

/**
 * Parses an incoming topic.
 *
 * @param base topic base, e.g. "winctl"
 * @param topic full topic
 * @returns parsed topic or null if it is not an agent topic
 */
export function parseTopic(base: string, topic: string): ParsedTopic | null {
	const prefix = `${base}/`;
	if (!topic.startsWith(prefix)) {
		return null;
	}
	const parts = topic.slice(prefix.length).split('/');
	if (parts.length < 2 || !parts[0] || parts[0] === 'all') {
		return null;
	}
	const kind = parts[1] as TopicKind;
	if (!KINDS.includes(kind)) {
		return null;
	}
	const path = parts.slice(2).join('/');
	if ((kind === 'state' || kind === 'event') && !path) {
		return null;
	}
	if (kind !== 'state' && kind !== 'event' && path) {
		return null;
	}
	return { device: parts[0], kind, path };
}

/**
 * One id segment: forbidden characters and dots (they would create levels) become "_".
 *
 * @param segment raw segment
 */
export function sanitizeSegment(segment: string): string {
	return segment.replace(FORBIDDEN, '_').replace(/[.\s]/g, '_') || '_';
}

/**
 * Agent path ("disk/C:") → ioBroker id part ("disk.C:")
 *
 * @param path path with "/"
 */
export function pathToId(path: string): string {
	return path
		.split('/')
		.filter(s => s !== '')
		.map(sanitizeSegment)
		.join('.');
}

/**
 * Converts a payload into a state value of the given type.
 *
 * @param payload raw payload
 * @param type expected type (optional)
 */
export function parseValue(payload: string, type?: string): ioBroker.StateValue {
	let v: unknown = payload;
	try {
		v = JSON.parse(payload);
	} catch {
		// plain text
	}
	if (type === 'number') {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	if (type === 'boolean') {
		if (typeof v === 'string') {
			return ['true', '1', 'on', 'yes'].includes(v.toLowerCase());
		}
		return !!v;
	}
	if (type === 'string') {
		return typeof v === 'string' ? v : JSON.stringify(v);
	}
	if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
		return v;
	}
	return JSON.stringify(v);
}

/**
 * Online payload → boolean
 *
 * @param payload raw payload
 */
export function parseOnline(payload: string): boolean {
	const p = payload.trim().toLowerCase().replace(/^"|"$/g, '');
	return ['true', '1', 'online', 'on', 'yes'].includes(p);
}

/**
 * Object or array of { name } → list of [name, entry]
 *
 * @param input raw manifest part
 */
function entries(input: unknown): [string, Record<string, unknown>][] {
	if (Array.isArray(input)) {
		return input
			.filter(e => e && typeof e === 'object' && typeof (e as { name?: unknown }).name === 'string')
			.map(e => [(e as { name: string }).name, e as Record<string, unknown>]);
	}
	if (input && typeof input === 'object') {
		return Object.entries(input as Record<string, unknown>).map(([k, e]) => [
			k,
			e && typeof e === 'object' ? (e as Record<string, unknown>) : {},
		]);
	}
	return [];
}

/** commands a writable state triggers, with the default parameter (the manifest's "primary" wins) */
export const WRITABLE_COMMANDS: Record<string, { command: string; param: string }> = {
	volume: { command: 'volume', param: 'level' },
	muted: { command: 'mute', param: 'state' },
	keep_awake: { command: 'keep_awake', param: 'state' },
};

const TYPES = ['number', 'string', 'boolean', 'json', 'array', 'object', 'mixed'];

/** Dangerous commands that get a data point anyway while the agent only starts programs from its alias list */
export const ALIAS_LIMITED = ['run', 'kill'];

/**
 * Normalises the info manifest (tolerant about objects vs. arrays and missing fields).
 *
 * @param raw parsed info payload
 */
export function normalizeManifest(raw: unknown): Manifest {
	const m = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const str = text;
	const states: ManifestState[] = entries(m.states).map(([path, e]) => {
		const raw = TYPES.includes(str(e.type)) ? str(e.type) : 'mixed';
		// dynamic states: "disk/<laufwerk>_free_gb" (agent) or "disk/*"
		let pattern: RegExp | undefined;
		if (path.includes('<') || path.endsWith('/*')) {
			const re = path
				.split(/(<[^>]+>|\*)/)
				.map(part =>
					part.startsWith('<') || part === '*' ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
				)
				.join('');
			pattern = new RegExp(`^${re}$`);
		}
		// structured values are stored as JSON text
		const type = (['json', 'array', 'object'].includes(raw) ? 'string' : raw) as ioBroker.CommonType;
		// volume, muted, keep_awake can be set from ioBroker (the agent has a command for them)
		const writable = e.writable === true || path in WRITABLE_COMMANDS;
		let role = OFFICIAL_ROLES.has(str(e.role)) ? str(e.role) : defaultRole(raw, writable);
		if (writable && role === 'indicator') {
			role = 'switch';
		}
		return {
			path,
			type,
			// only official ioBroker roles; anything else falls back to a generic role of the type
			role,
			name: str(e.name) || path,
			description: str(e.description),
			unit: e.unit !== undefined && e.unit !== '' ? str(e.unit) : undefined,
			min: typeof e.min === 'number' ? e.min : undefined,
			max: typeof e.max === 'number' ? e.max : undefined,
			writable,
			pattern,
		};
	});
	const security = m.security && typeof m.security === 'object' ? (m.security as Record<string, unknown>) : {};
	const disabled = Array.isArray(security.disabled_commands) ? security.disabled_commands.map(str) : [];
	const commands: ManifestCommand[] = entries(m.commands).map(([name, e]) => ({
		name,
		params: entries(e.params).map(([pn, p]) => ({
			name: pn,
			type: str(p.type) || 'string',
			required: p.required === true,
			enum: Array.isArray(p.enum) ? p.enum.map(str) : undefined,
			default: p.default,
		})),
		// run/kill are only flagged because of AllowAnyRun; with alias-only run the agent itself limits them
		dangerous: e.dangerous === true && !(ALIAS_LIMITED.includes(name) && security.allow_any_run === false),
		needsGui: e.needs_gui === true || e.needsGui === true,
		description: str(e.description),
		primary: e.primary ? str(e.primary) : undefined,
		examples: Array.isArray(e.examples) ? e.examples.map(str) : [],
		disabled: disabled.includes(name),
	}));
	const events = Array.isArray(m.events) ? m.events.map(str).filter(Boolean) : entries(m.events).map(([n]) => n);
	return {
		hostname: str(m.hostname),
		ip: str(m.ip),
		version: str(m.version),
		os: str(m.os),
		user: str(m.user),
		deviceId: str(m.device_id),
		started: str(m.started),
		protocol: typeof m.protocol === 'number' ? m.protocol : 0,
		apps: Array.isArray(security.apps) ? security.apps.map(str) : [],
		allowAnyRun: security.allow_any_run === true,
		states,
		commands,
		events,
	};
}

/**
 * Role if the agent does not send one
 *
 * @param type common type
 * @param writable writable state
 */
function defaultRole(type: string, writable: boolean): string {
	if (type === 'boolean') {
		return writable ? 'switch' : 'indicator';
	}
	if (type === 'number') {
		return writable ? 'level' : 'value';
	}
	if (type === 'json' || type === 'array' || type === 'object') {
		return 'json';
	}
	return 'text';
}

/**
 * Manifest entry for a state path (exact or via template "disk/*")
 *
 * @param manifest manifest
 * @param path state path
 */
export function findStateDef(manifest: Manifest | undefined, path: string): ManifestState | undefined {
	if (!manifest) {
		return undefined;
	}
	return manifest.states.find(s => !s.pattern && s.path === path) || manifest.states.find(s => s.pattern?.test(path));
}

/**
 * common for a state (from the manifest, or derived from the first value)
 *
 * @param path state path
 * @param def manifest entry
 * @param value first value (for unknown states)
 */
export function stateCommon(
	path: string,
	def: ManifestState | undefined,
	value?: ioBroker.StateValue,
): ioBroker.StateCommon {
	if (def) {
		const common: ioBroker.StateCommon = {
			name: def.pattern ? path : def.name,
			type: def.type,
			role: def.role,
			read: true,
			write: def.writable,
		};
		if (def.unit) {
			common.unit = def.unit;
		}
		if (def.description) {
			common.desc = def.description;
		}
		if (def.min !== undefined) {
			common.min = def.min;
		}
		if (def.max !== undefined) {
			common.max = def.max;
		}
		return common;
	}
	const type: ioBroker.CommonType =
		typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
	return { name: path, type, role: defaultRole(type, false), read: true, write: false };
}

/**
 * Converts a value to the type of a command parameter
 *
 * @param value value
 * @param type parameter type from the manifest
 */
export function convertParam(value: unknown, type: string | undefined): unknown {
	switch (type) {
		case 'integer':
			return Math.round(Number(value));
		case 'number':
			return Number(value);
		case 'boolean':
			return typeof value === 'string' ? ['true', '1', 'on', 'yes'].includes(value.toLowerCase()) : !!value;
		case 'string':
			return text(value);
		default:
			return value;
	}
}

/**
 * Command and parameter for a write to a writable state
 *
 * @param manifest manifest
 * @param path state path
 * @param value new value
 * @returns command and parameters or null
 */
export function commandForStateWrite(
	manifest: Manifest | undefined,
	path: string,
	value: ioBroker.StateValue,
): { command: string; params: Record<string, unknown> } | null {
	const map = WRITABLE_COMMANDS[path];
	if (!map) {
		return null;
	}
	const cmd = manifest?.commands.find(c => c.name === map.command);
	const param = cmd?.primary || cmd?.params[0]?.name || map.param;
	const type = cmd?.params.find(p => p.name === param)?.type;
	return { command: map.command, params: { [param]: convertParam(value, type) } };
}

/**
 * Whether a command gets a data point, and which kind:
 * button (no parameters), json (parameters as JSON or short form) or none (dangerous → only via sendTo)
 *
 * @param cmd command
 */
export function commandKind(cmd: ManifestCommand): 'button' | 'json' | 'both' | 'none' {
	if (cmd.dangerous || cmd.disabled) {
		return 'none';
	}
	if (!cmd.params.length) {
		return 'button';
	}
	const primary = cmd.params.find(p => p.name === cmd.primary);
	// required option, or a main option without default (e.g. kill: which program?) → only the input
	if (cmd.params.some(p => p.required) || (primary && primary.default === undefined)) {
		return 'json';
	}
	// only optional options: a button with the defaults plus an input "<name>_json" for the options
	return 'both';
}

/** Suffix of the additional input data point of commands with kind "both" */
export const OPTIONS_SUFFIX = '_json';

/**
 * Data points of a command: id suffix and kind
 *
 * @param cmd command from the manifest
 */
export function commandDataPoints(cmd: ManifestCommand): { suffix: string; kind: 'button' | 'json' }[] {
	const kind = commandKind(cmd);
	if (kind === 'none') {
		return [];
	}
	if (kind === 'both') {
		return [
			{ suffix: '', kind: 'button' },
			{ suffix: OPTIONS_SUFFIX, kind: 'json' },
		];
	}
	return [{ suffix: '', kind }];
}

/**
 * Parameters written to a command data point: a JSON object, nothing ("" / true) for commands without
 * parameters, or a plain value for the command's "primary" parameter (short form, e.g. speak ← "Hallo")
 *
 * @param value state value
 * @param cmd command from the manifest (enables the short form)
 * @returns parameters or an error text
 */
export function parseCommandParams(
	value: ioBroker.StateValue,
	cmd?: ManifestCommand,
): Record<string, unknown> | string {
	if (value === null || value === undefined || value === '' || value === true) {
		return {};
	}
	if (typeof value === 'string') {
		try {
			const p: unknown = JSON.parse(value);
			if (p && typeof p === 'object' && !Array.isArray(p)) {
				return p as Record<string, unknown>;
			}
		} catch {
			// not JSON: maybe the short form
		}
	}
	if (cmd?.primary) {
		const type = cmd.params.find(p => p.name === cmd.primary)?.type;
		return { [cmd.primary]: convertParam(value, type) };
	}
	// "true" or "{}" = run with the default options
	if (value === 'true' || value === '{}') {
		return {};
	}
	return 'parameters must be a JSON object';
}

/** Parsed result message */
export interface ResultMessage {
	/** correlation id */
	id: string;
	/** command name */
	command: string;
	/** success */
	ok: boolean;
	/** result data */
	result?: unknown;
	/** error text */
	error?: string;
}

/**
 * Parses a result payload
 *
 * @param payload raw payload
 */
export function parseResult(payload: string): ResultMessage | null {
	try {
		const r = JSON.parse(payload) as Record<string, unknown>;
		if (!r || typeof r !== 'object') {
			return null;
		}
		const error = r.error === undefined || r.error === null ? undefined : text(r.error);
		return {
			id: text(r.id),
			command: text(r.cmd ?? r.command),
			ok: r.ok === undefined ? !error : r.ok === true,
			result: r.result !== undefined ? r.result : r.data,
			error,
		};
	} catch {
		return null;
	}
}

/**
 * Screenshot payload → image bytes and file extension
 *
 * @param payload raw payload
 * @returns image or null
 */
export function parseScreenshot(payload: Buffer): { data: Buffer; ext: string; id: string } | null {
	if (payload.length === 0) {
		return null;
	}
	let data = payload;
	let id = '';
	if (payload[0] === 0x7b) {
		// JSON with base64
		try {
			const j = JSON.parse(payload.toString('utf8')) as { id?: unknown; data?: unknown };
			if (typeof j.data !== 'string') {
				return null;
			}
			data = Buffer.from(j.data, 'base64');
			id = text(j.id);
		} catch {
			return null;
		}
	}
	if (data[0] === 0x89 && data[1] === 0x50) {
		return { data, ext: 'png', id };
	}
	if (data[0] === 0xff && data[1] === 0xd8) {
		return { data, ext: 'jpg', id };
	}
	return null;
}
