# Hosting Eternal Powers v2 multiplayer

The game server supports up to 64 connected travelers in a room. Regions are individual destinations: traveling does not teleport the entire server. Characters, construction roles, inventories, trades and market receipts are validated by the authoritative Node server and persisted with SQLite. Renewable wilderness enemies and materials return on timers when no player occupies their spawn area. Story encounters, chests and posted creature offerings retain their one-time receipts.

GitHub Pages serves the public client. It cannot execute the Node server or store multiplayer worlds. In the game's Servers panel, enter the HTTPS address of a server you host, then create or join a world. Solo and offline play work without that address. Identity tokens are stored separately for each server; changing servers never imports a character or its balances implicitly.

## Container deployment

Install Docker and run:

```sh
docker compose up --build -d
```

This exposes port 5176 and keeps the SQLite database in the `world-data` volume. Put the service behind your host's HTTPS reverse proxy, with WebSocket upgrades forwarded to the same port. Use an HTTPS address such as `https://eternal.example.com` in the client. A Pages client will reject an insecure remote HTTP address; localhost HTTP remains available for development.

Set `ETERNAL_ALLOWED_ORIGINS` to the exact allowed web origins, separated by commas. For the public Pages client the origin is `https://muonntau.github.io` (no path). Origin checks apply to both session requests and WebSocket upgrades. Keep this list explicit rather than allowing arbitrary sites to create sessions.

For a direct Node deployment:

```sh
npm ci
npm run build
ETERNAL_CAPACITY=64 ETERNAL_ALLOWED_ORIGINS=https://muonntau.github.io npm start
```

Useful settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Listen interface |
| `PORT` | `5176` | HTTP and WebSocket port |
| `ETERNAL_CAPACITY` | `64` | Maximum travelers, capped at 64 |
| `ETERNAL_DB` | `data/private-worlds.sqlite` | Persistent world database |
| `ETERNAL_ALLOWED_ORIGINS` | same-origin clients | Additional allowed client origins |

A deployment must provide a persistent writable disk for the database. Stop the service before taking a filesystem backup. Serve the public port through HTTPS and expose only the reverse proxy to the internet.

The 64-client automated test is a controlled functional/load fixture, not a production hosting guarantee. Capacity depends on server hardware, bandwidth, active regions, population and player behavior. Check the reported tick/snapshot timings under your expected workload before inviting a full server.
