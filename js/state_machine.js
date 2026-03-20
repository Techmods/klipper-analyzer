const VALID_STATES = new Set([
  "DISCONNECTED",
  "CONNECTING",
  "READY_CHECK",
  "IDLE",
  "ERROR",
]);

const ALLOWED_TRANSITIONS = {
  DISCONNECTED: ["CONNECTING"],
  CONNECTING: ["READY_CHECK", "DISCONNECTED", "ERROR"],
  READY_CHECK: ["IDLE", "DISCONNECTED", "ERROR"],
  IDLE: ["DISCONNECTED", "ERROR"],
  ERROR: ["DISCONNECTED", "CONNECTING"],
};

export class StateMachine {
  constructor(initialState = "DISCONNECTED") {
    if (!VALID_STATES.has(initialState)) {
      throw new Error(`Unknown initial state: ${initialState}`);
    }

    this.state = initialState;
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  canTransition(nextState) {
    return ALLOWED_TRANSITIONS[this.state]?.includes(nextState) ?? false;
  }

  transition(nextState, meta = {}) {
    if (!VALID_STATES.has(nextState)) {
      throw new Error(`Unknown next state: ${nextState}`);
    }

    if (!this.canTransition(nextState)) {
      throw new Error(`Invalid state transition: ${this.state} -> ${nextState}`);
    }

    const previousState = this.state;
    this.state = nextState;
    const snapshot = { previousState, nextState, meta };

    for (const listener of this.listeners) {
      listener(snapshot);
    }

    return snapshot;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
