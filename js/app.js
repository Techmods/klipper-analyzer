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
  heaterSelect: document.querySelector("#heater-select"),
  targetTemperature: document.querySelector("#target-temperature"),
  startButton: document.querySelector("#start-button"),
  eventLog: document.querySelector("#event-log"),
  form: document.querySelector("#measurement-form"),
};

const stateMachine = new StateMachine("DISCONNECTED");

const appContext = {
  heaters: [],
  connectionPhase: "disconnected",
  readiness: null,
};

const client = new MoonrakerClient({
  websocketPath: runtimeConfig.moonrakerWebsocketPath,
  restBasePath: runtimeConfig.moonrakerRestBase,
  onLog: appendLog,
  onConnectionChange(status) {
    appContext.connectionPhase = status;
    updateStatusPanel();
  },
});

stateMachine.subscribe(({ nextState, meta }) => {
  renderState(nextState, meta);
});

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  appendLog("Messstart ist in v0 noch nicht implementiert");
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
  ui.heaterSelect.disabled = !isIdle || appContext.heaters.length === 0;
  ui.targetTemperature.disabled = !isIdle;
  ui.startButton.disabled = true;

  updateStatusPanel();

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
  appContext.heaters = [];
  appContext.readiness = null;
  populateHeaters([]);

  try {
    transitionTo("ERROR", { message: error.message });
  } catch (transitionError) {
    if (stateMachine.getState() !== "ERROR") {
      throw transitionError;
    }
  }

  updateStatusPanel();
  appendLog(`Fehler: ${error.message}`);

  if (!recoverable) {
    throw error;
  }
}
