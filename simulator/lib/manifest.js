/**
 * Persistenza manifest run simulatore.
 * @module simulator/lib/manifest
 */

import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const MANIFEST_PATH = join(dirname(fileURLToPath(import.meta.url)), '../manifest.json');
const LOCK_PATH = `${MANIFEST_PATH}.lock`;

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** I seed degli slot girano insieme: lettura e scrittura del manifest restano un blocco solo. */
function withManifestLock(fn) {
  const started = Date.now();
  let fd;
  for (;;) {
    try {
      fd = openSync(LOCK_PATH, 'wx');
      break;
    } catch (err) {
      if (!err || err.code !== 'EEXIST') throw err;
      try {
        if (Date.now() - statSync(LOCK_PATH).mtimeMs > 180_000) unlinkSync(LOCK_PATH);
      } catch {
        /* un altro processo ha già tolto il lock */
      }
      if (Date.now() - started > 120_000) {
        throw new Error('Lock del manifest non ottenuto entro 120s');
      }
      sleepMs(40);
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    try { unlinkSync(LOCK_PATH); } catch { /* già rimosso */ }
  }
}

function writeManifestUnlocked(list) {
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf-8');
}

export function readManifest() {
  try {
    const raw = readFileSync(MANIFEST_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const SEED_VERSION = 2;

export function appendManifestEntry(entry) {
  return withManifestLock(() => {
    const list = readManifest();
    list.push({
      ...entry,
      seedVersion: SEED_VERSION,
      createdAt: new Date().toISOString()
    });
    writeManifestUnlocked(list);
  });
}

/** Aggiorna l'ultima entry del manifest (es. personas[] dopo fase 06). */
export function updateLastManifestEntry(updates, tenantId) {
  return withManifestLock(() => {
    const list = readManifest();
    if (!list.length) return null;
    let idx = list.length - 1;
    if (tenantId) {
      const found = list.findIndex((e) => e.tenantId === tenantId);
      if (found >= 0) idx = found;
    }
    Object.assign(list[idx], updates);
    writeManifestUnlocked(list);
    return list[idx];
  });
}

export function writeManifest(list) {
  return withManifestLock(() => writeManifestUnlocked(list));
}

export function clearManifest() {
  writeManifest([]);
}

export { SEED_VERSION };
