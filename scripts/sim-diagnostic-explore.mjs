#!/usr/bin/env node
/**
 * Explore diagnostico unificato: app E2E + Tony (non bloccante) + merge report.
 * Prerequisiti: sim:emulators, npm start, seed (viticola-conto-terzi-manodopera minimo).
 *
 * Filtro opzionale: --only=prodotti;T-SMOKE-001  (app;tony)
 * @module scripts/sim-diagnostic-explore
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const strict = args.includes('--strict');

let appOnly = '';
let tonyOnly = '';
if (onlyArg) {
  const raw = onlyArg.slice('--only='.length);
  const parts = raw.split(';');
  appOnly = (parts[0] || '').trim();
  tonyOnly = (parts[1] || '').trim();
}

function run(label, npmScript, extraAfterDash = []) {
  console.log(`\n[sim:diagnostic:explore] ▶ ${label}`);
  const cmdArgs = ['run', npmScript];
  if (extraAfterDash.length) {
    cmdArgs.push('--', ...extraAfterDash);
  }
  const result = spawnSync('npm', cmdArgs, {
    stdio: 'inherit',
    cwd: rootDir,
    env: {
      ...process.env,
      GFV_E2E_MODE: 'explore',
      GFV_E2E_FAST: '1',
    },
    shell: true,
  });
  return typeof result.status === 'number' ? result.status : 1;
}

function main() {
  console.log('[sim:diagnostic:explore] mode=explore (non bloccante salvo --strict)');

  const appExtra = [];
  if (appOnly) appExtra.push(`--only=${appOnly}`);
  if (strict) appExtra.push('--strict');

  const tonyExtra = [];
  if (tonyOnly) tonyExtra.push(`--only=${tonyOnly}`);
  if (strict) tonyExtra.push('--strict');

  const appCode = run('App E2E explore (node)', 'sim:e2e:node:explore', appExtra);

  const tonyLive = process.env.GFV_TONY_E2E_LIVE === '1' || process.env.GFV_TONY_E2E_LIVE === 'true';
  const tonyScript = tonyLive ? 'sim:tony:e2e:live' : 'sim:tony:e2e:gate';
  const tonyCode = run(`Tony E2E ${tonyLive ? 'live explore' : 'gate mock'}`, tonyScript, tonyExtra);
  const mergeCode = run('Merge report', 'sim:diagnostic:merge');

  if (strict && (appCode !== 0 || tonyCode !== 0)) {
    process.exit(appCode || tonyCode || 1);
  }

  if (mergeCode !== 0) process.exit(mergeCode);
  console.log('\n[sim:diagnostic:explore] Completato — vedi test-results/diagnostic-merged-report.json');
  process.exit(0);
}

main();
