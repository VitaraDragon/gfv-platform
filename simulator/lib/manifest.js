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
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf-8');
}

export { SEED_VERSION };
