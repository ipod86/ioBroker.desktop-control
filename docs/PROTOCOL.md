# WinCtl MQTT-Protokoll v1

Dieses Dokument ist der Vertrag zwischen dem Windows-Agent (`WinCtl.exe`) und dem geplanten ioBroker-Adapter.
Alles, was der Adapter wissen muss, steht entweder hier oder wird vom Agent selbst im `info`-Topic beschrieben.

## Topic-Schema

`{base}` = Config `BaseTopic` (Standard `winctl`), `{id}` = Config `DeviceId` bzw. Hostname (klein, nur `a-z 0-9 - _`).

| Topic | Richtung | Retained | Payload |
|---|---|---|---|
| `{base}/{id}/online` | Agent → Broker | ja | `true` / `false` (LWT: `false` bei Verbindungsabbruch) |
| `{base}/{id}/info` | Agent → Broker | ja | JSON-Manifest (siehe unten), bei jedem (Re-)Connect neu |
| `{base}/{id}/state/{key}` | Agent → Broker | ja | Klartext: `true`/`false`, Zahl oder String |
| `{base}/{id}/event/{name}` | Agent → Broker | nein | JSON `{"ts": "...", ...}` |
| `{base}/{id}/result` | Agent → Broker | nein | JSON-Ergebnis zu jedem Befehl |
| `{base}/{id}/screenshot` | Agent → Broker | nein | **Rohe Bild-Bytes** (JPEG oder PNG) |
| `{base}/{id}/cmd/{command}` | Broker → Agent | nein | JSON-Objekt **oder** Kurzform-String |
| `{base}/all/cmd/{command}` | Broker → alle Agents | nein | wie oben (Broadcast) |

Der Agent abonniert `{base}/{id}/cmd/#` und `{base}/all/cmd/#`.

## Befehle senden

Payload ist ein JSON-Objekt mit den Parametern des Befehls. Optional kann `"id"` mitgegeben werden - er kommt unverändert im `result` zurück
(Korrelation für den Adapter). Beispiele:

```
winctl/buero/cmd/volume          {"level": 30}
winctl/buero/cmd/show_image      {"source":"http://kamera/snap.jpg","mode":"corner","seconds":15,"slot":"tuerklingel","id":"7f3a"}
winctl/buero/cmd/run             {"path":"notepad","args":["C:\\notiz.txt"]}
```

**Kurzform:** Befehle mit `primary`-Parameter im Manifest akzeptieren auch einen blanken String
(`volume` ← `30`, `speak` ← `Hallo Welt`, `run` ← `notepad`). Ein JSON-Objekt mit nur `"value"` wird ebenfalls auf den `primary`-Parameter abgebildet.
Befehle ohne Parameter (`lock`, `monitor_off`, …) ignorieren den Payload - ein ioBroker-Button darf also beliebig (`true`) senden.

## Ergebnis (`result`)

Jeder Befehl erzeugt genau ein Ergebnis auf `{base}/{id}/result`:

```json
{"id": "7f3a", "cmd": "show_image", "ok": true,  "data": {"width": 640, "height": 480, "mode": "corner"}, "ts": "2026-10-23T08:30:41.7Z"}
{"id": null,   "cmd": "run",        "ok": false, "error": "'x' ist kein Alias aus 'Apps' und AllowAnyRun ist in der Config aus", "ts": "..."}
```

`data` ist befehlsabhängig (siehe `docs/COMMANDS.md`). Der Befehl `ask` blockiert, bis der Benutzer antwortet, und liefert
`{"button":"Ja","index":0,"text":null}` bzw. `{"button":null,"index":-1,"timeout":true}` / `"closed":true`.

## Info-Manifest (`info`)

Selbstbeschreibung - der Adapter muss **keine** Befehls- oder State-Liste hartcodieren:

