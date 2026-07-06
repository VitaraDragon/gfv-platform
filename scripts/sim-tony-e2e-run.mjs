#!/usr/bin/env node
/**
 * GFV Tony E2E — runner browser (playwright-core + Chrome di sistema).
 * Prerequisiti: sim:emulators + npm start + tenant in manifest (sim:run).
 * M-T0: smoke infrastruttura + matrice JSON; scenari eseguibili solo se status=ready.
 * Filtro: `--only=T-PERF-001,T-DENY-001` o env `GFV_TONY_E2E_ONLY`.
 */
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { expect } from '@playwright/test';
import { runFlowLavoro013 } from '../tests/e2e/tony/scenarios/flow-lavoro-013.mjs';
import { runFlowPreventivo014 } from '../tests/e2e/tony/scenarios/flow-preventivo-014.mjs';
import { runFlowMovimento016 } from '../tests/e2e/tony/scenarios/flow-movimento-016.mjs';
import { runFlowMovimento017 } from '../tests/e2e/tony/scenarios/flow-movimento-017.mjs';
import { runFlowMovimento019 } from '../tests/e2e/tony/scenarios/flow-movimento-019.mjs';
import { runFlowProdotto015 } from '../tests/e2e/tony/scenarios/flow-prodotto-015.mjs';
import { runFlowProdotto018 } from '../tests/e2e/tony/scenarios/flow-prodotto-018.mjs';
import { runFlowSegnaOre021 } from '../tests/e2e/tony/scenarios/flow-segna-ore-021.mjs';
import { runMatrixScenario } from '../tests/e2e/tony/scenarios/run-matrix-scenario.mjs';
import { runWidgetSmokeAssertions } from '../tests/e2e/tony/scenarios/widget-smoke.mjs';

const baseURL = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const matrixPath = new URL('../tests/e2e/tony/fixtures/scenarios-matrix.json', import.meta.url);
const latencyPath = new URL('../tests/e2e/tony/perf/latency-budgets.json', import.meta.url);

async function checkHttp(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(`${label} non raggiungibile (${url}): ${err.message}`);
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
  const opts = { headless, timeout: 60_000 };
  if (!headless) {
    opts.slowMo = Number(process.env.GFV_E2E_SLOWMO) || 400;
  }
  if (process.env.GFV_E2E_BROWSER_CHANNEL) {
    opts.channel = process.env.GFV_E2E_BROWSER_CHANNEL;
  } else if (!process.env.CI) {
    opts.channel = 'chrome';
  }
  return opts;
}

/** @param {Array<{ id: string, status?: string }>} scenarios */
function resolveScenariosToRun(scenarios) {
  const fromArg = process.argv.find((a) => a.startsWith('--only='));
  const raw = (
    (fromArg ? fromArg.slice('--only='.length) : '') ||
    process.env.GFV_TONY_E2E_ONLY ||
    ''
  ).trim();

  let pool = scenarios.filter((s) => s.status === 'ready');
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
  'T-FLOW-016': runFlowMovimento016,
  'T-FLOW-017': runFlowMovimento017,
  'T-FLOW-019': runFlowMovimento019,
  'T-FLOW-015': runFlowProdotto015,
  'T-FLOW-018': runFlowProdotto018,
  'T-FLOW-013': runFlowLavoro013,
  'T-FLOW-014': runFlowPreventivo014,
};

async function runScenario(page, scenario) {
  if (scenario.status !== 'ready') {
    throw new Error(`Scenario ${scenario.id}: status=${scenario.status || 'draft'} — non eseguibile`);
  }
  const runner = SCENARIO_RUNNERS[scenario.id] || runMatrixScenario;
  await runner(page, expect, scenario);
}

async function main() {
  const matrix = await loadMatrix();
  await loadLatencyBudgets();
  const allScenarios = matrix.scenarios;
  const toRun = resolveScenariosToRun(allScenarios);
  const draftCount = allScenarios.filter((s) => s.status !== 'ready').length;

  const filterLabel =
    toRun.length === 0
      ? `0 eseguibili (${allScenarios.length} in matrice, ${draftCount} draft)`
      : `${toRun.length} scenari (filtro: ${toRun.map((s) => s.id).join(', ')})`;

  console.log(`[sim:tony:e2e] prerequisiti… (${filterLabel})`);
  console.log('[sim:tony:e2e] CF strategy: mock client Livello 2 (PR) — v. TONY_E2E_GUIDA §8');
  await checkHttp(`${baseURL}/`, 'http-server (npm start)');
  await checkHttp('http://127.0.0.1:8080/', 'Firestore emulator (sim:emulators)');
  await checkManifest();

  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  console.log('[sim:tony:e2e] infra-smoke …');
  await runInfraSmoke(page);
  console.log('[sim:tony:e2e] infra-smoke OK');

  let passed = 0;
  const failures = [];

  for (const scenario of toRun) {
    const scenarioPage = await context.newPage();
    process.stdout.write(`[sim:tony:e2e] ${scenario.id} … `);
    try {
      await runScenario(scenarioPage, scenario);
      passed += 1;
      console.log('OK');
    } catch (err) {
      console.log('FAIL');
      failures.push({ id: scenario.id, error: err });
    } finally {
      await scenarioPage.close().catch(() => {});
    }
  }

  await browser.close();

  if (failures.length) {
    console.error('\n[sim:tony:e2e] Falliti:');
    for (const f of failures) {
      console.error(`  • ${f.id}: ${f.error.message || f.error}`);
    }
    process.exit(1);
  }

  if (toRun.length === 0) {
    console.log(
      `\n[sim:tony:e2e] smoke infrastruttura OK — 0/${allScenarios.length} scenari eseguibili. ` +
        'Impostare status=ready in scenarios-matrix.json.'
    );
  } else {
    console.log(`\n[sim:tony:e2e] ${passed}/${toRun.length} scenari OK`);
  }
}

main().catch((err) => {
  console.error('[sim:tony:e2e] ERRORE:', err.message || err);
  process.exit(1);
});
