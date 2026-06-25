#!/usr/bin/env node
/**
 * Esegue sim:test + sim:test:vitest dentro Firebase emulators:exec (CI e locale).
 * Richiede Java su PATH.
 * @module simulator/ci-run
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const firebaseBin = join(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const inner = 'npm run sim:test && npm run sim:test:vitest';

const result = spawnSync(
  process.execPath,
  [firebaseBin, 'emulators:exec', '--only', 'auth,firestore', inner],
  { stdio: 'inherit', cwd: root }
);

process.exit(typeof result.status === 'number' ? result.status : 1);
