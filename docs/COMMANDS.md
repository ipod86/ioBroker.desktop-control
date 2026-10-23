# Befehlsreferenz

_Automatisch erzeugt aus `WinCtl.exe --dump-protocol` (Protokoll 1, Version 0.1.0). Nicht von Hand ändern._

Befehle werden an `{base}/{id}/cmd/<befehl>` gesendet (Payload: JSON-Objekt oder - bei Befehlen mit *Kurzform* - ein einfacher String).

## System

### `ping`
Lebenszeichen - antwortet mit Zeitstempel und Version  

### `get_state`
Veröffentlicht alle State-Werte sofort neu  

### `reload_config`
Config-Datei neu einlesen und neu verbinden  

### `exit`  _(⚠ sicherheitsrelevant)_
Beendet den Agent  

### `list_commands`
Gibt die Liste aller Befehle zurück  

## Energie & Sitzung

### `lock`
Sperrt den Bildschirm (Win+L)  

### `sleep`
Standby  

### `hibernate`
Ruhezustand  

### `shutdown`  _(⚠ sicherheitsrelevant)_
Fährt den PC herunter  
Kurzform: Payload `<text>` entspricht `{"delay": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `delay` | integer |  | 10 | Verzögerung in Sekunden |
| `force` | boolean |  | false | Programme zwangsweise schließen |

### `restart`  _(⚠ sicherheitsrelevant)_
Startet den PC neu  
Kurzform: Payload `<text>` entspricht `{"delay": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `delay` | integer |  | 10 | Verzögerung in Sekunden |
| `force` | boolean |  | false | Programme zwangsweise schließen |

### `logoff`  _(⚠ sicherheitsrelevant)_
Meldet den Benutzer ab  

### `cancel_shutdown`
Bricht einen geplanten Shutdown/Neustart ab  

### `monitor_off`
Schaltet die Monitore aus  

### `monitor_on`
Weckt die Monitore auf  

### `keep_awake`  _(braucht GUI-Sitzung)_
Verhindert Standby/Bildschirmschoner (bis auf Widerruf)  
Kurzform: Payload `<text>` entspricht `{"state": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `state` | boolean |  | true | an/aus |
| `display` | boolean |  | true | auch Bildschirm anlassen |

## Programme & Fenster

### `run`  _(⚠ sicherheitsrelevant)_
Startet ein Programm (Alias aus der Config oder - wenn erlaubt - beliebiger Pfad) mit Parametern  
Kurzform: Payload `<text>` entspricht `{"path": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `path` | string | ja |  | Alias (z.B. 'notepad') oder Pfad zur .exe |
| `args` | string |  |  | Parameter als String oder Liste |
| `workdir` | string |  |  | Arbeitsverzeichnis |
| `hidden` | boolean |  |  | Ohne Fenster starten |
| `window` | string |  |  | Fensterzustand (normal / minimized / maximized) |
| `admin` | boolean |  |  | Als Administrator (UAC-Abfrage am PC!) |
| `wait` | boolean |  |  | Auf Ende warten und Exit-Code zurückgeben |
| `timeout` | integer |  | 60 | Wartezeit in Sekunden bei wait |

### `open`
Öffnet URL, Datei oder Ordner mit der Standard-App (Dateien/Ordner nur mit AllowAnyRun)  
Kurzform: Payload `<text>` entspricht `{"target": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `target` | string | ja |  | URL (immer erlaubt), sonst Alias/Pfad |

### `kill`  _(⚠ sicherheitsrelevant)_
Beendet Prozesse nach Name oder PID  
Kurzform: Payload `<text>` entspricht `{"name": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `name` | string |  |  | Prozessname, z.B. 'chrome' |
| `pid` | integer |  |  | Prozess-ID |

### `list_processes`
Listet laufende Prozesse (max. 300)  
Kurzform: Payload `<text>` entspricht `{"filter": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `filter` | string |  |  | Namensfilter |

### `list_windows`
Listet sichtbare Fenster mit Titel  

### `focus_window`
Bringt ein Fenster (Titel enthält ...) in den Vordergrund  
Kurzform: Payload `<text>` entspricht `{"title": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `title` | string | ja |  | Teil des Fenstertitels |

### `close_window`
Schließt ein Fenster sauber (Titel enthält ...)  
Kurzform: Payload `<text>` entspricht `{"title": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `title` | string | ja |  | Teil des Fenstertitels |

### `minimize_all`
Alle Fenster minimieren (Desktop anzeigen) bzw. wiederherstellen  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `undo` | boolean |  | false | Wiederherstellen statt minimieren |

### `empty_recycle_bin`
Leert den Papierkorb  

### `shell`  _(⚠ sicherheitsrelevant)_
Führt einen Shell-Befehl aus und liefert die Ausgabe (nur mit AllowShell=true)  
Kurzform: Payload `<text>` entspricht `{"command": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `command` | string | ja |  | Befehl / Skript |
| `shell` | string |  | "powershell" | Interpreter (powershell / cmd) |
| `timeout` | integer |  | 30 | Sekunden |

## Audio

### `volume`
Setzt die Master-Lautstärke (0-100)  
Kurzform: Payload `<text>` entspricht `{"level": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `level` | integer | ja |  | 0 - 100 |

### `volume_change`
Lautstärke relativ ändern  
Kurzform: Payload `<text>` entspricht `{"delta": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `delta` | integer |  | 5 | z.B. 5 oder -10 |

### `mute`
Stummschalten / aufheben / umschalten  
Kurzform: Payload `<text>` entspricht `{"state": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `state` | string |  | "toggle" | true / false / toggle |

### `media`
Sendet eine Medientaste  
Kurzform: Payload `<text>` entspricht `{"key": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `key` | string | ja |  | Medientaste (playpause / next / prev / stop / volume_up / volume_down / mute) |

### `speak`
Text-to-Speech (Windows-Stimme)  
Kurzform: Payload `<text>` entspricht `{"text": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `text` | string | ja |  | Zu sprechender Text |
| `voice` | string |  |  | Teil des Stimmennamens, z.B. 'Hedda' |
| `rate` | integer |  | 0 | -10 (langsam) bis 10 (schnell) |
| `volume` | integer |  | 100 | 0-100 |
| `wait` | boolean |  |  | Warten bis fertig gesprochen |
| `interrupt` | boolean |  | true | Laufende Ausgabe abbrechen |

### `list_voices`
Listet installierte TTS-Stimmen  

### `play_sound`
Spielt eine Audiodatei (mp3/wav/wma, Pfad oder URL)  
Kurzform: Payload `<text>` entspricht `{"source": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `source` | string | ja |  | Pfad oder URL |
| `wait` | boolean |  | false | Warten bis zum Ende |

### `stop_sound`
Stoppt play_sound / speak  

### `beep`
Einfacher Piepton  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `freq` | integer |  | 800 | Hz |
| `ms` | integer |  | 300 | Dauer in ms |

## Anzeige

### `show_image`  _(braucht GUI-Sitzung)_
Zeigt ein Bild als Popup, Vollbild oder Ecken-Einblendung (Pfad, URL oder Base64)  
Kurzform: Payload `<text>` entspricht `{"source": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `source` | string | ja |  | Pfad, http(s)-URL oder data:-URI |
| `base64` | string |  |  | Alternativ: Base64-Daten |
| `fit` | string |  | "contain" | Skalierung (contain / stretch / center) |
| `mode` | string |  | "popup" | popup = Fenster in der Mitte, fullscreen = Vollbild, corner = Ecke (z.B. Türklingel-Kamera) (popup / fullscreen / corner) |
| `seconds` | number |  |  | Automatisch schließen nach X Sekunden (0 = bleibt bis Klick/close_popups) |
| `monitor` | integer |  | -1 | Monitor-Index (0 = erster, -1 = Hauptmonitor) |
| `position` | string |  | "bottom-right" | Nur bei mode=corner (top-left / top-right / bottom-left / bottom-right) |
| `caption` | string |  |  | Beschriftung unter dem Inhalt |
| `slot` | string |  |  | Gleicher Slot ersetzt das vorherige Popup (z.B. Kamerabild aktualisieren) |
| `click_close` | boolean |  |  | Klick schließt das Popup |
| `opacity` | number |  |  | Deckkraft 0.1 - 1 |
| `activate` | boolean |  | false | Fokus übernehmen (Standard: nein, stört nicht beim Arbeiten) |
| `bg` | string |  |  | Hintergrundfarbe, z.B. #000000 |

### `show_video`  _(braucht GUI-Sitzung)_
Spielt ein Video ab (Datei oder URL, mp4/H.264 empfohlen)  
Kurzform: Payload `<text>` entspricht `{"source": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `source` | string | ja |  | Pfad oder URL |
| `loop` | boolean |  | false | Endlosschleife |
| `muted` | boolean |  | false | Ohne Ton |
| `volume` | number |  | 1 | 0 - 1 |
| `controls` | boolean |  | false | Bedienelemente anzeigen |
| `close_when_done` | boolean |  | true | Nach Ende schließen |
| `mode` | string |  | "popup" | popup = Fenster in der Mitte, fullscreen = Vollbild, corner = Ecke (z.B. Türklingel-Kamera) (popup / fullscreen / corner) |
| `seconds` | number |  |  | Automatisch schließen nach X Sekunden (0 = bleibt bis Klick/close_popups) |
| `monitor` | integer |  | -1 | Monitor-Index (0 = erster, -1 = Hauptmonitor) |
| `position` | string |  | "bottom-right" | Nur bei mode=corner (top-left / top-right / bottom-left / bottom-right) |
| `caption` | string |  |  | Beschriftung unter dem Inhalt |
| `slot` | string |  |  | Gleicher Slot ersetzt das vorherige Popup (z.B. Kamerabild aktualisieren) |
| `click_close` | boolean |  |  | Klick schließt das Popup |
| `opacity` | number |  |  | Deckkraft 0.1 - 1 |
| `activate` | boolean |  | false | Fokus übernehmen (Standard: nein, stört nicht beim Arbeiten) |
| `bg` | string |  |  | Hintergrundfarbe, z.B. #000000 |

### `show_web`  _(braucht GUI-Sitzung)_
Zeigt eine Webseite (z.B. Dashboard, Kamera-Stream) in einem Fenster oder als Kiosk-Vollbild  
Kurzform: Payload `<text>` entspricht `{"url": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `url` | string | ja |  | Adresse |
| `mode` | string |  | "popup" | popup = Fenster in der Mitte, fullscreen = Vollbild, corner = Ecke (z.B. Türklingel-Kamera) (popup / fullscreen / corner) |
| `seconds` | number |  |  | Automatisch schließen nach X Sekunden (0 = bleibt bis Klick/close_popups) |
| `monitor` | integer |  | -1 | Monitor-Index (0 = erster, -1 = Hauptmonitor) |
| `position` | string |  | "bottom-right" | Nur bei mode=corner (top-left / top-right / bottom-left / bottom-right) |
| `caption` | string |  |  | Beschriftung unter dem Inhalt |
| `slot` | string |  |  | Gleicher Slot ersetzt das vorherige Popup (z.B. Kamerabild aktualisieren) |
| `click_close` | boolean |  |  | Klick schließt das Popup |
| `opacity` | number |  |  | Deckkraft 0.1 - 1 |
| `activate` | boolean |  | false | Fokus übernehmen (Standard: nein, stört nicht beim Arbeiten) |
| `bg` | string |  |  | Hintergrundfarbe, z.B. #000000 |

### `show_text`  _(braucht GUI-Sitzung)_
Blendet Text als Overlay ein (klickdurchlässig)  
Kurzform: Payload `<text>` entspricht `{"text": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `text` | string | ja |  | Text |
| `seconds` | number |  | 5 | Anzeigedauer |
| `size` | number |  | 40 | Schriftgröße |
| `color` | string |  | "#ffffff" | Textfarbe |
| `bg` | string |  | "#202020" | Hintergrund |
| `opacity` | number |  | 0.9 | Deckkraft |
| `position` | string |  | "bottom" | Lage (top / center / bottom) |
| `monitor` | integer |  | -1 | Monitor-Index |
| `bold` | boolean |  | true | Fett |
| `font` | string |  | "Segoe UI" | Schriftart |
| `click_through` | boolean |  | true | Mausklicks gehen durch |
| `slot` | string |  |  | Ersetzt Overlay mit gleichem Slot |

### `ask`  _(braucht GUI-Sitzung)_
Zeigt einen Dialog mit Buttons/Eingabefeld und liefert die Antwort im result zurück  
Kurzform: Payload `<text>` entspricht `{"text": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `text` | string | ja |  | Fragetext |
| `title` | string |  |  | Titel |
| `buttons` | array |  | ["OK"] | Beschriftungen, z.B. ["Ja","Nein"] |
| `input` | boolean |  | false | Texteingabefeld anzeigen |
| `default` | string |  |  | Vorgabe im Eingabefeld |
| `password` | boolean |  | false | Eingabe verdecken |
| `timeout` | integer |  | 0 | Sekunden bis automatisch geschlossen (0 = nie) |

### `notify`  _(braucht GUI-Sitzung)_
Zeigt eine Windows-Benachrichtigung  
Kurzform: Payload `<text>` entspricht `{"text": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `text` | string | ja |  | Text |
| `title` | string |  | "WinCtl" | Titel |
| `icon` | string |  | "info" | Symbol (info / warning / error / none) |
| `seconds` | integer |  | 5 | Dauer |

### `close_popups`  _(braucht GUI-Sitzung)_
Schließt alle Popups/Overlays/Dialoge von WinCtl  

### `screenshot`  _(braucht GUI-Sitzung)_
Macht einen Screenshot und veröffentlicht das Bild (JPEG/PNG-Rohdaten) auf <base>/<id>/screenshot  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `monitor` | integer |  | -1 | -1 = alle Monitore, 0 = erster ... |
| `scale` | number |  | 0.5 | Verkleinerung 0.05 - 1 |
| `quality` | integer |  | 70 | JPEG-Qualität |
| `format` | string |  | "jpeg" | Bildformat (jpeg / png) |
| `inline` | boolean |  | false | Base64 zusätzlich im result mitsenden |

### `set_wallpaper`
Setzt das Desktop-Hintergrundbild (Pfad oder URL)  
Kurzform: Payload `<text>` entspricht `{"source": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `source` | string | ja |  | Pfad oder URL |

### `brightness`
Setzt die Helligkeit (nur interne Laptop-Displays, 0-100)  
Kurzform: Payload `<text>` entspricht `{"level": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `level` | integer | ja |  | 0 - 100 |

## Eingabe

### `send_keys`  _(braucht GUI-Sitzung)_
Sendet Tastendrücke (SendKeys-Syntax: ^=Strg, %=Alt, +=Umschalt, {ENTER}, {F5} ...)  
Kurzform: Payload `<text>` entspricht `{"keys": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `keys` | string | ja |  | z.B. ^c oder %{F4} oder {ENTER} |

### `type_text`  _(braucht GUI-Sitzung)_
Tippt Text in das aktive Fenster  
Kurzform: Payload `<text>` entspricht `{"text": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `text` | string | ja |  | Text |

### `mouse`
Bewegt/klickt die Maus  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `x` | integer |  |  | X-Koordinate |
| `y` | integer |  |  | Y-Koordinate |
| `relative` | boolean |  | false | Relativ zur aktuellen Position |
| `click` | string |  | "none" | Klickart (none / single / double) |
| `button` | string |  | "left" | Taste (left / right / middle) |
| `wheel` | integer |  |  | Scrollrad-Schritte (+ hoch / - runter) |

### `clipboard_set`  _(braucht GUI-Sitzung)_
Setzt den Text der Zwischenablage  
Kurzform: Payload `<text>` entspricht `{"text": "<text>"}`.  

| Parameter | Typ | Pflicht | Standard | Beschreibung |
|---|---|---|---|---|
| `text` | string | ja |  | Text |

### `clipboard_get`  _(braucht GUI-Sitzung)_
Liest den Text der Zwischenablage  

## States

| Topic (`{base}/{id}/state/…`) | Typ | Einheit | Rolle | Beschreibung |
|---|---|---|---|---|
| `locked` | boolean |  | `indicator` | Bildschirm gesperrt |
| `user_present` | boolean |  | `indicator` | Benutzer aktiv (nicht gesperrt und Eingabe innerhalb der Idle-Schwelle) |
| `idle` | number | s | `value` | Sekunden seit der letzten Maus-/Tastatureingabe |
| `active_window` | string |  | `text` | Titel des aktiven Fensters |
| `active_process` | string |  | `text` | Prozess des aktiven Fensters |
| `volume` | number | % | `level.volume` | Master-Lautstärke |
| `muted` | boolean |  | `media.mute` | Stummgeschaltet |
| `cpu` | number | % | `value` | CPU-Auslastung |
| `ram` | number | % | `value` | RAM-Auslastung |
| `ram_free_gb` | number | GB | `value` | Freier Arbeitsspeicher |
| `uptime_min` | number | min | `value` | Laufzeit seit Windows-Start |
| `battery` | number | % | `value.battery` | Akkustand (nur Geräte mit Akku) |
| `charging` | boolean |  | `indicator` | Netzteil angeschlossen (nur Geräte mit Akku) |
| `monitors` | number |  | `value` | Anzahl Monitore |
| `ip` | string |  | `text` | Lokale IPv4-Adresse |
| `user` | string |  | `text` | Angemeldeter Benutzer |
| `keep_awake` | boolean |  | `indicator` | keep_awake aktiv |
| `disk/<laufwerk>_free_gb` | number | GB | `value` | Freier Platz je Festplatte (dynamisch) |
| `disk/<laufwerk>_used_percent` | number | % | `value` | Belegung je Festplatte (dynamisch) |
| `proc/<name>` | boolean |  | `indicator` | Prozess läuft (aus Config 'WatchProcesses', dynamisch) |
