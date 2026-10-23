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
	/** state path (template without "/*") */
	path: string;
	/** ioBroker type */
	type: ioBroker.CommonType;
	/** ioBroker role */
	role: string;
	/** display name */
	name: string;
	/** unit */
	unit?: string;
	/** minimum */
	min?: number;
	/** maximum */
	max?: number;
	/** can be changed from ioBroker */
	writable: boolean;
	/** template for dynamic states ("disk/*") */
	template: boolean;
}

/** One command parameter */
export interface ManifestParam {
	/** display name */
	name: string;
	/** ioBroker type */
	type: string;
	/** must be given */
	required: boolean;
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

const TYPES = ['number', 'string', 'boolean', 'json', 'array', 'object', 'mixed'];

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
		const template = path.endsWith('/*');
		// structured values are stored as JSON text
		const type = (['json', 'array', 'object'].includes(raw) ? 'string' : raw) as ioBroker.CommonType;
		return {
			path: template ? path.slice(0, -2) : path,
			type,
			// only official ioBroker roles; anything else falls back to a generic role of the type
			role: OFFICIAL_ROLES.has(str(e.role)) ? str(e.role) : defaultRole(raw, !!e.writable),
			name: str(e.name) || path,
			unit: e.unit !== undefined ? str(e.unit) : undefined,
			min: typeof e.min === 'number' ? e.min : undefined,
			max: typeof e.max === 'number' ? e.max : undefined,
			writable: e.writable === true,
			template,
		};
	});
	const commands: ManifestCommand[] = entries(m.commands).map(([name, e]) => ({
		name,
		params: entries(e.params).map(([pn, p]) => ({
			name: pn,
			type: str(p.type) || 'string',
			required: p.required === true,
		})),
		dangerous: e.dangerous === true,
		needsGui: e.needs_gui === true || e.needsGui === true,
		description: str(e.description),
	}));
	const events = Array.isArray(m.events) ? m.events.map(str).filter(Boolean) : entries(m.events).map(([n]) => n);
	return {
		hostname: str(m.hostname),
		ip: str(m.ip),
		version: str(m.version),
		os: str(m.os),
		user: str(m.user),
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
	return (
		manifest.states.find(s => !s.template && s.path === path) ||
		manifest.states.find(s => s.template && path.startsWith(`${s.path}/`))
	);
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
			name: def.template ? `${def.name} ${path.slice(def.path.length + 1)}` : def.name,
			type: def.type,
			role: def.role,
			read: true,
			write: def.writable,
		};
		if (def.unit) {
			common.unit = def.unit;
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

/** commands a writable state triggers, with the default parameter */
export const WRITABLE_COMMANDS: Record<string, { command: string; param: string }> = {
	volume: { command: 'volume', param: 'level' },
	muted: { command: 'mute', param: 'mute' },
	keep_awake: { command: 'keep_awake', param: 'enable' },
};

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
	const param = cmd?.params[0]?.name || map.param;
	return { command: map.command, params: { [param]: value } };
}

/**
 * Whether a command gets a data point, and which kind:
 * button (no required parameter), json (parameters as JSON) or none (dangerous → only via sendTo)
 *
 * @param cmd command
 */
export function commandKind(cmd: ManifestCommand): 'button' | 'json' | 'none' {
	if (cmd.dangerous) {
		return 'none';
	}
	return cmd.params.some(p => p.required) ? 'json' : 'button';
}

/**
 * Parameters written to a command data point (JSON object, or "" / true for none)
 *
 * @param value state value
 * @returns parameters or an error text
 */
export function parseCommandParams(value: ioBroker.StateValue): Record<string, unknown> | string {
	if (value === null || value === undefined || value === '' || value === true) {
		return {};
	}
	if (typeof value !== 'string') {
		return 'parameters must be a JSON object';
	}
	try {
		const p: unknown = JSON.parse(value);
		if (p && typeof p === 'object' && !Array.isArray(p)) {
			return p as Record<string, unknown>;
		}
	} catch {
		// fall through
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
			command: text(r.command),
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
