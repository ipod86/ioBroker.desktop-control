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
		note: 'Generated from the agent (`docs/protocol.json`, agent version {v}); the descriptions come from the agent and are German.',
		dp: 'Data point',
		button: 'button – click to run',
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

/** English descriptions (the agent only has German ones; README.md must be English) */
const EN_CMD = {
	ping: 'Sign of life, answers with time and agent version',
	get_state: 'Publishes all state values again',
	reload_config: 'Reloads the agent config and reconnects',
	exit: 'Stops the agent',
	list_commands: 'Returns the list of all commands',
	lock: 'Locks the screen (Win+L)',
	sleep: 'Standby',
	hibernate: 'Hibernate',
	shutdown: 'Shuts the PC down',
	restart: 'Restarts the PC',
	logoff: 'Logs the user off',
	cancel_shutdown: 'Cancels a planned shutdown/restart',
	monitor_off: 'Turns the monitors off',
	monitor_on: 'Wakes the monitors up',
	keep_awake: 'Prevents standby and screen saver',
	run: 'Starts a program (alias from the agent settings)',
	open: 'Opens a URL, file or folder with the default app',
	kill: 'Ends processes by name or PID',
	list_processes: 'Lists running processes',
	list_windows: 'Lists visible windows',
	focus_window: 'Brings a window to the front (title contains …)',
	close_window: 'Closes a window (title contains …)',
	minimize_all: 'Minimizes all windows (show desktop) or restores them',
	empty_recycle_bin: 'Empties the recycle bin',
	shell: 'Runs a PowerShell/cmd command and returns the output',
	volume: 'Sets the master volume (0-100)',
	volume_change: 'Changes the volume relatively',
	mute: 'Mute / unmute / toggle',
	media: 'Sends a media key',
	speak: 'Text to speech',
	list_voices: 'Lists the installed voices',
	play_sound: 'Plays an audio file (mp3/wav/wma, path or URL)',
	stop_sound: 'Stops play_sound / speak',
	beep: 'Simple beep',
	show_image: 'Shows an image as popup, full screen or in a corner',
	show_video: 'Plays a video (mp4/H.264)',
	show_web: 'Shows a web page (dashboard, camera stream) in a window or full screen',
	show_text: 'Shows text as an overlay',
	ask: 'Shows a dialog with buttons/input and returns the answer',
	notify: 'Shows a Windows notification',
	close_popups: 'Closes all popups, overlays and dialogs',
	screenshot: 'Takes a screenshot (stored in the ioBroker file storage)',
	set_wallpaper: 'Sets the desktop wallpaper',
	brightness: 'Sets the brightness (internal laptop displays only)',
	send_keys: 'Sends key presses (SendKeys syntax)',
	type_text: 'Types text into the active window',
	mouse: 'Moves/clicks the mouse',
	clipboard_set: 'Sets the clipboard text',
	clipboard_get: 'Reads the clipboard text',
};
const EN_STATE = {
	locked: 'Screen locked',
	user_present: 'User active (not locked and input within the idle threshold)',
	idle: 'Seconds since the last mouse/keyboard input',
	active_window: 'Title of the active window',
	active_process: 'Process of the active window',
	volume: 'Master volume',
	muted: 'Muted',
	cpu: 'CPU load',
	ram: 'RAM usage',
	ram_free_gb: 'Free memory',
	uptime_min: 'Time since Windows start',
	battery: 'Battery level (devices with battery only)',
	charging: 'Power supply connected (devices with battery only)',
	monitors: 'Number of monitors',
	ip: 'Local IPv4 address',
	user: 'Logged-in user',
	keep_awake: 'keep_awake active',
	'disk/<laufwerk>_free_gb': 'Free space per drive, e.g. `disk.C_free_gb`',
	'disk/<laufwerk>_used_percent': 'Usage per drive, e.g. `disk.C_used_percent`',
	'proc/<name>': 'Watched program is running (agent settings "Processes")',
};
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
			const kind =
				c.dangerous && !ALIAS_LIMITED.includes(c.name)
					? 'only `sendTo`'
					: ALIAS_LIMITED.includes(c.name)
						? 'input (alias list only)'
						: c.params.length
							? 'input'
							: 'button';
			const opts = c.params
				.map(p => `\`${p.name}\`${p.required ? '*' : ''}${p.enum ? ` (${p.enum.join('/')})` : ''}`)
				.join(', ');
			out.push(
				`| \`${c.name}\` | ${EN_CMD[c.name] || ''} | ${kind} | ${c.primary ? `\`${c.primary}\`` : ''} | ${opts} |`,
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
			`| \`state.${st.name.replace(/\//g, '.')}\` | ${st.type} | ${st.unit || ''} | ${WRITABLE.includes(st.name) ? 'yes' : ''} | ${EN_STATE[st.name] || ''} |`,
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
			const kind =
				c.dangerous && !ALIAS_LIMITED.includes(c.name) ? t.sendto : c.params.length ? t.input : t.button;
			const extra = ALIAS_LIMITED.includes(c.name) ? t.runNote : '';
			out.push('<details>', `<summary><code>${c.name}</code> – ${c.description}</summary>`, '');
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
			`| \`state.${id}\` | ${s.type} | ${s.unit || ''} | ${WRITABLE.includes(s.name) ? t.yes : ''} | ${s.description} |`,
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
