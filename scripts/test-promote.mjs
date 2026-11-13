#!/usr/bin/env node
/**
 * Gate locale prima di chiedere il merge di un promote su main.
 * Lancia in sequenza sim:e2e e sim:tony:e2e (mock). Esce ≠ 0 se uno fallisce.
 * Su Windows usa npm.cmd, così gira da PowerShell senza bash.
 *
 * Prerequisiti, gli stessi dei due script:
 * emulatori Auth+Firestore, http-server su :8000, seed (npm run sim:run).
 */
import { spawn } from 'node:child_process';

// Su Windows la CLI di Playwright resta ferma dopo l'elenco scenari
// (nessun test parte). Lo stesso gate, via playwright-core, è sim:e2e:node.
const appE2e = process.platform === 'win32' ? 'sim:e2e:node' : 'sim:e2e';
const steps = [appE2e, 'sim:tony:e2e'];

function runNpm(script) {
  const npmExec = process.env.npm_execpath;
  const cmd = npmExec ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = npmExec ? [npmExec, 'run', script] : ['run', script];
  return new Promise((resolve) => {
    let child;
    try {
      // Senza npm_execpath, su Windows spawn di npm.cmd senza shell dà EINVAL.
      child = spawn(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
        shell: !npmExec && process.platform === 'win32',
        windowsHide: true,
      });
    } catch (err) {
      console.error(`[test:promote] impossibile avviare ${script}: ${err.message}`);
      resolve(1);
      return;
    }
    child.on('error', (err) => {
      console.error(`[test:promote] impossibile avviare ${script}: ${err.message}`);
      resolve(1);
    });
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`[test:promote] ${script} interrotto (${signal})`);
        resolve(1);
        return;
      }
      resolve(typeof code === 'number' ? code : 1);
    });
  });
}

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

let exitCode = 0;
for (const script of steps) {
  const started = Date.now();
  console.log(`[test:promote] avvio ${script}`);
  const code = await runNpm(script);
  const duration = formatDuration(Date.now() - started);
  const esito = code === 0 ? 'ok' : 'fallito';
  console.log(`[test:promote] ${script}: ${esito} (${duration}), exit ${code}`);
  if (code !== 0) {
    exitCode = code;
    break;
  }
}

process.exit(exitCode);
