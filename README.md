![Logo](admin/desktop-control.png)
# ioBroker.desktop-control

[![NPM version](https://img.shields.io/npm/v/iobroker.desktop-control.svg)](https://www.npmjs.com/package/iobroker.desktop-control)
[![Downloads](https://img.shields.io/npm/dm/iobroker.desktop-control.svg)](https://www.npmjs.com/package/iobroker.desktop-control)
![Number of Installations](https://iobroker.live/badges/desktop-control-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/desktop-control-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.desktop-control.png?downloads=true)](https://nodei.co/npm/iobroker.desktop-control/)

**Tests:** ![Test and Release](https://github.com/ipod86/ioBroker.desktop-control/workflows/Test%20and%20Release/badge.svg)

## desktop-control adapter for ioBroker

Controls Windows PCs from ioBroker: popups, programs, audio, text-to-speech, screenshots, power, keyboard/mouse and more. On each PC runs the small **WinCtl** agent (a single exe, no installer); adapter and agent talk via **MQTT**.

The agent describes itself: it publishes all its commands, parameters and states as a manifest, and the adapter creates the data points from it. New agent commands therefore appear without an adapter update.

## Requirements

- The WinCtl agent on every PC to control: download `WinCtl.exe` from [the releases](https://github.com/ipod86/WinCtl/releases)
- Nothing else: the adapter has a built-in MQTT broker. An existing broker (Mosquitto, ioBroker MQTT adapter) can be used instead.

## Setup

1. Adapter settings: keep "Built-in broker" (port 1886 by default). Optionally set a user name and password – the agents then have to use them.
2. Start `WinCtl.exe` on the PC. In its settings enter the **IP address of the ioBroker server**, the port (1886) and the login.
3. Each PC appears as a device as soon as it connects.

With an existing broker select "Existing broker" in the adapter and enter the same broker in adapter and agents.

## Data points

### Overview

| Data point | Description |
|---|---|
| `info.connection` | Adapter connected to the MQTT broker |
| `<pc>.online` | Agent of this PC connected |
| `<pc>.lastSeen` | Time of the last message from the agent |
| `<pc>.info.*` | Information about the PC (see below) |
| `<pc>.state.*` | Values reported by the agent (see [States](#states-pcstate)) |
| `<pc>.event.*` | Events of the PC (see below) |
| `<pc>.cmd.*` | One data point per command (see [Commands](#commands-pccmd)) |
| `<pc>.cmd.result` | Result of the last command, e.g. the answer of `ask` |
| `<pc>.screenshot` | Path of the last screenshot in the ioBroker file storage, e.g. `/desktop-control.0/screenshots/<pc>.jpg` |
| `all.cmd.*` | Sends a command to all PCs at once |

### Info (`<pc>.info.*`)

| Data point | Description |
|---|---|
| `hostname` | Computer name |
| `ip` | IP address |
| `version` | Version of the agent |
| `os` | Windows version |
| `user` | Logged-in user |
| `started` | Start time of the agent |
| `apps` | Program aliases the agent may start (JSON list) |

### Events (`<pc>.event.*`)

Written on every event (also when the content is the same), so a trigger with `change: 'any'` fires every time. The value is JSON, e.g. `{"ts":"2026-10-23T12:00:00Z"}`.

| Data point | When |
|---|---|
| `lock` / `unlock` | Screen locked / unlocked |
| `logon` / `logoff` | User logged on / off |
| `remote_connect` / `remote_disconnect` | Remote desktop session connected / disconnected |
| `suspend` / `resume` | PC goes to standby / wakes up |
| `hotkey` | A hotkey from the agent settings was pressed: `{"name":"szene_kino","keys":"ctrl+alt+1"}` |

### Commands (`<pc>.cmd.*`)

- **Button:** commands without options – click to run.
- **Input:** commands with options. Write one of:
  - the **short form**: just the value of the main option, e.g. `Hello` into `cmd.speak`
  - **JSON** with any options, e.g. `{"text":"Hello","rate":2}`
  - `true` – runs the command with its default options
- The object description of every command data point lists its options and an example.
- The result appears in `<pc>.cmd.result`.
- Security relevant commands (e.g. `shell`, `shutdown`) and commands switched off in the agent get no data point; they can only be sent via `sendTo`. `run` and `kill` get a data point as long as the agent only starts programs from its alias list ("allow any program" off); `cmd.run` offers the aliases as a selection.

<!-- generated:start -->
_Generated from the agent (agent version 0.2.0). Examples and all option descriptions: [German reference](README.de.md#befehle-pccmd) and [docs/COMMANDS.md](docs/COMMANDS.md); the object description of each command data point lists its options and an example._

#### System

| Command | Description | Data point | Short form | Options |
|---|---|---|---|---|
| `ping` | Sign of life, answers with time and agent version | button |  |  |
| `get_state` | Publishes all state values again | button |  |  |
| `reload_config` | Reloads the agent config and reconnects | button |  |  |
| `exit` | Stops the agent | only `sendTo` |  |  |
| `list_commands` | Returns the list of all commands | button |  |  |

#### Power & session

| Command | Description | Data point | Short form | Options |
|---|---|---|---|---|
| `lock` | Locks the screen (Win+L) | button |  |  |
| `sleep` | Standby | button |  |  |
| `hibernate` | Hibernate | button |  |  |
| `shutdown` | Shuts the PC down | only `sendTo` | `delay` | `delay`, `force` |
| `restart` | Restarts the PC | only `sendTo` | `delay` | `delay`, `force` |
| `logoff` | Logs the user off | only `sendTo` |  |  |
| `cancel_shutdown` | Cancels a planned shutdown/restart | button |  |  |
| `monitor_off` | Turns the monitors off | button |  |  |
| `monitor_on` | Wakes the monitors up | button |  |  |
| `keep_awake` | Prevents standby and screen saver | input | `state` | `state`, `display` |

#### Programs & windows

| Command | Description | Data point | Short form | Options |
|---|---|---|---|---|
| `run` | Starts a program (alias from the agent settings) | input (alias list only) | `path` | `path`*, `args`, `workdir`, `hidden`, `window` (normal/minimized/maximized), `admin`, `wait`, `timeout` |
| `open` | Opens a URL, file or folder with the default app | input | `target` | `target`* |
| `kill` | Ends processes by name or PID | input (alias list only) | `name` | `name`, `pid` |
| `list_processes` | Lists running processes | input | `filter` | `filter` |
| `list_windows` | Lists visible windows | button |  |  |
| `focus_window` | Brings a window to the front (title contains …) | input | `title` | `title`* |
| `close_window` | Closes a window (title contains …) | input | `title` | `title`* |
| `minimize_all` | Minimizes all windows (show desktop) or restores them | input |  | `undo` |
| `empty_recycle_bin` | Empties the recycle bin | button |  |  |
| `shell` | Runs a PowerShell/cmd command and returns the output | only `sendTo` | `command` | `command`*, `shell` (powershell/cmd), `timeout` |

#### Audio

| Command | Description | Data point | Short form | Options |
|---|---|---|---|---|
| `volume` | Sets the master volume (0-100) | input | `level` | `level`* |
| `volume_change` | Changes the volume relatively | input | `delta` | `delta` |
| `mute` | Mute / unmute / toggle | input | `state` | `state` |
| `media` | Sends a media key | input | `key` | `key`* (playpause/next/prev/stop/volume_up/volume_down/mute) |
| `speak` | Text to speech | input | `text` | `text`*, `voice`, `rate`, `volume`, `wait`, `interrupt` |
| `list_voices` | Lists the installed voices | button |  |  |
| `play_sound` | Plays an audio file (mp3/wav/wma, path or URL) | input | `source` | `source`*, `wait` |
| `stop_sound` | Stops play_sound / speak | button |  |  |
| `beep` | Simple beep | input |  | `freq`, `ms` |

#### Display

| Command | Description | Data point | Short form | Options |
|---|---|---|---|---|
| `show_image` | Shows an image as popup, full screen or in a corner | input | `source` | `source`*, `base64`, `fit` (contain/stretch/center), `mode` (popup/fullscreen/corner), `seconds`, `monitor`, `position` (top-left/top/top-right/left/center/right/bottom-left/bottom/bottom-right), `size`, `margin`, `border`, `border_color`, `caption_size`, `caption_color`, `caption`, `slot`, `click_close`, `opacity`, `activate`, `bg` |
| `show_video` | Plays a video (mp4/H.264) | input | `source` | `source`*, `loop`, `muted`, `volume`, `controls`, `close_when_done`, `mode` (popup/fullscreen/corner), `seconds`, `monitor`, `position` (top-left/top/top-right/left/center/right/bottom-left/bottom/bottom-right), `size`, `margin`, `border`, `border_color`, `caption_size`, `caption_color`, `caption`, `slot`, `click_close`, `opacity`, `activate`, `bg` |
| `show_web` | Shows a web page (dashboard, camera stream) in a window or full screen | input | `url` | `url`*, `mode` (popup/fullscreen/corner), `seconds`, `monitor`, `position` (top-left/top/top-right/left/center/right/bottom-left/bottom/bottom-right), `size`, `margin`, `border`, `border_color`, `caption_size`, `caption_color`, `caption`, `slot`, `click_close`, `opacity`, `activate`, `bg` |
| `show_text` | Shows text as an overlay | input | `text` | `text`*, `seconds`, `size`, `color`, `bg`, `opacity`, `position` (top/center/bottom), `monitor`, `bold`, `font`, `click_through`, `slot`, `max_width`, `padding`, `margin` |
| `ask` | Shows a dialog with buttons/input and returns the answer | input | `text` | `text`*, `title`, `buttons`, `input`, `default`, `password`, `timeout`, `width`, `font_size`, `monitor` |
| `notify` | Shows a Windows notification | input | `text` | `text`*, `title`, `icon` (info/warning/error/none), `seconds` |
| `close_popups` | Closes all popups, overlays and dialogs | button |  |  |
| `screenshot` | Takes a screenshot (stored in the ioBroker file storage) | input |  | `monitor`, `scale`, `quality`, `format` (jpeg/png), `inline` |
| `set_wallpaper` | Sets the desktop wallpaper | input | `source` | `source`* |
| `brightness` | Sets the brightness (internal laptop displays only) | input | `level` | `level`* |

#### Input

| Command | Description | Data point | Short form | Options |
|---|---|---|---|---|
| `send_keys` | Sends key presses (SendKeys syntax) | input | `keys` | `keys`* |
| `type_text` | Types text into the active window | input | `text` | `text`* |
| `mouse` | Moves/clicks the mouse | input |  | `x`, `y`, `relative`, `click` (none/single/double), `button` (left/right/middle), `wheel` |
| `clipboard_set` | Sets the clipboard text | input | `text` | `text`* |
| `clipboard_get` | Reads the clipboard text | button |  |  |

\* = required

### States (`<pc>.state.*`)

| Data point | Type | Unit | Writable | Description |
|---|---|---|---|---|
| `state.locked` | boolean |  |  | Screen locked |
| `state.user_present` | boolean |  |  | User active (not locked and input within the idle threshold) |
| `state.idle` | number | s |  | Seconds since the last mouse/keyboard input |
| `state.active_window` | string |  |  | Title of the active window |
| `state.active_process` | string |  |  | Process of the active window |
| `state.volume` | number | % | yes | Master volume |
| `state.muted` | boolean |  | yes | Muted |
| `state.cpu` | number | % |  | CPU load |
| `state.ram` | number | % |  | RAM usage |
| `state.ram_free_gb` | number | GB |  | Free memory |
| `state.uptime_min` | number | min |  | Time since Windows start |
| `state.battery` | number | % |  | Battery level (devices with battery only) |
| `state.charging` | boolean |  |  | Power supply connected (devices with battery only) |
| `state.monitors` | number |  |  | Number of monitors |
| `state.ip` | string |  |  | Local IPv4 address |
| `state.user` | string |  |  | Logged-in user |
| `state.keep_awake` | boolean |  | yes | keep_awake active |
| `state.disk.<laufwerk>_free_gb` | number | GB |  | Free space per drive, e.g. `disk.C_free_gb` |
| `state.disk.<laufwerk>_used_percent` | number | % |  | Usage per drive, e.g. `disk.C_used_percent` |
| `state.proc.<name>` | boolean |  |  | Watched program is running (agent settings "Processes") |
<!-- generated:end -->

## Scripts (sendTo)

```js
// command to one PC (device id or host name), the answer is the result of the agent
sendTo('desktop-control.0', 'cmd', { device: 'office-pc', command: 'speak', params: { text: 'Dinner is ready' } }, res => log(JSON.stringify(res)));

// short form for the main parameter
sendTo('desktop-control.0', 'cmd', { device: 'office-pc', command: 'volume', params: 30 });

// question with buttons, waits for the answer (ask timeout from the settings)
sendTo('desktop-control.0', 'cmd', {
    device: 'living-room',
    command: 'ask',
    params: { text: 'Start movie mode?', buttons: ['Yes', 'No'], timeout: 30 },
}, res => log(res.result && res.result.button));

// all PCs, list of devices
sendTo('desktop-control.0', 'cmd', { device: 'all', command: 'lock' });
sendTo('desktop-control.0', 'devices', {}, list => log(JSON.stringify(list)));
```

The answer has the form `{ ok, command, result, error }`.

## Security

Whoever may write to `winctl/+/cmd/#` controls the PC. Secure the broker with user/password and ACLs, use TLS if needed. By default the agent only starts programs from its alias list and `shell` is off.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (ipod86) initial release
* (ipod86) built-in MQTT broker
* (ipod86) every command option settable via the data points; description with options and example; command and state reference in the README

Older changelogs are available in [CHANGELOG_OLD.md](CHANGELOG_OLD.md).

## License
MIT License

Copyright (c) 2026 David <david@graef.email>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.