const TOKEN_KEY = "eternal-coop-token";
const ID_KEY = "eternal-coop-account";
const clone = (value) => (value == null ? value : structuredClone(value));
const MUTATIONS = [
  "cast",
  "cancelCast",
  "interact",
  "attack",
  "dodge",
  "usePotion",
  "useEssencePotion",
  "useItem",
  "trainPower",
  "previewRespecialization",
  "commitRespecialization",
  "cancelRespecialization",
  "trainEnhancement",
  "equipEnhancement",
  "trainTechnique",
  "useTechnique",
  "certifyCrossAffinity",
  "beginOpposingPractice",
  "beginRevive",
  "cancelRevive",
  "useRecoveryRecall",
  "toggleVeil",
  "negotiate",
  "makeRestitution",
  "selectSecondaryTarget",
  "beginRitual",
  "commitRitual",
  "cancelRitual",
  "resumeRitual",
  "reverseCondition",
  "completeCounterAnchor",
  "counterCondition",
  "claimWorldSupply",
  "advanceWorldEvent",
  "completeWorldEvent",
  "disableWorldHazard",
  "assistCreature",
  "bondCompanion",
  "setCompanionSupport",
  "dismissCompanion",
  "craftItem",
  "startCraft",
  "resumeCraft",
  "cancelCraft",
  "placeBuild",
  "removeBuild",
  "undoBuild",
  "saveLayout",
  "restoreLayout",
  "depositItem",
  "withdrawItem",
  "repairItem",
  "salvageItem",
  "equipItem",
  "visitSanctuary",
  "resurrectNPC",
  "acceptContract",
  "advanceContractStep",
  "settleContract",
  "abandonContract",
  "chooseDialogue",
  "hireAlly",
  "commandAlly",
  "openContractDialogue",
  "learnRecipe",
  "learnRecipePlan",
  "previewBarter",
  "lockBarter",
  "commitBarter",
  "cancelBarter",
  "pinQuest",
  "completePortalTrial",
  "navigateTo",
  "navigateToEvent",
  "navigateToRitualAnchor",
  "navigateToCounterAnchor",
  "navigateToHazard",
  "navigateToContract",
  "chooseTravelRoute",
  "setZone",
  "save",
];

/** The solo checkpoint stays separate. Once joined, this client sends intentions;
 * the private-world server owns movement, resources, encounters, and receipts. */
