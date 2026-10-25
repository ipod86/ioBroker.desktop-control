![Logo](admin/desktop-control.png)
# ioBroker.desktop-control

[![NPM version](https://img.shields.io/npm/v/iobroker.desktop-control.svg)](https://www.npmjs.com/package/iobroker.desktop-control)
[![Downloads](https://img.shields.io/npm/dm/iobroker.desktop-control.svg)](https://www.npmjs.com/package/iobroker.desktop-control)
![Number of Installations](https://iobroker.live/badges/desktop-control-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/desktop-control-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.desktop-control.png?downloads=true)](https://nodei.co/npm/iobroker.desktop-control/)

**Tests:** ![Test and Release](https://github.com/ipod86/ioBroker.desktop-control/workflows/Test%20and%20Release/badge.svg)

## desktop-control Adapter für ioBroker

Steuert Windows-PCs aus ioBroker: Popups, Programme, Audio, Sprachausgabe, Screenshots, Energie, Tastatur/Maus und mehr. Auf jedem PC läuft der kleine **WinCtl**-Agent (eine einzelne exe, kein Installer); Adapter und Agent sprechen über **MQTT**.

Der Agent beschreibt sich selbst: Er veröffentlicht alle Befehle, Parameter und States als Manifest, und der Adapter legt daraus die Datenpunkte an. Neue Befehle des Agents erscheinen deshalb ohne Adapter-Update.

## Voraussetzungen

- Der WinCtl-Agent auf jedem zu steuernden PC: `WinCtl.exe` aus [den Releases](https://github.com/ipod86/WinCtl/releases) herunterladen
- Sonst nichts: Der Adapter hat einen eingebauten MQTT-Broker. Alternativ kann ein vorhandener Broker (Mosquitto, ioBroker-MQTT-Adapter) genutzt werden.

## Einrichtung

1. Adapter-Einstellungen: „Eingebauter Broker“ lassen (Standard-Port 1886). Optional Benutzername und Passwort setzen – die Agents müssen sich dann damit anmelden.
2. `WinCtl.exe` auf dem PC starten und in den Einstellungen die **IP-Adresse des ioBroker-Servers**, den Port (1886) und die Anmeldung eintragen.
3. Jeder PC erscheint als Gerät, sobald er sich verbindet.

### Broker: eingebaut oder vorhandener

Adapter und Agents tauschen alles über einen MQTT-Broker aus. Zwei Möglichkeiten:

| | Eingebauter Broker (Standard) | Vorhandener Broker |
|---|---|---|
| Aufbau | `WinCtl.exe` → **Adapter** (Port 1886) | `WinCtl.exe` → Broker ← Adapter |
| Adapter-Einstellung | „Eingebauter Broker“, Port, optional Benutzer/Passwort | „Vorhandener Broker“ + Adresse, Port, Anmeldung des Brokers |
| Im Agent eintragen | IP des ioBroker-Servers, Port 1886, Anmeldung aus dem Adapter | Adresse, Port und Anmeldung des Brokers |
| Geeignet für | die meisten Installationen – nichts weiter zu installieren | wenn schon Mosquitto oder der ioBroker-MQTT-Adapter läuft, ACLs/TLS gewünscht sind oder andere Programme mitlesen sollen |

Der Port des eingebauten Brokers (1886) ist absichtlich nicht 1883, damit er sich nicht mit einem vorhandenen Broker oder dem MQTT-Adapter beißt.

## Datenpunkte

### Übersicht

| Datenpunkt | Beschreibung |
|---|---|
| `info.connection` | Adapter mit dem MQTT-Broker verbunden |
| `<PC>.online` | Agent dieses PCs verbunden |
| `<PC>.lastSeen` | Zeitpunkt der letzten Nachricht vom Agent |
| `<PC>.info.*` | Informationen zum PC (siehe unten) |
| `<PC>.state.*` | Werte, die der Agent meldet (siehe [States](#states-pcstate)) |
| `<PC>.event.*` | Ereignisse des PCs (siehe unten) |
| `<PC>.cmd.*` | Ein Datenpunkt je Befehl (siehe [Befehle](#befehle-pccmd)) |
| `<PC>.cmd.result` | Ergebnis des letzten Befehls, z. B. die Antwort von `ask` |
| `<PC>.screenshot` | Pfad des letzten Screenshots im ioBroker-Dateispeicher, z. B. `/desktop-control.0/screenshots/<PC>.jpg` |
| `<PC>.cmd.wake` | Schaltet den PC per Wake-on-LAN ein – macht der Adapter selbst, funktioniert also auch, wenn der PC aus ist |
| `all.cmd.*` | Schickt einen Befehl an alle PCs gleichzeitig (`all.cmd.wake` weckt alle ausgeschalteten PCs) |

### Info (`<PC>.info.*`)

| Datenpunkt | Beschreibung |
|---|---|
| `hostname` | Computername |
| `ip` | IP-Adresse |
| `version` | Version des Agents |
| `os` | Windows-Version |
| `user` | Angemeldeter Benutzer |
| `started` | Startzeit des Agents |
| `mac` | MAC-Adresse der Netzwerkkarte (für Wake-on-LAN) |
| `apps` | Programm-Aliase, die der Agent starten darf (JSON-Liste) |

### Ereignisse (`<PC>.event.*`)

Wird bei jedem Ereignis geschrieben (auch bei gleichem Inhalt), ein Trigger mit `change: 'any'` reagiert also jedes Mal. Der Wert ist JSON, z. B. `{"ts":"2026-10-23T12:00:00Z"}`.

| Datenpunkt | Wann |
|---|---|
| `lock` / `unlock` | Bildschirm gesperrt / entsperrt |
| `logon` / `logoff` | Benutzer an- / abgemeldet |
| `remote_connect` / `remote_disconnect` | Remotedesktop-Sitzung verbunden / getrennt |
| `suspend` / `resume` | PC geht in Standby / wacht auf |
| `hotkey` | Ein Tastenkürzel aus den Agent-Einstellungen wurde gedrückt: `{"name":"szene_kino","keys":"ctrl+alt+1"}` |

### Befehle (`<PC>.cmd.*`)

- **Knopf:** Befehle ohne Optionen – Klick führt aus.
- **Knopf + `_json`-Eingabe:** Befehle, deren Optionen alle optional sind (z. B. `screenshot`, `mute`, `beep`): Der Knopf führt mit Standardwerten aus, `cmd.<befehl>_json` nimmt die Optionen.
- **Eingabe:** Befehle mit Pflichtangabe. Hineinschreiben:
  - die **Kurzform**: nur der Wert der Hauptoption, z. B. `Hallo` in `cmd.speak`
  - **JSON** mit beliebigen Optionen, z. B. `{"text":"Hallo","rate":2}`
  - `true` – führt den Befehl mit den Standardwerten aus
- In der Objektbeschreibung jedes Befehls-Datenpunkts stehen seine Optionen und ein Beispiel.
- Das Ergebnis steht in `<PC>.cmd.result`.
- Sicherheitsrelevante Befehle (z. B. `shell`) und im Agent abgeschaltete Befehle bekommen keinen Datenpunkt; sie gehen nur per `sendTo`. `run` und `kill` bekommen einen Datenpunkt, solange der Agent nur Programme aus seiner Alias-Liste startet („beliebige Programme erlauben“ aus); `cmd.run` bietet die Aliase zur Auswahl an.

<!-- generated:start -->
_Erzeugt aus dem Agent (`docs/protocol.json`, Agent-Version 0.6.1)._

#### System

<details>
<summary><code>ping</code> – Lebenszeichen - antwortet mit Zeitstempel und Version</summary>

Datenpunkt: `cmd.ping` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>get_state</code> – Veröffentlicht alle State-Werte sofort neu</summary>

Datenpunkt: `cmd.get_state` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>reload_config</code> – Config-Datei neu einlesen und neu verbinden</summary>

Datenpunkt: `cmd.reload_config` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>exit</code> – Beendet den Agent</summary>

Datenpunkt: `cmd.exit` – kein Datenpunkt (sicherheitsrelevant) – nur per `sendTo`  

</details>

<details>
<summary><code>list_commands</code> – Gibt die Liste aller Befehle zurück</summary>

Datenpunkt: `cmd.list_commands` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>check_update</code> – Prüft, ob es eine neuere WinCtl-Version gibt (GitHub-Releases)</summary>

Datenpunkt: `cmd.check_update` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>update</code> – Installiert die neueste WinCtl-Version und startet den Agent neu</summary>

Datenpunkt: `cmd.update` – Knopf – Klick führt aus  

</details>

#### Energie & Sitzung

<details>
<summary><code>lock</code> – Sperrt den Bildschirm (Win+L)</summary>

Datenpunkt: `cmd.lock` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>sleep</code> – Standby</summary>

Datenpunkt: `cmd.sleep` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>hibernate</code> – Ruhezustand</summary>

Datenpunkt: `cmd.hibernate` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>shutdown</code> – Fährt den PC herunter</summary>

Datenpunkt: `cmd.shutdown` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.shutdown_json` für die Optionen  
Kurzform: `delay`

Beispiele:

```
60
{"delay":0,"force":true}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `delay` | integer | `10` | Verzögerung in Sekunden |
| `force` | boolean | `false` | Programme zwangsweise schließen |

</details>

<details>
<summary><code>restart</code> – Startet den PC neu</summary>

Datenpunkt: `cmd.restart` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.restart_json` für die Optionen  
Kurzform: `delay`

Beispiele:

```
30
{"delay":0,"force":true}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `delay` | integer | `10` | Verzögerung in Sekunden |
| `force` | boolean | `false` | Programme zwangsweise schließen |

</details>

<details>
<summary><code>logoff</code> – Meldet den Benutzer ab</summary>

Datenpunkt: `cmd.logoff` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>cancel_shutdown</code> – Bricht einen geplanten Shutdown/Neustart ab</summary>

Datenpunkt: `cmd.cancel_shutdown` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>monitor_off</code> – Schaltet die Monitore aus</summary>

Datenpunkt: `cmd.monitor_off` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>monitor_on</code> – Weckt die Monitore auf</summary>

Datenpunkt: `cmd.monitor_on` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>screensaver</code> – Startet den Bildschirmschoner (der in Windows eingestellte oder eine .scr-Datei)</summary>

Datenpunkt: `cmd.screensaver` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.screensaver_json` für die Optionen  
Kurzform: `file`

Beispiele:

```
{"file":"C:/Windows/System32/Mystify.scr"}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `file` | string | `""` | Pfad zu einer .scr-Datei (leer = der in Windows eingestellte) |

</details>

<details>
<summary><code>keep_awake</code> – Verhindert Standby/Bildschirmschoner (bis auf Widerruf)</summary>

Datenpunkt: `cmd.keep_awake` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.keep_awake_json` für die Optionen  
Kurzform: `state`

Beispiele:

```
{"state":true,"display":false}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `state` | boolean | `true` | an/aus |
| `display` | boolean | `true` | auch Bildschirm anlassen |

</details>

#### Programme & Fenster

<details>
<summary><code>run</code> – Startet ein Programm (Alias aus der Config oder - wenn erlaubt - beliebiger Pfad) mit Parametern</summary>

Datenpunkt: `cmd.run` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte) (Datenpunkt nur, solange der Agent nur Programme aus seiner Alias-Liste startet)  
Kurzform: `path`

Beispiele:

```
notepad
{"path":"kodi","args":"--fullscreen","window":"maximized"}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `path` | string | Pflicht | Alias (z.B. 'notepad') oder Pfad zur .exe |
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

Datenpunkt: `cmd.open` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `target`

Beispiele:

```
https://www.iobroker.net
ms-settings:display
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `target` | string | Pflicht | URL (immer erlaubt), sonst Alias/Pfad |

</details>

<details>
<summary><code>kill</code> – Beendet Prozesse nach Name oder PID</summary>

Datenpunkt: `cmd.kill` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte) (Datenpunkt nur, solange der Agent nur Programme aus seiner Alias-Liste startet)  
Kurzform: `name`

Beispiele:

```
notepad
{"pid":1234}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `name` | string |  | Prozessname, z.B. 'chrome' |
| `pid` | integer |  | Prozess-ID |

</details>

<details>
<summary><code>list_processes</code> – Listet laufende Prozesse (max. 300)</summary>

Datenpunkt: `cmd.list_processes` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `filter`

Beispiele:

```
chrome
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `filter` | string |  | Namensfilter |

</details>

<details>
<summary><code>list_windows</code> – Listet sichtbare Fenster mit Titel</summary>

Datenpunkt: `cmd.list_windows` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>focus_window</code> – Bringt ein Fenster (Titel enthält ...) in den Vordergrund</summary>

Datenpunkt: `cmd.focus_window` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `title`

Beispiele:

```
Kodi
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `title` | string | Pflicht | Teil des Fenstertitels |

</details>

<details>
<summary><code>close_window</code> – Schließt ein Fenster sauber (Titel enthält ...)</summary>

Datenpunkt: `cmd.close_window` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `title`

Beispiele:

```
Editor
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `title` | string | Pflicht | Teil des Fenstertitels |

</details>

<details>
<summary><code>minimize_all</code> – Alle Fenster minimieren (Desktop anzeigen) bzw. wiederherstellen</summary>

Datenpunkt: `cmd.minimize_all` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.minimize_all_json` für die Optionen  

Beispiele:

```
{"undo":true}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `undo` | boolean | `false` | Wiederherstellen statt minimieren |

</details>

<details>
<summary><code>empty_recycle_bin</code> – Leert den Papierkorb</summary>

Datenpunkt: `cmd.empty_recycle_bin` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>shell</code> – Führt einen Shell-Befehl aus und liefert die Ausgabe (nur mit AllowShell=true)</summary>

Datenpunkt: `cmd.shell` – kein Datenpunkt (sicherheitsrelevant) – nur per `sendTo`  
Kurzform: `command`

Beispiele:

```
Get-Date
{"command":"ipconfig","shell":"cmd"}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `command` | string | Pflicht | Befehl / Skript |
| `shell` | string | `"powershell"` | Interpreter (`powershell`, `cmd`) |
| `timeout` | integer | `30` | Sekunden |

</details>

#### Audio

<details>
<summary><code>volume</code> – Setzt die Master-Lautstärke (0-100)</summary>

Datenpunkt: `cmd.volume` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `level`

Beispiele:

```
30
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `level` | integer | Pflicht | 0 - 100 |

</details>

<details>
<summary><code>volume_change</code> – Lautstärke relativ ändern</summary>

Datenpunkt: `cmd.volume_change` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.volume_change_json` für die Optionen  
Kurzform: `delta`

Beispiele:

```
-10
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `delta` | integer | `5` | z.B. 5 oder -10 |

</details>

<details>
<summary><code>mute</code> – Stummschalten / aufheben / umschalten</summary>

Datenpunkt: `cmd.mute` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.mute_json` für die Optionen  
Kurzform: `state`

Beispiele:

```
toggle
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `state` | string | `"toggle"` | true / false / toggle |

</details>

<details>
<summary><code>media</code> – Sendet eine Medientaste</summary>

Datenpunkt: `cmd.media` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `key`

Beispiele:

```
playpause
next
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `key` | string | Pflicht | Medientaste (`playpause`, `next`, `prev`, `stop`, `volume_up`, `volume_down`, `mute`) |

</details>

<details>
<summary><code>speak</code> – Text-to-Speech (Windows-Stimme)</summary>

Datenpunkt: `cmd.speak` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `text`

Beispiele:

```
Das Essen ist fertig
{"text":"Achtung","voice":"Hedda","rate":2,"volume":80}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `text` | string | Pflicht | Zu sprechender Text |
| `voice` | string |  | Teil des Stimmennamens, z.B. 'Hedda' |
| `rate` | integer | `0` | -10 (langsam) bis 10 (schnell) |
| `volume` | integer | `100` | 0-100 |
| `wait` | boolean |  | Warten bis fertig gesprochen |
| `interrupt` | boolean | `true` | Laufende Ausgabe abbrechen |

</details>

<details>
<summary><code>list_voices</code> – Listet installierte TTS-Stimmen</summary>

Datenpunkt: `cmd.list_voices` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>play_sound</code> – Spielt eine Audiodatei (mp3/wav/wma, Pfad oder URL)</summary>

Datenpunkt: `cmd.play_sound` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `source`

Beispiele:

```
http://192.168.1.5/gong.mp3
{"source":"C:\\Sounds\\klingel.wav","wait":true}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `source` | string | Pflicht | Pfad oder URL |
| `wait` | boolean | `false` | Warten bis zum Ende |

</details>

<details>
<summary><code>stop_sound</code> – Stoppt play_sound / speak</summary>

Datenpunkt: `cmd.stop_sound` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>beep</code> – Einfacher Piepton</summary>

Datenpunkt: `cmd.beep` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.beep_json` für die Optionen  

Beispiele:

```
{"freq":1200,"ms":500}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `freq` | integer | `800` | Hz |
| `ms` | integer | `300` | Dauer in ms |

</details>

#### Anzeige

<details>
<summary><code>show_image</code> – Zeigt ein Bild als Popup, Vollbild oder Ecken-Einblendung (Pfad, URL oder Base64)</summary>

Datenpunkt: `cmd.show_image` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `source`

Beispiele:

```
http://kamera/snapshot.jpg
{"source":"http://kamera/snapshot.jpg","mode":"corner","position":"top-right","size":30,"seconds":10,"caption":"Haustür","slot":"klingel"}
{"source":"https://picsum.photos/1920/1080","mode":"fullscreen","seconds":15}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `source` | string | Pflicht | Pfad, http(s)-URL oder data:-URI |
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
<summary><code>show_video</code> – Spielt ein Video ab (Datei oder URL; mit Edge mp4/H.264, WebM, Ogg, je nach Windows-Codecs auch HEVC)</summary>

Datenpunkt: `cmd.show_video` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `source`

Beispiele:

```
http://server/video.mp4
{"source":"http://server/video.mp4","mode":"corner","position":"bottom-left","size":25,"muted":true,"loop":true}
{"source":"C:\\Videos\\intro.mp4","mode":"fullscreen","close_when_done":true}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `source` | string | Pflicht | Pfad oder URL |
| `loop` | boolean | `false` | Endlosschleife |
| `muted` | boolean | `false` | Ohne Ton |
| `volume` | number | `1` | 0 - 1 |
| `controls` | boolean | `false` | Bedienelemente anzeigen |
| `close_when_done` | boolean | `true` | Nach Ende schließen |
| `engine` | string | `"auto"` | Player: auto = Edge (WebView2), sonst IE11; edge = nur Edge; ie = altes IE11 (`auto`, `edge`, `ie`) |
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
<summary><code>show_web</code> – Zeigt eine Webseite (z.B. vis, Lovelace, Kamera-Stream) mit Edge/Chromium in einem Fenster oder als Kiosk-Vollbild, auch mehrere im Wechsel (Diashow)</summary>

Datenpunkt: `cmd.show_web` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `url`

Beispiele:

```
http://192.168.1.5:8082/vis/
{"url":"http://192.168.1.5:8082/vis/","mode":"fullscreen"}
{"urls":["http://192.168.1.5:8082/vis/","http://kamera/snapshot.jpg"],"interval":20,"mode":"fullscreen"}
{"url":"http://kamera/stream","mode":"corner","size":35,"seconds":30,"slot":"kamera"}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `url` | string |  | Adresse (oder 'urls' für eine Diashow) |
| `urls` | array |  | Diashow: mehrere Adressen, wechseln nach 'interval' Sekunden |
| `interval` | number | `30` | Diashow: Sekunden je Seite |
| `zoom` | number | `1` | Zoom, z. B. 1.25 = 125 % (nur Edge) |
| `engine` | string | `"auto"` | Browser: auto = Edge (WebView2), sonst IE11; edge = nur Edge; ie = altes IE11 (`auto`, `edge`, `ie`) |
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

Datenpunkt: `cmd.show_text` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `text`

Beispiele:

```
Waschmaschine fertig
{"text":"Alarm!","size":60,"color":"#ffffff","bg":"#c00000","position":"center","seconds":10}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `text` | string | Pflicht | Text |
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

Datenpunkt: `cmd.ask` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `text`

Beispiele:

```
Licht ausschalten?
{"text":"Kinomodus starten?","buttons":["Ja","Nein"],"timeout":30}
{"text":"Wie warm soll es werden?","input":true,"default":"21","buttons":["OK","Abbrechen"]}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `text` | string | Pflicht | Fragetext |
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

Datenpunkt: `cmd.notify` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `text`

Beispiele:

```
Paket ist angekommen
{"text":"Fenster offen","title":"Heizung","icon":"warning","seconds":10}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `text` | string | Pflicht | Text |
| `title` | string | `"WinCtl"` | Titel |
| `icon` | string | `"info"` | Symbol (`info`, `warning`, `error`, `none`) |
| `seconds` | integer | `5` | Dauer |

</details>

<details>
<summary><code>close_popups</code> – Schließt alle Popups/Overlays/Dialoge von WinCtl</summary>

Datenpunkt: `cmd.close_popups` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>screenshot</code> – Macht einen Screenshot und veröffentlicht das Bild (JPEG/PNG-Rohdaten) auf <base>/<id>/screenshot</summary>

Datenpunkt: `cmd.screenshot` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.screenshot_json` für die Optionen  

Beispiele:

```
{"monitor":0,"scale":1,"format":"png"}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `monitor` | integer | `-1` | -1 = alle Monitore, 0 = erster ... |
| `scale` | number | `0.5` | Verkleinerung 0.05 - 1 |
| `quality` | integer | `70` | JPEG-Qualität |
| `format` | string | `"jpeg"` | Bildformat (`jpeg`, `png`) |
| `inline` | boolean | `false` | Base64 zusätzlich im result mitsenden |

</details>

<details>
<summary><code>set_wallpaper</code> – Setzt das Desktop-Hintergrundbild (Pfad oder URL)</summary>

Datenpunkt: `cmd.set_wallpaper` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `source`

Beispiele:

```
https://picsum.photos/1920/1080
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `source` | string | Pflicht | Pfad oder URL |

</details>

<details>
<summary><code>brightness</code> – Setzt die Helligkeit (nur interne Laptop-Displays, 0-100)</summary>

Datenpunkt: `cmd.brightness` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `level`

Beispiele:

```
60
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `level` | integer | Pflicht | 0 - 100 |

</details>

#### Eingabe

<details>
<summary><code>start_menu</code> – Öffnet bzw. schließt das Startmenü (Windows-Taste)</summary>

Datenpunkt: `cmd.start_menu` – Knopf – Klick führt aus  

</details>

<details>
<summary><code>send_keys</code> – Sendet Tastendrücke (SendKeys-Syntax: ^=Strg, %=Alt, +=Umschalt, {ENTER}, {F5} ...)</summary>

Datenpunkt: `cmd.send_keys` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `keys`

Beispiele:

```
^c
%{F4}
{ENTER}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `keys` | string | Pflicht | z.B. ^c oder %{F4} oder {ENTER} |

</details>

<details>
<summary><code>type_text</code> – Tippt Text in das aktive Fenster</summary>

Datenpunkt: `cmd.type_text` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `text`

Beispiele:

```
Hallo Welt
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `text` | string | Pflicht | Text |

</details>

<details>
<summary><code>mouse</code> – Bewegt/klickt die Maus</summary>

Datenpunkt: `cmd.mouse` – Knopf (führt mit Standardwerten aus) + Eingabe `cmd.mouse_json` für die Optionen  

Beispiele:

```
{"x":100,"y":200,"click":"single"}
{"wheel":-3}
```

| Option | Typ | Standard | Beschreibung |
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

Datenpunkt: `cmd.clipboard_set` – Eingabe – JSON, Kurzform oder `true` (= Standardwerte)  
Kurzform: `text`

Beispiele:

```
Text für die Zwischenablage
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `text` | string | Pflicht | Text |

</details>

<details>
<summary><code>clipboard_get</code> – Liest den Text der Zwischenablage</summary>

Datenpunkt: `cmd.clipboard_get` – Knopf – Klick führt aus  

</details>

### States (`<PC>.state.*`)

| Datenpunkt | Typ | Einheit | Schreibbar | Beschreibung |
|---|---|---|---|---|
| `state.locked` | boolean |  |  | Bildschirm gesperrt |
| `state.user_present` | boolean |  |  | Benutzer aktiv (nicht gesperrt und Eingabe innerhalb der Idle-Schwelle) |
| `state.idle` | number | s |  | Sekunden seit der letzten Maus-/Tastatureingabe |
| `state.active_window` | string |  |  | Titel des aktiven Fensters |
| `state.active_process` | string |  |  | Prozess des aktiven Fensters |
| `state.volume` | number | % | ja | Master-Lautstärke |
| `state.muted` | boolean |  | ja | Stummgeschaltet |
| `state.cpu` | number | % |  | CPU-Auslastung |
| `state.ram` | number | % |  | RAM-Auslastung |
| `state.ram_free_gb` | number | GB |  | Freier Arbeitsspeicher |
| `state.uptime_min` | number | min |  | Laufzeit seit Windows-Start |
| `state.battery` | number | % |  | Akkustand (nur Geräte mit Akku) |
| `state.charging` | boolean |  |  | Netzteil angeschlossen (nur Geräte mit Akku) |
| `state.monitors` | number |  |  | Anzahl Monitore |
| `state.ip` | string |  |  | Lokale IPv4-Adresse |
| `state.user` | string |  |  | Angemeldeter Benutzer |
| `state.keep_awake` | boolean |  | ja | keep_awake aktiv |
| `state.webcam_in_use` | boolean |  |  | Kamera wird gerade benutzt (z.B. Videokonferenz) |
| `state.webcam_app` | string |  |  | Programm(e), die die Kamera benutzen |
| `state.mic_in_use` | boolean |  |  | Mikrofon wird gerade benutzt |
| `state.mic_app` | string |  |  | Programm(e), die das Mikrofon benutzen |
| `state.web_url` | string |  |  | Seite, die show_web gerade anzeigt (leer = keine) |
| `state.update_available` | boolean |  |  | Neuere WinCtl-Version verfügbar (Prüfung beim Start und alle 12 h) |
| `state.latest_version` | string |  |  | Neueste WinCtl-Version auf GitHub |
| `state.disk.<laufwerk>_free_gb` | number | GB |  | Freier Platz je Festplatte (dynamisch) |
| `state.disk.<laufwerk>_used_percent` | number | % |  | Belegung je Festplatte (dynamisch) |
| `state.proc.<name>` | boolean |  |  | Prozess läuft (aus Config 'WatchProcesses', dynamisch) |
<!-- generated:end -->

## Skripte (sendTo)

```js
// Befehl an einen PC (Geräte-ID oder Hostname), die Antwort ist das Ergebnis des Agents
sendTo('desktop-control.0', 'cmd', { device: 'buero-pc', command: 'speak', params: { text: 'Essen ist fertig' } }, res => log(JSON.stringify(res)));

// Kurzform für den Hauptparameter
sendTo('desktop-control.0', 'cmd', { device: 'buero-pc', command: 'volume', params: 30 });

// Frage mit Buttons, wartet auf die Antwort (Timeout für Rückfragen aus den Einstellungen)
sendTo('desktop-control.0', 'cmd', {
    device: 'wohnzimmer',
    command: 'ask',
    params: { text: 'Kinomodus starten?', buttons: ['Ja', 'Nein'], timeout: 30 },
}, res => log(res.result && res.result.button));

// alle PCs, Geräteliste
sendTo('desktop-control.0', 'cmd', { device: 'all', command: 'lock' });
sendTo('desktop-control.0', 'devices', {}, list => log(JSON.stringify(list)));
```

Die Antwort hat die Form `{ ok, command, result, error }`.

## Wake-on-LAN

Der Agent meldet die MAC-Adresse seiner Netzwerkkarte; der Adapter merkt sie sich, damit `cmd.wake` auch nach einem Neustart funktioniert, während der PC aus ist. Voraussetzungen: Wake-on-LAN im BIOS/UEFI und in der Netzwerkkarte aktiviert (Geräte-Manager → Netzwerkkarte → Energieverwaltung / Erweitert), PC per Kabel angeschlossen, ioBroker im selben Netz. Der Windows-„Schnellstart“ kann das Wecken aus dem heruntergefahrenen Zustand verhindern – dann abschalten.

## Agent aktualisieren

Der Agent sucht beim Start und danach alle 12 Stunden auf GitHub nach einer neuen Version (abschaltbar in den Agent-Einstellungen → „Allgemein“). Er **installiert nicht von selbst**, er meldet nur:

- `<PC>.state.update_available` – `true`, wenn eine neuere Version da ist
- `<PC>.state.latest_version` – neueste Version auf GitHub; die installierte steht in `<PC>.info.version`

Installieren:

- **aus ioBroker:** Knopf `<PC>.cmd.update` – lädt die neue exe, prüft die Prüfsumme, tauscht sie aus und startet den Agent neu. Nach einigen Sekunden ist der PC wieder online, mit neuer Version in `info.version`.
- **am PC:** Tray-Symbol → „Nach Update suchen …“ – zeigt die Neuerungen und fragt, ob installiert werden soll.
- `<PC>.cmd.check_update` prüft sofort, ohne zu installieren.

Automatisch per Skript, z. B. nachts:

```js
on({ id: /^desktop-control\.0\.[^.]+\.state\.update_available$/, val: true }, obj => {
    setState(obj.id.replace('state.update_available', 'cmd.update'), true);
});
```

Voraussetzung: Die exe liegt in einem Ordner, in den der Benutzer schreiben darf (z. B. `C:\Tools\WinCtl` oder Downloads, nicht `C:\Program Files`).

## Sicherheit

Wer auf `winctl/+/cmd/#` schreiben darf, steuert den PC. Den Broker mit Benutzer/Passwort und ACLs absichern, bei Bedarf TLS nutzen. Standardmäßig startet der Agent nur Programme aus seiner Alias-Liste, und `shell` ist aus.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
* (ipod86) Agent 0.6.1: `show_video` nutzt ebenfalls Microsoft Edge (WebView2)
* (ipod86) Agent 0.6.0: `show_web` nutzt Microsoft Edge (WebView2), Optionen `zoom` und `engine`, State `web_url`
* (ipod86) Agent 0.5.0: `show_web` als Diashow, Befehle `screensaver` und `start_menu`
-->
### **WORK IN PROGRESS**
* (ipod86) Erste Version
* (ipod86) Eingebauter MQTT-Broker
* (ipod86) Wake-on-LAN (`cmd.wake`), Kamera/Mikrofon in Benutzung (`state.webcam_in_use`, `state.mic_in_use`)
* (ipod86) Agent-Update aus ioBroker: `state.update_available`, `state.latest_version`, Knopf `cmd.update`
* (ipod86) Alle Befehlsoptionen über die Datenpunkte einstellbar; Beschreibung mit Optionen und Beispiel; Befehls- und State-Referenz in der README

Ältere Einträge stehen in [CHANGELOG_OLD.md](CHANGELOG_OLD.md).
