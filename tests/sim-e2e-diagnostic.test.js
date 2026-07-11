/**
 * Test classificatore diagnostico E2E app sim.
 */
import { describe, expect, it } from 'vitest';
import {
  classifySimFailure,
  buildSimFixOptions,
  recommendSimOptions,
} from './tests/e2e/sim/helpers/sim-e2e-diagnostic.mjs';
import {
  buildScenarioMetaFromSpec,
  resolveAppScenarioMode,
} from './tests/e2e/sim/helpers/sim-e2e-scenario-meta.mjs';
import {
  isTonyE2eGateFast,
  simE2ePause,
  simE2eTimeout,
  simE2eTonyPerfWaitTimeout,
  simE2eTonyPostSaveWaitTimeout,
} from './tests/e2e/sim/helpers/sim-e2e-timeouts.mjs';

describe('sim-e2e-scenario-meta', () => {
  it('write scenario → category write + seed profile', () => {
    const meta = buildScenarioMetaFromSpec('trattori-write.spec.js');
    expect(meta.category).toBe('write');
    expect(meta.contract.invariant).toMatch(/save/i);
    expect(resolveAppScenarioMode(meta)).toBe('gate');
  });

  it('mista-azienda-read → seed mista', () => {
    const meta = buildScenarioMetaFromSpec('mista-azienda-read.spec.js');
    expect(meta.requiresSeedProfile).toContain('mista');
  });
});

describe('classifySimFailure app', () => {
  const scenario = buildScenarioMetaFromSpec('movimenti-uscita-write.spec.js');

  it('seed error → T1', () => {
    const r = classifySimFailure({
      error: new Error('Nessun prodotto con giacenza >= 5 per uscita magazzino E2E'),
      scenario,
      observed: {},
    });
    expect(r.classification).toBe('T1_SEED_INADEQUATE');
  });

  it('timeout → T6', () => {
    const r = classifySimFailure({
      error: new Error('Timeout 45000ms exceeded waiting for locator'),
      scenario,
      observed: {},
    });
    expect(r.classification).toBe('T6_PERF_BUDGET_EXCEEDED');
  });

  it('locator → T5 or T4', () => {
    const r = classifySimFailure({
      error: new Error('locator.toBeVisible: Error: strict mode violation'),
      scenario: { ...scenario, category: 'read' },
      observed: {},
    });
    expect(['T5_FORM_MAPPING_DRIFT', 'T4_PRODUCT_REGRESSION']).toContain(r.classification);
  });
});

describe('recommendSimOptions', () => {
  it('T1 raccomanda A1/A4', () => {
    const opts = buildSimFixOptions('T1_SEED_INADEQUATE', { id: 'x' });
    const { recommended } = recommendSimOptions('T1_SEED_INADEQUATE', opts);
    expect(recommended).toContain('A1');
    expect(recommended).toContain('A4');
  });
});

describe('sim-e2e-timeouts', () => {
  const keys = [
    'GFV_E2E_FAST',
    'GFV_E2E_MODE',
    'GFV_E2E_TIMEOUT_MS',
    'CI',
    'GFV_TONY_E2E_GATE_FAST',
    'GFV_TONY_E2E_MODE',
  ];
  /** @type {Record<string, string|undefined>} */
  let saved = {};

  beforeEach(() => {
    saved = {};
    for (const k of keys) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('gate locale (no CI) mantiene timeout pieni', () => {
    delete process.env.GFV_E2E_FAST;
    delete process.env.GFV_E2E_MODE;
    delete process.env.GFV_E2E_TIMEOUT_MS;
    delete process.env.CI;
    delete process.env.GFV_TONY_E2E_GATE_FAST;
    delete process.env.GFV_TONY_E2E_MODE;
    expect(isTonyE2eGateFast()).toBe(false);
    expect(simE2eTimeout(60_000)).toBe(60_000);
    expect(simE2ePause(600)).toBe(600);
    expect(simE2eTonyPerfWaitTimeout()).toBe(12_000);
    expect(simE2eTonyPostSaveWaitTimeout()).toBe(90_000);
  });

  it('gate-fast CI riduce perf/post-save', () => {
    process.env.CI = 'true';
    process.env.GFV_TONY_E2E_MODE = 'gate';
    delete process.env.GFV_TONY_E2E_GATE_FAST;
    expect(isTonyE2eGateFast()).toBe(true);
    expect(simE2eTonyPerfWaitTimeout()).toBe(8_000);
    expect(simE2eTonyPostSaveWaitTimeout()).toBe(45_000);
    expect(simE2eTimeout(90_000)).toBe(18_000);
  });

  it('explore/fast riduce timeout e pause', () => {
    delete process.env.CI;
    delete process.env.GFV_TONY_E2E_GATE_FAST;
    process.env.GFV_E2E_MODE = 'explore';
    process.env.GFV_E2E_FAST = '1';
    delete process.env.GFV_E2E_TIMEOUT_MS;
    expect(simE2eTimeout(60_000)).toBe(18_000);
    expect(simE2eTimeout(45_000)).toBe(12_000);
    expect(simE2ePause(800)).toBe(250);
  });
});
