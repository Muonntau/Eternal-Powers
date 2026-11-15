import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { performance } from "node:perf_hooks";
import { createGameServer } from "../server/index.js";

async function openClient(url, token) {
  const socket = new WebSocket(url),
    pending = new Map();
  let count = 0;
  const state = { frames: 0, bytes: 0, latest: null, lastSnapshotBytes: 0 };
  socket.on("message", (raw) => {
    state.bytes += raw.length;
    const m = JSON.parse(String(raw));
    if (m.type === "snapshot") {
      state.frames++;
      state.latest = m.data;
      state.lastSnapshotBytes = raw.length;
    }
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(p.timer);
      m.ok ? p.resolve(m.result) : p.reject(Error(m.error));
    }
  });
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const request = (action, payload = {}) =>
    new Promise((resolve, reject) => {
      const id = `capacity-${++count}`,
        timer = setTimeout(() => {
          pending.delete(id);
          reject(Error(`Timeout ${action}`));
        }, 20000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, action, payload }));
    });
  await request("auth", { token });
  return { socket, state, request };
}

test(
  "64 real WebSocket travelers share movement and independent zones; a 65th waits and reconnect keeps identity",
  { timeout: 120000 },
  async (t) => {
    const app = createGameServer({
      database: ":memory:",
      tickInterval: 50,
      broadcastInterval: 200,
    });
    const address = await app.listen(0, "127.0.0.1"),
      origin = `http://127.0.0.1:${address.port}`,
      socketURL = origin.replace("http:", "ws:") + "/socket";
    const clients = [],
      accounts = [];
    const started = performance.now();
    try {
      for (let i = 0; i < 65; i++) {
        const response = await fetch(origin + "/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Traveler ${i + 1}`,
            character: {
              name: `Traveler ${i + 1}`,
              lineage: i % 2 ? "demon" : "angel",
              starterBranch: i % 2 ? "fire-create" : "water-grow",
              appearance: {},
            },
          }),
        });
        assert.equal(response.status, 201);
        accounts.push(await response.json());
      }
      // All 65 transports authenticate; the realm itself admits exactly 64.
      for (const account of accounts)
        clients.push(await openClient(socketURL, account.token));
      const first = await clients[0].request("room.create", {
          name: "64 Player Verification",
        }),
        code = first.room.code;
      assert.equal(first.room.capacity, 64);
      assert.equal(first.room.sharedTravel, false);
      for (let i = 1; i < 64; i++)
        await clients[i].request("room.join", { code });
      assert.equal(app.service.roomFor(code).members.size, 64);
      // Every admitted server identity already has a created character.
      app.service.tick(0.05);
      assert.equal(
        app.service
          .member(accounts[0].token)
          .member.engine.entities.filter((e) => e.adventureActor).length,
        64 * 7,
      );
      await assert.rejects(
        () => clients[64].request("room.join", { code }),
        /full.*64/,
      );
      const before = app.service.member(accounts[0].token).member.engine.player
        .x;
      await clients[0].request("input", { sequence: 1, keys: ["d"] });
      await new Promise((resolve) => setTimeout(resolve, 400));
      await clients[0].request("input", { sequence: 2, keys: [] });
      const moved = await clients[1].request("snapshot");
      assert.ok(moved.players.find((p) => p.id === accounts[0].id).x > before);
      await clients[1].request("command", {
        method: "setZone",
        args: ["prismatic-waterfalls"],
      });
      assert.equal(
        app.service.member(accounts[0].token).member.engine.zone.id,
        "sacred-groves",
      );
      assert.equal(
        app.service.member(accounts[1].token).member.engine.zone.id,
        "prismatic-waterfalls",
      );
      const tickTimes = [];
      for (let i = 0; i < 10; i++) {
        const begin = performance.now();
        app.service.tick(0.05);
        tickTimes.push(performance.now() - begin);
      }
      const snapshotStart = performance.now();
      app.broadcast();
      const broadcastMs = performance.now() - snapshotStart;
      const compact = app.service.snapshot(
        app.service.roomFor(code),
        accounts[0].id,
        { compact: true, includeWorld: false },
      );
      assert.equal(compact.checkpoint, undefined);
      assert.equal(compact.world, undefined);
      assert.equal(compact.players.length, 64);
      assert.ok(compact.entities.length <= moved.entities.length);
      // Measure actual warmed wire frames, rather than treating the one-time
      // full-state join response as a packet sent every broadcast.
      app.broadcast();
      await new Promise((resolve) => setTimeout(resolve, 80));
      app.broadcast();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const idleWireBytes = clients
        .slice(0, 64)
        .map((client) => client.state.lastSnapshotBytes);
      assert.ok(
        Math.max(...idleWireBytes) < 16000,
        "Idle delta frames must not resend complete menus, terrain or unchanged entities.",
      );
      const accountId = accounts[0].id;
      await clients[0].request("room.leave");
      await clients[64].request("room.join", { code });
      await clients[64].request("room.leave");
      await clients[0].request("room.join", { code });
      assert.equal(app.service.member(accounts[0].token).member.id, accountId);
      assert.equal(
        app.service.roomFor(code).members.get(accountId).connected,
        true,
      );
      assert.ok(clients.some((c) => c.state.frames > 0));
      const maxTick = Math.max(...tickTimes),
        averageTick = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
      t.diagnostic(
        JSON.stringify({
          players: 64,
          elapsedMs: Math.round(performance.now() - started),
          averageTickMs: +averageTick.toFixed(2),
          maxTickMs: +maxTick.toFixed(2),
          broadcastMs: +broadcastMs.toFixed(2),
          compactBytes: Buffer.byteLength(JSON.stringify(compact)),
          averageIdleWireBytes: Math.round(
            idleWireBytes.reduce((a, b) => a + b, 0) / idleWireBytes.length,
          ),
          maxIdleWireBytes: Math.max(...idleWireBytes),
          frames: clients.reduce((n, c) => n + c.state.frames, 0),
        }),
      );
      assert.ok(
        maxTick < 1000,
        "64-client fixture must remain responsive; measured timing is reported, not a production SLA",
      );
    } finally {
      for (const c of clients) c.socket.terminate();
      await app.close();
    }
  },
);

test("remote clients require an explicit CORS and WebSocket origin allowlist", async () => {
  const app = createGameServer({
    database: ":memory:",
    capacity: 12,
    allowedOrigins: ["https://muonntau.github.io"],
  });
  const address = await app.listen(0, "127.0.0.1"),
    origin = `http://127.0.0.1:${address.port}`;
  try {
    const good = await fetch(origin + "/api/health", {
      headers: { Origin: "https://muonntau.github.io" },
    });
    assert.equal(good.status, 200);
    assert.equal(
      good.headers.get("access-control-allow-origin"),
      "https://muonntau.github.io",
    );
    assert.equal((await good.json()).capacity, 12);
    const bad = await fetch(origin + "/api/session", {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "No" }),
    });
    assert.equal(bad.status, 403);
    const preflight = await fetch(origin + "/api/session", {
      method: "OPTIONS",
      headers: {
        Origin: "https://muonntau.github.io",
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(preflight.status, 204);
    await assert.rejects(
      () =>
        new Promise((resolve, reject) => {
          const ws = new WebSocket(origin.replace("http:", "ws:") + "/socket", {
            origin: "https://untrusted.example",
          });
          ws.once("open", () => {
            ws.terminate();
            resolve();
          });
          ws.once("error", reject);
        }),
    );
  } finally {
    await app.close();
  }
});
