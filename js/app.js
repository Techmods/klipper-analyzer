import { MoonrakerClient, detectHeaterObjects } from "./api.js";
import { StateMachine } from "./state_machine.js";

const runtimeConfig = {
  appBasePath: "/klipper-analyzer/",
  moonrakerRestBase: "",
  moonrakerWebsocketPath: "/websocket",
  ...(window.KLIPPER_ANALYZER_CONFIG ?? {}),
};

const ui = {
  badge: document.querySelector("#state-badge"),
  connectionStatus: document.querySelector("#connection-status"),
  readyStatus: document.querySelector("#ready-status"),
  heaterCount: document.querySelector("#heater-count"),
  statusMessage: document.querySelector("#status-message"),
  sessionStatus: document.querySelector("#session-status"),
  heaterSelect: document.querySelector("#heater-select"),
  targetTemperature: document.querySelector("#target-temperature"),
  startButton: document.querySelector("#start-button"),
  stopButton: document.querySelector("#stop-button"),
  sessionHeater: document.querySelector("#session-heater"),
  sessionTarget: document.querySelector("#session-target"),
  sessionActual: document.querySelector("#session-actual"),
  sessionPoints: document.querySelector("#session-points"),
  eventLog: document.querySelector("#event-log"),
  form: document.querySelector("#measurement-form"),
};

const stateMachine = new StateMachine("DISCONNECTED");

const appContext = {
  heaters: [],
  connectionPhase: "disconnected",
  readiness: null,
  session: createEmptySession(),
};

const client = new MoonrakerClient({
  websocketPath: runtimeConfig.moonrakerWebsocketPath,
  restBasePath: runtimeConfig.moonrakerRestBase,
  onLog: appendLog,
  onConnectionChange(status) {
    appContext.connectionPhase = status;
    updateStatusPanel();
  },
  onStatusUpdate: handleStatusUpdate,
});

stateMachine.subscribe(({ nextState, meta }) => {
  renderState(nextState, meta);
});

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  startMeasurement().catch((error) => {
    handleFatalError(error);
  });
});

ui.stopButton.addEventListener("click", () => {
  stopMeasurement().catch((error) => {
    handleFatalError(error);
  });
});

ui.heaterSelect.addEventListener("change", () => {
  syncFormState();
});

ui.targetTemperature.addEventListener("input", () => {
  syncFormState();
});

bootstrap().catch((error) => {
  handleFatalError(error);
});

async function bootstrap() {
  renderState(stateMachine.getState(), { reason: "initial" });
  appendLog(`App-Basis: ${runtimeConfig.appBasePath}`);
  appendLog("Initialisierung gestartet");

  while (true) {
    try {
      transitionTo("CONNECTING", { reason: "startup" });
      await client.connect();
      await client.identifyConnection();

      transitionTo("READY_CHECK", { reason: "socket-ready" });
      const readiness = await client.getReadinessSnapshot();
      appContext.readiness = readiness;
      updateStatusPanel();

      if (!readiness.ready) {
        throw new Error("Printer ist noch nicht bereit");
      }

      const objects = await client.getAvailableObjects();
      const heaters = detectHeaterObjects(objects);
      appContext.heaters = heaters;

      if (heaters.length > 0) {
        await client.subscribeToObjects(heaters);
        appendLog("Telemetrie-Subscription aktiv");
      }

      populateHeaters(heaters);
      transitionTo("IDLE", { heatersFound: heaters.length });
      appendLog("Startup-Sequenz erfolgreich abgeschlossen");
      return;
    } catch (error) {
      handleFatalError(error, { recoverable: true });
      await client.waitWithBackoff();
      transitionTo("DISCONNECTED", { reason: "retry" });
    }
  }
}

function transitionTo(nextState, meta = {}) {
  if (stateMachine.getState() === nextState) {
    renderState(nextState, meta);
    return;
  }

  stateMachine.transition(nextState, meta);
}

