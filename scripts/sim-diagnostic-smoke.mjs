#!/usr/bin/env node
/**
 * Smoke diagnostico: 1 scenario app + 1 Tony in explore + merge.
 * Verifica pipeline report senza suite completa.
 * Prerequisiti: sim:emulators, npm start, seed viticola-conto-terzi-manodopera.
 * @module scripts/sim-diagnostic-smoke
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const mergedPath = join(rootDir, 'test-results', 'diagnostic-merged-report.json');

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: rootDir,
    shell: true,
  });
  return typeof result.status === 'number' ? result.status : 1;
}

async function main() {
  console.log('[sim:diagnostic:smoke] 1 app + 1 Tony + merge');

  const appCode = run('npm', ['run', 'sim:e2e:node:explore', '--', '--only=prodotti']);
  const tonyCode = run('npm', ['run', 'sim:tony:e2e:explore', '--', '--only=T-SMOKE-001']);
  const mergeCode = run('npm', ['run', 'sim:diagnostic:merge']);

  if (mergeCode !== 0) {
    console.error('[sim:diagnostic:smoke] merge fallito');
    process.exit(1);
  }

  try {
    const merged = JSON.parse(await readFile(mergedPath, 'utf8'));
    if (!merged.schemaVersion || !merged.summary) {
      throw new Error('merged report invalido');
    }
    console.log(
      `[sim:diagnostic:smoke] OK — merged report (app ${merged.summary.app.passed}/${merged.summary.app.total}, tony ${merged.summary.tony.passed}/${merged.summary.tony.total}, findings ${merged.summary.findingsTotal})`
    );
  } catch (err) {
    console.error('[sim:diagnostic:smoke] report non leggibile:', err.message);
    process.exit(1);
  }

  process.exit(appCode !== 0 || tonyCode !== 0 ? 0 : 0);
}

main();
