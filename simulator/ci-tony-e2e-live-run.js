#!/usr/bin/env node
/**
 * Tony E2E live tier 3 in CI: emulators:exec (auth + firestore + functions) + seed + sim:tony:e2e:live.
 * Job target: simulator-tony-e2e-live (M-T5 notturno).
 * @module simulator/ci-tony-e2e-live-run
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const firebaseBin = join(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const innerScript = join(root, 'scripts/sim-ci-tony-e2e-live-inner.sh');
const inner = `bash ${innerScript}`;

if (!process.env.GEMINI_API_KEY) {
  console.warn('[sim:tony:e2e:live:ci] GEMINI_API_KEY assente — skip job live (tier 3 richiede secret CI).');
  process.exit(0);
}

/** Functions emulator carica index.js all'avvio — deps e config Tony prima di emulators:exec. */
function prepareFunctionsForEmulator() {
  const npmCi = spawnSync('npm', ['ci', '--prefix', 'functions'], {
    stdio: 'inherit',
    cwd: root,
    shell: process.platform === 'win32',
  });
  if (npmCi.status !== 0) {
    process.exit(typeof npmCi.status === 'number' ? npmCi.status : 1);
  }
  const genCfg = spawnSync(process.execPath, ['functions/scripts/generate-tony-configs.js'], {
    stdio: 'inherit',
    cwd: root,
  });
  if (genCfg.status !== 0) {
    process.exit(typeof genCfg.status === 'number' ? genCfg.status : 1);
  }
}

prepareFunctionsForEmulator();

const result = spawnSync(
  process.execPath,
  [firebaseBin, 'emulators:exec', '--only', 'auth,firestore,functions', inner],
  {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, CI: 'true', GFV_TONY_E2E_LIVE: '1' },
  }
);

process.exit(typeof result.status === 'number' ? result.status : 1);
