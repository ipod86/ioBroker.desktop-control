# WinCtl MQTT protocol v1

_Deutsche Fassung: [PROTOCOL.de.md](PROTOCOL.de.md)_

This document is the contract between the Windows agent (`WinCtl.exe`) and the ioBroker adapter.
Everything the adapter needs to know is either described here or described by the agent itself in the `info` topic.

## Topic scheme

`{base}` = config `BaseTopic` (default `winctl`), `{id}` = config `DeviceId` or the host name (lower case, only `a-z 0-9 - _`).

| Topic | Direction | Retained | Payload |
|---|---|---|---|
| `{base}/{id}/online` | agent → broker | yes | `true` / `false` (LWT: `false` when the connection is lost) |
| `{base}/{id}/info` | agent → broker | yes | JSON manifest (see below), sent again on every (re)connect |
| `{base}/{id}/state/{key}` | agent → broker | yes | plain text: `true`/`false`, number or string |
| `{base}/{id}/event/{name}` | agent → broker | no | JSON `{"ts": "...", ...}` |
| `{base}/{id}/result` | agent → broker | no | JSON result of every command |
| `{base}/{id}/screenshot` | agent → broker | no | **raw image bytes** (JPEG or PNG) |
| `{base}/{id}/cmd/{command}` | broker → agent | no | JSON object **or** short-form string |
| `{base}/all/cmd/{command}` | broker → all agents | no | as above (broadcast) |

The agent subscribes to `{base}/{id}/cmd/#` and `{base}/all/cmd/#`.

## Sending commands

The payload is a JSON object with the parameters of the command. Optionally an `"id"` can be added - it is returned unchanged in the `result`
(correlation for the adapter). Examples:

```
winctl/office/cmd/volume          {"level": 30}
winctl/office/cmd/show_image      {"source":"http://camera/snap.jpg","mode":"corner","seconds":15,"slot":"doorbell","id":"7f3a"}
winctl/office/cmd/run             {"path":"notepad","args":["C:\\note.txt"]}
```

**Short form:** commands with a `primary` parameter in the manifest also accept a plain string
(`volume` ← `30`, `speak` ← `Hello world`, `run` ← `notepad`). A JSON object with only `"value"` is mapped to the `primary` parameter as well.
Commands without parameters (`lock`, `monitor_off`, …) ignore the payload - an ioBroker button may send anything (`true`).

## Result (`result`)

Every command produces exactly one result on `{base}/{id}/result`:

```json
{"id": "7f3a", "cmd": "show_image", "ok": true,  "data": {"width": 640, "height": 480, "mode": "corner"}, "ts": "2026-10-23T08:30:41.7Z"}
{"id": null,   "cmd": "run",        "ok": false, "error": "'x' ist kein Alias aus 'Apps' und AllowAnyRun ist in der Config aus", "ts": "..."}
```

(Error texts come from the agent as they are.) `data` depends on the command (see [`COMMANDS.md`](COMMANDS.md)). The command `ask` blocks until the user answers and returns
`{"button":"Yes","index":0,"text":null}` or `{"button":null,"index":-1,"timeout":true}` / `"closed":true`.

## Info manifest (`info`)

Self-description - the adapter does **not** have to hard-code any command or state list:

```jsonc
{
  "protocol": 1, "app": "WinCtl", "version": "0.1.0",
  "device_id": "office", "base_topic": "winctl", "hostname": "OFFICE-PC", "user": "david", "os": "...", "ip": "192.168.1.20", "started": "ISO-8601",
  "topics": { "online": "...", "info": "...", "state": ".../state/<key>", "command": ".../cmd/<command>", "broadcast": "winctl/all/cmd/<command>", "result": "...", "screenshot": "..." },
  "security": { "allow_any_run": false, "allow_shell": false, "apps": ["notepad","calc"], "disabled_commands": [] },
  "hotkeys": { "ctrl+alt+1": "scene_cinema" },
  "events": ["lock","unlock","logon","logoff","remote_connect","remote_disconnect","suspend","resume","hotkey"],
  "states": [ { "name":"volume", "type":"number", "role":"level.volume", "unit":"%", "description":"...", "description_de":"..." } ],
  "commands": [ {
      "name": "show_image", "category": "display", "description": "...", "description_de": "...", "primary": "source", "needs_gui": true, "dangerous": false,
      "params": [ { "name":"source","type":"string","description":"...","required":true },
                  { "name":"mode","type":"string","enum":["popup","fullscreen","corner"],"default":"popup","required":false } ] } ]
}
```

`description` of commands and states is English, `description_de` German; parameter descriptions are German.
Parameter types: `string`, `integer`, `number`, `boolean`, `array`. `dangerous` marks security relevant commands
(run, kill, shell, shutdown, restart, logoff, exit) - the adapter should not simply create them as buttons.
`needs_gui` = the command only works when the agent runs in a user session with a tray icon.

## States

All states are retained plain text and are published **only on change** (completely on connect).
Static list: `info.states`. Dynamic ones are added: `state/disk/{drive}_free_gb`, `state/disk/{drive}_used_percent`
and `state/proc/{name}` (from config `WatchProcesses`). Booleans are exactly `true`/`false`.

Some states reflect the new value right after a command (`volume`, `muted`, `keep_awake`); otherwise the 2 s cycle applies
(fast values: `active_window`, `active_process`, `locked`, `user_present`, `volume`, `muted`, `proc/*`) or `StateIntervalSec` (slow ones: `cpu`, `ram`, `idle`, …).

## Events

Not retained, JSON with `ts`. `hotkey` additionally contains `{"name": "...", "keys": "ctrl+alt+1"}` - this way the PC can be used as an input device
for scenes in ioBroker.

## Suggested object model of the adapter

```
winctl.0.{id}.online                  (indicator.reachable, read)
winctl.0.{id}.info.*                  (hostname, ip, version, os - from info)
winctl.0.{id}.state.*                 (1:1 from state/*; role/unit/type from info.states; read-only,
                                       except volume, muted, keep_awake -> writable, triggers a command)
winctl.0.{id}.cmd.{command}           (per command: state with role "button" if there are no required parameters,
                                       otherwise role "json" -> payload = parameter JSON)
winctl.0.{id}.result                  (last result as JSON)
winctl.0.{id}.event.{name}            (time stamp / JSON)
winctl.0.{id}.screenshot              (Base64 data URI or file in the ioBroker file storage)
winctl.0.all.cmd.{command}            (broadcast)
```

For calls from Blockly/JavaScript the adapter should also offer the command `sendTo('winctl.0','cmd',{device:'office',command:'show_image',params:{...}})`
with a promise/callback that returns the matching `result` via the `id` correlation.

## Security model

* The broker is the trust boundary: set a **login + ACL** (only the adapter may write to `.../cmd/#`), use TLS if in doubt.
* `run`/`open` only start aliases from config `Apps` as long as `AllowAnyRun=false`.
* `shell` is blocked without `AllowShell=true`.
* Single commands can be switched off completely via `DisabledCommands`.
* The agent runs as a normal user (no admin, no service).

## Versioning

`protocol` in the manifest is increased on incompatible changes. New commands/parameters/states are backwards compatible and appear in the manifest automatically.
