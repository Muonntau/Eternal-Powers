import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { CoopService, MAX_PLAYERS } from "./service.js";
import { WorldStore } from "./store.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};
const REPLAY_FREE = new Set(["auth", "input", "snapshot", "room.leave"]);
const parseBody = async (request) => {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 2 * 1024 * 1024)
      throw Error("The request is too large.");
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw Error("Send a valid JSON object.");
  }
};

export function createGameServer({
  database = "data/private-worlds.sqlite",
  service = null,
  dist = resolve("dist"),
  tickInterval = 50,
  broadcastInterval = 150,
  capacity = MAX_PLAYERS,
  allowedOrigins = [],
  sessionsPerMinute = 120,
  now = () => Date.now(),
} = {}) {
  const coop =
    service ||
    new CoopService({ store: new WorldStore(database), now, capacity });
  const clients = new Map(),
    sessionsByIP = new Map();
  let closing = false;
  const originAllowlist = new Set(
    allowedOrigins
      .map((value) => {
        try {
          return new URL(value).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
  const allowsOrigin = (origin, host) => {
    if (!origin) return true;
    try {
      const url = new URL(origin);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        (url.host === host || originAllowlist.has(url.origin))
      );
    } catch {
      return false;
    }
  };
  const json = (response, status, value) => {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(
        request.url || "/",
        `http://${request.headers.host || "localhost"}`,
      );
      const origin = request.headers.origin;
      if (url.pathname.startsWith("/api/") && origin) {
        if (!allowsOrigin(origin, request.headers.host)) {
          json(response, 403, {
            error: "This game origin is not allowed by the server.",
          });
          return;
        }
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
      }
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        response.writeHead(204, {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
        });
        response.end();
        return;
      }
      if (url.pathname === "/api/health") {
        json(response, 200, {
          ok: true,
          service: "Eternal Powers private worlds",
          capacity: coop.capacity,
          persistence: "SQLite",
          version: "2",
          tickRate: Math.round(1000 / tickInterval),
        });
        return;
      }
      if (url.pathname === "/api/session" && request.method === "POST") {
        const address = request.socket.remoteAddress || "local",
          entry = sessionsByIP.get(address) || { since: now(), count: 0 };
        if (now() - entry.since > 60000) {
          entry.since = now();
          entry.count = 0;
        }
        entry.count++;
        sessionsByIP.set(address, entry);
        if (entry.count > sessionsPerMinute) {
          json(response, 429, {
            error: "Wait a minute before creating another local identity.",
          });
          return;
        }
        if (!allowsOrigin(origin, request.headers.host)) {
          json(response, 403, {
            error: "Create identities from this game origin.",
          });
          return;
        }
        const body = await parseBody(request);
        json(
          response,
          201,
          coop.createSession(
            body.name,
            body.checkpoint || null,
            body.character || null,
          ),
        );
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        json(response, 404, { error: "Unknown game endpoint." });
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405);
        response.end();
        return;
      }
      let decoded;
      try {
        decoded = decodeURIComponent(url.pathname);
      } catch {
        response.writeHead(400);
        response.end();
        return;
      }
      if (decoded.includes("\0")) {
        response.writeHead(400);
        response.end();
        return;
      }
      let filename = resolve(
        dist,
        `.${decoded === "/" ? "/index.html" : decoded}`,
      );
      if (filename !== dist && !filename.startsWith(dist + sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      try {
        const info = await stat(filename);
        if (info.isDirectory()) filename = resolve(filename, "index.html");
      } catch {
        if (!extname(decoded)) filename = resolve(dist, "index.html");
        else {
          response.writeHead(404);
          response.end();
          return;
        }
      }
      let content;
      try {
        content = await readFile(filename);
      } catch {
        json(response, 503, {
          error:
            "Build the game with npm run build before serving production assets.",
        });
        return;
      }
      response.writeHead(200, {
        "Content-Type": MIME[extname(filename)] || "application/octet-stream",
        "Content-Length": content.length,
        "Cache-Control":
          extname(filename) === ".html" ? "no-cache" : "public,max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      json(response, 400, {
        error: String(error.message || "The request was rejected."),
      });
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`,
    ).pathname;
    if (pathname !== "/socket") {
      socket.destroy();
      return;
    }
    const origin = request.headers.origin;
    if (origin) {
      try {
        if (!allowsOrigin(origin, request.headers.host)) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws, request),
    );
  });
  const send = (socket, value) => {
    if (
      socket.readyState === WebSocket.OPEN &&
      socket.bufferedAmount < 4 * 1024 * 1024
    )
      socket.send(JSON.stringify(value));
  };
  coop.notifier = (accountId, type, data) => {
    for (const [socket, context] of clients)
      if (context.accountId === accountId) send(socket, { type, data });
  };
  const broadcast = () => {
    const encodedObjects = new WeakMap();
    const encode = (value) => {
      if (!value || typeof value !== "object") return JSON.stringify(value);
      if (!encodedObjects.has(value))
        encodedObjects.set(value, JSON.stringify(value));
      return encodedObjects.get(value);
    };
    const fields = (value) =>
      new Map(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    const changes = (value, before) => {
      const values = {},
        removed = [];
      for (const [key, item] of Object.entries(value))
        if (before.get(key) !== encode(item)) values[key] = item;
      for (const key of before.keys())
        if (!Object.hasOwn(value, key)) removed.push(key);
      return { values, removed };
    };
    for (const [socket, context] of clients) {
      if (
        !context.token ||
        !context.accountId ||
        socket.readyState !== WebSocket.OPEN ||
        socket.bufferedAmount >= 4 * 1024 * 1024
      )
        continue;
      const connection = coop.connections.get(context.accountId);
      if (!connection) continue;
      try {
        const room = coop.roomFor(connection.roomCode),
          member = room.members.get(context.accountId);
        if (!member) continue;
        const worldKey = `${member.engine.zone.id}:${member.engine.world.seed}:${room.sanctuary?.components?.length || 0}`;
        const frame = coop.snapshot(room, context.accountId, {
          compact: true,
          includeWorld: context.worldKey !== worldKey,
        });
        if (context.worldKey !== worldKey) {
          context.lastGame = {};
          context.lastEntities = null;
          context.worldKey = worldKey;
        }
        const delta = {},
          gameFields = {};
        context.lastGame ||= {};
        for (const [key, value] of Object.entries(frame.game)) {
          const record =
            value && typeof value === "object" && !Array.isArray(value);
          const previous = context.lastGame[key];
          if (record) {
            if (previous instanceof Map) {
              const patch = changes(value, previous);
              if (Object.keys(patch.values).length || patch.removed.length)
                gameFields[key] = patch;
            } else delta[key] = value;
            context.lastGame[key] = fields(value);
          } else {
            const encoded = encode(value);
            if (previous !== encoded) delta[key] = value;
            context.lastGame[key] = encoded;
          }
        }
        frame.game = delta;
        if (Object.keys(gameFields).length) frame.gameFields = gameFields;
        const nextEntities = new Map(
          frame.entities.map((entity) => [entity.id, fields(entity)]),
        );
        if (context.lastEntities) {
          const added = [],
            updated = [],
            removed = [];
          for (const entity of frame.entities) {
            const previous = context.lastEntities.get(entity.id);
            if (!previous) added.push(entity);
            else {
              const patch = changes(entity, previous);
              if (Object.keys(patch.values).length || patch.removed.length)
                updated.push({ id: entity.id, ...patch });
            }
          }
          for (const id of context.lastEntities.keys())
            if (!nextEntities.has(id)) removed.push(id);
          if (added.length || updated.length || removed.length)
            frame.entityChanges = { added, updated, removed };
          delete frame.entities;
        }
        context.lastEntities = nextEntities;
        context.lastCollections ||= {};
        for (const key of [
          "effects",
          "chat",
          "trades",
          "market",
          "receipts",
          "renderState",
        ]) {
          const encoded = encode(frame[key]);
          if (context.lastCollections[key] === encoded) delete frame[key];
          else context.lastCollections[key] = encoded;
        }
        if (context.lastPlayers) {
          const changed = [],
            removed = [];
          const present = new Set(frame.players.map((player) => player.id));
          for (const id of context.lastPlayers.keys())
            if (!present.has(id)) {
              context.lastPlayers.delete(id);
              removed.push(id);
            }
          for (const player of frame.players) {
            const encoded = JSON.stringify(player);
            if (context.lastPlayers.get(player.id) !== encoded) {
              changed.push(player);
              context.lastPlayers.set(player.id, encoded);
            }
          }
          frame.playersDelta = changed;
          if (removed.length) frame.playersRemoved = removed;
          delete frame.players;
        } else
          context.lastPlayers = new Map(
            frame.players.map((player) => [player.id, JSON.stringify(player)]),
          );
        frame.delta = true;
        send(socket, { type: "snapshot", data: frame });
      } catch (error) {
        send(socket, { type: "error", error: String(error.message) });
      }
    }
  };
  const perform = (context, action, payload) => {
    const token = context.token;
    switch (action) {
      case "room.create":
        return coop.createRoom(token, payload.name);
      case "room.join":
        return coop.joinRoom(token, payload.code);
      case "room.leave": {
        const connection = coop.connections.get(context.accountId);
        if (connection) coop.leaveRoom(context.accountId, connection.roomCode);
        return true;
      }
      case "input":
        return coop.input(token, payload);
      case "command":
        return coop.command(
          token,
          String(payload.method || ""),
          payload.args || [],
          payload.input || null,
        );
      case "role":
        return coop.setRole(token, payload.targetId, payload.role);
      case "chat":
        return coop.chat(token, payload.text);
      case "trade.invite":
        return coop.tradeInvite(token, payload.targetId);
      case "trade.offer":
        return coop.tradeOffer(token, payload.id, payload.offer);
      case "trade.lock":
        return coop.tradeLock(token, payload.id);
      case "trade.confirm":
        return coop.tradeConfirm(token, payload.id);
      case "trade.cancel":
        return coop.tradeCancel(token, payload.id);
      case "market.list":
        return coop.listMarket(
          token,
          payload.itemId,
          payload.quantity,
          payload.price,
          payload.currency,
        );
      case "market.buy":
        return coop.buyMarket(token, payload.id);
      case "market.cancel":
        return coop.cancelMarket(token, payload.id);
      case "snapshot": {
        const { room, member } = coop.member(token);
        return coop.snapshot(room, member.id);
      }
      default:
        throw Error("Unknown private-world action.");
    }
  };
  wss.on("connection", (socket) => {
    const context = { token: null, accountId: null, since: now(), count: 0 };
    clients.set(socket, context);
    const authTimeout = setTimeout(() => {
      if (!context.accountId)
        socket.close(4001, "Authenticate before playing.");
    }, 10000);
    authTimeout.unref?.();
    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        send(socket, { type: "error", error: "Malformed game message." });
        return;
      }
      const id =
          typeof message.id === "string" && message.id.length <= 160
            ? message.id
            : null,
        action = String(message.action || ""),
        payload =
          message.payload &&
          typeof message.payload === "object" &&
          !Array.isArray(message.payload)
            ? message.payload
            : {};
      if (now() - context.since > 1000) {
        context.since = now();
        context.count = 0;
      }
      if (++context.count > 100) {
        socket.close(4008, "Too many game messages.");
        return;
      }
      try {
        if (action === "auth") {
          const account = coop.authenticate(payload.token);
          for (const [otherSocket, otherContext] of clients)
            if (
              otherSocket !== socket &&
              otherContext.accountId === account.id
            ) {
              otherContext.accountId = null;
              otherContext.token = null;
              otherSocket.close(
                4002,
                "Identity reconnected in another client.",
              );
            }
          context.token = payload.token;
          context.accountId = account.id;
          clearTimeout(authTimeout);
          send(socket, {
            id,
            ok: true,
            result: { id: account.id, name: account.name },
          });
          return;
        }
        if (!context.token)
          throw Error("Authenticate your private-world identity first.");
        let response;
        if (REPLAY_FREE.has(action)) {
          response = {
            id,
            ok: true,
            result: perform(context, action, payload),
          };
        } else {
          if (!id)
            throw Error(
              "Resource-changing actions need a unique request identity.",
            );
          response = coop.store.transaction(() => {
            const recorded = coop.store.request(context.accountId, id);
            if (recorded) return recorded;
            const result = perform(context, action, payload),
              value = { id, ok: true, result: result ?? null };
            coop.store.saveRequest(context.accountId, id, value);
            return value;
          });
        }
        if (id) send(socket, response);
        // The regular snapshot timer batches simultaneous actions and joins.
        // Resource-changing replies remain immediate and replay-safe.
      } catch (error) {
        if (id)
          send(socket, {
            id,
            ok: false,
            error: String(error.message || "Action rejected."),
          });
        else
          send(socket, {
            type: "error",
            error: String(error.message || "Action rejected."),
          });
      }
    });
    socket.on("close", () => {
      clearTimeout(authTimeout);
      clients.delete(socket);
      if (context.accountId) {
        const connection = coop.connections.get(context.accountId);
        if (connection) coop.leaveRoom(context.accountId, connection.roomCode);
      }
      // The next regular broadcast advertises the disconnect.
    });
    socket.on("error", () => {});
  });
  const tick = setInterval(() => {
    try {
      coop.tick(tickInterval / 1000);
    } catch (error) {
      for (const socket of clients.keys())
        send(socket, {
          type: "error",
          error: "The world paused an invalid simulation step.",
        });
      process.stderr.write(`World simulation: ${error.message}\n`);
    }
  }, tickInterval);
  tick.unref?.();
  const snapshots = setInterval(broadcast, broadcastInterval);
  snapshots.unref?.();
  return {
    server,
    wss,
    service: coop,
    broadcast,
    async listen(port = 5176, host = "0.0.0.0") {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      return server.address();
    },
    async close() {
      if (closing) return;
      closing = true;
      clearInterval(tick);
      clearInterval(snapshots);
      for (const socket of clients.keys()) socket.terminate();
      await new Promise((resolve) => wss.close(() => resolve()));
      await new Promise((resolve) => server.close(() => resolve()));
      coop.close();
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = createGameServer({
    database: process.env.ETERNAL_DB || "data/private-worlds.sqlite",
    capacity: Number(process.env.ETERNAL_CAPACITY) || MAX_PLAYERS,
    allowedOrigins: (process.env.ETERNAL_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  });
  const address = await app.listen(
    Number(process.env.PORT) || 5176,
    process.env.HOST || "0.0.0.0",
  );
  process.stdout.write(
    `Eternal Powers private worlds: http://localhost:${address.port}\n`,
  );
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
