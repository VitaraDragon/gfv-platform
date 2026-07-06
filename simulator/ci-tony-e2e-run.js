#!/usr/bin/env node
/**
 * Tony E2E in CI: emulators:exec + http-server + sim:run + sim:tony:e2e.
 * Job target: simulator-tony-e2e-mock (M-T3+). M-T0: smoke infra only.
 * @module simulator/ci-tony-e2e-run
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const firebaseBin = join(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const innerScript = join(root, 'scripts/sim-ci-tony-e2e-inner.sh');
const inner = `bash ${innerScript}`;

const result = spawnSync(
  process.execPath,
  [firebaseBin, 'emulators:exec', '--only', 'auth,firestore', inner],
  {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, CI: 'true' },
  }
);

process.exit(typeof result.status === 'number' ? result.status : 1);
