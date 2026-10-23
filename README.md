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
_Generated from the agent (`docs/protocol.json`, agent version 0.2.0); the descriptions come from the agent and are German._

#### System

<details>
<summary><code>ping</code> – Lebenszeichen - antwortet mit Zeitstempel und Version</summary>

Data point: `cmd.ping` – button – click to run  

</details>

<details>
<summary><code>get_state</code> – Veröffentlicht alle State-Werte sofort neu</summary>

Data point: `cmd.get_state` – button – click to run  

</details>

<details>
<summary><code>reload_config</code> – Config-Datei neu einlesen und neu verbinden</summary>

Data point: `cmd.reload_config` – button – click to run  

</details>

<details>
<summary><code>exit</code> – Beendet den Agent</summary>

Data point: `cmd.exit` – no data point (security relevant) – only via `sendTo`  

</details>

<details>
<summary><code>list_commands</code> – Gibt die Liste aller Befehle zurück</summary>

Data point: `cmd.list_commands` – button – click to run  

</details>

#### Power & session

<details>
<summary><code>lock</code> – Sperrt den Bildschirm (Win+L)</summary>

Data point: `cmd.lock` – button – click to run  

</details>

<details>
<summary><code>sleep</code> – Standby</summary>

Data point: `cmd.sleep` – button – click to run  

</details>

<details>
<summary><code>hibernate</code> – Ruhezustand</summary>

Data point: `cmd.hibernate` – button – click to run  

</details>

<details>
<summary><code>shutdown</code> – Fährt den PC herunter</summary>

Data point: `cmd.shutdown` – no data point (security relevant) – only via `sendTo`  
Short form: `delay`

Examples:

```
60
{"delay":0,"force":true}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `delay` | integer | `10` | Verzögerung in Sekunden |
| `force` | boolean | `false` | Programme zwangsweise schließen |

</details>

<details>
<summary><code>restart</code> – Startet den PC neu</summary>

Data point: `cmd.restart` – no data point (security relevant) – only via `sendTo`  
Short form: `delay`

Examples:

```
30
{"delay":0,"force":true}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `delay` | integer | `10` | Verzögerung in Sekunden |
| `force` | boolean | `false` | Programme zwangsweise schließen |

</details>

<details>
<summary><code>logoff</code> – Meldet den Benutzer ab</summary>

Data point: `cmd.logoff` – no data point (security relevant) – only via `sendTo`  

</details>

<details>
<summary><code>cancel_shutdown</code> – Bricht einen geplanten Shutdown/Neustart ab</summary>

Data point: `cmd.cancel_shutdown` – button – click to run  

</details>

<details>
<summary><code>monitor_off</code> – Schaltet die Monitore aus</summary>

Data point: `cmd.monitor_off` – button – click to run  

</details>

<details>
<summary><code>monitor_on</code> – Weckt die Monitore auf</summary>

Data point: `cmd.monitor_on` – button – click to run  

</details>

<details>
<summary><code>keep_awake</code> – Verhindert Standby/Bildschirmschoner (bis auf Widerruf)</summary>

Data point: `cmd.keep_awake` – input – JSON, short form or `true` (= default options)  
Short form: `state`

Examples:

```
{"state":true,"display":false}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `state` | boolean | `true` | an/aus |
| `display` | boolean | `true` | auch Bildschirm anlassen |

</details>

#### Programs & windows

<details>
<summary><code>run</code> – Startet ein Programm (Alias aus der Config oder - wenn erlaubt - beliebiger Pfad) mit Parametern</summary>

Data point: `cmd.run` – input – JSON, short form or `true` (= default options) (data point only while the agent only starts programs from its alias list)  
Short form: `path`

Examples:

```
notepad
{"path":"kodi","args":"--fullscreen","window":"maximized"}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `path` | string | required | Alias (z.B. 'notepad') oder Pfad zur .exe |
| `args` | string |  | Parameter als String oder Liste |
| `workdir` | string |  | Arbeitsverzeichnis |
| `hidden` | boolean |  | Ohne Fenster starten |
| `window` | string |  | Fensterzustand (`normal`, `minimized`, `maximized`) |
| `admin` | boolean |  | Als Administrator (UAC-Abfrage am PC!) |
| `wait` | boolean |  | Auf Ende warten und Exit-Code zurückgeben |
| `timeout` | integer | `60` | Wartezeit in Sekunden bei wait |

</details>

