'use strict';

/*
 * Writes the command and state reference of docs/protocol.json (from the WinCtl agent) into
 * README.md and README.de.md, between the markers <!-- generated:start --> and <!-- generated:end -->.
 *
 * node tools/gen-readme.js
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const proto = require('../docs/protocol.json');

const T = {
	en: {
		cats: {
			system: 'System',
			power: 'Power & session',
			programs: 'Programs & windows',
			audio: 'Audio',
			display: 'Display',
			input: 'Input',
		},
		note: 'Generated from the agent (`docs/protocol.json`, agent version {v}); the descriptions come from the agent.',
		dp: 'Data point',
		button: 'button – click to run',
		both: 'button (runs with the defaults) + input `cmd.{n}_json` for the options',
		input: 'input – JSON, short form or `true` (= default options)',
		sendto: 'no data point (security relevant) – only via `sendTo`',
		runNote: ' (data point only while the agent only starts programs from its alias list)',
		short: 'Short form',
		examples: 'Examples',
		options: 'Options',
		opt: ['Option', 'Type', 'Default', 'Description'],
		required: 'required',
		states: 'States (`<pc>.state.*`)',
		stCols: ['Data point', 'Type', 'Unit', 'Writable', 'Description'],
		yes: 'yes',
	},
	de: {
		cats: {
			system: 'System',
			power: 'Energie & Sitzung',
			programs: 'Programme & Fenster',
			audio: 'Audio',
			display: 'Anzeige',
			input: 'Eingabe',
		},
		note: 'Erzeugt aus dem Agent (`docs/protocol.json`, Agent-Version {v}).',
		dp: 'Datenpunkt',
		button: 'Knopf – Klick führt aus',
		both: 'Knopf (führt mit Standardwerten aus) + Eingabe `cmd.{n}_json` für die Optionen',
		input: 'Eingabe – JSON, Kurzform oder `true` (= Standardwerte)',
		sendto: 'kein Datenpunkt (sicherheitsrelevant) – nur per `sendTo`',
		runNote: ' (Datenpunkt nur, solange der Agent nur Programme aus seiner Alias-Liste startet)',
		short: 'Kurzform',
		examples: 'Beispiele',
		options: 'Optionen',
		opt: ['Option', 'Typ', 'Standard', 'Beschreibung'],
		required: 'Pflicht',
		states: 'States (`<PC>.state.*`)',
		stCols: ['Datenpunkt', 'Typ', 'Einheit', 'Schreibbar', 'Beschreibung'],
		yes: 'ja',
	},
};

const WRITABLE = ['volume', 'muted', 'keep_awake'];

/**
 * Data point kind like in src/lib/protocol.ts (commandKind)
 *
 * @param {{name: string, dangerous?: boolean, primary?: string, params: {name: string, required: boolean, default?: unknown}[]}} c command
 * @returns {'none'|'button'|'json'|'both'|'alias'} kind
 */
function kindOf(c) {
	if (ALIAS_LIMITED.includes(c.name)) {
		return 'alias';
	}
	if (c.dangerous) {
		return 'none';
	}
	if (!c.params.length) {
		return 'button';
	}
	const primary = c.params.find(p => p.name === c.primary);
	if (c.params.some(p => p.required) || (primary && primary.default === undefined)) {
		return 'json';
	}
	return 'both';
}

const ALIAS_LIMITED = ['run', 'kill'];

/**
 * Markdown for one language
 *
 * @param {'en'|'de'} lang language
 */
function render(lang) {
	return lang === 'en' ? renderEn() : renderDe();
}

