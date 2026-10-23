# CLAUDE.md – ioBroker.desktop-control

## Goal

ioBroker adapter that controls Windows PCs through the **WinCtl** agent (C#, separate repo) over MQTT.
The adapter knows no command lists: everything comes from the manifest the agent publishes on `{base}/{id}/info`.

## Architecture

```
WinCtl.exe (per PC) ──MQTT──> broker (built-in or external) <──MQTT── desktop-control adapter ──> ioBroker objects/states
```

- `src/lib/protocol.ts` – pure functions: topic parsing, manifest normalisation, state common, command kinds, parameter parsing (short form), results, screenshot detection. Unit-tested.
- `src/lib/correlator.ts` – maps command ids to `result` messages (timeout, reject on offline/unload).
- `src/lib/roles.ts` – the official role list (https://www.iobroker.com/docs/dev/stateroles.md). Roles from the manifest that are not in it fall back to a generic role.
- `src/main.ts` – MQTT connection, objects, `onStateChange`, `onMessage` (`cmd`, `devices`).
- `tools/fake-agent.js` – fake agent built from `docs/protocol.json`, used by the integration test and usable by hand (`node tools/fake-agent.js mqtt://host:1883 pc1`).
- `docs/PROTOCOL.md`, `docs/COMMANDS.md`, `docs/protocol.json` – copied from the agent repo, the source of truth for the protocol. Update them together with the agent.

## Decisions

- Topics: `{base}/{id}/online|info|state/<path>|event/<name>|result|screenshot`, commands to `{base}/{id}/cmd/<name>` and `{base}/all/cmd/<name>`.
- States are plain text; typed with the manifest. `/` in state paths becomes an object level (`disk/C_free_gb` → `state.disk.C_free_gb`). Dynamic states (`<...>` or `/*` in the manifest) are created on the first value.
- Command data points: no required params → button; otherwise `json` (string). A non-JSON value is the short form for the `primary` parameter.
- `dangerous` and `disabled_commands` get no data point (only `sendTo`). Stale `cmd.*` objects are removed when the manifest changes.
- Writable states: `volume` → `volume{level}`, `muted` → `mute{state}`, `keep_awake` → `keep_awake{state}` (`WRITABLE_COMMANDS`).
- MQTT messages are processed one after another (`queue` in main.ts), so the manifest is applied before the states that follow it.
- Screenshots: raw image bytes → file storage `desktop-control.0/screenshots/<device>.<ext>`; the instance meta object is created in `onReady`.
- Built-in broker (aedes, `src/lib/broker.ts`) is the default (`brokerMode: internal`, port 1886); the adapter connects to it on 127.0.0.1. User name/password of the settings are then the login the agents must use. Old instances without `brokerMode` stay external when a host is set. aedes is ESM: esbuild turns `import()` into `require()`, which needs Node >= 22.12 (require(esm)).
- Protocol version > 1 in the manifest → warning in the log, no hard stop.

## Commands

```bash
npm run build          # TypeScript → build/ (build/ is committed)
npm run lint -- --fix
npm run test:ts        # unit tests (src/**/*.test.ts)
npm run test:package
npm run test:integration   # aedes broker + fake agent, ~30 s
```

Do not run `npm run translate` without asking; all texts are maintained by hand in 11 languages (admin/i18n).
No push, no npm publish without the maintainer saying so.

## Not tested against the real agent yet

- Real Windows agent end-to-end (only the fake agent).
- TLS connection, broker with ACLs.
- Large screenshots (MQTT max packet size of the broker).
- `ask` with a long timeout while the device goes offline.

## Open points / agent issues

- `docs/protocol.json` from the agent repo has broken umlauts (`Lautst?rke`): `tools/gen_docs.py` writes the descriptions with a wrong encoding. These descriptions end up in `common.desc`. Fix in the agent repo.
- The agent repo's git author is `WinCtl <winctl@localhost>`; change it before publishing.
- Update function for the agent (tray item "Check for updates", GitHub releases) – planned in the agent repo.