export class NetworkClient {
  constructor(
    engine,
    { onUpdate = () => {}, onEvent = () => {}, baseURL = "" } = {},
  ) {
    this.engine = engine;
    this.onUpdate = onUpdate;
    this.onEvent = onEvent;
    this.baseURL = baseURL;
    this.listeners = new Set();
    this.pending = new Map();
    this.counter = 0;
    this.sequence = 0;
    this.state = {
      status: "offline",
      room: null,
      players: [],
      trades: [],
      market: [],
      chat: [],
      receipts: [],
      selfId: null,
      error: null,
    };
    this.token = this.readStorage(TOKEN_KEY);
    this.account = this.readAccount();
    this.originals = null;
    this.localQuote = null;
    this.worldCache = new Map();
    this.closed = false;
  }
  readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  readAccount() {
    try {
      return JSON.parse(this.readStorage(ID_KEY) || "null");
    } catch {
      return null;
    }
  }
  remember() {
    try {
      localStorage.setItem(TOKEN_KEY, this.token);
      localStorage.setItem(ID_KEY, JSON.stringify(this.account));
    } catch {}
  }
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }
  getState() {
    return this.state;
  }
  emit(patch = {}) {
    this.state = { ...this.state, ...patch };
    this.onUpdate(this.state);
    for (const fn of this.listeners) fn(this.state);
    if (this.engine) this.engine.network = this.state;
  }
  notice(text, type = "info") {
    const event = { type, text };
    this.onEvent(event);
    this.engine?.onEvent?.(event);
  }
  async connectSession({
    name = "Wayfarer",
    importCheckpoint = false,
    fresh = false,
  } = {}) {
    if (this.closed) throw Error("This connection has been closed.");
    if (!this.token || fresh) {
      const checkpoint = importCheckpoint
        ? (
            this.originals?.exportCheckpoint || this.engine?.exportCheckpoint
          )?.call(this.engine)
        : undefined;
      const response = await fetch(`${this.baseURL}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(checkpoint ? { checkpoint } : {}) }),
      });
      const body = await response.json();
      if (!response.ok || body.error)
        throw Error(body.error || "The world server is unavailable.");
      this.token = body.token;
      this.account = { id: body.id, name: body.name };
      this.remember();
    }
    if (this.socket?.readyState === WebSocket.OPEN) return this.account;
    this.emit({ status: "connecting", error: null });
    const endpoint = this.baseURL
      ? new URL(this.baseURL, location.href)
      : new URL(location.href);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    endpoint.pathname = "/socket";
    endpoint.search = "";
    endpoint.hash = "";
    const socket = (this.socket = new WebSocket(endpoint.href));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("The world server did not respond.")),
        10000,
      );
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(
          Error(
            "Start the private-world server with npm run server, then reconnect.",
          ),
        );
      };
      socket.onmessage = (event) => this.receive(event.data);
      socket.onclose = () => this.lostConnection();
    });
    try {
      await this.request("auth", { token: this.token });
      this.emit({ status: "ready", account: this.account, error: null });
      return this.account;
    } catch (error) {
      socket.close();
      if (/token|session/i.test(error.message)) {
        this.token = null;
        this.account = null;
        try {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ID_KEY);
        } catch {}
      }
      throw error;
    }
  }
  async createRoom(name = "A Shared Eternity") {
    await this.connectSession();
    const value = await this.request("room.create", { name });
    if (value?.room) this.applySnapshot(value);
    return value;
  }
  async joinRoom(code) {
    await this.connectSession();
    const value = await this.request("room.join", {
      code: String(code).trim().toUpperCase(),
    });
    if (value?.room) this.applySnapshot(value);
    return value;
  }
  request(action, payload = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN)
      return Promise.reject(
        Error("Connect to the private-world server first."),
      );
    const id = `${this.account?.id || "client"}:${Date.now().toString(36)}:${++this.counter}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error("The world server timed out. No new action is assumed."));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, action, payload }));
    });
  }
  command(method, args = []) {
    return this.request("command", {
      method,
      args,
      input: this.captureInput(),
    }).catch((error) => {
      this.notice(error.message, "error");
      return false;
    });
  }
  receive(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.result);
      else
        pending.reject(
          Error(message.error || "The server rejected that request."),
        );
    }
    if (message.type === "snapshot" && message.data)
      this.applySnapshot(message.data);
    if (message.type === "event" && message.data) {
      this.onEvent(message.data);
      this.engine?.onEvent?.(message.data);
    }
    if (message.type === "error")
      this.emit({ error: message.error || "Connection error" });
  }
  captureInput() {
    const e = this.engine;
    return {
      sequence: ++this.sequence,
      keys: [...(e?.keys || [])],
      targetId: e?.targetId ?? null,
      pointer: e?.pointer,
      destination: e?.destination || null,
      selectedPower: e?.selectedPower,
      blocked: !!e?.inputBlocked || !!e?.paused,
    };
  }
  attach() {
    const e = this.engine;
    if (!e || this.originals) return;
    this.originals = {};
    const names = [
      ...new Set([
        ...MUTATIONS,
        "update",
        "getSnapshot",
        "setPower",
        "selectTarget",
        "previewTrade",
        "commitTrade",
        "buyItem",
        "sellItem",
        "exportCheckpoint",
        "restoreCheckpoint",
      ]),
    ];
    for (const name of names)
      if (typeof e[name] === "function") this.originals[name] = e[name];
    this.soloCheckpoint = clone(this.originals.exportCheckpoint?.call(e));
    this.soloStorage = e.storage;
    let saved = this.soloCheckpoint
      ? JSON.stringify(this.soloCheckpoint)
      : null;
    e.storage = {
      getItem: () => saved,
      setItem: (_, value) => {
        saved = value;
      },
      removeItem: () => {
        saved = null;
      },
    };
    e.update = () => {};
    e.getSnapshot = () =>
      this.latest?.game
        ? {
            ...this.latest.game,
            player: clone(e.player),
            selectedPower: this.latest.game.selectedPower,
            target:
              e.entities?.find((n) => n.id === e.targetId && !n.collected) ||
              this.latest.game.target,
            network: this.state,
            inputBlocked: e.inputBlocked,
          }
        : this.originals.getSnapshot.call(e);
    for (const name of MUTATIONS)
      if (this.originals[name]) e[name] = (...args) => this.command(name, args);
    e.setPower = (branchId, level = 1) => {
      this.originals.setPower.call(e, branchId, level);
      this.command("setPower", [branchId, level]);
      return true;
    };
    if (this.originals.selectTarget)
      e.selectTarget = (id) => {
        this.originals.selectTarget.call(e, id);
        this.request("input", this.captureInput()).catch(() => {});
      };
    e.previewTrade = (...args) => {
      const q = this.originals.previewTrade.call(e, ...args);
      this.localQuote = clone(q);
      return q;
    };
    e.commitTrade = (quoteId) => {
      const q = this.localQuote || e.shop?.activeQuote;
      if (!q || q.id !== quoteId) return false;
      this.localQuote = null;
      return this.command("purchase", [
        q.itemId,
        q.quantity,
        q.mode,
        { total: q.total },
      ]);
    };
    e.buyItem = (id, quantity = 1) =>
      this.command("purchase", [id, quantity, "buy"]);
    e.sellItem = (id, quantity = 1) =>
      this.command("purchase", [id, quantity, "sell"]);
    e.exportCheckpoint = () => clone(this.latest?.checkpoint || null);
    this.inputTimer = setInterval(() => {
      if (
        this.state.status === "connected" &&
        this.socket?.readyState === WebSocket.OPEN
      )
        this.socket.send(
          JSON.stringify({ action: "input", payload: this.captureInput() }),
        );
    }, 50);
  }
  applySnapshot(snapshot) {
    if (!snapshot?.game || !snapshot?.room) return;
    this.attach();
    const e = this.engine;
    this.latest = snapshot;
    const target = e?.targetId,
      pointer = e?.pointer;
    if (e && snapshot.checkpoint && this.originals.restoreCheckpoint)
      this.originals.restoreCheckpoint.call(e, clone(snapshot.checkpoint));
    if (e) {
      for (const [key, value] of Object.entries(snapshot.game))
        if (
          [
            "player",
            "zone",
            "time",
            "localMagic",
            "powerObjects",
            "downed",
            "cooldowns",
          ].includes(key)
        )
          e[key] = clone(value);
      const worldKey = `${snapshot.game.zone?.id}:${snapshot.world?.seed}:${snapshot.worldRevision || 0}`;
      if (snapshot.world && !this.worldCache.has(worldKey))
        this.worldCache.set(worldKey, snapshot.world);
      e.world = this.worldCache.get(worldKey) || snapshot.world || e.world;
      e.entities = snapshot.entities || e.entities;
      e.effects = snapshot.effects || [];
      e.selectedPower = {
        branchId: snapshot.game.selectedPower?.branchId || "water-grow",
        level: snapshot.game.selectedPower?.level || 1,
      };
      e.destination = snapshot.destination || null;
      if (snapshot.targetId !== undefined) e.targetId = snapshot.targetId;
      else if (target && e.entities.some((n) => n.id === target))
        e.targetId = target;
      e.pointer = pointer || e.pointer;
      if (this.localQuote && e.shop)
        e.shop.activeQuote = clone(this.localQuote);
    }
    const { game, checkpoint, world, entities, effects, ...publicState } =
      snapshot;
    this.emit({ ...publicState, status: "connected", error: null });
    e?.publish?.();
  }
  detach() {
    clearInterval(this.inputTimer);
    this.inputTimer = null;
    const e = this.engine;
    if (!e || !this.originals) return;
    for (const [key, fn] of Object.entries(this.originals)) e[key] = fn;
    e.storage = this.soloStorage;
    const backup = this.soloCheckpoint;
    this.originals = null;
    this.latest = null;
    if (backup) e.restoreCheckpoint(backup);
    e.keys?.clear();
    e.destination = null;
    e.network = null;
    e.publish?.();
  }
  lostConnection() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(Error("Disconnected from the world server."));
    }
    this.pending.clear();
    this.detach();
    this.emit({
      status: "offline",
      room: null,
      players: [],
      trades: [],
      market: [],
      chat: [],
      error:
        "Connection closed. Your solo journey is restored; the server retains the shared world.",
    });
  }
  async disconnect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        await this.request("room.leave");
      } catch {}
    }
    this.detach();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    this.emit({
      status: "offline",
      room: null,
      players: [],
      trades: [],
      market: [],
      chat: [],
      error: null,
    });
  }
  async destroy() {
    this.closed = true;
    await this.disconnect();
    this.listeners.clear();
  }
}
export default NetworkClient;
