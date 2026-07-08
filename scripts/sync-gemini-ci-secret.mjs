#!/usr/bin/env node
/**
 * Copia GEMINI_API_KEY da functions/.secret.local → GitHub Actions secret (repo).
 * Non stampa la chiave. Richiede `gh` autenticato.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'functions', '.secret.local');
const repo = process.env.GFV_GITHUB_REPO || 'VitaraDragon/gfv-platform';

if (!existsSync(path)) {
  console.error('[sync-gemini-ci-secret] Manca functions/.secret.local');
  process.exit(1);
}

let key = '';
for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  if (!trimmed.startsWith('GEMINI_API_KEY=')) continue;
  key = trimmed.slice('GEMINI_API_KEY='.length).trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  break;
}

if (!key) {
  console.error('[sync-gemini-ci-secret] GEMINI_API_KEY non trovato in .secret.local');
  process.exit(1);
}

const gh = spawnSync(
  'gh',
  ['secret', 'set', 'GEMINI_API_KEY', '--repo', repo],
  { input: key, stdio: ['pipe', 'inherit', 'inherit'] }
);

if (gh.status !== 0) {
  process.exit(typeof gh.status === 'number' ? gh.status : 1);
}

console.log(`[sync-gemini-ci-secret] GEMINI_API_KEY impostato su ${repo}`);
