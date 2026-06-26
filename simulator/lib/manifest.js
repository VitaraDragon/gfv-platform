/**
 * Persistenza manifest run simulatore.
 * @module simulator/lib/manifest
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const MANIFEST_PATH = join(dirname(fileURLToPath(import.meta.url)), '../manifest.json');

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
  const list = readManifest();
  list.push({
    ...entry,
    seedVersion: SEED_VERSION,
    createdAt: new Date().toISOString()
  });
  writeManifest(list);
}

/** Aggiorna l'ultima entry del manifest (es. personas[] dopo fase 06). */
export function updateLastManifestEntry(updates) {
  const list = readManifest();
  if (!list.length) return null;
  Object.assign(list[list.length - 1], updates);
  writeManifest(list);
  return list[list.length - 1];
}

export function writeManifest(list) {
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf-8');
}

export function clearManifest() {
  writeManifest([]);
}

export { SEED_VERSION };
