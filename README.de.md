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

- Ein MQTT-Broker (z. B. Mosquitto oder der ioBroker-MQTT-Adapter im Broker-Modus)
- Der WinCtl-Agent auf jedem zu steuernden PC, verbunden mit demselben Broker

## Einrichtung

1. Agent auf dem PC starten und im Einstellungsdialog Broker, Benutzer/Passwort und optional die Geräte-ID eintragen.
2. In den Adapter-Einstellungen denselben Broker und dieselbe Topic-Basis (Standard `winctl`) eintragen.
3. Jeder PC erscheint als Gerät, sobald er sich verbindet.

## Datenpunkte je PC

| Datenpunkt | Beschreibung |
|---|---|
| `online` | Agent verbunden |
| `info.*` | Hostname, IP, Agent-Version, Betriebssystem, Benutzer, Startzeit, erlaubte Programme |
| `state.*` | Werte des Agents (gesperrt, Benutzer anwesend, Leerlaufzeit, aktives Fenster, Lautstärke, CPU, RAM, Akku, Laufwerke, überwachte Prozesse, …). `volume`, `muted` und `keep_awake` sind schreibbar. |
| `cmd.*` | Ein Datenpunkt je Befehl: Button bei Befehlen ohne Pflichtparameter, sonst JSON (`{"text":"Hallo"}`) oder direkt der Wert des Hauptparameters (`Hallo`) |
| `event.*` | Ereignisse wie `lock`, `unlock`, `hotkey` |
| `result` | Ergebnis des letzten Befehls |
| `screenshot` | Pfad des letzten Screenshots im ioBroker-Dateispeicher |

`all.cmd.*` schickt einen Befehl an alle PCs gleichzeitig.

Gefährliche Befehle (z. B. `shell`) und im Agent abgeschaltete Befehle bekommen keinen Datenpunkt. Sie gehen nur per `sendTo`.

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

## Sicherheit

Wer auf `winctl/+/cmd/#` schreiben darf, steuert den PC. Den Broker mit Benutzer/Passwort und ACLs absichern, bei Bedarf TLS nutzen. Standardmäßig startet der Agent nur Programme aus seiner Alias-Liste, und `shell` ist aus.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (ipod86) Erste Version

Ältere Einträge stehen in [CHANGELOG_OLD.md](CHANGELOG_OLD.md).
