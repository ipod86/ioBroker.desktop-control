import { expect } from 'chai';
import {
	commandForStateWrite,
	commandKind,
	findStateDef,
	normalizeManifest,
	parseCommandParams,
	parseOnline,
	parseResult,
	parseScreenshot,
	parseTopic,
	parseValue,
	pathToId,
	stateCommon,
} from './protocol';

// shaped like the real agent manifest (docs/PROTOCOL.md): arrays, primary, dynamic state patterns
const MANIFEST = normalizeManifest({
	protocol: 1,
	device_id: 'pc1',
	hostname: 'PC1',
	ip: '10.0.0.2',
	version: '0.1.0',
	os: 'Windows 11',
	user: 'david',
	started: '2026-10-23T08:00:00Z',
	security: { apps: ['notepad'], disabled_commands: ['beep'] },
	states: [
		{ name: 'locked', type: 'boolean', role: 'indicator', unit: '', description: 'Locked' },
		{ name: 'volume', type: 'number', role: 'level.volume', unit: '%' },
		{ name: 'keep_awake', type: 'boolean', role: 'indicator', unit: '' },
		{ name: 'disk/<laufwerk>_free_gb', type: 'number', role: 'value', unit: 'GB', description: 'Free space' },
	],
	commands: [
		{ name: 'ping', params: [] },
		{ name: 'volume', primary: 'level', params: [{ name: 'level', type: 'integer', required: true }] },
		{ name: 'mute', primary: 'state', params: [{ name: 'state', type: 'string', required: false }] },
		{ name: 'speak', primary: 'text', params: [{ name: 'text', type: 'string', required: true }] },
		{ name: 'shell', dangerous: true, params: [{ name: 'cmd', type: 'string', required: true }] },
		{ name: 'beep', params: [] },
		{ name: 'ask', needs_gui: true, primary: 'text', params: [{ name: 'text', required: true }] },
	],
	events: ['lock', 'unlock'],
});

const cmd = (name: string): NonNullable<ReturnType<typeof MANIFEST.commands.find>> =>
	MANIFEST.commands.find(c => c.name === name)!;

describe('parseTopic', () => {
	it('parses state, event and simple kinds', () => {
		expect(parseTopic('winctl', 'winctl/pc1/state/disk/C_free_gb')).to.deep.equal({
			device: 'pc1',
			kind: 'state',
			path: 'disk/C_free_gb',
		});
		expect(parseTopic('winctl', 'winctl/pc1/event/lock')).to.deep.equal({
			device: 'pc1',
			kind: 'event',
			path: 'lock',
		});
		expect(parseTopic('winctl', 'winctl/pc1/online')).to.deep.equal({ device: 'pc1', kind: 'online', path: '' });
		expect(parseTopic('winctl', 'winctl/pc1/result')?.kind).to.equal('result');
	});
	it('ignores foreign, broadcast, command and malformed topics', () => {
		expect(parseTopic('winctl', 'other/pc1/online')).to.equal(null);
		expect(parseTopic('winctl', 'winctl/all/cmd/ping')).to.equal(null);
		expect(parseTopic('winctl', 'winctl/pc1/cmd/ping')).to.equal(null);
		expect(parseTopic('winctl', 'winctl/pc1/state')).to.equal(null);
		expect(parseTopic('winctl', 'winctl/pc1/online/x')).to.equal(null);
	});
});

describe('id mapping', () => {
	it('turns "/" into levels and removes forbidden characters and dots', () => {
		expect(pathToId('disk/C_free_gb')).to.equal('disk.C_free_gb');
		expect(pathToId('proc/chrome.exe')).to.equal('proc.chrome_exe');
		expect(pathToId('a b/c*d')).to.equal('a_b.c_d');
	});
});

describe('values', () => {
	it('parses plain text and typed values', () => {
		expect(parseValue('42', 'number')).to.equal(42);
		expect(parseValue('notepad.exe', 'string')).to.equal('notepad.exe');
		expect(parseValue('true', 'boolean')).to.equal(true);
		expect(parseValue('false', 'boolean')).to.equal(false);
		expect(parseValue('{"a":1}')).to.equal('{"a":1}');
		expect(parseValue('abc', 'number')).to.equal(null);
	});
	it('parses online payloads', () => {
		expect(parseOnline('true')).to.equal(true);
		expect(parseOnline('"online"')).to.equal(true);
		expect(parseOnline('false')).to.equal(false);
		expect(parseOnline('0')).to.equal(false);
	});
});

