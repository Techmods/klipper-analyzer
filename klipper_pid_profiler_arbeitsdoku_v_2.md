# Klipper PID & Temperature Profiler
## Arbeitsdokumentation, Implementierungsspezifikation und Review-Stand

**Status:** Review-approved mit offenen Punkten  
**Ziel:** Diese Fassung dient gleichzeitig als technische Spezifikation, Arbeitsdoku und Umsetzungsleitfaden für die Entwicklung.  
**Dokumenttyp:** Living Document / Arbeitsdokument mit Phasen, Checklisten, Änderungsbegründungen und Abnahmekriterien.

---

## 0. Warum diese Fassung

Ja — **Änderungen sollten bewusst in die Doku aufgenommen und begründet werden**.

Nicht als Roman, sondern als **kontrollierte Entscheidungs- und Arbeitsdoku**. Der Vorteil ist klar:

- Das Team sieht **nicht nur was gilt, sondern warum**.
- Architekturentscheidungen bleiben **nachvollziehbar**.
- Missverständnisse zwischen Review, Entwicklung und Deployment werden reduziert.
- Bei späteren Änderungen lässt sich sauber erkennen, **welche Annahmen ersetzt wurden**.
- Die Doku taugt gleichzeitig als **Umsetzungsplan, Review-Protokoll und Abnahmegrundlage**.

Darum enthält diese Fassung bewusst:

1. **integrierte Korrekturen**,
2. **Änderungsbegründungen**,
3. **Phasen mit Checklisten**,
4. **offene Punkte / Entscheidungen**,
5. **Abnahmekriterien**.

---

## 1. Executive Summary

Die Anwendung wird als **Single-Page-Application (SPA)** umgesetzt, die vollständig im Browser des Clients läuft. Es gibt **keinen separaten Backend-Service**. Die Kommunikation mit dem 3D-Drucker erfolgt ausschließlich über **Moonraker**.

### Architektur in Kurzform

- **Frontend (SPA):** UI, State Machine, Analyse, CSV-Export, Charting
- **Moonraker:** API-Gateway für G-Code, Druckerstatus und Live-Telemetrie
- **Nginx:** statische Auslieferung der Web-App; optional Reverse Proxy für Same-Origin-Betrieb
- **Klipper:** eigentliche Druckersteuerung und Heizerobjekte

### Architekturentscheidungen

- Keine serverseitige Datenhaltung
- Keine künstliche Interpolation von Messpunkten
- Speicherung der originalen Telemetrie-Ereignisse mit Moonraker-/Klipper-Zeitbasis
- Zustandsautomat zur Vermeidung von Race Conditions
- Analyse ausschließlich clientseitig
- Deployment so schlank, dass es von **Pi Zero 2 W bis Pi 5** realistisch betreibbar bleibt

---

## 2. Änderungsprotokoll gegenüber älteren Fassungen

> Diese Sektion ist absichtlich knapp, aber begründet. Sie soll Entscheidungen dokumentieren, nicht das Lesen erschweren.

| ID | Änderung | Frühere Annahme | Neue Regel | Begründung |
|---|---|---|---|---|
| C-01 | WebSocket-Auth korrigiert | `auth`-Methode als Standard | Auth über `server.connection.identify` oder One-Shot-Token | Browser- und Moonraker-konformer Verbindungsaufbau |
| C-02 | Zeitstempelbeschreibung korrigiert | Unix-Zeitstempel | Monotone Zeitbasis von Klipper/Moonraker | Verhindert falsche Interpretation bei Export und Analyse |
| C-03 | Startup-Sequenz gehärtet | direkt subscriben nach Connect | zuerst Verfügbarkeit/Ready prüfen, dann Objekte ermitteln, dann subscriben | Robuster gegenüber Neustart / Race Conditions |
| C-04 | Heizer-Erkennung geändert | Fehlerantwort bei unbekanntem Objekt angenommen | verfügbare Heizer aktiv ermitteln | Robuster, weniger implizite Annahmen |
| C-05 | REST-Fehlerpfad präzisiert | starres `result = ok` | generische Erfolgs-/Fehlerbehandlung | APIs sollen robust ausgewertet werden |
| C-06 | Deployment präzisiert | Cross-Origin eher „wahrscheinlich okay“ | Same-Origin bevorzugt, Reverse Proxy empfohlen | Vermeidet CORS-/WebSocket-Probleme |
| C-07 | Update-Manager geschärft | `type: web` pauschal | `web` nur für Release-Artefakte, sonst `git_repo` | Saubere Upgrade-Strategie |
| C-08 | Abschaltlogik verallgemeinert | `M104 S0` als generischer Off-Befehl | Heizer-spezifisch oder `TURN_OFF_HEATERS` je nach Profilmodus | Extruder und Bett sauber abdecken |
| C-09 | Arbeitsdoku ergänzt | reine Spezifikation | Phasen, Checklisten, Abnahme | Praktisch für Teamarbeit und Umsetzung |

