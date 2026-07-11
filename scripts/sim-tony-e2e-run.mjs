#!/usr/bin/env node
/**
 * GFV Tony E2E — runner browser (playwright-core + Chrome di sistema).
 * Prerequisiti: sim:emulators + npm start + tenant in manifest (sim:run).
 *
 * Modalità:
 *   --mode=gate     tier 1–2 mock — blocca CI su fallimento (default mock)
 *   --mode=explore  tier 3 live / draft — report diagnostico, exit 0 salvo --strict
 *
 * Output: test-results/tony-e2e-diagnostic-report.json (T1–T8 + opzioni fix)
 *
 * Filtro: `--only=T-PERF-001` o env `GFV_TONY_E2E_ONLY`.
 * Tier 3 live: `--live` o `GFV_TONY_E2E_LIVE=1`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { expect } from '@playwright/test';
import { runFlowLavoro013 } from '../tests/e2e/tony/scenarios/flow-lavoro-013.mjs';
import { runFlowPreventivo014 } from '../tests/e2e/tony/scenarios/flow-preventivo-014.mjs';
import { runFlowPreventivo014Live } from '../tests/e2e/tony/scenarios/flow-preventivo-014-live.mjs';
import { runFlowMovimento016 } from '../tests/e2e/tony/scenarios/flow-movimento-016.mjs';
import { runFlowMovimento017 } from '../tests/e2e/tony/scenarios/flow-movimento-017.mjs';
import { runFlowMovimento019 } from '../tests/e2e/tony/scenarios/flow-movimento-019.mjs';
import { runFlowProdotto015 } from '../tests/e2e/tony/scenarios/flow-prodotto-015.mjs';
import { runFlowProdotto018 } from '../tests/e2e/tony/scenarios/flow-prodotto-018.mjs';
import { runFlowSegnaOre021 } from '../tests/e2e/tony/scenarios/flow-segna-ore-021.mjs';
import { runFlowSegnaOre022 } from '../tests/e2e/tony/scenarios/flow-segna-ore-022.mjs';
import { runMatrixScenario } from '../tests/e2e/tony/scenarios/run-matrix-scenario.mjs';
import { runWidgetSmokeAssertions } from '../tests/e2e/tony/scenarios/widget-smoke.mjs';
import {
  buildTonyE2ePerfReport,
  evaluateTonyE2ePerfGate,
  loadTonyE2eP95GateHistory,
  appendTonyE2eP95GateHistory,
} from '../tests/e2e/tony/helpers/tony-e2e-perf-report.mjs';
import { readTonyScenarioPerf, resetTonyE2eScenarioState } from '../tests/e2e/tony/helpers/tony-e2e-scenario-perf.mjs';
import { captureTonyFailureContext } from '../tests/e2e/tony/helpers/tony-e2e-failure-context.mjs';
import {
  buildDiagnosticReport,
  buildFinding,
  printDiagnosticSummary,
  resolveScenarioMode,
} from '../tests/e2e/tony/helpers/tony-e2e-diagnostic.mjs';
import { isSimE2eFastMode, simE2eBrowserLaunchTimeout } from '../tests/e2e/sim/helpers/sim-e2e-timeouts.mjs';

await import('./load-functions-secret-local.mjs');

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const matrixPath = new URL('../tests/e2e/tony/fixtures/scenarios-matrix.json', import.meta.url);
const latencyPath = new URL('../tests/e2e/tony/perf/latency-budgets.json', import.meta.url);
const reportPath =
  process.env.GFV_TONY_E2E_REPORT ||
  join(rootDir, 'test-results', 'tony-e2e-live-report.json');
const diagnosticReportPath =
  process.env.GFV_TONY_E2E_DIAGNOSTIC ||
  join(rootDir, 'test-results', 'tony-e2e-diagnostic-report.json');
const p95HistoryPath =
  process.env.GFV_TONY_E2E_P95_HISTORY ||
  join(rootDir, 'test-results', 'tony-e2e-p95-gate-history.json');

const isLiveMode =
  process.argv.includes('--live') ||
  process.env.GFV_TONY_E2E_LIVE === '1' ||
  process.env.GFV_TONY_E2E_LIVE === 'true';

const enforceP95 =
  process.argv.includes('--enforce-p95') ||
  process.env.GFV_TONY_E2E_ENFORCE_P95 === '1' ||
  process.env.GFV_TONY_E2E_ENFORCE_P95 === 'true';

const includeDraft =
  process.argv.includes('--include-draft') ||
  process.env.GFV_TONY_E2E_INCLUDE_DRAFT === '1' ||
  process.env.GFV_TONY_E2E_INCLUDE_DRAFT === 'true';

const strictExplore =
  process.argv.includes('--strict') ||
  process.env.GFV_TONY_E2E_STRICT === '1' ||
  process.env.GFV_TONY_E2E_STRICT === 'true';

function resolveRunMode() {
  const fromArg = process.argv.find((a) => a.startsWith('--mode='));
  const raw = (
    (fromArg ? fromArg.slice('--mode='.length) : '') ||
    process.env.GFV_TONY_E2E_MODE ||
    ''
  ).trim();
  if (raw === 'gate' || raw === 'explore') return raw;
  if (isLiveMode) return 'explore';
  return 'gate';
}

const runMode = resolveRunMode();
if (runMode === 'explore' || process.env.GFV_E2E_FAST === '1') {
  process.env.GFV_E2E_FAST = '1';
}
process.env.GFV_TONY_E2E_MODE = runMode;

const useProdCf =
  process.env.GFV_TONY_E2E_PROD_CF === '1' ||
  process.env.GFV_TONY_E2E_PROD_CF === 'true';

async function checkHttp(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(`${label} non raggiungibile (${url}): ${err.message}`);
  }
}

async function checkFunctionsEmulatorIfLive() {
  if (!isLiveMode || useProdCf) return;
  const url = 'http://127.0.0.1:5001/';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    // Root emulator spesso 404: basta una risposta HTTP per confermare che è in ascolto.
    if (res.status >= 500) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    const detail = err.message || String(err);
    throw new Error(
      `Functions emulator (port 5001) non raggiungibile (${url}): ${detail} — avvia emulator con functions: npm run sim:emulators:live (o firebase emulators:start --only auth,firestore,functions)`
    );
  }
}

async function checkManifest() {
  let raw;
  try {
    raw = await readFile(new URL('../simulator/manifest.json', import.meta.url), 'utf8');
  } catch {
    throw new Error('simulator/manifest.json assente — esegui npm run sim:run');
  }
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('manifest vuoto — esegui npm run sim:run (con emulator attivo)');
  }
}

async function loadMatrix() {
  const raw = await readFile(matrixPath, 'utf8');
  const matrix = JSON.parse(raw);
  if (!matrix.scenarios || !Array.isArray(matrix.scenarios)) {
    throw new Error('scenarios-matrix.json: campo scenarios mancante');
  }
  return matrix;
}

async function loadLatencyBudgets() {
  const raw = await readFile(latencyPath, 'utf8');
  return JSON.parse(raw);
}

function launchOptions() {
  const headless = process.env.GFV_E2E_HEADED !== '1';
  const opts = { headless, timeout: simE2eBrowserLaunchTimeout() };
  if (!headless) {
    opts.slowMo = Number(process.env.GFV_E2E_SLOWMO) || (isSimE2eFastMode() ? 0 : 400);
  }
  if (process.env.GFV_E2E_BROWSER_CHANNEL) {
    opts.channel = process.env.GFV_E2E_BROWSER_CHANNEL;
  } else if (!process.env.CI) {
    opts.channel = 'chrome';
  }
  return opts;
}

/** @param {Array<{ id: string, status?: string, tier?: number, mode?: string }>} scenarios */
function resolveScenariosToRun(scenarios) {
  const fromArg = process.argv.find((a) => a.startsWith('--only='));
  const raw = (
    (fromArg ? fromArg.slice('--only='.length) : '') ||
    process.env.GFV_TONY_E2E_ONLY ||
    ''
  ).trim();

  let pool = scenarios.filter((s) => {
    const mode = resolveScenarioMode(s);
    if (mode !== runMode) return false;
    if (s.status === 'ready') return true;
    return includeDraft && runMode === 'explore';
  });

  if (isLiveMode && runMode === 'explore') {
    pool = pool.filter((s) => s.tier === 3 || includeDraft);
  } else if (runMode === 'gate') {
    pool = pool.filter((s) => s.tier !== 3);
  }

  if (pool.length === 0 && !raw) {
    return [];
  }

  if (!raw) return pool;

  const wanted = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (wanted.length === 0) return pool;

  const known = new Set(scenarios.map((s) => s.id));
  const missing = wanted.filter((id) => !known.has(id));
  if (missing.length) {
    throw new Error(
      `GFV_TONY_E2E_ONLY / --only: scenari sconosciuti: ${missing.join(', ')}. ` +
        'Vedi tests/e2e/tony/fixtures/scenarios-matrix.json'
    );
  }

  const order = new Map(wanted.map((id, i) => [id, i]));
  return scenarios
    .filter((s) => order.has(s.id))
    .sort((a, b) => order.get(a.id) - order.get(b.id));
}

