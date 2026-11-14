import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createOfflineIndex } from '../scripts/build-offline-index.mjs';
import { runInNewContext } from 'node:vm';

test('offline index includes actual local asset bytes, encodes paths and changes with game code', async () => {
  const parent = resolve('work'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, 'offline-index-'));
  try {
    await mkdir(resolve(root, 'public/assets/region'), { recursive: true }); await mkdir(resolve(root, 'src'));
    await writeFile(resolve(root, 'public/assets/region/one sprite.png'), 'pixels');
    await writeFile(resolve(root, 'public/assets/region/theme.ogg'), 'sound');
    await writeFile(resolve(root, 'public/assets/region/source.txt'), 'excluded source');
    await writeFile(resolve(root, 'src/main.js'), 'first build');
    const first = await createOfflineIndex({ projectRoot: root });
    assert.equal(first.assetCount, 2); assert.equal(first.totalBytes, 11);
    assert.ok(first.files.some(file => file.url === '/assets/region/one%20sprite.png'));
    assert.ok(first.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
    const again = await createOfflineIndex({ projectRoot: root }); assert.equal(again.version, first.version);
    await writeFile(resolve(root, 'src/main.js'), 'second build');
    const changed = await createOfflineIndex({ projectRoot: root }); assert.notEqual(changed.version, first.version);
    assert.match(await readFile(resolve(root, 'public/offline-version.js'), 'utf8'), new RegExp(changed.version));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('postbuild shell index contains bundled code and fonts but leaves large art opt-in', async () => {
  const parent = resolve('work'); await mkdir(parent, { recursive: true }); const root = await mkdtemp(resolve(parent, 'offline-core-'));
  try {
    await mkdir(resolve(root, 'public/assets'), { recursive: true }); await mkdir(resolve(root, 'dist/assets'), { recursive: true });
    await writeFile(resolve(root, 'public/assets/tree.png'), 'tree'); await writeFile(resolve(root, 'dist/assets/app-abcd.js'), 'code');
    await writeFile(resolve(root, 'dist/assets/font.woff2'), 'font'); await writeFile(resolve(root, 'dist/assets/tree.png'), 'tree');
    await writeFile(resolve(root, 'dist/index.html'), '<html>game</html>');
    const index = await createOfflineIndex({ projectRoot: root, dist: true });
    const core = JSON.parse(await readFile(resolve(root, 'dist/offline-core.json'), 'utf8'));
    assert.equal(index.coreCount, 3);
    assert.deepEqual(core.files.map(file => file.url), ['/', '/assets/app-abcd.js', '/assets/font.woff2']);
    assert.equal(core.files.some(file => file.url.endsWith('.png')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('service worker explicitly excludes multiplayer API and socket routes from caching', async () => {
  const source = await readFile(resolve('public/sw.js'), 'utf8');
  assert.match(source, /api\|socket/);
  assert.match(source, /request\.method !== 'GET'/);
  assert.match(source, /CACHE_ALL/);
  assert.match(source, /offline-core\.json/);
  const client = await readFile(resolve('src/offline.js'), 'utf8');
  assert.match(client, /import\.meta\.env\?\.PROD/);
  assert.match(client, /private rooms, player trades/);
});

test('service worker permits only same-origin static game files, including encoded asset names', async () => {
  const source = await readFile(resolve('public/sw.js'), 'utf8');
  const context = { URL, importScripts() {}, self: { location: { origin: 'http://localhost:5184' }, addEventListener() {} } };
  runInNewContext(source + '\nthis.acceptOfflineURL = safeURL;', context);
  for (const path of ['/', '/favicon.svg', '/manifest.webmanifest', '/offline-assets.json', '/assets/regions/one%20sprite.png', '/assets/app-a1.js', '/assets/font.woff2']) {
    assert.ok(context.acceptOfflineURL(path), `Expected static game file ${path}`);
  }
  for (const path of ['/api/session', '/api/rooms/private.json', '/socket', '/private/account.json', 'https://example.com/assets/a.png', 'http://user:password@localhost:5184/assets/a.png', '/assets/a.png?token=secret', '/assets/a.png#private', '/assets/a%2F..%2F..%2Fapi/session.json', '/assets/a%5c..%5capi/session.json', '/assets/%']) {
    assert.equal(context.acceptOfflineURL(path), null, `Refused non-game or private path ${path}`);
  }
});

test('prefetched module and font files remain usable offline when static hosting varies by Origin', async () => {
  const source = await readFile(resolve('public/sw.js'), 'utf8');
  const listeners = {};
  let networkRequests = 0;
  const context = {
    URL, Request, Response, importScripts() {},
    self: { location: { origin: 'http://localhost:5184' }, addEventListener: (type, handler) => { listeners[type] = handler; } },
    caches: { open: async () => ({ match: async (request, options) => options?.ignoreVary ? new Response(`cached ${new URL(request.url).pathname}`) : undefined }) },
    fetch: async () => { networkRequests++; throw new Error('Network is offline'); }
  };
  runInNewContext(source, context);
  for (const path of ['/assets/app-build.js', '/assets/font.woff2']) {
    let response;
    listeners.fetch({ request: new Request(`http://localhost:5184${path}`, { headers: { Origin: 'http://localhost:5184' }, mode: 'cors' }), respondWith: value => { response = value; } });
    assert.equal(await (await response).text(), `cached ${path}`);
  }
  let privateResponse = null;
  listeners.fetch({ request: new Request('http://localhost:5184/api/session'), respondWith: value => { privateResponse = value; } });
  assert.equal(privateResponse, null, 'Private APIs remain outside the offline handler');
  assert.equal(networkRequests, 0);
});

test('deployment base keeps runtime URLs scoped without changing external resources', async () => {
  const { withBase } = await import('../src/assetUrl.js');
  assert.equal(withBase('/assets/hero-sheet.png', '/Eternal-Powers/'), '/Eternal-Powers/assets/hero-sheet.png');
  assert.equal(withBase('/Eternal-Powers/assets/hero-sheet.png', '/Eternal-Powers/'), '/Eternal-Powers/assets/hero-sheet.png');
  assert.equal(withBase('/sw.js', '/Eternal-Powers/'), '/Eternal-Powers/sw.js');
  assert.equal(withBase('/', '/Eternal-Powers/'), '/Eternal-Powers/');
  assert.equal(withBase('/assets/hero-sheet.png', '/'), '/assets/hero-sheet.png');
  assert.equal(withBase('https://example.com/a.png', '/Eternal-Powers/'), 'https://example.com/a.png');
  const parent = resolve('work'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, 'offline-pages-'));
  try {
    await mkdir(resolve(root, 'public/assets'), { recursive: true });
    await writeFile(resolve(root, 'public/assets/hero.png'), 'pixels');
    const index = await createOfflineIndex({ projectRoot: root, base: '/Eternal-Powers/' });
    assert.equal(index.files[0].url, '/Eternal-Powers/assets/hero.png');
    const rootIndex = await createOfflineIndex({ projectRoot: root, base: '/' });
    assert.notEqual(rootIndex.version, index.version, 'Distinct deployment scopes have distinct cache versions');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('project Pages worker accepts only its own static files and leaves both API routes uncached', async () => {
  const source = await readFile(resolve('public/sw.js'), 'utf8');
  const listeners = {};
  const context = { URL, importScripts() {}, self: {
    location: { origin: 'http://localhost:5184' },
    registration: { scope: 'http://localhost:5184/Eternal-Powers/' },
    addEventListener(type, handler) { listeners[type] = handler; }
  } };
  runInNewContext(source + '\nthis.acceptOfflineURL = safeURL;', context);
  for (const path of ['/Eternal-Powers/', '/Eternal-Powers/favicon.svg', '/Eternal-Powers/assets/app.js', '/Eternal-Powers/assets/one%20sprite.png']) {
    assert.ok(context.acceptOfflineURL(path), path);
  }
  for (const path of ['/', '/assets/a.png', '/Other-Game/assets/a.png', '/api/session', '/Eternal-Powers/api/session', '/Eternal-Powers/socket', '/Eternal-Powers/assets/a.png?private=1']) {
    assert.equal(context.acceptOfflineURL(path), null, path);
    if (!path.includes('assets/a.png?')) {
      let response = null;
      listeners.fetch({ request: { method: 'GET', url: `http://localhost:5184${path}` }, respondWith(value) { response = value; } });
      assert.equal(response, null, `No cache handler for ${path}`);
    }
  }
});
