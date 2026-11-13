#!/usr/bin/env node
/**
 * Gate locale uguale alla CI (sim:e2e:ci e sim:tony:e2e:ci).
 * Solo Node: niente bash o curl. Gira su Windows 11.
 *
 * Default: le due fasi partono insieme. Ognuna ha il suo emulators:exec
 * e porte proprie. L'app usa il project id gfv-platform, come in seriale.
 * Tony usa demo-gfv-promote-tony, così i file dell'hub non coincidono.
 * --seriale: una fase dopo l'altra, sulle porte di firebase.json, come prima.
 *
 * Fase app: 4 seed + verify, poi sim:e2e:gate con CI=true
 * (retries: 1, workers: 1 da playwright.config.js).
 * Resta su Auth 9099 e Firestore 8080: il client e
 * tests/e2e/sim/scenarios/guasti-annulla-write.mjs chiamano quelle porte.
 * Fase Tony: solo seed viticola, CI=true, GFV_TONY_E2E_GATE_FAST=1,
 * GFV_TONY_E2E_MODE=gate. Porte 9109/8180. Il server riscrive in memoria
 * le porte 9099/8080 e il project id del client, senza toccarli su disco.
 * Il seed usa GFV_SIM_PROJECT_ID, lo stesso project id della CLI.
 * Il manifest git non si usa: si parte da [] e si ripristina il file alla fine.
 * In parallelo ogni fase ha il suo manifest temporaneo.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
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

/**
 * L'app tiene le porte storiche e il project id gfv-platform, come in seriale.
 * L'emulatore Auth assegna il login a quel project id: un demo id fa fallire
 * «Entra come manager». Tony ha altre porte e demo-gfv-promote-tony, così
 * i file dell'hub non coincidono. singleProjectMode resta false.
 */
const PHASE_PORTS = {
  app: {
    projectId: 'gfv-platform',
    http: 8000,
    auth: 9099,
    firestore: 8080,
    // 9150 è la websocket di default: spesso la tiene un altro emulatore già acceso.
    firestoreWeb: 9152,
    hub: 4400,
    logging: 4500,
  },
  tony: {
    projectId: 'demo-gfv-promote-tony',
    http: 8001,
    auth: 9109,
    firestore: 8180,
    firestoreWeb: 9160,
    hub: 4410,
    logging: 4510,
  },
};

const REWRITE_PATHS = new Set([
  '/core/js/firebase-emulator-dev.js',
  '/core/dev/simulator-dev-standalone.html',
  '/core/config/firebase-config.js',
  '/core/firebase-config.js',
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.csv': 'text/csv; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

const phaseArg = process.argv.find((a) => a.startsWith('--phase='));
const phase = phaseArg ? phaseArg.slice('--phase='.length) : '';
const serial = process.argv.includes('--seriale');

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function runNode(script, args, extraEnv) {
  // spawn, non spawnSync: il server HTTP sta in questo processo e deve
  // rispondere mentre Playwright e il seed girano.
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, script), ...args], {
      cwd: root,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, ...extraEnv },
      windowsHide: true,
    });
    child.on('error', (err) => {
      console.error(`[test:promote] ${script}: ${err.message}`);
      resolve(1);
    });
    child.on('close', (code) => {
      resolve(typeof code === 'number' ? code : 1);
    });
  });
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    return;
  }
  child.kill();
}

function insideRoot(abs) {
  const base = resolve(root);
  const full = resolve(abs);
  if (process.platform === 'win32') {
    const b = base.toLowerCase();
    const f = full.toLowerCase();
    return f === b || f.startsWith(b + sep);
  }
  return full === base || full.startsWith(base + sep);
}

function rewriteEmulatorPorts(pathname, body) {
  if (!REWRITE_PATHS.has(pathname)) return body;
  const auth = process.env.GFV_PROMOTE_AUTH_PORT;
  const firestore = process.env.GFV_PROMOTE_FIRESTORE_PORT;
  let out = body;
  if (auth && auth !== '9099') {
    out = out.replaceAll('http://127.0.0.1:9099', `http://127.0.0.1:${auth}`);
    out = out.replaceAll('Auth 9099', `Auth ${auth}`);
  }
  if (firestore && firestore !== '8080') {
    out = out.replaceAll('const FIRESTORE_PORT = 8080', `const FIRESTORE_PORT = ${firestore}`);
    out = out.replaceAll('Firestore 8080', `Firestore ${firestore}`);
  }
  const projectId = String(process.env.GFV_SIM_PROJECT_ID || '').trim();
  if (projectId && projectId !== 'gfv-platform') {
    out = out.replaceAll('projectId: "gfv-platform"', `projectId: "${projectId}"`);
    out = out.replaceAll("projectId: 'gfv-platform'", `projectId: '${projectId}'`);
  }
  return out;
}

