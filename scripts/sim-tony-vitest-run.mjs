#!/usr/bin/env node
/**
 * Tony Vitest tier 1 + suite (esclude canary build-tag fragili).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(root, 'tests');
const vitestBin = join(root, 'node_modules', 'vitest', 'vitest.mjs');

const skip = new Set([
  'tony-tts-latency-canary.test.js',
  'tony-voice-pipeline-canary.test.js',
]);

const rootTonyFiles = readdirSync(testsDir)
  .filter((f) => f.startsWith('tony-') && f.endsWith('.test.js') && !skip.has(f))
  .map((f) => join('tests', f));

const args = [
  vitestBin,
  'run',
  '--exclude',
  '**/*canary*.test.js',
  join('tests', 'tony'),
  ...rootTonyFiles,
];

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

process.exit(typeof result.status === 'number' ? result.status : 1);