/**
 * Smoke infrastruttura M-T0: import helper + expect playwright ok.
 * @param {import('playwright-core').Page} page
 */
async function runInfraSmoke(page) {
  await page.goto(`${baseURL}/core/dev/simulator-dev-standalone.html?emulator=1`);
  await expect(page.locator('body')).toBeVisible();
}

/** @type {Record<string, (page: import('playwright-core').Page, expect: typeof expect, scenario: object) => Promise<void>>} */
const SCENARIO_RUNNERS = {
  'T-SMOKE-001': runWidgetSmokeAssertions,
  'T-FLOW-021': runFlowSegnaOre021,
  'T-FLOW-022': runFlowSegnaOre022,
  'T-FLOW-016': runFlowMovimento016,
  'T-FLOW-017': runFlowMovimento017,
  'T-FLOW-019': runFlowMovimento019,
  'T-FLOW-015': runFlowProdotto015,
  'T-FLOW-018': runFlowProdotto018,
  'T-FLOW-013': runFlowLavoro013,
  'T-FLOW-014': runFlowPreventivo014,
  'T-FLOW-014-LIVE': runFlowPreventivo014Live,
};

async function runScenario(page, scenario) {
  if (scenario.status !== 'ready') {
    throw new Error(`Scenario ${scenario.id}: status=${scenario.status || 'draft'} — non eseguibile`);
  }
  if (isLiveMode && scenario.mockCf) {
    throw new Error(`Scenario ${scenario.id}: mockCf=true non ammesso in modalità live`);
  }
  const runner = SCENARIO_RUNNERS[scenario.id] || runMatrixScenario;
  await runner(page, expect, scenario);
}