---

## 3. Systemgrenzen und Annahmen

### 3.1 Ziel des Tools

Der Profiler soll für ausgewählte Heizer eines Klipper-Systems kontrolliert Temperaturverläufe aufzeichnen, visualisieren und analysieren.

### 3.2 Nicht-Ziele

Dieses Tool ist **kein** sicherheitskritisches Schutzsystem.

Es darf:
- Anomalien erkennen,
- Heizvorgänge abbrechen,
- Empfehlungen und Fehlerhinweise geben.

Es ersetzt **nicht**:
- firmwareseitige Schutzmechanismen,
- thermische Schutzfunktionen,
- hardwareseitige Sicherheitskonzepte.

### 3.3 Primäre Zielplattformen

- Raspberry Pi Zero 2 W
- Raspberry Pi 3B+
- Raspberry Pi 4B
- Raspberry Pi 5

### 3.4 Designziel für Ressourcen

Das System muss auf einem Pi Zero 2 W **funktional** bleiben, wenn:
- die App schlank bleibt,
- Charting moderat bleibt,
- keine unnötige Serverlogik dazukommt,
- die Hauptdarstellung remote im Browser des Clients erfolgt.

---

## 4. Systemarchitektur & Datenfluss

### 4.1 Komponenten

#### Frontend (SPA)
Verantwortlich für:
- WebSocket-Verbindung
- REST-Aufrufe
- State Machine
- Datenspeicherung im Browser
- Metrikberechnung
- Charting
- CSV-Export
- UI-Logik und Fehlerdialoge

#### Nginx
Verantwortlich für:
- Auslieferung statischer Dateien
- optional Reverse Proxy für Moonraker-Endpunkte
- optional Same-Origin-Betrieb zur Vermeidung von CORS-Problemen

#### Moonraker
Verantwortlich für:
- WebSocket-Telemetrie
- REST-Endpunkt für G-Code
- Verbindungsidentifikation / Authentifizierung
- Bereitstellung verfügbarer Druckerobjekte

#### Klipper
Verantwortlich für:
- reale Heizregelung
- Heizerobjekte
- Zustandsdaten
- Sicherheits- und Druckerlogik

### 4.2 Datenfluss

1. Browser lädt SPA über Nginx.
2. SPA verbindet sich mit Moonraker-WebSocket.
3. Verbindung wird identifiziert / authentifiziert.
4. SPA prüft Druckerstatus.
5. SPA ermittelt verfügbare Druckerobjekte / Heizer.
6. SPA abonniert relevante Objekte.
7. Benutzer startet Messung.
8. SPA sendet Heizbefehl über REST.
9. Moonraker sendet Telemetrie-Events.
10. SPA speichert Rohdaten und aktualisiert das Diagramm.
11. SPA erkennt Statusübergänge (Heating, Stabilizing, Cooling, Analyzing).
12. Ergebnisse werden lokal berechnet und exportiert.

---

## 5. Zielarchitektur für den Verbindungsaufbau

## 5.1 Empfohlener Betriebsmodus

**Empfehlung: Same-Origin-Betrieb über Nginx-Reverse-Proxy.**

Vorteile:
- weniger CORS-Probleme,
- sauberer Browserbetrieb,
- einfachere URL-Logik,
- konsistenteres Deployment.