```jsonc
{
  "protocol": 1, "app": "WinCtl", "version": "0.1.0",
  "device_id": "buero", "base_topic": "winctl", "hostname": "BUERO-PC", "user": "david", "os": "...", "ip": "192.168.1.20", "started": "ISO-8601",
  "topics": { "online": "...", "info": "...", "state": ".../state/<key>", "command": ".../cmd/<command>", "broadcast": "winctl/all/cmd/<command>", "result": "...", "screenshot": "..." },
  "security": { "allow_any_run": false, "allow_shell": false, "apps": ["notepad","calc"], "disabled_commands": [] },
  "hotkeys": { "ctrl+alt+1": "szene_kino" },
  "events": ["lock","unlock","logon","logoff","remote_connect","remote_disconnect","suspend","resume","hotkey"],
  "states": [ { "name":"volume", "type":"number", "role":"level.volume", "unit":"%", "description":"..." } ],
  "commands": [ {
      "name": "show_image", "category": "display", "description": "...", "primary": "source", "needs_gui": true, "dangerous": false,
      "params": [ { "name":"source","type":"string","description":"...","required":true },
                  { "name":"mode","type":"string","enum":["popup","fullscreen","corner"],"default":"popup","required":false } ] } ]
}
```

Parametertypen: `string`, `integer`, `number`, `boolean`, `array`. `dangerous` markiert sicherheitsrelevante Befehle
(run, kill, shell, shutdown, restart, logoff, exit) - der Adapter sollte sie nicht ohne Weiteres als Button anlegen.
`needs_gui` = Befehl funktioniert nur, wenn der Agent in einer Benutzersitzung mit Tray läuft.

## States

Alle States sind retained Klartext und werden **nur bei Änderung** veröffentlicht (beim Connect komplett).
Statische Liste: `info.states`. Dynamisch dazu kommen `state/disk/{laufwerk}_free_gb`, `state/disk/{laufwerk}_used_percent`
und `state/proc/{name}` (aus Config `WatchProcesses`). Booleans sind exakt `true`/`false`.

Einige States spiegeln den Zustand sofort nach einem Befehl (`volume`, `muted`, `keep_awake`), sonst gilt das 2-s-Raster
(schnelle Werte: `active_window`, `active_process`, `locked`, `user_present`, `volume`, `muted`, `proc/*`) bzw. `StateIntervalSec` (langsame: `cpu`, `ram`, `idle`, …).

## Events

Nicht retained, JSON mit `ts`. `hotkey` enthält zusätzlich `{"name": "...", "keys": "ctrl+alt+1"}` - damit lässt sich der PC als Eingabegerät
für Szenen in ioBroker verwenden.

## Vorschlag für das Objektmodell des Adapters

```
winctl.0.{id}.online                  (indicator.reachable, read)
winctl.0.{id}.info.*                  (hostname, ip, version, os - aus info)
winctl.0.{id}.state.*                 (1:1 aus state/*; role/unit/type aus info.states; read-only,
                                       außer volume, muted, keep_awake -> schreibbar, löst Befehl aus)
winctl.0.{id}.cmd.{command}           (je Befehl: state mit role "button" wenn keine Pflicht-Parameter,
                                       sonst role "json" -> Payload = Parameter-JSON)
winctl.0.{id}.result                  (letztes Ergebnis als JSON)
winctl.0.{id}.event.{name}            (Zeitstempel / JSON)
winctl.0.{id}.screenshot              (Base64-Data-URI oder Datei in ioBroker-Dateispeicher)
winctl.0.all.cmd.{command}            (Broadcast)
```

Für Aufrufe aus Blockly/JavaScript empfiehlt sich zusätzlich der Adapter-Befehl `sendTo('winctl.0','cmd',{device:'buero',command:'show_image',params:{...}})`
mit Promise/Callback, der über die `id`-Korrelation das passende `result` zurückgibt.

## Sicherheitsmodell

* Der Broker ist die Vertrauensgrenze: **Login + ACL** setzen (nur der Adapter darf auf `.../cmd/#` schreiben), im Zweifel TLS.
* `run`/`open` starten nur Aliase aus Config `Apps`, solange `AllowAnyRun=false`.
* `shell` ist ohne `AllowShell=true` gesperrt.
* Einzelne Befehle lassen sich über `DisabledCommands` komplett abschalten.
* Der Agent läuft als normaler Benutzer (kein Admin, kein Dienst).

## Versionierung

`protocol` im Manifest wird bei inkompatiblen Änderungen erhöht. Neue Befehle/Parameter/States sind abwärtskompatibel und erscheinen automatisch im Manifest.