async function writeDiagnosticReport(report) {
  await mkdir(dirname(diagnosticReportPath), { recursive: true });
  await writeFile(diagnosticReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[sim:tony:e2e] diagnostic → ${diagnosticReportPath}`);
  printDiagnosticSummary(report);
}

async function writePerfReport(report, budgets) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[sim:tony:e2e${isLiveMode ? ':live' : ''}] report → ${reportPath}`);

  const priorHistory = isLiveMode ? await loadTonyE2eP95GateHistory(p95HistoryPath) : null;
  const gate = evaluateTonyE2ePerfGate(report, budgets, priorHistory);

  if (isLiveMode) {
    await appendTonyE2eP95GateHistory(p95HistoryPath, {
      at: report.generatedAt,
      breach: gate.breach,
      reasons: gate.reasons,
      consecutiveBreaches: gate.consecutiveBreaches,
    });
  }

  if (gate.breach) {
    if (gate.warnOnly) {
      console.warn(
        `[sim:tony:e2e:live] soglie p95 superate (${gate.consecutiveBreaches}/${gate.streakThreshold} run consecutivi):`,
        gate.reasons.join('; ')
      );
    } else {
      console.warn('[sim:tony:e2e:live] soglie p95 superate:', gate.reasons.join('; '));
    }
  }
  if (enforceP95) {
    console.log('[sim:tony:e2e:live] gate p95: ENFORCED');
  }
  return gate;
}