/** README.md: compact English tables, the full reference with examples is in README.de.md / docs/COMMANDS.md */
function renderEn() {
	const t = T.en;
	const out = [
		`_Generated from the agent (agent version ${proto.version}). Examples and all option descriptions: [German reference](README.de.md#befehle-pccmd) and [docs/COMMANDS.md](docs/COMMANDS.md); the object description of each command data point lists its options and an example._`,
		'',
	];
	const cats = {};
	for (const c of proto.commands) {
		(cats[c.category] = cats[c.category] || []).push(c);
	}
	for (const [cat, title] of Object.entries(t.cats)) {
		if (!cats[cat]) {
			continue;
		}
		out.push(
			`#### ${title}`,
			'',
			'| Command | Description | Data point | Short form | Options |',
			'|---|---|---|---|---|',
		);
		for (const c of cats[cat]) {
			const kind = {
				none: 'only `sendTo`',
				alias: 'input (alias list only)',
				json: 'input',
				button: 'button',
				both: `button + \`${c.name}_json\``,
			}[kindOf(c)];
			const opts = c.params
				.map(p => `\`${p.name}\`${p.required ? '*' : ''}${p.enum ? ` (${p.enum.join('/')})` : ''}`)
				.join(', ');
			out.push(
				`| \`${c.name}\` | ${c.description} | ${kind} | ${c.primary ? `\`${c.primary}\`` : ''} | ${opts} |`,
			);
		}
		out.push('');
	}
	out.push(
		'\\* = required',
		'',
		`### ${t.states}`,
		'',
		'| Data point | Type | Unit | Writable | Description |',
		'|---|---|---|---|---|',
	);
	for (const st of proto.states) {
		out.push(
			`| \`state.${st.name.replace(/\//g, '.')}\` | ${st.type} | ${st.unit || ''} | ${WRITABLE.includes(st.name) ? 'yes' : ''} | ${st.description} |`,
		);
	}
	return out.join('\n');
}

/** README.de.md: full reference with examples and option descriptions */
function renderDe() {
	const lang = 'de';
	const t = T[lang];
	const out = [`_${t.note.replace('{v}', proto.version)}_`, ''];
	const cats = {};
	for (const c of proto.commands) {
		(cats[c.category] = cats[c.category] || []).push(c);
	}
	for (const [cat, title] of Object.entries(t.cats)) {
		if (!cats[cat]) {
			continue;
		}
		out.push(`#### ${title}`, '');
		for (const c of cats[cat]) {
			const k = kindOf(c);
			const kind =
				k === 'none'
					? t.sendto
					: k === 'button'
						? t.button
						: k === 'both'
							? t.both.replace('{n}', c.name)
							: t.input;
			const extra = ALIAS_LIMITED.includes(c.name) ? t.runNote : '';
			out.push(
				'<details>',
				`<summary><code>${c.name}</code> – ${c.description_de || c.description}</summary>`,
				'',
			);
			out.push(`${t.dp}: \`cmd.${c.name}\` – ${kind}${extra}  `);
			if (c.primary) {
				out.push(`${t.short}: \`${c.primary}\``);
			}
			const ex = (c.examples || []).filter(e => e !== 'true');
			if (ex.length) {
				out.push('', `${t.examples}:`, '', '```', ...ex, '```');
			}
			if (c.params.length) {
				out.push('', `| ${t.opt.join(' | ')} |`, '|---|---|---|---|');
				for (const p of c.params) {
					const def =
						p.default !== undefined ? `\`${JSON.stringify(p.default)}\`` : p.required ? t.required : '';
					const choices = p.enum ? ` (${p.enum.map(e => `\`${e}\``).join(', ')})` : '';
					out.push(`| \`${p.name}\` | ${p.type} | ${def} | ${p.description}${choices} |`);
				}
			}
			out.push('', '</details>', '');
		}
	}
	out.push(`### ${t.states}`, '', `| ${t.stCols.join(' | ')} |`, '|---|---|---|---|---|');
	for (const s of proto.states) {
		const id = s.name.replace(/\//g, '.');
		out.push(
			`| \`state.${id}\` | ${s.type} | ${s.unit || ''} | ${WRITABLE.includes(s.name) ? t.yes : ''} | ${s.description_de || s.description} |`,
		);
	}
	return out.join('\n');
}

for (const [file, lang] of [
	['README.md', 'en'],
	['README.de.md', 'de'],
]) {
	const p = path.join(root, file);
	const text = fs.readFileSync(p, 'utf8');
	const re = /(<!-- generated:start -->\n)[\s\S]*?(<!-- generated:end -->)/;
	if (!re.test(text)) {
		throw new Error(`${file}: markers <!-- generated:start --> / <!-- generated:end --> missing`);
	}
	fs.writeFileSync(p, text.replace(re, `$1${render(lang)}\n$2`));
	console.log(`${file} updated`);
}