### 5.2 Fallback-Modus

Direkte Verbindung vom Browser zu Moonraker auf anderem Port ist zulässig, aber nur wenn:
- CORS korrekt konfiguriert ist,
- WebSocket-Verbindung zuverlässig funktioniert,
- Authentifizierungsfluss sauber implementiert wurde.

### 5.3 Verbindungsprinzip

Beim Laden der Seite gilt folgende Reihenfolge:

1. WebSocket verbinden
2. Verbindung identifizieren / authentifizieren
3. Druckerstatus prüfen
4. verfügbare Objekte / Heizer bestimmen
5. Subscription setzen
6. UI freigeben

---

## 6. Ablauf des Messzyklus

### 6.1 Initialisierung

- Anwendung startet im Zustand `DISCONNECTED`.
- WebSocket-Verbindung wird aufgebaut.
- Nach erfolgreicher Identifikation wird geprüft, ob Klipper bereit ist.
- Erst danach wird die UI in `IDLE` freigegeben.

### 6.2 Benutzerstart

- Benutzer wählt Heizer und Zieltemperatur.
- Eingaben werden validiert.
- UI wird gesperrt.
- Startzeit wird gespeichert.
- Messarray wird geleert.
- Heizbefehl wird gesendet.
- Zustand wechselt zu `HEATING`.

### 6.3 Heating

- Telemetrie wird fortlaufend gespeichert.
- Thermal-Timeout-Überwachung läuft.
- Sobald `actual >= target`, Übergang nach `STABILIZING`.

### 6.4 Stabilizing

- PID bleibt aktiv.
- Einschwingverhalten wird beobachtet.
- Sobald die definierte Stabilitätsbedingung erfüllt ist, Heizung ausschalten.
- Übergang nach `COOLING`.

### 6.5 Cooling

- Abkühlkurve weiter aufzeichnen.
- Ende bei Unterschreitung des Kühl-Schwellenwerts oder Maximaldauer.
- Übergang nach `ANALYZING`.

### 6.6 Analyzing

- Overshoot berechnen
- Settling Time berechnen
- Heizrate berechnen
- Exportdaten erzeugen
- UI zurück in `IDLE`

---

## 7. Zustandsautomat (State Machine)

### 7.1 Zustände

| Zustand | Beschreibung |
|---|---|
| DISCONNECTED | keine gültige Moonraker-Verbindung |
| IDLE | bereit für neue Messung |
| HEATING | Heizbefehl wurde gesendet, Ziel noch nicht erreicht |
| STABILIZING | Ziel erreicht, Einschwingverhalten wird beobachtet |
| COOLING | Heizung aus, Abkühlung wird erfasst |
| ANALYZING | Metriken werden berechnet, Export wird erzeugt |
| ERROR | kritischer Fehlerzustand |

### 7.2 Zustandsübergänge

```text
DISCONNECTED -> IDLE
IDLE -> HEATING
HEATING -> STABILIZING
STABILIZING -> COOLING
COOLING -> ANALYZING
ANALYZING -> IDLE
Jeder Zustand -> ERROR
ERROR -> DISCONNECTED oder IDLE
```

### 7.3 Pflichtregeln für Übergänge

- Kein Start aus einem anderen Zustand als `IDLE`
- Kein UI-Unlock während aktiver Messung
- Jeder Netzwerkfehler während aktiver Messung führt zu `ERROR`
- Eine unterbrochene Messung wird **nicht** fortgesetzt
- Reconnect stellt nur Konnektivität wieder her, nicht die laufende Messung

---

## 8. API-Spezifikation

## 8.1 REST – G-Code ausführen

### Endpunkt

`POST /printer/gcode/script`

### Payload

```json
{
  "script": "M104 S200"
}
```

### Anforderungen an die Client-Implementierung

- `Content-Type: application/json`
- Authentifizierung ergänzen, falls erforderlich
- Erfolg nicht starr nur auf eine einzige JSON-Form prüfen
- Fehlerpfade für HTTP-Fehler, JSON-Fehler und Netzwerkfehler vorsehen

### Rückgabeverarbeitung

