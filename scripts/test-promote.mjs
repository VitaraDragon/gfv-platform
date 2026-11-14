#!/usr/bin/env node
/**
 * Gate locale uguale alla CI (sim:e2e:ci poi sim:tony:e2e:ci).
 * Solo Node: niente bash, curl o /tmp. Gira su Windows 11.
 *
 * Un solo emulators:exec: prima la fase app, poi Tony, senza riavviare gli emulatori.
 * `--phase=app` o `--phase=tony` lancia una fase sola, sempre dentro gli emulatori.
 * Fase app: 4 seed + verify, poi sim:e2e:gate con CI=true (timeout pieni).
 * Fase Tony: nuovo seed viticola sullo stesso emulatore, CI=true,
 * GFV_TONY_E2E_GATE_FAST=1, GFV_TONY_E2E_MODE=gate.
 * Il manifest git non si usa: si parte da [] e si ripristina il file alla fine.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'simulator', 'manifest.json');
const firebaseBin = join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const selfPath = fileURLToPath(import.meta.url);

const APP_TEMPLATES = [
  'viticola-conto-terzi-manodopera',
  'frutteto-solo-titolare',
  'solo-titolare-viticola',
  'mista-viticola-frutteto-conto-terzi-manodopera',
];

const phaseArg = process.argv.find((a) => a.startsWith('--phase='));
const phase = phaseArg ? phaseArg.slice('--phase='.length) : '';
const insideArg = process.argv.find((a) => a.startsWith('--inside='));
const inside = insideArg ? insideArg.slice('--inside='.length) : '';

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function runNode(script, args, extraEnv) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, ...extraEnv },
    windowsHide: true,
  });
  if (result.error) {
    console.error(`[test:promote] ${script}: ${result.error.message}`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function startHttpServer() {
  const bin = join(root, 'node_modules', 'http-server', 'bin', 'http-server');
  const child = spawn(process.execPath, [bin, '-p', '8000', '-c-1'], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true,
  });
  return child;
}

async function waitForHttp() {
  const url = 'http://127.0.0.1:8000/';
  const deadline = Date.now() + 30_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
      lastError = `status ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`http-server non raggiungibile su :8000 (${lastError})`);
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    return;
  }
  child.kill();
}

async function runAppPhase() {
  const server = startHttpServer();
  try {
    await waitForHttp();
    for (const template of APP_TEMPLATES) {
      console.log(`[test:promote] seed ${template}`);
      const seeded = runNode('simulator/orchestrator.js', [`--template=${template}`]);
      if (seeded !== 0) return seeded;
      console.log(`[test:promote] verify ${template}`);
      const verified = runNode('simulator/verify-e2e-seed.js', [], {
        GFV_SIM_E2E_TEMPLATE: template,
      });
      if (verified !== 0) return verified;
    }
    console.log('[test:promote] sim:e2e:gate (CI=true, Playwright CLI)');
    return runNode('scripts/sim-e2e-pw-run.mjs', ['--mode=gate'], {
      CI: 'true',
      GFV_E2E_MODE: 'gate',
      PW_DISABLE_TS_ESM: '1',
    });
  } finally {
    stopChild(server);
  }
}

async function runTonyPhase() {
  const server = startHttpServer();
  try {
    await waitForHttp();
    const template = 'viticola-conto-terzi-manodopera';
    console.log(`[test:promote] seed ${template}`);
    const seeded = runNode('simulator/orchestrator.js', [`--template=${template}`]);
    if (seeded !== 0) return seeded;
    console.log('[test:promote] sim:tony:e2e (CI=true, GATE_FAST, mode=gate)');
    return runNode('scripts/sim-tony-e2e-run.mjs', ['--mode=gate'], {
      CI: 'true',
      GFV_TONY_E2E_GATE_FAST: '1',
      GFV_TONY_E2E_MODE: 'gate',
    });
  } finally {
    stopChild(server);
  }
}

function emulatorExec(which) {
  const command = `"${process.execPath}" "${selfPath}" --inside=${which}`;
  const extra = { CI: 'true' };
  console.log(`[test:promote] emulators:exec fase ${which}`);
  const result = spawnSync(process.execPath, [
    firebaseBin,
    'emulators:exec',
    '--only',
    'auth,firestore',
    command,
  ], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, ...extra, PW_DISABLE_TS_ESM: process.env.PW_DISABLE_TS_ESM || '1' },
    windowsHide: true,
  });
  if (result.error) {
    console.error(`[test:promote] emulators:exec ${which}: ${result.error.message}`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function warnIfOnBattery() {
  if (process.platform !== 'win32') return;
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    '(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1).BatteryStatus',
  ], { encoding: 'utf8', windowsHide: true });
  const status = String(result.stdout || '').trim();
  if (status === '1') {
    console.warn('[test:promote] ATTENZIONE: il PC è a batteria. Collegalo alla corrente: i due giri durano circa 20 minuti ciascuno.');
  }
}

function startKeepAwake() {
  if (process.platform !== 'win32') return null;
  const script = [
    '$code = @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class GfvAwake {',
    '  [DllImport("kernel32.dll")]',
    '  public static extern uint SetThreadExecutionState(uint esFlags);',
    '}',
    '"@',
    'Add-Type -TypeDefinition $code | Out-Null',
    '[GfvAwake]::SetThreadExecutionState([uint32]2147483649) | Out-Null',
    'Write-Output "[test:promote] sospensione del PC disattivata per la durata del gate"',
    '[Console]::In.ReadToEnd() | Out-Null',
    '[GfvAwake]::SetThreadExecutionState([uint32]2147483648) | Out-Null',
  ].join('\n');
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', script], {
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: true,
  });
  child.on('error', (err) => {
    console.warn(`[test:promote] non riesco a tenere sveglio il PC: ${err.message}`);
  });
  return child;
}

function stopKeepAwake(child) {
  if (!child || child.killed) return;
  try {
    child.stdin.end();
  } catch {
    child.kill();
  }
}

function listeningPids(port) {
  const result = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
  const pids = new Set();
  const needle = `:${port}`;
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    if (!line.includes(needle) || !line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (pid) pids.add(pid);
  }
  return [...pids];
}

function commandLineOf(pid) {
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue).CommandLine`,
  ], { encoding: 'utf8', windowsHide: true });
  return String(result.stdout || '');
}

function freeStaleListeners() {
  const ports = [8000, 8080, 9099, 4000];
  const seen = new Set();
  for (const port of ports) {
    for (const pid of listeningPids(port)) {
      if (seen.has(pid) || pid === process.pid) continue;
      const cmd = commandLineOf(pid);
      if (/hosting:app/i.test(cmd)) continue;
      const ours = /firebase|http-server|emulators:start|cloud-firestore-emulator|emu-java/i.test(cmd);
      if (!ours) continue;
      seen.add(pid);
      console.log(`[test:promote] libero la porta ${port}: fermo il processo ${pid}`);
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    }
  }
}

function bundledBrowserReady() {
  const local = process.env.LOCALAPPDATA;
  if (!local) return false;
  const headless = join(local, 'ms-playwright', 'chromium_headless_shell-1148', 'chrome-win', 'headless_shell.exe');
  return existsSync(headless);
}

async function runPhases(which) {
  const order = which === 'app' ? ['app'] : which === 'tony' ? ['tony'] : ['app', 'tony'];
  let exitCode = 0;
  for (const name of order) {
    if (name === 'tony') writeFileSync(manifestPath, '[]\n');
    const started = Date.now();
    const code = name === 'app' ? await runAppPhase() : await runTonyPhase();
    const duration = formatDuration(Date.now() - started);
    const esito = code === 0 ? 'ok' : 'fallito';
    console.log(`[test:promote] fase ${name}: ${esito} (${duration}), exit ${code}`);
    if (code !== 0) exitCode = code;
  }
  return exitCode;
}

async function mainOuter() {
  warnIfOnBattery();
  if (!bundledBrowserReady() && !process.env.GFV_E2E_BROWSER_CHANNEL) {
    console.warn('[test:promote] Chromium bundled assente: uso Chrome di sistema (GFV_E2E_BROWSER_CHANNEL=chrome). CI=true resta attivo, quindi i retry sono 1.');
    process.env.GFV_E2E_BROWSER_CHANNEL = 'chrome';
  }
  freeStaleListeners();
  const awake = startKeepAwake();
  const originalManifest = existsSync(manifestPath)
    ? readFileSync(manifestPath)
    : Buffer.from('[]\n');
  writeFileSync(manifestPath, '[]\n');
  const which = phase === 'app' || phase === 'tony' ? phase : 'all';
  let exitCode = 0;
  try {
    const started = Date.now();
    exitCode = emulatorExec(which);
    console.log(`[test:promote] emulatore unico (${which}): ${formatDuration(Date.now() - started)}, exit ${exitCode}`);
  } finally {
    writeFileSync(manifestPath, originalManifest);
    stopKeepAwake(awake);
    console.log(`[test:promote] manifest ripristinato (${manifestPath})`);
  }
  return exitCode;
}

if (inside === 'app' || inside === 'tony' || inside === 'all') {
  process.exit(await runPhases(inside));
}
if (inside || (phase && phase !== 'app' && phase !== 'tony')) {
  console.error(`[test:promote] fase sconosciuta: ${inside || phase}`);
  process.exit(1);
}
process.exit(await mainOuter());
