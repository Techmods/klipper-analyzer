# Deployment unter Mainsail

## Zielbild

- Mainsail bleibt unter `/`
- Klipper Analyzer wird unter `/klipper-analyzer/` ausgeliefert
- Moonraker bleibt unter den vorhandenen Root-Pfaden:
  - `/websocket`
  - `/printer/`
  - `/server/`
  - weitere Mainsail-/Moonraker-Routen bleiben unberuehrt

## Zielpfad auf dem Pi

- App-Verzeichnis: `/home/pi/klipper-analyzer`

## Bekannter Mainsail-Stand

Die vorhandene Nginx-Site liegt unter:

- `/etc/nginx/sites-available/mainsail`
- `/etc/nginx/sites-enabled/mainsail`

Die bestehende Konfiguration proxyt Moonraker bereits auf:

- `location /websocket`
- `location ~ ^/(printer|api|access|machine|server)/`

Deshalb darf der Analyzer nur unter einem eigenen Unterpfad eingehangen werden. Die Moonraker-Endpunkte bleiben root-relativ.

## Empfohlenes Nginx-Snippet

Dieses Snippet in den bestehenden `server { ... }`-Block der Mainsail-Site einfuegen:

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

## Wichtige Regeln

- Der Unterpfad muss mit abschliessendem Slash verwendet werden.
- Die SPA-Dateien leben unter `/home/pi/klipper-analyzer/`.
- API- und WebSocket-Zugriffe bleiben absichtlich root-relativ.
- Es darf kein zweiter separater Nginx-Serverblock fuer den Analyzer aufgebaut werden.
- `try_files` muss auf `/klipper-analyzer/index.html` zurueckfallen, nicht auf `/index.html`.

## Erwartetes Verhalten

- `http://<host>/` oeffnet Mainsail
- `http://<host>/klipper-analyzer/` oeffnet den Analyzer
- Der Analyzer verbindet sich ueber dieselbe Origin mit Moonraker
- Auf der Testplattform sollen `extruder` und `heater_bed` als Heizer erkannt werden
