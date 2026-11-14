import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
const digest = (value) =>
  createHash("sha256").update(String(value)).digest("hex");
export class WorldStore {
  constructor(filename = ":memory:") {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
   CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,name TEXT NOT NULL,checkpoint TEXT,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,name TEXT NOT NULL,owner_id TEXT NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS members(room_code TEXT NOT NULL,account_id TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'visitor',joined_at INTEGER NOT NULL,PRIMARY KEY(room_code,account_id));
   CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,room_code TEXT NOT NULL,type TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS characters(room_code TEXT NOT NULL,account_id TEXT NOT NULL,checkpoint TEXT NOT NULL,PRIMARY KEY(room_code,account_id));
   CREATE TABLE IF NOT EXISTS trades(id TEXT PRIMARY KEY,room_code TEXT NOT NULL,status TEXT NOT NULL,state TEXT NOT NULL,updated_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS requests(account_id TEXT NOT NULL,request_id TEXT NOT NULL,response TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(account_id,request_id));
   CREATE TABLE IF NOT EXISTS market(id TEXT PRIMARY KEY,room_code TEXT NOT NULL,seller_id TEXT NOT NULL,item_id TEXT NOT NULL,quantity INTEGER NOT NULL,price INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL);
  `);
  }
  transaction(fn) {
    if (this.inTransaction) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.inTransaction = true;
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }
  createAccount(name = "Wayfarer", checkpoint = null) {
    const id = randomUUID(),
      token = randomBytes(32).toString("base64url");
    this.db
      .prepare("INSERT INTO accounts VALUES(?,?,?,?,?)")
      .run(
        id,
        digest(token),
        String(name).slice(0, 24),
        checkpoint ? JSON.stringify(checkpoint) : null,
        Date.now(),
      );
    return { id, token, name: String(name).slice(0, 24), checkpoint };
  }
  authenticate(token) {
    if (typeof token !== "string" || token.length > 100) return null;
    const row = this.db
      .prepare("SELECT * FROM accounts WHERE token_hash=?")
      .get(digest(token));
    return row
      ? {
          id: row.id,
          name: row.name,
          checkpoint: row.checkpoint ? JSON.parse(row.checkpoint) : null,
        }
      : null;
  }
  account(id) {
    const row = this.db.prepare("SELECT * FROM accounts WHERE id=?").get(id);
    return row
      ? {
          id: row.id,
          name: row.name,
          checkpoint: row.checkpoint ? JSON.parse(row.checkpoint) : null,
        }
      : null;
  }
  character(code, id) {
    const row = this.db
      .prepare(
        "SELECT checkpoint FROM characters WHERE room_code=? AND account_id=?",
      )
      .get(code, id);
    return row ? JSON.parse(row.checkpoint) : null;
  }
  saveCharacter(code, id, checkpoint) {
    this.db
      .prepare(
        "INSERT INTO characters VALUES(?,?,?) ON CONFLICT(room_code,account_id) DO UPDATE SET checkpoint=excluded.checkpoint",
      )
      .run(code, id, JSON.stringify(checkpoint));
  }
  saveTrade(trade) {
    this.db
      .prepare(
        "INSERT INTO trades VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,state=excluded.state,updated_at=excluded.updated_at",
      )
      .run(
        trade.id,
        trade.roomCode,
        trade.status,
        JSON.stringify(trade),
        Date.now(),
      );
  }
  openTrades() {
    return this.db
      .prepare("SELECT state FROM trades WHERE status='open'")
      .all()
      .map((r) => JSON.parse(r.state));
  }
  request(accountId, id) {
    const row = this.db
      .prepare(
        "SELECT response FROM requests WHERE account_id=? AND request_id=?",
      )
      .get(accountId, id);
    return row ? JSON.parse(row.response) : null;
  }
  saveRequest(accountId, id, response) {
    this.db
      .prepare("INSERT OR IGNORE INTO requests VALUES(?,?,?,?)")
      .run(accountId, id, JSON.stringify(response), Date.now());
  }
  receiptExists(id) {
    return !!this.db.prepare("SELECT id FROM receipts WHERE id=?").get(id);
  }
  saveAccount(id, checkpoint) {
    this.db
      .prepare("UPDATE accounts SET checkpoint=?,name=? WHERE id=?")
      .run(
        JSON.stringify(checkpoint),
        String(checkpoint.player?.name || "Wayfarer").slice(0, 24),
        id,
      );
  }
  room(code) {
    const row = this.db
      .prepare("SELECT * FROM rooms WHERE code=?")
      .get(String(code).toUpperCase());
    return row
      ? {
          code: row.code,
          name: row.name,
          ownerId: row.owner_id,
          state: JSON.parse(row.state),
        }
      : null;
  }
  createRoom(ownerId, name) {
    let code;
    do {
      code = randomBytes(5).toString("hex").slice(0, 6).toUpperCase();
    } while (this.room(code));
    this.db
      .prepare("INSERT INTO rooms VALUES(?,?,?,?,?)")
      .run(
        code,
        String(name || "A Shared Eternity").slice(0, 40),
        ownerId,
        "{}",
        Date.now(),
      );
    this.setRole(code, ownerId, "owner");
    return this.room(code);
  }
  saveRoom(code, state) {
    this.db
      .prepare("UPDATE rooms SET state=? WHERE code=?")
      .run(JSON.stringify(state), code);
  }
  role(code, id) {
    return (
      this.db
        .prepare("SELECT role FROM members WHERE room_code=? AND account_id=?")
        .get(code, id)?.role || null
    );
  }
  setRole(code, id, role) {
    this.db
      .prepare(
        "INSERT INTO members VALUES(?,?,?,?) ON CONFLICT(room_code,account_id) DO UPDATE SET role=excluded.role",
      )
      .run(code, id, role, Date.now());
  }
  receipt(code, type, body, id = randomUUID()) {
    this.db
      .prepare("INSERT INTO receipts VALUES(?,?,?,?,?)")
      .run(id, code, type, JSON.stringify(body), Date.now());
    return { id, type, ...body };
  }
  receipts(code) {
    return this.db
      .prepare(
        "SELECT * FROM receipts WHERE room_code=? ORDER BY created_at DESC LIMIT 50",
      )
      .all(code)
      .map((r) => ({
        id: r.id,
        type: r.type,
        ...JSON.parse(r.body),
        createdAt: r.created_at,
      }));
  }
  listMarket(code) {
    return this.db
      .prepare(
        "SELECT * FROM market WHERE room_code=? AND status='open' ORDER BY created_at DESC",
      )
      .all(code)
      .map((r) => ({
        id: r.id,
        sellerId: r.seller_id,
        itemId: r.item_id,
        quantity: r.quantity,
        price: r.price,
        currency: r.currency,
        status: r.status,
        createdAt: r.created_at,
      }));
  }
  market(id) {
    const r = this.db.prepare("SELECT * FROM market WHERE id=?").get(id);
    return r
      ? {
          id: r.id,
          roomCode: r.room_code,
          sellerId: r.seller_id,
          itemId: r.item_id,
          quantity: r.quantity,
          price: r.price,
          currency: r.currency,
          status: r.status,
        }
      : null;
  }
  createListing(code, sellerId, itemId, quantity, price, currency) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO market VALUES(?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        code,
        sellerId,
        itemId,
        quantity,
        price,
        currency,
        "open",
        Date.now(),
      );
    return this.market(id);
  }
  closeListing(id, status) {
    this.db
      .prepare("UPDATE market SET status=? WHERE id=? AND status='open'")
      .run(status, id);
  }
  close() {
    this.db.close();
  }
}
