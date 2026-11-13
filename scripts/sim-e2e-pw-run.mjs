#!/usr/bin/env node
/**
 * Wrapper Playwright E2E app — mode gate/explore + report diagnostico.
 * @module scripts/sim-e2e-pw-run
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRegistryFromSpecs,
  resolveAppScenarioMode,
} from '../tests/e2e/sim/helpers/sim-e2e-scenario-meta.mjs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const simDir = join(rootDir, 'tests/e2e/sim');

function resolveRunMode() {
  const fromArg = process.argv.find((a) => a.startsWith('--mode='));
  const raw = (
    (fromArg ? fromArg.slice('--mode='.length) : '') ||
    process.env.GFV_E2E_MODE ||
    'gate'
  ).trim();
  return raw === 'explore' ? 'explore' : 'gate';
}

function resolveStrict(runMode) {
  if (process.argv.includes('--strict') || process.env.GFV_E2E_STRICT === '1') return true;
  if (process.argv.includes('--no-strict')) return false;
  return runMode === 'gate';
}

const runMode = resolveRunMode();
const strict = resolveStrict(runMode);

const specFiles = readdirSync(simDir).filter((f) => f.endsWith('.spec.js'));
const registry = buildRegistryFromSpecs(specFiles);

const fromOnly = process.argv.find((a) => a.startsWith('--only='));
const onlyRaw = (
  (fromOnly ? fromOnly.slice('--only='.length) : '') ||
  process.env.GFV_E2E_ONLY ||
  ''
).trim();

let pool = runMode === 'explore' ? registry : registry.filter((s) => resolveAppScenarioMode(s) === 'gate');

if (onlyRaw) {
  const wanted = new Set(
    onlyRaw
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
  );
  pool = pool.filter((s) => wanted.has(s.id));
}

const pwArgs = ['playwright', 'test', ...pool.map((s) => s.specFile)];

const extraPw = process.argv.slice(2).filter(
  (a) =>
    !a.startsWith('--mode=') &&
    a !== '--strict' &&
    a !== '--no-strict' &&
    !a.startsWith('--only=')
);
pwArgs.push(...extraPw);

console.log(`[sim:e2e:pw] mode=${runMode} strict=${strict} scenari=${pool.length}`);

const env = {
  ...process.env,
  GFV_E2E_MODE: runMode,
  GFV_E2E_STRICT: strict ? '1' : '0',
  GFV_E2E_FAST: runMode === 'explore' ? '1' : process.env.GFV_E2E_FAST || '',
};
// Su Windows con Node 24 il loader ESM di Playwright 1.49 resta in attesa
// sulla MessageChannel: la CLI non stampa nulla dopo l'elenco scenari.
// I file di test sono JavaScript nativo, il loader TypeScript non serve.
if (process.platform === 'win32' && !env.PW_DISABLE_TS_ESM) {
  env.PW_DISABLE_TS_ESM = '1';
}

const cli = join(rootDir, 'node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [cli, ...pwArgs.slice(1)], {
  // stdin chiuso: da un terminale non-TTY la CLI altrimenti non procede.
  stdio: ['ignore', 'inherit', 'inherit'],
  cwd: rootDir,
  env,
  windowsHide: true,
});

if (runMode === 'explore' && !strict && result.status !== 0) {
  console.warn('[sim:e2e:pw] explore non-strict: exit forzato a 0 nonostante fallimenti Playwright');
  process.exit(0);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