Der Client muss robust behandeln:
- HTTP 2xx als Erfolgspfad,
- JSON-Antworten mit `result`,
- JSON-Antworten mit `error`,
- Netzwerkfehler / Timeout.

## 8.2 WebSocket – Verbindungslogik

### Verbindungsendpunkt

`/websocket`

### Verbindungsidentifikation

Die Anwendung muss **nicht** auf eine frei erfundene oder historisch übernommene `auth`-Methode setzen.
Stattdessen gilt:

- Verbindung nach aktuellem Moonraker-konformen Verfahren identifizieren
- Browser-taugliche Auth-Variante verwenden
- Falls nötig One-Shot-Token oder API-/Access-Token-Strategie implementieren

### Subscription-Inhalt

Die App soll Heizer nicht hart kodieren, sondern nach verfügbarer Systemkonfiguration bestimmen.

Beispiel für Subscription-Struktur:

```json
{
  "jsonrpc": "2.0",
  "method": "printer.objects.subscribe",
  "params": {
    "objects": {
      "extruder": ["temperature", "target"],
      "heater_bed": ["temperature", "target"]
    }
  },
  "id": 101
}
```

### Telemetrieevent

Beispielstruktur:

```json
{
  "jsonrpc": "2.0",
  "method": "notify_status_update",
  "params": [
    {
      "extruder": { "temperature": 150.4, "target": 200.0 },
      "heater_bed": { "temperature": 60.2, "target": 0.0 }
    },
    1678886400.123
  ]
}
```

### Wichtige Regel zur Zeitbasis

`params[1]` wird **als monotone Zeitbasis** behandelt, **nicht** als Unix-Zeitstempel.

Die Anwendung nutzt diese Zeit ausschließlich für:
- relative Zeitdifferenzen,
- Diagrammaxe,
- Settling-Time-Berechnung,
- Heizratenberechnung.

---

## 9. Startup-Sequenz – verbindlich

Diese Reihenfolge ist verbindlich und darf nicht übersprungen werden:

### Schritt 1 – WebSocket verbinden
- Verbindung öffnen
- Fehlerpfad registrieren
- Reconnect-Backoff bereitstellen

### Schritt 2 – Verbindung identifizieren
- konfigurierten Auth-Flow ausführen
- bei Fehlschlag nach `ERROR`

### Schritt 3 – Druckerstatus prüfen
- Klipper-/Printer-Readiness prüfen
- keine UI-Freigabe, solange das System nicht bereit ist

### Schritt 4 – verfügbare Objekte bestimmen
- verfügbare Druckerobjekte lesen
- daraus Heizerliste ableiten
- UI-Dropdown dynamisch füllen

### Schritt 5 – Subscription setzen
- nur valide Objekte abonnieren
- Rückmeldung prüfen

### Schritt 6 – Zustand `IDLE`
- Startbutton aktivieren
- UI für Nutzer freigeben

---

## 10. Datenmodell

```typescript
interface TelemetryPoint {
  timestamp: number;   // monotone Zeitbasis aus Moonraker/Klipper
  target: number;      // Solltemperatur in °C
  actual: number;      // Isttemperatur in °C
  heater: string;      // z. B. 'extruder' oder 'heater_bed'
}
```

### Zusatzdaten pro Messung

```typescript
interface MeasurementSession {
  sessionId: string;
  heater: string;
  targetTemperature: number;
  heatingStartTimestamp: number;
  coolingStartTimestamp?: number;
  endTimestamp?: number;
  state: 'HEATING' | 'STABILIZING' | 'COOLING' | 'ANALYZING' | 'DONE' | 'ERROR';
  points: TelemetryPoint[];
}
```

### Regeln

- Datenpunkte immer in aufsteigender Reihenfolge halten
- keine Interpolation im Rohdatensatz
- keine Verdichtung im Primärspeicher
- eventuelle Downsampling-Logik nur für Chart-Rendering, nicht für Analyse

---

## 11. Algorithmen

## 11.1 Overshoot

Definition: maximale Überschreitung des Sollwerts nach dem ersten Erreichen der Zieltemperatur.

