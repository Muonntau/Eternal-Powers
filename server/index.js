import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { CoopService } from "./service.js";
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
  broadcastInterval = 100,
  now = () => Date.now(),
} = {}) {
  const coop =
    service || new CoopService({ store: new WorldStore(database), now });
  const clients = new Map(),
    sessionsByIP = new Map();
  let closing = false;
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
      if (url.pathname === "/api/health") {
        json(response, 200, {
          ok: true,
          service: "Eternal Powers private worlds",
          capacity: 4,
          persistence: "SQLite",
          version: "1",
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
        if (entry.count > 12) {
          json(response, 429, {
            error: "Wait a minute before creating another local identity.",
          });
          return;
        }
        const origin = request.headers.origin;
        if (origin && new URL(origin).host !== request.headers.host) {
          json(response, 403, {
            error: "Create identities from this game origin.",
          });
          return;
        }
        const body = await parseBody(request);
        json(
          response,
          201,
          coop.createSession(body.name, body.checkpoint || null),
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
        if (new URL(origin).host !== request.headers.host) {
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
    for (const [socket, context] of clients) {
      if (
        !context.token ||
        !context.accountId ||
        socket.readyState !== WebSocket.OPEN
      )
        continue;
      const connection = coop.connections.get(context.accountId);
      if (!connection) continue;
      try {
        send(socket, {
          type: "snapshot",
          data: coop.snapshot(
            coop.roomFor(connection.roomCode),
            context.accountId,
          ),
        });
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
        if (action !== "input" && action !== "snapshot") broadcast();
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
      if (!closing) broadcast();
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