function renderState(state, meta = {}) {
  const normalizedState = state.toLowerCase();
  ui.badge.textContent = state;
  ui.badge.className = `state-badge state-${normalizedState}`;

  const isIdle = state === "IDLE";
  const isHeating = state === "HEATING";
  ui.heaterSelect.disabled = !isIdle || appContext.heaters.length === 0;
  ui.targetTemperature.disabled = !isIdle;
  ui.stopButton.disabled = !isHeating;

  syncFormState();
  updateStatusPanel();
  updateSessionPanel();

  if (meta.reason === "initial") {
    return;
  }

  appendLog(`Statuswechsel: ${state}`);
}

function updateStatusPanel() {
  ui.connectionStatus.textContent = describeConnection(appContext.connectionPhase);
  ui.readyStatus.textContent = describeReadiness(appContext.readiness);
  ui.heaterCount.textContent = String(appContext.heaters.length);
  ui.statusMessage.textContent = buildStatusMessage();
  ui.sessionStatus.textContent = describeSessionStatus();
}

function describeConnection(connectionPhase) {
  switch (connectionPhase) {
    case "connected":
      return "WebSocket verbunden";
    case "error":
      return "Verbindungsfehler";
    case "disconnected":
    default:
      return "Nicht verbunden";
  }
}

function describeReadiness(readiness) {
  if (!readiness) {
    return "Wird geprueft";
  }

  if (readiness.ready) {
    return "Bereit";
  }

  if (readiness.serverReady === false || readiness.printerReady === false) {
    return "Nicht bereit";
  }

  return "Unbekannt";
}

function buildStatusMessage() {
  const state = stateMachine.getState();

  if (state === "IDLE" && appContext.heaters.length > 0) {
    return "System bereit, Heizerliste geladen";
  }

  if (state === "HEATING") {
    return "Messung laeuft und Rohdaten werden aufgezeichnet";
  }

  if (state === "IDLE") {
    return "System bereit, aber keine validen Heizer gefunden";
  }

  if (state === "READY_CHECK") {
    return "Druckerstatus und Objektliste werden geprueft";
  }

  if (state === "CONNECTING") {
    return "Verbinde mit Moonraker";
  }

  if (state === "ERROR") {
    return "Initialisierung fehlgeschlagen, Reconnect wird vorbereitet";
  }

  return "Warte auf Initialisierung";
}

function populateHeaters(heaters) {
  ui.heaterSelect.innerHTML = "";

  if (heaters.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Keine Heizer verfuegbar";
    ui.heaterSelect.append(option);
    return;
  }

  for (const heater of heaters) {
    const option = document.createElement("option");
    option.value = heater;
    option.textContent = heater;
    ui.heaterSelect.append(option);
  }

  syncFormState();
}

function appendLog(message) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  item.append(time, document.createTextNode(message));
  ui.eventLog.prepend(item);

  while (ui.eventLog.children.length > 10) {
    ui.eventLog.removeChild(ui.eventLog.lastChild);
  }
}

function handleFatalError(error, { recoverable = false } = {}) {
  appContext.connectionPhase = "error";
  appContext.session.active = false;

  if (!recoverable) {
    appContext.heaters = [];
    appContext.readiness = null;
    populateHeaters([]);
  }

  try {
    transitionTo("ERROR", { message: error.message });
  } catch (transitionError) {
    if (stateMachine.getState() !== "ERROR") {
      throw transitionError;
    }
  }

  updateStatusPanel();
  updateSessionPanel();
  appendLog(`Fehler: ${error.message}`);

  if (!recoverable) {
    throw error;
  }
}

function createEmptySession() {
  return {
    active: false,
    heater: "",
    targetTemperature: null,
    points: [],
    heatingStartTimestamp: null,
    lastActual: null,
  };
}