```javascript
function calculateOvershoot(data, target) {
  const firstReachIndex = data.findIndex(p => p.actual >= target);
  if (firstReachIndex === -1) return null;

  let maxTemp = target;
  for (let i = firstReachIndex; i < data.length; i++) {
    if (data[i].actual > maxTemp) maxTemp = data[i].actual;
  }
  return maxTemp - target;
}
```

## 11.2 Settling Time

Definition: Zeitspanne zwischen erstem Erreichen des Sollwerts und dem Beginn eines stabilen Abschnitts innerhalb eines Toleranzbandes, der für eine definierte Dauer nicht mehr verlassen wird.

```javascript
function calculateSettlingTime(data, target, tolerance = 1.0, stableDuration = 10.0) {
  const firstReachIndex = data.findIndex(p => p.actual >= target);
  if (firstReachIndex === -1) return null;

  let stableStartTime = null;
  let stableStartAbsolute = null;

  for (let i = firstReachIndex; i < data.length; i++) {
    const diff = Math.abs(data[i].actual - target);
    if (diff <= tolerance) {
      if (stableStartAbsolute === null) {
        stableStartAbsolute = data[i].timestamp;
        stableStartTime = data[i].timestamp - data[firstReachIndex].timestamp;
      } else {
        const duration = data[i].timestamp - stableStartAbsolute;
        if (duration >= stableDuration) {
          return stableStartTime;
        }
      }
    } else {
      stableStartAbsolute = null;
    }
  }
  return null;
}
```

## 11.3 Heizrate

Empfohlen ist eine robuste Berechnung über einen definierten Heizabschnitt, z. B.:
- vom ersten Messpunkt nach Start
- bis zum ersten Erreichen des Sollwerts

Einfachvariante:

```javascript
function calculateHeatingRate(data, target) {
  if (!data.length) return null;
  const start = data[0];
  const end = data.find(p => p.actual >= target);
  if (!end) return null;

  const deltaT = end.actual - start.actual;
  const deltaTime = end.timestamp - start.timestamp;
  if (deltaTime <= 0) return null;
  return deltaT / deltaTime;
}
```

### Hinweis

Für spätere Versionen kann eine robustere Regression ergänzt werden, falls Rauschen oder unregelmäßige Eventdichte stärker ins Gewicht fällt.

---

## 12. CSV-Export

### Exportformat

- Separator: `,`
- Dezimaltrenner: `.`
- Kopfzeile: ja
- Rundung: 2 Nachkommastellen
- Zeit: relativ zur `heatingStartTimestamp`

### Beispiel

```csv
time (s),target_temp,actual_temp,heater
0.00,200.00,24.50,extruder
1.05,200.00,26.10,extruder
```

### Exportregeln

- Export immer auf Basis der Rohdatenpunkte
- kein Export interpolierter Werte
- Session-Metadaten optional als separate Header-Kommentare oder zweite Datei

---

## 13. Fehlerbehandlung und Schutzlogik

## 13.1 Grundsatz

Fehlerpfade sind **gleichrangig** zur Normalfunktion zu behandeln.
Jeder Fehlerpfad muss:
- klar erkennbar,
- reproduzierbar,
- UI-seitig eindeutig,
- technisch sauber terminierend sein.

## 13.2 Verbindungsabbruch

### Verhalten
- Zustand auf `DISCONNECTED`
- Timer stoppen
- aktive Messung abbrechen
- Reconnect mit exponentiellem Backoff
- keine automatische Wiederaufnahme einer laufenden Messung

## 13.3 Thermal Timeout

### Ziel
Erkennen, wenn ein Heizer nach Start nicht plausibel reagiert.

### Mindestanforderungen
- Überwachung startet direkt nach Heizbefehl
- Schwellwerte konfigurierbar
- nicht nur einmaliger Timeout, sondern Verlaufskontrolle
- bei Fehler: Heizung ausschalten und in `ERROR`

### Abschaltstrategie
- Extruder-Profiling: geeigneter Off-Befehl für Extruder
- Bett-Profiling: geeigneter Off-Befehl für Bett
- optional generisch: `TURN_OFF_HEATERS`