<details>
<summary><code>open</code> – Öffnet URL, Datei oder Ordner mit der Standard-App (Dateien/Ordner nur mit AllowAnyRun)</summary>

Data point: `cmd.open` – input – JSON, short form or `true` (= default options)  
Short form: `target`

Examples:

```
https://www.iobroker.net
ms-settings:display
```

| Option | Type | Default | Description |
|---|---|---|---|
| `target` | string | required | URL (immer erlaubt), sonst Alias/Pfad |

</details>

<details>
<summary><code>kill</code> – Beendet Prozesse nach Name oder PID</summary>

Data point: `cmd.kill` – input – JSON, short form or `true` (= default options) (data point only while the agent only starts programs from its alias list)  
Short form: `name`

Examples:

```
notepad
{"pid":1234}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | string |  | Prozessname, z.B. 'chrome' |
| `pid` | integer |  | Prozess-ID |

</details>

<details>
<summary><code>list_processes</code> – Listet laufende Prozesse (max. 300)</summary>

Data point: `cmd.list_processes` – input – JSON, short form or `true` (= default options)  
Short form: `filter`

Examples:

```
chrome
```

| Option | Type | Default | Description |
|---|---|---|---|
| `filter` | string |  | Namensfilter |

</details>

<details>
<summary><code>list_windows</code> – Listet sichtbare Fenster mit Titel</summary>

Data point: `cmd.list_windows` – button – click to run  

</details>

<details>
<summary><code>focus_window</code> – Bringt ein Fenster (Titel enthält ...) in den Vordergrund</summary>

Data point: `cmd.focus_window` – input – JSON, short form or `true` (= default options)  
Short form: `title`

Examples:

```
Kodi
```

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | required | Teil des Fenstertitels |

</details>

<details>
<summary><code>close_window</code> – Schließt ein Fenster sauber (Titel enthält ...)</summary>

Data point: `cmd.close_window` – input – JSON, short form or `true` (= default options)  
Short form: `title`

Examples:

```
Editor
```

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | required | Teil des Fenstertitels |

</details>

<details>
<summary><code>minimize_all</code> – Alle Fenster minimieren (Desktop anzeigen) bzw. wiederherstellen</summary>

Data point: `cmd.minimize_all` – input – JSON, short form or `true` (= default options)  

Examples:

```
{"undo":true}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `undo` | boolean | `false` | Wiederherstellen statt minimieren |

</details>

<details>
<summary><code>empty_recycle_bin</code> – Leert den Papierkorb</summary>

Data point: `cmd.empty_recycle_bin` – button – click to run  

</details>

<details>
<summary><code>shell</code> – Führt einen Shell-Befehl aus und liefert die Ausgabe (nur mit AllowShell=true)</summary>

Data point: `cmd.shell` – no data point (security relevant) – only via `sendTo`  
Short form: `command`

Examples:

```
Get-Date
{"command":"ipconfig","shell":"cmd"}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `command` | string | required | Befehl / Skript |
| `shell` | string | `"powershell"` | Interpreter (`powershell`, `cmd`) |
| `timeout` | integer | `30` | Sekunden |

</details>

#### Audio

<details>
<summary><code>volume</code> – Setzt die Master-Lautstärke (0-100)</summary>

Data point: `cmd.volume` – input – JSON, short form or `true` (= default options)  
Short form: `level`

Examples:

```
30
```

| Option | Type | Default | Description |
|---|---|---|---|
| `level` | integer | required | 0 - 100 |

</details>

<details>
<summary><code>volume_change</code> – Lautstärke relativ ändern</summary>

Data point: `cmd.volume_change` – input – JSON, short form or `true` (= default options)  
Short form: `delta`

Examples:

```
-10
```

| Option | Type | Default | Description |
|---|---|---|---|
| `delta` | integer | `5` | z.B. 5 oder -10 |

</details>

<details>
<summary><code>mute</code> – Stummschalten / aufheben / umschalten</summary>

Data point: `cmd.mute` – input – JSON, short form or `true` (= default options)  
Short form: `state`

Examples:

```
toggle
```

| Option | Type | Default | Description |
|---|---|---|---|
| `state` | string | `"toggle"` | true / false / toggle |

</details>

<details>
<summary><code>media</code> – Sendet eine Medientaste</summary>

Data point: `cmd.media` – input – JSON, short form or `true` (= default options)  
Short form: `key`

Examples:

```
playpause
next
```

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | string | required | Medientaste (`playpause`, `next`, `prev`, `stop`, `volume_up`, `volume_down`, `mute`) |

</details>

<details>
<summary><code>speak</code> – Text-to-Speech (Windows-Stimme)</summary>

Data point: `cmd.speak` – input – JSON, short form or `true` (= default options)  
Short form: `text`

Examples:

```
Das Essen ist fertig
{"text":"Achtung","voice":"Hedda","rate":2,"volume":80}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | string | required | Zu sprechender Text |
| `voice` | string |  | Teil des Stimmennamens, z.B. 'Hedda' |
| `rate` | integer | `0` | -10 (langsam) bis 10 (schnell) |
| `volume` | integer | `100` | 0-100 |
| `wait` | boolean |  | Warten bis fertig gesprochen |
| `interrupt` | boolean | `true` | Laufende Ausgabe abbrechen |