describe('manifest', () => {
	it('normalises the agent manifest', () => {
		expect(MANIFEST).to.include({ hostname: 'PC1', deviceId: 'pc1', protocol: 1, started: '2026-10-23T08:00:00Z' });
		expect(MANIFEST.apps).to.deep.equal(['notepad']);
		const disk = MANIFEST.states.find(s => s.path === 'disk/<laufwerk>_free_gb');
		expect(disk?.pattern?.test('disk/C_free_gb')).to.equal(true);
		expect(disk?.pattern?.test('disk/C_used_percent')).to.equal(false);
		expect(cmd('volume').primary).to.equal('level');
		expect(cmd('beep').disabled).to.equal(true);
		expect(cmd('ask').needsGui).to.equal(true);
		expect(MANIFEST.events).to.deep.equal(['lock', 'unlock']);
	});
	it('builds state common from the manifest, dynamic states and unknown values', () => {
		const vol = stateCommon('volume', findStateDef(MANIFEST, 'volume'));
		expect(vol).to.include({ type: 'number', role: 'level.volume', unit: '%', write: true });
		// writable boolean with a read-only role becomes a switch
		expect(stateCommon('keep_awake', findStateDef(MANIFEST, 'keep_awake'))).to.include({
			role: 'switch',
			write: true,
		});
		const disk = stateCommon('disk/C_free_gb', findStateDef(MANIFEST, 'disk/C_free_gb'));
		expect(disk).to.include({ name: 'disk/C_free_gb', unit: 'GB', write: false, desc: 'Free space' });
		expect(stateCommon('locked', findStateDef(MANIFEST, 'locked'))).to.not.have.property('unit');
		expect(stateCommon('proc/x', undefined, true)).to.include({ type: 'boolean', role: 'indicator' });
	});
	it('gives run and kill a data point only while the agent is limited to aliases', () => {
		const commands = [
			{ name: 'run', dangerous: true, primary: 'path', params: [{ name: 'path', required: true }] },
			{ name: 'kill', dangerous: true, primary: 'name', params: [{ name: 'name' }] },
			{ name: 'shell', dangerous: true, params: [{ name: 'command', required: true }] },
		];
		const limited = normalizeManifest({ security: { allow_any_run: false }, commands });
		expect(limited.commands.map(c => commandKind(c))).to.deep.equal(['json', 'button', 'none']);
		const open = normalizeManifest({ security: { allow_any_run: true }, commands });
		expect(open.commands.map(c => commandKind(c))).to.deep.equal(['none', 'none', 'none']);
		// unknown (older agent): stays dangerous
		expect(commandKind(normalizeManifest({ commands }).commands[0])).to.equal('none');
	});
	it('accepts only official roles', () => {
		const odd = normalizeManifest({ states: [{ name: 'cpu', type: 'number', role: 'value.cpu.custom' }] });
		expect(odd.states[0].role).to.equal('value');
	});
	it('creates buttons, json data points, and nothing for dangerous or disabled commands', () => {
		expect(commandKind(cmd('ping'))).to.equal('button');
		expect(commandKind(cmd('speak'))).to.equal('json');
		expect(commandKind(cmd('shell'))).to.equal('none');
		expect(commandKind(cmd('beep'))).to.equal('none');
	});
	it('maps writable states to commands with the primary parameter and its type', () => {
		expect(commandForStateWrite(MANIFEST, 'volume', 30.4)).to.deep.equal({
			command: 'volume',
			params: { level: 30 },
		});
		expect(commandForStateWrite(MANIFEST, 'muted', true)).to.deep.equal({
			command: 'mute',
			params: { state: 'true' },
		});
		expect(commandForStateWrite(MANIFEST, 'locked', true)).to.equal(null);
	});
});

describe('commands and results', () => {
	it('parses command parameters including the short form', () => {
		expect(parseCommandParams(true)).to.deep.equal({});
		expect(parseCommandParams('{"alias":"notepad"}')).to.deep.equal({ alias: 'notepad' });
		expect(parseCommandParams('[1]')).to.be.a('string');
		expect(parseCommandParams('nope')).to.be.a('string');
		expect(parseCommandParams('Hallo Welt', cmd('speak'))).to.deep.equal({ text: 'Hallo Welt' });
		expect(parseCommandParams('{"text":"x"}', cmd('speak'))).to.deep.equal({ text: 'x' });
		expect(parseCommandParams(35, cmd('volume'))).to.deep.equal({ level: 35 });
	});
	it('parses results of the agent ("cmd", "data")', () => {
		expect(parseResult('{"id":"c","cmd":"volume","ok":true,"data":{"level":30},"ts":"x"}')).to.deep.equal({
			id: 'c',
			command: 'volume',
			ok: true,
			result: { level: 30 },
			error: undefined,
		});
		expect(parseResult('{"id":null,"cmd":"run","ok":false,"error":"denied"}')).to.include({
			ok: false,
			error: 'denied',
			id: '',
		});
		expect(parseResult('x')).to.equal(null);
	});
	it('detects screenshot formats', () => {
		expect(parseScreenshot(Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]))?.ext).to.equal('png');
		expect(parseScreenshot(Buffer.from([0xff, 0xd8, 0xff, 1]))?.ext).to.equal('jpg');
		expect(parseScreenshot(Buffer.from('hello'))).to.equal(null);
	});
});
