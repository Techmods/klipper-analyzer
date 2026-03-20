const DEFAULT_HEATER_FIELDS = ["temperature", "target"];

function createRpcIdGenerator() {
  let currentId = 1;
  return () => currentId++;
}

export class MoonrakerClient {
  constructor({
    websocketPath = "/websocket",
    restBasePath = "",
    onLog = () => {},
    onConnectionChange = () => {},
  } = {}) {
    this.websocketPath = websocketPath;
    this.restBasePath = restBasePath;
    this.onLog = onLog;
    this.onConnectionChange = onConnectionChange;
    this.socket = null;
    this.socketReadyPromise = null;
    this.rpcId = createRpcIdGenerator();
    this.pendingRpcRequests = new Map();
    this.reconnectAttempt = 0;
  }

  async connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.socketReadyPromise) {
      return this.socketReadyPromise;
    }

    const websocketUrl = this.#buildWebsocketUrl();
    this.onLog(`Verbinde WebSocket zu ${websocketUrl}`);

    this.socketReadyPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(websocketUrl);
      this.socket = socket;

      socket.addEventListener("open", () => {
        this.reconnectAttempt = 0;
        this.onConnectionChange("connected");
        this.onLog("WebSocket verbunden");
        resolve();
      });

      socket.addEventListener("message", (event) => {
        this.#handleSocketMessage(event);
      });

      socket.addEventListener("close", () => {
        this.onConnectionChange("disconnected");
        this.onLog("WebSocket getrennt");
        this.socketReadyPromise = null;
        this.#rejectPendingRequests(new Error("WebSocket connection closed"));
      });

      socket.addEventListener("error", () => {
        this.onConnectionChange("error");
        this.onLog("WebSocket-Fehler");
        reject(new Error("Unable to establish WebSocket connection"));
      });
    });

    return this.socketReadyPromise;
  }

  async identifyConnection(clientInfo = {}) {
    const payload = {
      client_name: "Klipper Analyzer",
      version: "0.1.0",
      type: "web",
      url: window.location.origin,
      ...clientInfo,
    };

    this.onLog("Fuehre Verbindungs-Identifikation aus");

    try {
      return await this.sendRpc("server.connection.identify", payload);
    } catch (error) {
      this.onLog(
        `Identify nicht bestaetigt, fahre ohne harte Auth-Fehlannahme fort: ${error.message}`,
      );
      return null;
    }
  }

  async getServerInfo() {
    return this.fetchJson("/server/info");
  }

  async getPrinterInfo() {
    return this.fetchJson("/printer/info");
  }

  async getAvailableObjects() {
    try {
      const response = await this.fetchJson("/printer/objects/list");
      return this.#extractObjectNames(response);
    } catch (error) {
      this.onLog(`REST-Objektliste nicht verfuegbar, fallback auf RPC: ${error.message}`);
      const response = await this.sendRpc("printer.objects.list");
      return this.#extractObjectNames(response);
    }
  }

  async subscribeToObjects(objects) {
    const payload = {
      objects: Object.fromEntries(
        objects.map((objectName) => [objectName, [...DEFAULT_HEATER_FIELDS]]),
      ),
    };

    this.onLog(`Setze Subscription fuer ${objects.length} Objekt(e)`);
    return this.sendRpc("printer.objects.subscribe", payload);
  }

  async fetchJson(path, options = {}) {
    const response = await fetch(`${this.restBasePath}${path}`, {
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fuer ${path}`);
    }

    let body;
    try {
      body = await response.json();
    } catch (error) {
      throw new Error(`JSON-Fehler fuer ${path}`);
    }

    if (body?.error) {
      const message = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
      throw new Error(`Moonraker-Fehler fuer ${path}: ${message}`);
    }

    return body;
  }

  async sendRpc(method, params = {}) {
    await this.connect();

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const id = this.rpcId();
    const payload = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRpcRequests.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify(payload));
    });
  }

  async waitWithBackoff() {
    const delay = Math.min(5000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.onLog(`Warte ${delay} ms vor erneutem Verbindungsversuch`);
    await new Promise((resolve) => window.setTimeout(resolve, delay));
  }

  async getReadinessSnapshot() {
    const [serverInfo, printerInfo] = await Promise.allSettled([
      this.getServerInfo(),
      this.getPrinterInfo(),
    ]);

    const serverData = serverInfo.status === "fulfilled" ? serverInfo.value : null;
    const printerData = printerInfo.status === "fulfilled" ? printerInfo.value : null;

    const serverReady = this.#extractServerReady(serverData);
    const printerReady = this.#extractPrinterReady(printerData);
    const ready = serverReady !== false && printerReady !== false;

    return {
      ready,
      serverInfo: serverData,
      printerInfo: printerData,
      serverReady,
      printerReady,
    };
  }

  #buildWebsocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${this.websocketPath}`;
  }

  #handleSocketMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      this.onLog("Nicht parsebare WebSocket-Nachricht ignoriert");
      return;
    }

    if (typeof message.id === "number" && this.pendingRpcRequests.has(message.id)) {
      const request = this.pendingRpcRequests.get(message.id);
      this.pendingRpcRequests.delete(message.id);

      if (message.error) {
        request.reject(new Error(message.error.message ?? "Unbekannter RPC-Fehler"));
        return;
      }

      request.resolve(message.result ?? message);
      return;
    }

    if (message.method === "notify_status_update") {
      this.onLog("Telemetrie-Subscription aktiv");
    }
  }

  #rejectPendingRequests(error) {
    for (const [id, request] of this.pendingRpcRequests.entries()) {
      request.reject(error);
      this.pendingRpcRequests.delete(id);
    }
  }

  #extractObjectNames(response) {
    const result = response?.result ?? response;

    if (Array.isArray(result?.objects)) {
      return result.objects;
    }

    if (Array.isArray(result)) {
      return result;
    }

    throw new Error("Objektliste konnte nicht gelesen werden");
  }

  #extractServerReady(serverInfo) {
    const result = serverInfo?.result ?? serverInfo;
    const moonrakerState = result?.klippy_state ?? result?.state;

    if (typeof moonrakerState === "string") {
      return !["startup", "error", "shutdown"].includes(moonrakerState.toLowerCase());
    }

    return null;
  }

  #extractPrinterReady(printerInfo) {
    const result = printerInfo?.result ?? printerInfo;

    if (typeof result?.state === "string") {
      return result.state.toLowerCase() === "ready";
    }

    if (typeof result?.status === "string") {
      return result.status.toLowerCase() === "ready";
    }

    return null;
  }
}

export function detectHeaterObjects(objectNames = []) {
  return objectNames.filter((objectName) => {
    return (
      objectName === "extruder" ||
      objectName === "heater_bed" ||
      objectName.startsWith("heater_generic ") ||
      objectName.startsWith("temperature_fan ")
    );
  });
}
