#!/usr/bin/env node
/**
 * Gate unificato pre-push: app E2E + Tony mock (bloccante) + merge report se fallisce.
 * @module scripts/sim-diagnostic-gate
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, npmScript, extraArgs = []) {
  console.log(`\n[sim:diagnostic:gate] ▶ ${label}`);
  const result = spawnSync('npm', ['run', npmScript, '--', ...extraArgs], {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, CI: process.env.CI || 'true' },
    shell: true,
  });
  return typeof result.status === 'number' ? result.status : 1;
}

function main() {
  console.log('[sim:diagnostic:gate] gate app + Tony (bloccante)');

  const appCode = run('App E2E gate', 'sim:e2e:gate');
  const tonyCode = run('Tony E2E gate', 'sim:tony:e2e:gate');

  if (appCode !== 0 || tonyCode !== 0) {
    spawnSync('npm', ['run', 'sim:diagnostic:merge'], {
      stdio: 'inherit',
      cwd: rootDir,
      shell: true,
    });
    console.error('\n[sim:diagnostic:gate] FALLITO — vedi diagnostic-merged-report.json per opzioni fix');
    process.exit(appCode || tonyCode || 1);
  }

  console.log('\n[sim:diagnostic:gate] OK — pronto per push');
  process.exit(0);
}

main();
