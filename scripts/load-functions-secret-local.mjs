#!/usr/bin/env node
/**
 * Carica functions/.secret.local in process.env (senza stampare valori).
 * Usato da sim:tony:e2e:live prima di avviare Functions emulator.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'functions', '.secret.local');

if (!existsSync(path)) {
  // Nessun secret locale: ok per prod CF (GEMINI su Cloud Run) o mock E2E.
} else {

const raw = readFileSync(path, 'utf8');
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 1) continue;
  const name = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (name && val && process.env[name] == null) {
    process.env[name] = val;
  }
}
}

if (process.env.GFV_TONY_E2E_DEBUG_SECRETS === '1') {
  const loaded = ['GEMINI_API_KEY', 'OPENWEATHER_API_KEY'].filter((k) => !!process.env[k]);
  console.log(`[load-functions-secret-local] loaded: ${loaded.join(', ') || 'none'}`);
}