function sendFile(res, filePath, ext, rewritePath) {
  const type = MIME[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
  if (rewritePath) {
    const raw = readFileSync(filePath, 'utf8');
    const body = rewriteEmulatorPorts(rewritePath, raw);
    res.writeHead(200, { ...headers, 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
    return;
  }
  res.writeHead(200, headers);
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  });
  stream.pipe(res);
}

function createPromoteServer() {
  return createServer((req, res) => {
    let pathname = '/';
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (pathname === '/simulator/manifest.json' && process.env.GFV_SIM_MANIFEST) {
      sendFile(res, process.env.GFV_SIM_MANIFEST, '.json', '');
      return;
    }
    const rel = pathname.replace(/^\/+/, '');
    let abs = resolve(root, rel);
    if (!insideRoot(abs)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const st = statSync(abs);
      if (st.isDirectory()) abs = join(abs, 'index.html');
      if (!existsSync(abs) || !statSync(abs).isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }
    const rewrite = REWRITE_PATHS.has(pathname) ? pathname : '';
    sendFile(res, abs, extname(abs).toLowerCase(), rewrite);
  });
}

async function startHttpServer() {
  const port = Number(process.env.GFV_PROMOTE_HTTP_PORT || 8000);
  if (!process.env.GFV_SIM_MANIFEST && !process.env.GFV_PROMOTE_AUTH_PORT) {
    const bin = join(root, 'node_modules', 'http-server', 'bin', 'http-server');
    const child = spawn(process.execPath, [bin, '-p', String(port), '-c-1'], {
      cwd: root,
      stdio: 'ignore',
      windowsHide: true,
    });
    return { close: () => stopChild(child) };
  }
  const server = createPromoteServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  return { close: () => server.close() };
}

async function waitForHttp() {
  const port = process.env.GFV_PROMOTE_HTTP_PORT || '8000';
  const url = `http://127.0.0.1:${port}/`;
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
    await new Promise((resolveWait) => setTimeout(resolveWait, 400));
  }
  throw new Error(`http-server non raggiungibile su :${port} (${lastError})`);
}

async function withHttpServer(body) {
  let handle;
  try {
    handle = await startHttpServer();
    await waitForHttp();
    return await body();
  } finally {
    if (handle) handle.close();
  }
}

async function runAppPhase() {
  const port = process.env.GFV_PROMOTE_HTTP_PORT || '8000';
  console.log(`[test:promote] fase app su :${port}`);
  try {
    return await withHttpServer(async () => {
      for (const template of APP_TEMPLATES) {
        console.log(`[test:promote] seed ${template}`);
        const seeded = await runNode('simulator/orchestrator.js', [`--template=${template}`]);
        if (seeded !== 0) return seeded;
        console.log(`[test:promote] verify ${template}`);
        const verified = await runNode('simulator/verify-e2e-seed.js', [], {
          GFV_SIM_E2E_TEMPLATE: template,
        });
        if (verified !== 0) return verified;
      }
      console.log('[test:promote] sim:e2e:gate (CI=true, Playwright CLI)');
      return await runNode('scripts/sim-e2e-pw-run.mjs', ['--mode=gate'], {
        CI: 'true',
        GFV_E2E_MODE: 'gate',
        PW_DISABLE_TS_ESM: '1',
      });
    });
  } catch (err) {
    console.error(`[test:promote] fase app: ${err instanceof Error ? err.message : err}`);
    return 1;
  }
}

async function runTonyPhase() {
  const port = process.env.GFV_PROMOTE_HTTP_PORT || '8000';
  console.log(`[test:promote] fase tony su :${port}`);
  try {
    return await withHttpServer(async () => {
      const template = 'viticola-conto-terzi-manodopera';
      console.log(`[test:promote] seed ${template}`);
      const seeded = await runNode('simulator/orchestrator.js', [`--template=${template}`]);
      if (seeded !== 0) return seeded;
      console.log('[test:promote] sim:tony:e2e (CI=true, GATE_FAST, mode=gate)');
      return await runNode('scripts/sim-tony-e2e-run.mjs', ['--mode=gate'], {
        CI: 'true',
        GFV_TONY_E2E_GATE_FAST: '1',
        GFV_TONY_E2E_MODE: 'gate',
      });
    });
  } catch (err) {
    console.error(`[test:promote] fase tony: ${err instanceof Error ? err.message : err}`);
    return 1;
  }
}

function phaseEnv(which, manifestFile) {
  const ports = PHASE_PORTS[which];
  const tony = which === 'tony'
    ? {
      CI: 'true',
      GFV_TONY_E2E_GATE_FAST: '1',
      GFV_TONY_E2E_MODE: 'gate',
    }
    : { CI: 'true' };
  const isolated = manifestFile
    ? {
      GFV_PROMOTE_HTTP_PORT: String(ports.http),
      GFV_PROMOTE_AUTH_PORT: String(ports.auth),
      GFV_PROMOTE_FIRESTORE_PORT: String(ports.firestore),
      GFV_E2E_BASE_URL: `http://127.0.0.1:${ports.http}`,
      GFV_SIM_MANIFEST: manifestFile,
      START_LOGGING_EMULATOR: 'true',
      ...(which === 'tony' ? { GFV_SIM_PROJECT_ID: ports.projectId } : {}),
    }
    : {};
  return {
    ...process.env,
    ...tony,
    ...isolated,
    PW_DISABLE_TS_ESM: process.env.PW_DISABLE_TS_ESM || '1',
  };
}

function emulatorArgs(which, configPath) {
  const command = `"${process.execPath}" "${selfPath}" --phase=${which}`;
  const args = [firebaseBin];
  if (configPath) {
    args.push('--non-interactive', '--config', configPath, '--project', PHASE_PORTS[which].projectId);
  }
  args.push('emulators:exec', '--only', 'auth,firestore', command);
  return args;
}

function emulatorExecSerial(which) {
  console.log(`[test:promote] emulators:exec fase ${which}`);
  const result = spawnSync(process.execPath, emulatorArgs(which, ''), {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: phaseEnv(which, ''),
    windowsHide: true,
  });
  if (result.error) {
    console.error(`[test:promote] emulators:exec ${which}: ${result.error.message}`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function writePhaseConfig(which) {
  const ports = PHASE_PORTS[which];
  const base = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));
  base.emulators = {
    ...base.emulators,
    auth: { port: ports.auth },
    firestore: { port: ports.firestore, websocketPort: ports.firestoreWeb },
    ui: { enabled: false },
    hub: { port: ports.hub },
    logging: { port: ports.logging },
    singleProjectMode: false,
  };
  const configPath = join(root, `firebase.promote-${which}.json`);
  writeFileSync(configPath, `${JSON.stringify(base, null, 2)}\n`);
  return configPath;
}

function attachPrefix(child, label, logPath) {
  mkdirSync(dirname(logPath), { recursive: true });
  const log = createWriteStream(logPath, { flags: 'w' });
  const pump = (source, isErr) => {
    if (!source) return;
    let buf = '';
    source.setEncoding('utf8');
    const flush = (line) => {
      (isErr ? process.stderr : process.stdout).write(`[${label}] ${line}\n`);
      log.write(`${line}\n`);
    };
    source.on('data', (chunk) => {
      buf += chunk;
      const parts = buf.split(/\r?\n/);
      buf = parts.pop() ?? '';
      for (const line of parts) flush(line);
    });
    source.on('end', () => {
      if (buf) flush(buf);
      buf = '';
    });
  };
  pump(child.stdout, false);
  pump(child.stderr, true);
  child.on('close', () => log.end());
}

function emulatorExecParallel(which, configPath, manifestFile, logPath) {
  const ports = PHASE_PORTS[which];
  console.log(
    `[test:promote] emulators:exec fase ${which} `
    + `(auth ${ports.auth}, firestore ${ports.firestore}, hub ${ports.hub}, `
    + `logging ${ports.logging}, http ${ports.http}, project ${ports.projectId})`
  );
  const started = Date.now();
  const child = spawn(process.execPath, emulatorArgs(which, configPath), {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: phaseEnv(which, manifestFile),
    windowsHide: true,
  });
  attachPrefix(child, which, logPath);
  return new Promise((resolveRun) => {
    child.on('error', (err) => {
      console.error(`[test:promote] emulators:exec ${which}: ${err.message}`);
      resolveRun({ which, code: 1, duration: formatDuration(Date.now() - started) });
    });
    child.on('close', (code) => {
      const exit = typeof code === 'number' ? code : 1;
      resolveRun({ which, code: exit, duration: formatDuration(Date.now() - started) });
    });
  });
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
    const detail = serial
      ? 'In serie le due fasi si sommano (circa un quarto d’ora).'
      : 'In parallelo un giro dura quanto la fase più lunga.';
    console.warn(`[test:promote] ATTENZIONE: il PC è a batteria. Collegalo alla corrente. ${detail}`);
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
  const suffix = `:${port}`;
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    if (!/LISTENING|ASCOLTO/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const local = parts[1] || '';
    if (!local.endsWith(suffix)) continue;
    const pid = Number(parts[parts.length - 1]);
    if (pid) pids.add(pid);
  }
  return [...pids];
}

function portsToCheck() {
  if (serial) {
    return [
      ['http', 8000],
      ['firestore', 8080],
      ['auth', 9099],
      ['ui', 4000],
      ['hub', 4400],
    ];
  }
  const list = [];
  for (const [which, ports] of Object.entries(PHASE_PORTS)) {
    list.push(
      [`${which} http`, ports.http],
      [`${which} auth`, ports.auth],
      [`${which} firestore`, ports.firestore],
      [`${which} firestore websocket`, ports.firestoreWeb],
      [`${which} hub`, ports.hub],
      [`${which} logging`, ports.logging],
    );
  }
  return list;
}

function assertPortsFree() {
  const busy = [];
  for (const [label, port] of portsToCheck()) {
    const pids = listeningPids(port);
    if (pids.length) busy.push({ label, port, pids });
  }
  if (!busy.length) return;
  console.error('[test:promote] ci sono già servizi in ascolto sulle porte del gate. Chiudili e rilancia. Non li ho fermati.');
  for (const { label, port, pids } of busy) {
    console.error(`[test:promote] ${label} :${port} occupata dai processi ${pids.join(', ')}`);
  }
  process.exit(1);
}

function bundledBrowserReady() {
  const local = process.env.LOCALAPPDATA;
  if (!local) return false;
  const headless = join(local, 'ms-playwright', 'chromium_headless_shell-1148', 'chrome-win', 'headless_shell.exe');
  return existsSync(headless);
}

function printSummary(timings, totalMs) {
  console.log('[test:promote] riepilogo');
  for (const row of timings) {
    const esito = row.code === 0 ? 'ok' : 'fallito';
    console.log(`[test:promote] fase ${row.which}: ${esito} (${row.duration}), exit ${row.code}`);
  }
  console.log(`[test:promote] totale: ${formatDuration(totalMs)}`);
}

function removeQuiet(file) {
  try {
    unlinkSync(file);
  } catch {
    /* già assente */
  }
}

async function mainOuter() {
  warnIfOnBattery();
  if (!bundledBrowserReady() && !process.env.GFV_E2E_BROWSER_CHANNEL) {
    console.warn('[test:promote] Chromium bundled assente: uso Chrome di sistema (GFV_E2E_BROWSER_CHANNEL=chrome). CI=true resta attivo, quindi i retry sono 1.');
    process.env.GFV_E2E_BROWSER_CHANNEL = 'chrome';
  }
  assertPortsFree();
  console.log(`[test:promote] modalità ${serial ? 'seriale' : 'parallela'}`);
  const awake = startKeepAwake();
  const originalManifest = existsSync(manifestPath)
    ? readFileSync(manifestPath)
    : Buffer.from('[]\n');
  writeFileSync(manifestPath, '[]\n');
  const timings = [];
  const tempFiles = [];
  const startedAll = Date.now();
  let exitCode = 0;
  try {
    if (serial) {
      for (const which of ['app', 'tony']) {
        if (which === 'tony') writeFileSync(manifestPath, '[]\n');
        const started = Date.now();
        const code = emulatorExecSerial(which);
        timings.push({ which, code, duration: formatDuration(Date.now() - started) });
        if (code !== 0) exitCode = code;
      }
    } else {
      const manifests = {};
      const configs = {};
      mkdirSync(join(root, 'test-results'), { recursive: true });
      for (const which of ['app', 'tony']) {
        configs[which] = writePhaseConfig(which);
        tempFiles.push(configs[which]);
        manifests[which] = join(tmpdir(), `gfv-promote-${which}-${process.pid}.json`);
        writeFileSync(manifests[which], '[]\n');
        tempFiles.push(manifests[which]);
      }
      const results = await Promise.all(['app', 'tony'].map((which) => emulatorExecParallel(
        which,
        configs[which],
        manifests[which],
        join(root, 'test-results', `promote-${which}.log`),
      )));
      for (const row of results) {
        timings.push(row);
        if (row.code !== 0) exitCode = row.code || 1;
      }
    }
  } finally {
    for (const file of tempFiles) removeQuiet(file);
    writeFileSync(manifestPath, originalManifest);
    stopKeepAwake(awake);
    console.log(`[test:promote] manifest ripristinato (${manifestPath})`);
  }
  printSummary(timings, Date.now() - startedAll);
  return exitCode;
}

if (phase === 'app') {
  process.exit(await runAppPhase());
}
if (phase === 'tony') {
  process.exit(await runTonyPhase());
}
if (phase) {
  console.error(`[test:promote] fase sconosciuta: ${phase}`);
  process.exit(1);
}
process.exit(await mainOuter());
