# Mainsail Sidebar Integration

## Ziel

Klipper Analyzer soll in Mainsail als zusaetzlicher Sidebar-Eintrag erscheinen, ohne Mainsail zu forken oder Dateien in `/home/pi/mainsail` zu ueberschreiben.

## Prinzip

- Analyzer bleibt eine eigene Seite unter `/klipper-analyzer/`
- Mainsail bekommt nur einen offiziellen Custom-Navigation-Eintrag
- die Integration erfolgt ueber eine `navi.json` im aktiven Mainsail-Custom-Theme

## Repo-Artefakt

Dieses Repository liefert eine vorbereitete Datei:

- `deploy/mainsail-theme/navi.json`

Inhalt:

```json
[
  {
    "title": "Klipper Analyzer",
    "href": "/klipper-analyzer/",
    "target": "_self",
    "position": 95,
    "icon": "M3 3H21V5H3V3M3 7H21V9H3V7M3 11H13V13H3V11M3 15H13V17H3V15M3 19H13V21H3V19M15 11H21V21H15V11Z"
  }
]
```

## Installation

1. Sicherstellen, dass der Analyzer bereits unter `/klipper-analyzer/` ueber Nginx erreichbar ist.
2. Das aktive Mainsail-Custom-Theme lokalisieren oder anlegen.
3. `deploy/mainsail-theme/navi.json` in dieses Theme kopieren.
4. Mainsail bzw. den Browser neu laden.

## Praktische Pi-Schritte

Die Datei im Projekt liegt nach dem Klonen hier:

```text
/home/pi/klipper-analyzer/deploy/mainsail-theme/navi.json
```

Falls du bereits ein aktives Custom-Theme hast, kopiere die Datei in dieses Theme.

Beispiel mit Platzhalterpfad:

```bash
cp /home/pi/klipper-analyzer/deploy/mainsail-theme/navi.json /PFAD/ZUM/AKTIVEN/THEME/navi.json
```

Danach Browser neu laden.

Wenn du den Theme-Pfad noch nicht kennst, ist der sichere Weg:

1. In Mainsail nachsehen, welches Custom Theme aktiv ist.
2. Falls noch keines existiert, ein Custom Theme anlegen.
3. Erst dann `navi.json` in dieses Theme kopieren.

## Hinweise

- Den exakten Theme-Pfad verdrahtet dieses Repo absichtlich nicht, weil er je nach Setup variieren kann.
- Die Navigation ist eine offizielle Erweiterung ueber Custom Navigation, kein Eingriff in den Mainsail-Quellcode.
- `target: "_self"` sorgt dafuer, dass der Analyzer in derselben Mainsail-Instanz geoeffnet wird.