</details>

<details>
<summary><code>list_voices</code> – Listet installierte TTS-Stimmen</summary>

Data point: `cmd.list_voices` – button – click to run  

</details>

<details>
<summary><code>play_sound</code> – Spielt eine Audiodatei (mp3/wav/wma, Pfad oder URL)</summary>

Data point: `cmd.play_sound` – input – JSON, short form or `true` (= default options)  
Short form: `source`

Examples:

```
http://192.168.1.5/gong.mp3
{"source":"C:\\Sounds\\klingel.wav","wait":true}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | string | required | Pfad oder URL |
| `wait` | boolean | `false` | Warten bis zum Ende |

</details>

<details>
<summary><code>stop_sound</code> – Stoppt play_sound / speak</summary>

Data point: `cmd.stop_sound` – button – click to run  

</details>

<details>
<summary><code>beep</code> – Einfacher Piepton</summary>

Data point: `cmd.beep` – input – JSON, short form or `true` (= default options)  

Examples:

```
{"freq":1200,"ms":500}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `freq` | integer | `800` | Hz |
| `ms` | integer | `300` | Dauer in ms |

</details>

#### Display

<details>
<summary><code>show_image</code> – Zeigt ein Bild als Popup, Vollbild oder Ecken-Einblendung (Pfad, URL oder Base64)</summary>

Data point: `cmd.show_image` – input – JSON, short form or `true` (= default options)  
Short form: `source`

Examples:

```
http://kamera/snapshot.jpg
{"source":"http://kamera/snapshot.jpg","mode":"corner","position":"top-right","size":30,"seconds":10,"caption":"Haustür","slot":"klingel"}
{"source":"https://picsum.photos/1920/1080","mode":"fullscreen","seconds":15}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | string | required | Pfad, http(s)-URL oder data:-URI |
| `base64` | string |  | Alternativ: Base64-Daten |
| `fit` | string | `"contain"` | Skalierung (`contain`, `stretch`, `center`) |
| `mode` | string | `"popup"` | popup = Fenster in der Mitte, fullscreen = Vollbild, corner = Ecke (z.B. Türklingel-Kamera) (`popup`, `fullscreen`, `corner`) |
| `seconds` | number |  | Automatisch schließen nach X Sekunden (0 = bleibt bis Klick/close_popups) |
| `monitor` | integer | `-1` | Monitor-Index (0 = erster, -1 = Hauptmonitor) |
| `position` | string | `"bottom-right"` | Lage bei mode=corner (`top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`) |
| `size` | number |  | Breite in % des Bildschirms (5 - 100, Seitenverhältnis bleibt; leer = automatisch: Ecke 28 %, Popup max. 70 %) |
| `margin` | integer | `16` | Abstand zum Bildschirmrand in Pixel (mode=corner) |
| `border` | integer | `2` | Rahmenbreite in Pixel (0 = kein Rahmen) |
| `border_color` | string | `"#282828"` | Rahmenfarbe, z.B. #ff0000 |
| `caption_size` | number | `11` | Schriftgröße der Beschriftung |
| `caption_color` | string | `"#ffffff"` | Farbe der Beschriftung |
| `caption` | string |  | Beschriftung unter dem Inhalt |
| `slot` | string |  | Gleicher Slot ersetzt das vorherige Popup (z.B. Kamerabild aktualisieren) |
| `click_close` | boolean |  | Klick schließt das Popup |
| `opacity` | number |  | Deckkraft 0.1 - 1 |
| `activate` | boolean | `false` | Fokus übernehmen (Standard: nein, stört nicht beim Arbeiten) |
| `bg` | string |  | Hintergrundfarbe, z.B. #000000 |

</details>

<details>
<summary><code>show_video</code> – Spielt ein Video ab (Datei oder URL, mp4/H.264 empfohlen)</summary>

Data point: `cmd.show_video` – input – JSON, short form or `true` (= default options)  
Short form: `source`

Examples:

```
http://server/video.mp4
{"source":"http://server/video.mp4","mode":"corner","position":"bottom-left","size":25,"muted":true,"loop":true}
{"source":"C:\\Videos\\intro.mp4","mode":"fullscreen","close_when_done":true}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | string | required | Pfad oder URL |
| `loop` | boolean | `false` | Endlosschleife |
| `muted` | boolean | `false` | Ohne Ton |
| `volume` | number | `1` | 0 - 1 |
| `controls` | boolean | `false` | Bedienelemente anzeigen |
| `close_when_done` | boolean | `true` | Nach Ende schließen |
| `mode` | string | `"popup"` | popup = Fenster in der Mitte, fullscreen = Vollbild, corner = Ecke (z.B. Türklingel-Kamera) (`popup`, `fullscreen`, `corner`) |
| `seconds` | number |  | Automatisch schließen nach X Sekunden (0 = bleibt bis Klick/close_popups) |
| `monitor` | integer | `-1` | Monitor-Index (0 = erster, -1 = Hauptmonitor) |
| `position` | string | `"bottom-right"` | Lage bei mode=corner (`top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`) |
| `size` | number |  | Breite in % des Bildschirms (5 - 100, Seitenverhältnis bleibt; leer = automatisch: Ecke 28 %, Popup max. 70 %) |
| `margin` | integer | `16` | Abstand zum Bildschirmrand in Pixel (mode=corner) |
| `border` | integer | `2` | Rahmenbreite in Pixel (0 = kein Rahmen) |
| `border_color` | string | `"#282828"` | Rahmenfarbe, z.B. #ff0000 |
| `caption_size` | number | `11` | Schriftgröße der Beschriftung |
| `caption_color` | string | `"#ffffff"` | Farbe der Beschriftung |
| `caption` | string |  | Beschriftung unter dem Inhalt |
| `slot` | string |  | Gleicher Slot ersetzt das vorherige Popup (z.B. Kamerabild aktualisieren) |
| `click_close` | boolean |  | Klick schließt das Popup |
| `opacity` | number |  | Deckkraft 0.1 - 1 |
| `activate` | boolean | `false` | Fokus übernehmen (Standard: nein, stört nicht beim Arbeiten) |
| `bg` | string |  | Hintergrundfarbe, z.B. #000000 |

</details>

<details>
<summary><code>show_web</code> – Zeigt eine Webseite (z.B. Dashboard, Kamera-Stream) in einem Fenster oder als Kiosk-Vollbild</summary>

Data point: `cmd.show_web` – input – JSON, short form or `true` (= default options)  
Short form: `url`

Examples:

```
http://192.168.1.5:8082/vis/
{"url":"http://192.168.1.5:8082/vis/","mode":"fullscreen"}
{"url":"http://kamera/stream","mode":"corner","size":35,"seconds":30,"slot":"kamera"}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | Adresse |
| `mode` | string | `"popup"` | popup = Fenster in der Mitte, fullscreen = Vollbild, corner = Ecke (z.B. Türklingel-Kamera) (`popup`, `fullscreen`, `corner`) |
| `seconds` | number |  | Automatisch schließen nach X Sekunden (0 = bleibt bis Klick/close_popups) |
| `monitor` | integer | `-1` | Monitor-Index (0 = erster, -1 = Hauptmonitor) |
| `position` | string | `"bottom-right"` | Lage bei mode=corner (`top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`) |
| `size` | number |  | Breite in % des Bildschirms (5 - 100, Seitenverhältnis bleibt; leer = automatisch: Ecke 28 %, Popup max. 70 %) |
| `margin` | integer | `16` | Abstand zum Bildschirmrand in Pixel (mode=corner) |
| `border` | integer | `2` | Rahmenbreite in Pixel (0 = kein Rahmen) |
| `border_color` | string | `"#282828"` | Rahmenfarbe, z.B. #ff0000 |
| `caption_size` | number | `11` | Schriftgröße der Beschriftung |
| `caption_color` | string | `"#ffffff"` | Farbe der Beschriftung |
| `caption` | string |  | Beschriftung unter dem Inhalt |
| `slot` | string |  | Gleicher Slot ersetzt das vorherige Popup (z.B. Kamerabild aktualisieren) |
| `click_close` | boolean |  | Klick schließt das Popup |
| `opacity` | number |  | Deckkraft 0.1 - 1 |
| `activate` | boolean | `false` | Fokus übernehmen (Standard: nein, stört nicht beim Arbeiten) |
| `bg` | string |  | Hintergrundfarbe, z.B. #000000 |

</details>

<details>
<summary><code>show_text</code> – Blendet Text als Overlay ein (klickdurchlässig)</summary>

Data point: `cmd.show_text` – input – JSON, short form or `true` (= default options)  
Short form: `text`

Examples:

```
Waschmaschine fertig
{"text":"Alarm!","size":60,"color":"#ffffff","bg":"#c00000","position":"center","seconds":10}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | string | required | Text |
| `seconds` | number | `5` | Anzeigedauer |
| `size` | number | `40` | Schriftgröße |
| `color` | string | `"#ffffff"` | Textfarbe |
| `bg` | string | `"#202020"` | Hintergrund |
| `opacity` | number | `0.9` | Deckkraft |
| `position` | string | `"bottom"` | Lage (`top`, `center`, `bottom`) |
| `monitor` | integer | `-1` | Monitor-Index |
| `bold` | boolean | `true` | Fett |
| `font` | string | `"Segoe UI"` | Schriftart |
| `click_through` | boolean | `true` | Mausklicks gehen durch |
| `slot` | string |  | Ersetzt Overlay mit gleichem Slot |
| `max_width` | number | `80` | Maximale Breite in % des Bildschirms (Text bricht um) |
| `padding` | integer | `24` | Innenabstand in Pixel |
| `margin` | integer |  | Abstand zum Rand in Pixel (top: 40, bottom: 60) |

</details>

<details>
<summary><code>ask</code> – Zeigt einen Dialog mit Buttons/Eingabefeld und liefert die Antwort im result zurück</summary>

Data point: `cmd.ask` – input – JSON, short form or `true` (= default options)  
Short form: `text`

Examples:

```
Licht ausschalten?
{"text":"Kinomodus starten?","buttons":["Ja","Nein"],"timeout":30}
{"text":"Wie warm soll es werden?","input":true,"default":"21","buttons":["OK","Abbrechen"]}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | string | required | Fragetext |
| `title` | string |  | Titel |
| `buttons` | array | `["OK"]` | Beschriftungen, z.B. ["Ja","Nein"] |
| `input` | boolean | `false` | Texteingabefeld anzeigen |
| `default` | string |  | Vorgabe im Eingabefeld |
| `password` | boolean | `false` | Eingabe verdecken |
| `timeout` | integer | `0` | Sekunden bis automatisch geschlossen (0 = nie) |
| `width` | integer | `460` | Breite des Dialogs in Pixel |
| `font_size` | number | `10` | Schriftgröße |
| `monitor` | integer | `-1` | Monitor-Index (-1 = Hauptmonitor) |

</details>

<details>
<summary><code>notify</code> – Zeigt eine Windows-Benachrichtigung</summary>

Data point: `cmd.notify` – input – JSON, short form or `true` (= default options)  
Short form: `text`

Examples:

```
Paket ist angekommen
{"text":"Fenster offen","title":"Heizung","icon":"warning","seconds":10}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | string | required | Text |
| `title` | string | `"WinCtl"` | Titel |
| `icon` | string | `"info"` | Symbol (`info`, `warning`, `error`, `none`) |
| `seconds` | integer | `5` | Dauer |

</details>

<details>
<summary><code>close_popups</code> – Schließt alle Popups/Overlays/Dialoge von WinCtl</summary>

Data point: `cmd.close_popups` – button – click to run  

</details>

<details>
<summary><code>screenshot</code> – Macht einen Screenshot und veröffentlicht das Bild (JPEG/PNG-Rohdaten) auf <base>/<id>/screenshot</summary>

Data point: `cmd.screenshot` – input – JSON, short form or `true` (= default options)  

Examples:

```
{"monitor":0,"scale":1,"format":"png"}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `monitor` | integer | `-1` | -1 = alle Monitore, 0 = erster ... |
| `scale` | number | `0.5` | Verkleinerung 0.05 - 1 |
| `quality` | integer | `70` | JPEG-Qualität |
| `format` | string | `"jpeg"` | Bildformat (`jpeg`, `png`) |
| `inline` | boolean | `false` | Base64 zusätzlich im result mitsenden |

</details>

<details>
<summary><code>set_wallpaper</code> – Setzt das Desktop-Hintergrundbild (Pfad oder URL)</summary>

Data point: `cmd.set_wallpaper` – input – JSON, short form or `true` (= default options)  
Short form: `source`

Examples:

```
https://picsum.photos/1920/1080
```

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | string | required | Pfad oder URL |

</details>

<details>
<summary><code>brightness</code> – Setzt die Helligkeit (nur interne Laptop-Displays, 0-100)</summary>

Data point: `cmd.brightness` – input – JSON, short form or `true` (= default options)  
Short form: `level`

Examples:

```
60
```

| Option | Type | Default | Description |
|---|---|---|---|
| `level` | integer | required | 0 - 100 |

</details>

#### Input

<details>
<summary><code>send_keys</code> – Sendet Tastendrücke (SendKeys-Syntax: ^=Strg, %=Alt, +=Umschalt, {ENTER}, {F5} ...)</summary>

Data point: `cmd.send_keys` – input – JSON, short form or `true` (= default options)  
Short form: `keys`

Examples:

```
^c
%{F4}
{ENTER}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `keys` | string | required | z.B. ^c oder %{F4} oder {ENTER} |

</details>

<details>
<summary><code>type_text</code> – Tippt Text in das aktive Fenster</summary>

Data point: `cmd.type_text` – input – JSON, short form or `true` (= default options)  
Short form: `text`

Examples:

```
Hallo Welt
```

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | string | required | Text |

</details>

<details>
<summary><code>mouse</code> – Bewegt/klickt die Maus</summary>

Data point: `cmd.mouse` – input – JSON, short form or `true` (= default options)  

Examples:

```
{"x":100,"y":200,"click":"single"}
{"wheel":-3}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `x` | integer |  | X-Koordinate |
| `y` | integer |  | Y-Koordinate |
| `relative` | boolean | `false` | Relativ zur aktuellen Position |
| `click` | string | `"none"` | Klickart (`none`, `single`, `double`) |
| `button` | string | `"left"` | Taste (`left`, `right`, `middle`) |
| `wheel` | integer |  | Scrollrad-Schritte (+ hoch / - runter) |

</details>

<details>
<summary><code>clipboard_set</code> – Setzt den Text der Zwischenablage</summary>

Data point: `cmd.clipboard_set` – input – JSON, short form or `true` (= default options)  
Short form: `text`

Examples:

```
Text für die Zwischenablage
```

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | string | required | Text |

</details>

<details>
<summary><code>clipboard_get</code> – Liest den Text der Zwischenablage</summary>

Data point: `cmd.clipboard_get` – button – click to run  

</details>

### States (`<pc>.state.*`)

| Data point | Type | Unit | Writable | Description |
|---|---|---|---|---|
| `state.locked` | boolean |  |  | Bildschirm gesperrt |
| `state.user_present` | boolean |  |  | Benutzer aktiv (nicht gesperrt und Eingabe innerhalb der Idle-Schwelle) |
| `state.idle` | number | s |  | Sekunden seit der letzten Maus-/Tastatureingabe |
| `state.active_window` | string |  |  | Titel des aktiven Fensters |
| `state.active_process` | string |  |  | Prozess des aktiven Fensters |
| `state.volume` | number | % | yes | Master-Lautstärke |
| `state.muted` | boolean |  | yes | Stummgeschaltet |
| `state.cpu` | number | % |  | CPU-Auslastung |
| `state.ram` | number | % |  | RAM-Auslastung |
| `state.ram_free_gb` | number | GB |  | Freier Arbeitsspeicher |
| `state.uptime_min` | number | min |  | Laufzeit seit Windows-Start |
| `state.battery` | number | % |  | Akkustand (nur Geräte mit Akku) |
| `state.charging` | boolean |  |  | Netzteil angeschlossen (nur Geräte mit Akku) |
| `state.monitors` | number |  |  | Anzahl Monitore |
| `state.ip` | string |  |  | Lokale IPv4-Adresse |
| `state.user` | string |  |  | Angemeldeter Benutzer |
| `state.keep_awake` | boolean |  | yes | keep_awake aktiv |
| `state.disk.<laufwerk>_free_gb` | number | GB |  | Freier Platz je Festplatte (dynamisch) |
| `state.disk.<laufwerk>_used_percent` | number | % |  | Belegung je Festplatte (dynamisch) |
| `state.proc.<name>` | boolean |  |  | Prozess läuft (aus Config 'WatchProcesses', dynamisch) |
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