### Wichtig
`M112` ist **nicht** Standardreaktion für diesen Fehlerfall. Nur verwenden, wenn wirklich ein harter Notfall vorliegt.

## 13.4 REST-Fehler

- HTTP-Fehler in `ERROR`
- JSON-Fehler in `ERROR`
- Netzwerkfehler in `ERROR`
- Benutzer erhält klare Fehlermeldung

## 13.5 Ungültige Konfiguration

- keine manuelle Eingabe unbekannter Heizer erlauben
- UI-Auswahl nur aus validierter Heizerliste aufbauen
- Startbutton deaktiviert, solange keine gültige Konfiguration vorhanden ist

---

## 14. Datei- und Projektstruktur

```text
klipper_pid_profiler/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── api.js
│   ├── analyzer.js
│   ├── chart_config.js
│   └── state_machine.js
├── nginx/
│   └── profiler.conf
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── checklist.md
│   └── testplan.md
└── README.md
```

### Ergänzung gegenüber älteren Fassungen

Die zusätzliche `docs/`-Struktur ist bewusst eingeführt, damit:
- Entscheidungslogik,
- Testplan,
- Phasen-Checklisten,
- Review-Feststellungen

nicht im Haupttext verloren gehen.

---

## 15. Rollen der Hauptdateien

### `index.html`
DOM-Grundgerüst mit:
- Formularbereich
- Statusanzeige
- Diagrammfläche
- Ergebnisbereich
- Fehlerdialog

### `css/style.css`
- Layout
- Theme-Variablen
- Zustandsklassen
- Fehler- und Sperrzustände

### `js/app.js`
- Orchestrierung
- Initialisierung
- Zusammenschalten der Module
- Event-Listener

### `js/api.js`
- WebSocket-Verbindung
- Identifikation / Auth
- REST-Wrapper
- Objektabfragen
- Subscription-Funktionen

### `js/analyzer.js`
- Overshoot
- Settling Time
- Heizrate
- CSV-Export

### `js/chart_config.js`
- Chart-Erzeugung
- Update-Strategie
- optionale Render-Optimierung

### `js/state_machine.js`
- Zustandsdefinition
- Übergangsvalidierung
- Seiteneffekte kontrollieren

### `docs/decisions.md`
- ADR-ähnliche Kurzentscheidungen
- warum etwas geändert wurde

### `docs/checklist.md`
- Arbeitschecklisten je Phase

### `docs/testplan.md`
- Testfälle
- erwartetes Verhalten
- Abnahme

---

## 16. Deployment

## 16.1 Zielbild

Bevorzugt wird folgende Struktur:
- SPA über Nginx ausgeliefert
- Moonraker per Reverse Proxy unter derselben Origin erreichbar
- Frontend kommuniziert nicht cross-origin, wenn es vermeidbar ist

## 16.2 Nginx – statische Auslieferung

Beispiel:

```nginx
server {
    listen 8081;
    server_name _;

    access_log off;

    location / {
        alias /ABSOLUTER/PFAD/ZUM/klipper_pid_profiler/;
        index index.html;
        try_files $uri $uri/ =404;
    }
}
```

### Regel

Der Pfad muss:
- real existieren,
- zum Deployment passen,
- dokumentiert sein,
- nicht stillschweigend auf Benutzer `pi` fest verdrahtet werden, wenn Portabilität gewünscht ist.

## 16.3 Nginx – empfohlener Reverse Proxy

Empfohlenes Ziel: Die App nutzt dieselbe Origin für statische Dateien und Moonraker-Zugriffe.

Beispielhafte Richtung:

```nginx
location /websocket {
    proxy_pass http://127.0.0.1:7125/websocket;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}

location /printer/ {
    proxy_pass http://127.0.0.1:7125/printer/;
    proxy_set_header Host $host;
}
```

### Entscheidung

**Standardempfehlung für das Projekt:** Same-Origin per Reverse Proxy.

## 16.4 CORS

Cross-Origin-Betrieb ist nur dann freizugeben, wenn:
- notwendige Moonraker-CORS-Konfiguration dokumentiert ist,
- Test auf Zielbrowsern durchgeführt wurde,
- WebSocket und REST verifiziert sind.

