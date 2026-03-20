# Klipper Analyzer

Schlanke Vanilla-JS-SPA fuer Moonraker/Klipper-basierte Temperatur- und PID-Analyse.

## Aktueller Stand

Der aktuelle v0-Stand implementiert:

- Status-UI fuer Verbindung und Printer-Readiness
- Startup-Sequenz mit WebSocket, Identify, Ready-Check und Objektliste
- dynamische Heizer-Erkennung fuer das Zielsystem
- Same-Origin-Deployment unter Mainsail via `/klipper-analyzer/`

Noch nicht implementiert:

- Heizbefehl und Messstart
- kompletter Messzyklus
- Charting
- Analyse
- CSV-Export

## Wichtige Dateien

- `index.html`: Grundgeruest der SPA
- `js/app.js`: Initialisierung und UI-Orchestrierung
- `js/api.js`: Moonraker-Client fuer REST und WebSocket
- `js/state_machine.js`: Zustandsmodell fuer den Startup-Pfad
- `nginx/profiler.conf`: Nginx-Snippet fuer Mainsail-Integration
- `docs/hardware.md`: Testplattform
- `docs/deployment.md`: Deployment-Referenz fuer das Zielsystem
