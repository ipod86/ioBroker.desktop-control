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

const MANIFEST = normalizeManifest({
	hostname: 'PC1',
	ip: '10.0.0.2',
	version: '1.0.0',
	os: 'Windows 11',
	user: 'david',
	states: {
		locked: { type: 'boolean', role: 'indicator', name: 'Locked' },
		volume: { type: 'number', role: 'level.volume', unit: '%', min: 0, max: 100, writable: true },
		'disk/*': { type: 'number', role: 'value', unit: '%', name: 'Disk' },
	},
	commands: {
		ping: {},
		volume: { params: { percent: { type: 'number', required: true } } },
		run: { params: { alias: { type: 'string', required: true }, wait: { type: 'boolean' } } },
		shell: { dangerous: true, params: { cmd: { type: 'string', required: true } } },
		ask: { needs_gui: true, params: [{ name: 'text', required: true }] },
	},
	events: ['lock', 'unlock'],
});

describe('parseTopic', () => {
	it('parses state, event and simple kinds', () => {
		expect(parseTopic('winctl', 'winctl/pc1/state/disk/C')).to.deep.equal({
			device: 'pc1',
			kind: 'state',
			path: 'disk/C',
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
		expect(pathToId('disk/C:')).to.equal('disk.C:');
		expect(pathToId('proc/chrome.exe')).to.equal('proc.chrome_exe');
		expect(pathToId('a b/c*d')).to.equal('a_b.c_d');
	});
});

describe('values', () => {
	it('parses JSON and typed values', () => {
		expect(parseValue('42', 'number')).to.equal(42);
		expect(parseValue('"x"')).to.equal('x');
		expect(parseValue('true', 'boolean')).to.equal(true);
		expect(parseValue('off', 'boolean')).to.equal(false);
		expect(parseValue('{"a":1}')).to.equal('{"a":1}');
		expect(parseValue('abc', 'number')).to.equal(null);
	});
	it('parses online payloads', () => {
		expect(parseOnline('true')).to.equal(true);
		expect(parseOnline('"online"')).to.equal(true);
		expect(parseOnline('offline')).to.equal(false);
		expect(parseOnline('0')).to.equal(false);
	});
});

describe('manifest', () => {
	it('normalises states, templates, commands and events', () => {
		expect(MANIFEST.hostname).to.equal('PC1');
		expect(MANIFEST.states.find(s => s.path === 'disk')?.template).to.equal(true);
		expect(MANIFEST.commands.map(c => c.name)).to.deep.equal(['ping', 'volume', 'run', 'shell', 'ask']);
		expect(MANIFEST.commands.find(c => c.name === 'ask')?.needsGui).to.equal(true);
		expect(MANIFEST.events).to.deep.equal(['lock', 'unlock']);
	});
	it('builds state common from the manifest, templates and unknown values', () => {
		const vol = stateCommon('volume', findStateDef(MANIFEST, 'volume'));
		expect(vol).to.include({ type: 'number', role: 'level.volume', unit: '%', write: true, min: 0, max: 100 });
		const disk = stateCommon('disk/C', findStateDef(MANIFEST, 'disk/C'));
		expect(disk).to.include({ name: 'Disk C', unit: '%', write: false });
		expect(stateCommon('proc/x', undefined, true)).to.include({ type: 'boolean', role: 'indicator' });
	});
	it('creates buttons for commands without required parameters, json otherwise, nothing for dangerous ones', () => {
		const kind = (n: string): string => commandKind(MANIFEST.commands.find(c => c.name === n)!);
		expect(kind('ping')).to.equal('button');
		expect(kind('run')).to.equal('json');
		expect(kind('shell')).to.equal('none');
	});
	it('maps writable states to commands with the manifest parameter name', () => {
		expect(commandForStateWrite(MANIFEST, 'volume', 30)).to.deep.equal({
			command: 'volume',
			params: { percent: 30 },
		});
		expect(commandForStateWrite(MANIFEST, 'muted', true)).to.deep.equal({
			command: 'mute',
			params: { mute: true },
		});
		expect(commandForStateWrite(MANIFEST, 'locked', true)).to.equal(null);
	});
});

describe('commands and results', () => {
	it('parses command parameters', () => {
		expect(parseCommandParams(true)).to.deep.equal({});
		expect(parseCommandParams('{"alias":"notepad"}')).to.deep.equal({ alias: 'notepad' });
		expect(parseCommandParams('[1]')).to.be.a('string');
		expect(parseCommandParams('nope')).to.be.a('string');
	});
	it('parses results', () => {
		expect(parseResult('{"id":"a","command":"ping","ok":true,"result":"pong"}')).to.deep.equal({
			id: 'a',
			command: 'ping',
			ok: true,
			result: 'pong',
			error: undefined,
		});
		expect(parseResult('{"id":"b","error":"denied"}')?.ok).to.equal(false);
		expect(parseResult('x')).to.equal(null);
	});
	it('detects screenshot formats', () => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]);
		expect(parseScreenshot(png)?.ext).to.equal('png');
		const json = Buffer.from(JSON.stringify({ id: 'x', data: Buffer.from([0xff, 0xd8, 1]).toString('base64') }));
		expect(parseScreenshot(json)).to.include({ ext: 'jpg', id: 'x' });
		expect(parseScreenshot(Buffer.from('hello'))).to.equal(null);
	});
});