---

## 17. Moonraker Update-Strategie

Hier muss bewusst zwischen zwei Fällen unterschieden werden.

### Fall A – Release-basierte Frontend-Auslieferung
Geeignet, wenn das Projekt als veröffentlichte Frontend-Versionen mit Release-Artefakten verteilt wird.

### Fall B – Git-Repo auf dem Zielsystem
Geeignet, wenn das Projekt lokal als Repository ausgecheckt und direkt genutzt wird.

### Projektentscheidung

Für frühe Entwicklungs- und Pilotphasen ist **Git-Repo-basiertes Deployment** meist sinnvoller.

Für stabile, veröffentlichte Frontend-Versionen ist **Release-basierte Auslieferung** sinnvoll.

### Dokumentationsregel

Die Doku darf diese beiden Varianten nicht mehr vermischen.

---

## 18. Performance-Leitlinien nach Raspberry-Pi-Klasse

## 18.1 Pi Zero 2 W

Ziel: funktional, schlank, kein Ballast.

Pflicht:
- wenige DOM-Updates
- begrenzte Chart-Komplexität
- kein unnötiges Re-Rendern
- keine schweren Frameworks ohne echten Mehrwert

## 18.2 Pi 3B+

Ziel: solide Standardbasis.

- Charting moderat möglich
- mehrere Statuskomponenten okay
- normale SPA-Struktur realistisch

## 18.3 Pi 4B

Ziel: bevorzugte Plattform.

- komfortable Reserven
- gute Balance aus Leistung und Stabilität
- beste Standardempfehlung

## 18.4 Pi 5

Ziel: problemlos für dieses Projekt.

- hohe Reserven für UI und Nebenfunktionen
- für den Profiler eher Luxus als Notwendigkeit

---

## 19. Umsetzungsphasen

## Phase 1 – Architektur festziehen

### Ziel
Architektur, Betriebsmodus und Randbedingungen final festlegen.

### Deliverables
- Architektur freigegeben
- Auth-Strategie gewählt
- Deployment-Modus gewählt
- Heizerstrategie definiert

### Checkliste
- [ ] Same-Origin vs Cross-Origin entschieden
- [ ] Auth-Flow definiert
- [ ] Liste relevanter Heizerobjekte geklärt
- [ ] Abschaltstrategie für Extruder/Bett definiert
- [ ] Ziel-Pi-Klasse benannt

## Phase 2 – API- und Verbindungsmodul

### Ziel
Stabile Kommunikation mit Moonraker herstellen.

### Checkliste
- [ ] WebSocket Connect implementiert
- [ ] Reconnect mit Backoff implementiert
- [ ] Identifikations-/Auth-Flow implementiert
- [ ] Printer-Ready-Check implementiert
- [ ] Objects-List-Abfrage implementiert
- [ ] Subscription implementiert
- [ ] REST-Wrapper implementiert
- [ ] Fehlerpfade getestet

## Phase 3 – State Machine und Session-Logik

### Ziel
Messablauf deterministisch machen.

### Checkliste
- [ ] Zustände modelliert
- [ ] Übergänge abgesichert
- [ ] Start/Stop/Abort sauber implementiert
- [ ] Fehlerübergänge vollständig
- [ ] Session-Datenmodell integriert

## Phase 4 – UI und Charting

### Ziel
Bedienbare, stabile Oberfläche.

### Checkliste
- [ ] Heizerauswahl dynamisch
- [ ] Zieltemperatur validiert
- [ ] UI-Locking implementiert
- [ ] Statusanzeige sichtbar
- [ ] Live-Chart funktioniert
- [ ] Fehlerdialog vorhanden
- [ ] Ergebnisdarstellung vorhanden

## Phase 5 – Analyse und Export

### Ziel
Technisch belastbare Auswertung.

### Checkliste
- [ ] Overshoot berechnet
- [ ] Settling Time berechnet
- [ ] Heizrate berechnet
- [ ] CSV-Export implementiert
- [ ] Exportformat dokumentiert

## Phase 6 – Deployment

### Ziel
Lauffähige Installation auf Zielsystem.