function getValidatedTargetTemperature() {
  const value = Number(ui.targetTemperature.value);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function syncFormState() {
  const state = stateMachine.getState();
  const heaterSelected = Boolean(ui.heaterSelect.value);
  const targetTemperature = getValidatedTargetTemperature();
  const canStart =
    state === "IDLE" &&
    heaterSelected &&
    targetTemperature !== null &&
    appContext.heaters.includes(ui.heaterSelect.value);

  ui.startButton.disabled = !canStart;
}

function updateSessionPanel() {
  const { session } = appContext;
  ui.sessionHeater.textContent = session.heater || "-";
  ui.sessionTarget.textContent =
    session.targetTemperature === null ? "-" : `${session.targetTemperature.toFixed(1)} C`;
  ui.sessionActual.textContent =
    session.lastActual === null ? "-" : `${session.lastActual.toFixed(1)} C`;
  ui.sessionPoints.textContent = String(session.points.length);
}

function describeSessionStatus() {
  const state = stateMachine.getState();
  if (state === "HEATING" && appContext.session.heater) {
    return `Aktive Messung auf ${appContext.session.heater}`;
  }

  return "Keine aktive Messung";
}

async function startMeasurement() {
  if (stateMachine.getState() !== "IDLE") {
    throw new Error("Messung kann nur aus dem Zustand IDLE gestartet werden");
  }

  const heater = ui.heaterSelect.value;
  const targetTemperature = getValidatedTargetTemperature();

  if (!heater || targetTemperature === null) {
    throw new Error("Bitte Heizer und Zieltemperatur gueltig setzen");
  }

  const script = buildHeatCommand(heater, targetTemperature);

  appContext.session = {
    active: true,
    heater,
    targetTemperature,
    points: [],
    heatingStartTimestamp: null,
    lastActual: null,
  };

  updateSessionPanel();
  appendLog(`Sende Heizbefehl fuer ${heater} auf ${targetTemperature.toFixed(0)} C`);
  await client.runGcodeScript(script);
  transitionTo("HEATING", { heater, targetTemperature });
}

async function stopMeasurement() {
  const { session } = appContext;

  if (!session.active || !session.heater) {
    return;
  }

  appendLog(`Stoppe Messung fuer ${session.heater}`);
  await client.runGcodeScript(buildOffCommand(session.heater));
  appendLog(`Messung beendet, ${session.points.length} Rohdatenpunkte gespeichert`);
  appContext.session.active = false;
  transitionTo("IDLE", { pointsCaptured: session.points.length });
  updateSessionPanel();
}

function handleStatusUpdate({ status, eventtime }) {
  const { session } = appContext;

  if (!session.active || !session.heater) {
    return;
  }

  const heaterStatus = status?.[session.heater];
  if (!heaterStatus || typeof heaterStatus.temperature !== "number") {
    return;
  }

  if (session.heatingStartTimestamp === null && typeof eventtime === "number") {
    session.heatingStartTimestamp = eventtime;
    appendLog(`Erster Telemetriepunkt fuer ${session.heater} empfangen`);
  }

  session.lastActual = heaterStatus.temperature;
  session.points.push({
    timestamp: typeof eventtime === "number" ? eventtime : Date.now() / 1000,
    target: typeof heaterStatus.target === "number" ? heaterStatus.target : session.targetTemperature,
    actual: heaterStatus.temperature,
    heater: session.heater,
  });

  updateSessionPanel();
}

function buildHeatCommand(heater, targetTemperature) {
  const formattedTarget = targetTemperature.toFixed(0);

  if (heater === "extruder") {
    return `M104 S${formattedTarget}`;
  }

  if (heater === "heater_bed") {
    return `M140 S${formattedTarget}`;
  }

  return `SET_HEATER_TEMPERATURE HEATER="${heater}" TARGET=${formattedTarget}`;
}

function buildOffCommand(heater) {
  if (heater === "extruder") {
    return "M104 S0";
  }

  if (heater === "heater_bed") {
    return "M140 S0";
  }

  return `SET_HEATER_TEMPERATURE HEATER="${heater}" TARGET=0`;
}
