# DesktopControl MQTT protocol (as used by the adapter)

> **Status: assumption.** The authoritative contract is `docs/PROTOCOL.md` / `docs/protocol.json` of the
> agent repository, which was not available when the adapter was written. This file describes what the
> adapter expects. Everything is manifest driven, so states and commands adapt to what the agent announces;
> only the message *formats* below are assumed. Differences must be resolved here and in `src/lib/protocol.ts`.

## Topics

`{base}` is configurable (default `winctl`, later `desktop-control`). `{device}` is the agent id.

| Topic | Direction | Retained | Payload |
|---|---|---|---|
| `{base}/{device}/online` | agent → | yes (LWT) | `true`/`false` (also accepted: `online`/`offline`, `1`/`0`) |
| `{base}/{device}/info` | agent → | yes | manifest JSON (see below) |
| `{base}/{device}/state/{path}` | agent → | yes | JSON value (number, boolean, string); raw strings are accepted |
| `{base}/{device}/event/{name}` | agent → | no | JSON (any) or plain text |
| `{base}/{device}/cmd/{command}` | → agent | no | JSON object with the parameters and an `id` for correlation |
| `{base}/{device}/result` | agent → | no | `{"id": "...", "command": "...", "ok": true, "result": …, "error": "…"}` |
| `{base}/{device}/screenshot` | agent → | no | image bytes (PNG/JPEG) or JSON `{"id", "format", "data": "<base64>"}` |
| `{base}/all/cmd/{command}` | → all agents | no | like `cmd`, broadcast (no correlation) |

`{path}` may contain `/` (e.g. `disk/C`, `proc/chrome`); in ioBroker it becomes `state.disk.C`.

## Manifest (`info`)

```json
{
  "hostname": "PC-WOHNZIMMER", "ip": "192.168.1.20", "version": "1.0.0", "os": "Windows 11", "user": "david",
  "states": {
    "locked":   { "type": "boolean", "role": "indicator", "name": "Locked" },
    "volume":   { "type": "number", "role": "level.volume", "unit": "%", "min": 0, "max": 100, "writable": true },
    "disk/*":   { "type": "number", "role": "value", "unit": "%" }
  },
  "commands": {
    "lock":     { "params": {} },
    "run":      { "params": { "alias": { "type": "string", "required": true } } },
    "shell":    { "dangerous": true, "params": { "cmd": { "type": "string", "required": true } } },
    "ask":      { "needs_gui": true, "params": { "text": { "type": "string", "required": true } } }
  },
  "events": ["lock", "unlock", "logon", "logoff", "suspend", "resume", "remote", "hotkey"]
}
```

`states`/`commands` may also be arrays of objects with a `name`; `params` may be an array with `name`.
Entries ending in `/*` are templates for dynamic states (created on first appearance).

## Writable states

A write with `ack=false` sends the command of the same meaning; the value goes into the first parameter
the manifest lists for that command, otherwise into the default parameter:

| State | Command | Default parameter |
|---|---|---|
| `volume` | `volume` | `level` |
| `muted` | `mute` | `mute` |
| `keep_awake` | `keep_awake` | `enable` |
