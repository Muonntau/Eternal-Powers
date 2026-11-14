/* Production-only offline solo game. Private-room APIs and sockets are never cached. */
try { importScripts('/offline-version.js'); } catch { /* A first unindexed preview still works online. */ }
const BUILD = self.ETERNAL_OFFLINE_BUILD || 'unindexed';
const PREFIX = 'eternal-powers-offline-';
const CACHE = PREFIX + BUILD;
const INFO_KEY = '/__eternal_offline_status__';
let downloadJob = null;

const sameOrigin = url => url.origin === self.location.origin;
const forbidden = url => /^\/(?:api|socket)(?:\/|$)/.test(url.pathname);
const gameFile = url => {
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { return false; }
  if (url.username || url.password || url.hash || url.search || decoded.includes('\\')) return false;
  if (decoded.split('/').some(part => part === '.' || part === '..')) return false;
  return decoded === '/' || /^\/(?:favicon\.svg|manifest\.webmanifest|offline-assets\.json)$/.test(decoded)
    || /^\/assets\/.+\.(?:png|webp|jpe?g|svg|ogg|wav|mp3|json|js|css|woff2?|ttf|otf)$/i.test(decoded);
};
const safeURL = path => {
  let url;
  try { url = new URL(path, self.location.origin); } catch { return null; }
  return sameOrigin(url) && !forbidden(url) && gameFile(url) ? url : null;
};
async function fetchAndCache(cache, path) {
  const url = safeURL(path);
  if (!url) throw new Error('Only local game files can be downloaded.');
  const response = await fetch(url.href, { cache: 'reload', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error(`${url.pathname}: HTTP ${response.status}`);
  await cache.put(url.href, response.clone());
  return response;
}
async function shellFiles() {
  try {
    const response = await fetch('/offline-core.json', { cache: 'no-store' });
    if (response.ok) {
      const index = await response.json();
      if (Array.isArray(index.files)) return index.files.map(file => file.url).filter(Boolean);
    }
  } catch { /* Fallback supports a static preview without the postbuild index. */ }
  const response = await fetch('/', { cache: 'no-store' });
  if (!response.ok) throw new Error('The game shell could not be downloaded.');
  const html = await response.text();
  const files = ['/', '/favicon.svg', '/manifest.webmanifest'];
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    if (/\.(?:js|css|woff2?)(?:\?|$)/.test(match[1]) && safeURL(match[1])) files.push(match[1]);
  }
  return [...new Set(files)];
}
async function cacheShell() {
  const cache = await caches.open(CACHE), files = await shellFiles();
  for (const path of files) await fetchAndCache(cache, path);
  await fetchAndCache(cache, '/offline-assets.json');
}
self.addEventListener('install', event => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || !sameOrigin(url) || forbidden(url)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && /text\/html/.test(response.headers.get('content-type') || '')) await cache.put('/', response.clone());
        return response;
      } catch {
        return await cache.match('/') || new Response('Open Eternal Powers online once before playing offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }
  if (!/^\/(?:assets\/|favicon\.svg$|manifest\.webmanifest$|offline-assets\.json$)/.test(url.pathname)) return;
  event.respondWith((async () => {
    // Static game files are independent of the request's Origin header. A
    // module/font request sets Origin while the opt-in prefetch does not;
    // development-style static servers may send Vary: Origin for both.
    const cache = await caches.open(CACHE), cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected && safeURL(response.url || request.url)) await cache.put(request, response.clone());
    return response;
  })());
});
async function status() {
  const cache = await caches.open(CACHE), response = await cache.match(INFO_KEY);
  return response ? response.json() : { version: BUILD, complete: false, shellReady: !!await cache.match('/'), cached: 0, total: 0, bytes: 0, totalBytes: 0 };
}
async function downloadAll(port) {
  const cache = await caches.open(CACHE);
  let indexResponse = await cache.match('/offline-assets.json');
  if (!indexResponse) indexResponse = await fetchAndCache(cache, '/offline-assets.json');
  const index = await indexResponse.json();
  if (!Array.isArray(index.files)) throw new Error('The offline asset index is invalid.');
  let cursor = 0, done = 0, bytes = 0;
  const failures = [];
  const progress = { version: BUILD, complete: false, shellReady: true, cached: 0, total: index.files.length, bytes: 0, totalBytes: index.totalBytes || 0 };
  const send = () => port?.postMessage({ type: 'progress', ...progress });
  send();
  async function worker() {
    while (cursor < index.files.length) {
      const file = index.files[cursor++];
      try {
        const url = safeURL(file.url);
        if (!url || !url.pathname.startsWith('/assets/')) throw new Error('Invalid local asset path.');
        if (!await cache.match(url.href)) await fetchAndCache(cache, file.url);
        done++; bytes += Number(file.bytes) || 0;
        Object.assign(progress, { cached: done, bytes, current: file.url });
        send();
      } catch (error) { failures.push({ url: file.url, reason: error.message }); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  Object.assign(progress, { complete: failures.length === 0, failures });
  delete progress.current;
  await cache.put(INFO_KEY, new Response(JSON.stringify(progress), { headers: { 'Content-Type': 'application/json' } }));
  return progress;
}
self.addEventListener('message', event => {
  const port = event.ports?.[0], type = event.data?.type;
  if (!port) return;
  const run = async () => {
    if (type === 'STATUS') return status();
    if (type === 'CACHE_ALL') {
      if (downloadJob) throw new Error('An offline download is already running.');
      downloadJob = downloadAll(port);
      try { return await downloadJob; } finally { downloadJob = null; }
    }
    if (type === 'SKIP_WAITING') { await self.skipWaiting(); return { version: BUILD }; }
    throw new Error('Unknown offline operation.');
  };
  event.waitUntil(run().then(result => port.postMessage({ type: 'done', ...result })).catch(error => port.postMessage({ type: 'error', error: error.message })));
});