### Checkliste
- [ ] Nginx-Config erstellt
- [ ] Reverse Proxy umgesetzt oder bewusst ausgeschlossen
- [ ] Pfade dokumentiert
- [ ] Update-Strategie festgelegt
- [ ] Konfiguration auf Ziel-Pi getestet

## Phase 7 – Test und Abnahme

### Ziel
Nachweis, dass das System unter realen Bedingungen funktioniert.

### Checkliste
- [ ] Testfall Extruder erfolgreich
- [ ] Testfall Heizbett erfolgreich
- [ ] Netzwerkabbruch getestet
- [ ] Moonraker-Neustart getestet
- [ ] Thermal Timeout getestet
- [ ] CSV geprüft
- [ ] Pi-Zielplattform geprüft
- [ ] Dokumentation aktualisiert

---

## 20. Testplan – Mindestumfang

### Funktionale Tests
- Start einer Messung
- Zieltemperatur wird erreicht
- Stabilisierung wird erkannt
- Cooling wird gestartet
- Analyse wird berechnet
- CSV wird exportiert

### Negativtests
- Moonraker nicht erreichbar
- WebSocket trennt während Messung
- ungültiger Heizbefehl
- Heizer reagiert nicht
- Klipper nicht ready

### Plattformtests
- Pi Zero 2 W
- Pi 4B
- optional Pi 5

### Browsertests
- Desktop-Browser Standardfall
- mobiles Gerät optional

---

## 21. Abnahmekriterien

Die Fassung gilt als umsetzungsreif, wenn folgende Punkte erfüllt sind:

- stabile Verbindung zu Moonraker
- dynamische Erkennung gültiger Heizer
- reproduzierbarer Messzyklus
- korrekte Statusübergänge
- robuste Fehlerbehandlung
- CSV-Export mit dokumentiertem Format
- Deployment auf Zielplattform erfolgreich
- Dokumentation entspricht tatsächlich dem implementierten Verhalten

---

## 22. Offene Entscheidungen

Diese Punkte sollten vor Codestart final bestätigt werden:

1. **Auth-Variante**  
   One-Shot-Token, Access-Token oder API-Key-Strategie?

2. **Deployment-Modell**  
   Gleich Same-Origin per Reverse Proxy oder zunächst direkter Moonraker-Port?

3. **Update-Modell**  
   Erst `git_repo`, später Release-basiert?

4. **Abschaltstrategie**  
   Heizer-spezifische Off-Befehle oder generisch `TURN_OFF_HEATERS`?

5. **Cooling-Ende**  
   Fester Temperaturschwellenwert, feste Maximalzeit oder kombinierte Bedingung?

6. **Settling-Konfiguration**  
   Toleranzband und Stable-Duration global oder pro Heizer einstellbar?

---

## 23. Konkrete Empfehlung für die Teamarbeit

Für dieses Projekt empfehle ich folgende Dokumentenlogik:

### Hauptdokument
Diese Spezifikation hier:
- Zielbild
- Architektur
- Phasen
- Checklisten
- Abnahme

### Entscheidungslog
Kurz und hart:
- Änderung
- Grund
- Auswirkung
- Datum
- Verantwortlich

### Testlog
Je Testfall:
- Testname
- Plattform
- Erwartung
- Ergebnis
- Befund

Damit bleibt die Doku gleichzeitig:
- lesbar,
- steuerbar,
- auditierbar,
- als Arbeitsdoku brauchbar.

---

## 24. Schlussbewertung

Diese Fassung ist absichtlich **nicht nur schöne Architekturprosa**, sondern eine **arbeitsfähige Spezifikation**.

Sie ist dafür ausgelegt,
- vom Entwickler umgesetzt,
- vom Reviewer nachvollzogen,
- vom Betreiber deployed,
- und vom Team schrittweise abgearbeitet zu werden.

Wenn später noch etwas ergänzt wird, dann nicht als loses Gerede im Chat, sondern kontrolliert über:
- Änderungsprotokoll,
- offene Entscheidungen,
- Checklisten,
- Abnahme.

Genau so bleibt das Ding sauber statt mit jedem Review weiter zu verwässern.

