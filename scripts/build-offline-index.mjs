import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_TYPES = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg', '.ogg', '.wav', '.mp3', '.json']);
const CORE_TYPES = new Set(['.js', '.css', '.woff', '.woff2', '.ttf', '.otf']);
const CODE_TYPES = new Set(['.js', '.jsx', '.mjs', '.css', '.html', '.json']);

async function filesUnder(directory) {
  const result = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return result;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
const urlFor = (root, file) => '/' + relative(root, file).split('\\').map(part => part.split('/').map(encodeURIComponent).join('/')).join('/');

export async function createOfflineIndex({ projectRoot = DEFAULT_ROOT, dist = false } = {}) {
  const publicRoot = resolve(projectRoot, 'public');
  const outputRoot = resolve(projectRoot, dist ? 'dist' : 'public');
  const assets = [];
  for (const file of await filesUnder(resolve(publicRoot, 'assets'))) {
    if (!ASSET_TYPES.has(extname(file).toLowerCase())) continue;
    const bytes = await readFile(file);
    assets.push({ url: urlFor(publicRoot, file), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  assets.sort((a, b) => a.url.localeCompare(b.url));
  const fingerprint = createHash('sha256');
  for (const asset of assets) fingerprint.update(`${asset.url}\0${asset.sha256}\n`);
  const codeFiles = [
    ...await filesUnder(resolve(projectRoot, 'src')),
    ...['index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'public/sw.js', 'public/manifest.webmanifest'].map(path => resolve(projectRoot, path))
  ];
  for (const file of [...new Set(codeFiles)].sort()) {
    if (!CODE_TYPES.has(extname(file).toLowerCase()) && !file.endsWith('.webmanifest')) continue;
    try { fingerprint.update(relative(projectRoot, file)); fingerprint.update(await readFile(file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const version = fingerprint.digest('hex').slice(0, 20);
  const index = { version, assetCount: assets.length, totalBytes: assets.reduce((total, item) => total + item.bytes, 0), files: assets };
  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, 'offline-assets.json'), JSON.stringify(index, null, 2) + '\n');
  await writeFile(resolve(outputRoot, 'offline-version.js'), `self.ETERNAL_OFFLINE_BUILD = ${JSON.stringify(version)};\n`);
  if (dist) {
    const core = [{ url: '/', bytes: (await stat(resolve(outputRoot, 'index.html'))).size }];
    for (const file of await filesUnder(resolve(outputRoot, 'assets'))) {
      if (CORE_TYPES.has(extname(file).toLowerCase())) core.push({ url: urlFor(outputRoot, file), bytes: (await stat(file)).size });
    }
    for (const name of ['favicon.svg', 'manifest.webmanifest']) {
      try { core.push({ url: '/' + name, bytes: (await stat(resolve(outputRoot, name))).size }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await writeFile(resolve(outputRoot, 'offline-core.json'), JSON.stringify({ version, files: core }, null, 2) + '\n');
    index.coreCount = core.length;
  }
  return index;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const index = await createOfflineIndex({ dist: process.argv.includes('--dist') });
  process.stdout.write(`Offline index: ${index.assetCount} assets, ${(index.totalBytes / 1024 / 1024).toFixed(1)} MiB, build ${index.version}${index.coreCount ? `, ${index.coreCount} shell files` : ''}\n`);
}
