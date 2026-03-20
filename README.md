# Klipper Analyzer

Schlanke Vanilla-JS-SPA fuer Moonraker/Klipper-basierte Temperatur- und PID-Analyse.

## Aktueller Stand

Der aktuelle v0-Stand implementiert:

- Status-UI fuer Verbindung und Printer-Readiness
- Startup-Sequenz mit WebSocket, Identify, Ready-Check und Objektliste
- dynamische Heizer-Erkennung fuer das Zielsystem
- Start und Stop einer einfachen Heiz-Session fuer den gewaehlten Heizer
- Rohdatenaufzeichnung aus Moonraker-Telemetrie waehrend aktiver Session
- Same-Origin-Deployment unter Mainsail via `/klipper-analyzer/`

Noch nicht implementiert:

- kompletter Messzyklus mit Stabilisierung und Cooling
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

## Installation auf dem Pi

Die Zielplattform verwendet Mainsail mit bestehendem Nginx-Serverblock. Der Analyzer wird als eigene SPA unter `/klipper-analyzer/` eingehangen.

### 1. Repository klonen

```bash
cd /home/pi
git clone https://github.com/Techmods/klipper-analyzer.git
```

Damit liegt das Projekt unter:

```text
/home/pi/klipper-analyzer
```

### 2. Nginx-Konfiguration erweitern

In `/etc/nginx/sites-available/mainsail` innerhalb des bestehenden `server { ... }`-Blocks dieses Snippet einfuegen:

```nginx
location = /klipper-analyzer {
    return 301 /klipper-analyzer/;
}

location /klipper-analyzer/ {
    alias /home/pi/klipper-analyzer/;
    index index.html;
    try_files $uri $uri/ /klipper-analyzer/index.html;
}
```

Danach Nginx pruefen und neu laden:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Browser-Test

Im Browser aufrufen:

```text
http://<dein-pi>/klipper-analyzer/
```

Erwartet fuer die aktuelle Testplattform:

- die Seite laedt
- die App verbindet sich mit Moonraker
- `extruder` und `heater_bed` werden als verfuegbare Heizer erkannt

## Update auf dem Pi

Fuer den aktuellen Stand sind Updates bewusst einfach gehalten und laufen direkt ueber Git.

### Projekt aktualisieren

```bash
cd /home/pi/klipper-analyzer
git pull
```

Da es eine statische SPA ist, reicht danach in der Regel ein Browser-Reload. Falls Nginx-Konfiguration geaendert wurde:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Spaeterer Moonraker Update Manager

Der Moonraker Update Manager ist fuer spaetere Schritte vorgesehen, nicht fuer den allerersten Rollout. Sobald der Analyzer funktional stabil laeuft, kann er als `git_repo` in `/home/pi/printer_data/config/moonraker.conf` eingetragen werden.

Bis dahin ist der empfohlene Weg:

- Entwicklung im GitHub-Repo
- `git pull` auf dem Pi
- Nginx nur bei Konfigurationsaenderungen neu laden