async function main() {
  const matrix = await loadMatrix();
  const budgets = await loadLatencyBudgets();
  const allScenarios = matrix.scenarios;
  const toRun = resolveScenariosToRun(allScenarios);
  const draftCount = allScenarios.filter((s) => s.status !== 'ready').length;
  const modeLabel = isLiveMode ? 'live tier 3' : 'mock tier 2';

  const filterLabel =
    toRun.length === 0
      ? `0 eseguibili (${allScenarios.length} in matrice, ${draftCount} draft, ${modeLabel}, runMode=${runMode})`
      : `${toRun.length} scenari ${modeLabel} mode=${runMode} (${toRun.map((s) => s.id).join(', ')})`;

  console.log(`[sim:tony:e2e${isLiveMode ? ':live' : ''}] prerequisiti… (${filterLabel})`);
  if (runMode === 'explore' && !strictExplore) {
    console.log('[sim:tony:e2e] explore: i fallimenti producono findings ma non bloccano exit (usa --strict per bloccare)');
  }
  if (isSimE2eFastMode()) {
    console.log('[sim:tony:e2e] fast mode: timeout risposta ~20s, pause UI ridotte (GFV_E2E_TIMEOUT_MS per override)');
  } else if (process.env.CI === 'true' && runMode === 'gate') {
    console.log('[sim:tony:e2e] gate-fast CI: perf wait ~8s, post-save max ~45s, modal stuck ~8s');
  }
  if (isLiveMode) {
    if (useProdCf) {
      console.log('[sim:tony:e2e:live] CF strategy: produzione europe-west1 (GEMINI già su Cloud Run)');
    } else {
      console.log('[sim:tony:e2e:live] CF strategy: Functions emulator + GEMINI_API_KEY — v. TONY_E2E_GUIDA §8');
      if (!process.env.GEMINI_API_KEY) {
        console.warn('[sim:tony:e2e:live] GEMINI_API_KEY assente — crea functions/.secret.local o usa GFV_TONY_E2E_PROD_CF=1');
      }
    }
  } else {
    console.log('[sim:tony:e2e] CF strategy: mock client Livello 2 (PR) — v. TONY_E2E_GUIDA §8');
  }
  await checkHttp(`${baseURL}/`, 'http-server (npm start)');
  await checkHttp('http://127.0.0.1:8080/', 'Firestore emulator (sim:emulators)');
  await checkFunctionsEmulatorIfLive();
  await checkManifest();

  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext({ baseURL });
  if (isLiveMode) {
    await context.addInitScript((prodCf) => {
      if (prodCf) {
        window.__GFV_TONY_E2E_PROD_CF = true;
        return;
      }
      window.__GFV_TONY_E2E_LIVE = true;
      const projectId =
        (window.firebaseConfig && window.firebaseConfig.projectId) || 'gfv-platform';
      window.__gfvTonyCfEmulatorBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
    }, useProdCf);
  }
  const page = await context.newPage();

  console.log(`[sim:tony:e2e${isLiveMode ? ':live' : ''}] infra-smoke …`);
  await runInfraSmoke(page);
  console.log(`[sim:tony:e2e${isLiveMode ? ':live' : ''}] infra-smoke OK`);

  let passed = 0;
  const failures = [];
  /** @type {Array<object>} */
  const resultRows = [];
  /** @type {Array<{ id: string, category?: string, passed: boolean, latencyMs?: number, usedGemini?: boolean|null, error?: string }>} */
  const perfRows = [];

  for (const scenario of toRun) {
    const scenarioPage = await context.newPage();
    await resetTonyE2eScenarioState(scenarioPage);
    process.stdout.write(`[sim:tony:e2e${isLiveMode ? ':live' : ''}] ${scenario.id} … `);
    try {
      await runScenario(scenarioPage, scenario);
      passed += 1;
      console.log('OK');
      const perf = await readTonyScenarioPerf(scenarioPage).catch(() => null);
      resultRows.push({
        id: scenario.id,
        mode: resolveScenarioMode(scenario),
        category: scenario.category,
        passed: true,
        latencyMs: perf && typeof perf.latencyMs === 'number' ? perf.latencyMs : undefined,
        usedGemini: perf && typeof perf.usedGemini === 'boolean' ? perf.usedGemini : null,
      });
      if (isLiveMode) {
        perfRows.push({
          id: scenario.id,
          category: scenario.category,
          passed: true,
          latencyMs: perf && typeof perf.latencyMs === 'number' ? perf.latencyMs : undefined,
          usedGemini: perf && typeof perf.usedGemini === 'boolean' ? perf.usedGemini : null,
        });
      }
    } catch (err) {
      console.log('FAIL');
      const observed = await captureTonyFailureContext(scenarioPage, scenario).catch(() => ({}));
      const finding = buildFinding({ scenario, error: err, observed });
      failures.push({ id: scenario.id, error: err, finding });
      const perf = observed?.perf || (await readTonyScenarioPerf(scenarioPage).catch(() => null));
      resultRows.push({
        id: scenario.id,
        mode: resolveScenarioMode(scenario),
        category: scenario.category,
        passed: false,
        error: err.message || String(err),
        classification: finding.classification,
        latencyMs: perf && typeof perf.latencyMs === 'number' ? perf.latencyMs : undefined,
        usedGemini: perf && typeof perf.usedGemini === 'boolean' ? perf.usedGemini : null,
      });
      if (isLiveMode) {
        perfRows.push({
          id: scenario.id,
          category: scenario.category,
          passed: false,
          latencyMs: perf && typeof perf.latencyMs === 'number' ? perf.latencyMs : undefined,
          usedGemini: perf && typeof perf.usedGemini === 'boolean' ? perf.usedGemini : null,
          error: err.message || String(err),
        });
      }
    } finally {
      await scenarioPage.close().catch(() => {});
    }
  }

  await browser.close();

  const findings = failures.map((f) => f.finding).filter(Boolean);
  const diagnosticReport = buildDiagnosticReport({
    runMode,
    isLiveMode,
    results: resultRows,
    findings,
  });
  await writeDiagnosticReport(diagnosticReport);

  if (isLiveMode && perfRows.length) {
    const report = buildTonyE2ePerfReport(perfRows, budgets);
    const gate = await writePerfReport(report, budgets);
    console.log(
      `[sim:tony:e2e:live] metriche: p50=${report.summary.p50LatencyMs ?? 'n/a'}ms p95=${report.summary.p95LatencyMs ?? 'n/a'}ms quickReplyHit=${report.summary.quickReplyHitPct ?? 'n/a'}%`
    );
    if (!gate.ok && enforceP95) {
      failures.push({
        id: 'P95-GATE',
        error: new Error(
          `${gate.reasons.join('; ')} (streak ${gate.consecutiveBreaches}/${gate.streakThreshold})`
        ),
      });
    }
  }

  const shouldFailExit =
    failures.length > 0 && (runMode === 'gate' || strictExplore);

  if (failures.length) {
    console.error(`\n[sim:tony:e2e${isLiveMode ? ':live' : ''}] Falliti (${failures.length}):`);
    for (const f of failures) {
      const cls = f.finding?.classification ? ` [${f.finding.classification}]` : '';
      console.error(`  • ${f.id}${cls}: ${f.error.message || f.error}`);
    }
    if (!shouldFailExit) {
      console.warn(
        `[sim:tony:e2e] explore: ${failures.length} finding(s) registrati — exit 0 (vedi ${diagnosticReportPath})`
      );
    } else {
      process.exit(1);
    }
  }

  if (toRun.length === 0) {
    console.log(
      `\n[sim:tony:e2e${isLiveMode ? ':live' : ''}] smoke infrastruttura OK — 0/${allScenarios.length} scenari eseguibili (${modeLabel}). ` +
        'Impostare status=ready in scenarios-matrix.json.'
    );
  } else {
    console.log(`\n[sim:tony:e2e${isLiveMode ? ':live' : ''}] ${passed}/${toRun.length} scenari OK`);
  }
}

main().catch((err) => {
  console.error(`[sim:tony:e2e${isLiveMode ? ':live' : ''}] ERRORE:`, err.message || err);
  process.exit(1);
});
