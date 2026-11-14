/** Optional installation and explicit full-asset caching for the solo game. */
let registrationPromise = null;
const production = Boolean(import.meta.env?.PROD);
const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

export function registerOffline() {
  if (!production || !supported()) return Promise.resolve(null);
  registrationPromise ||= navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(async registration => { await navigator.serviceWorker.ready; return registration; })
    .catch(error => { registrationPromise = null; throw error; });
  return registrationPromise;
}
async function request(type, onProgress) {
  if (!production) throw new Error('Offline installation is available in the production build.');
  if (!supported()) throw new Error('This browser does not support offline installation.');
  const registration = await registerOffline();
  const worker = navigator.serviceWorker.controller || registration?.active;
  if (!worker) throw new Error('The offline game shell is still getting ready. Try again shortly.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timeout, lastProgress = 0;
    const resetTimeout = () => { clearTimeout(timeout); timeout = setTimeout(() => { channel.port1.close(); reject(new Error('The offline download stopped responding. Your online game and save are unchanged.')); }, 60000); };
    resetTimeout();
    channel.port1.onmessage = event => {
      const data = event.data || {};
      resetTimeout();
      if (data.type === 'progress') {
        const now = Date.now();
        if (now - lastProgress >= 80 || data.cached === data.total || !data.cached) {
          lastProgress = now;
          onProgress?.(data);
        }
        return;
      }
      clearTimeout(timeout); channel.port1.close();
      if (data.type === 'error') reject(new Error(data.error || 'Offline installation failed.'));
      else resolve(data);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
export const getOfflineStatus = () => request('STATUS');
export const cacheForOffline = onProgress => request('CACHE_ALL', onProgress);
export const offlineAvailable = () => production && supported();
export const offlineConnectionNotice = () => typeof navigator !== 'undefined' && !navigator.onLine
  ? 'You are offline. Solo play and local saves are available; private rooms, player trades, and the shared market require the game server.'
  : '';

if (production && supported()) {
  if (document.readyState === 'complete') registerOffline().catch(() => {});
  else window.addEventListener('load', () => { registerOffline().catch(() => {}); }, { once: true });
}
