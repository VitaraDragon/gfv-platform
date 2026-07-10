/**
 * Test classificatore diagnostico Tony E2E (T1–T8).
 */
import { describe, expect, it } from 'vitest';
import {
  classifyFailure,
  resolveScenarioMode,
  buildFixOptions,
  recommendOptions,
} from './tests/e2e/tony/helpers/tony-e2e-diagnostic.mjs';

describe('resolveScenarioMode', () => {
  it('tier 3 → explore se mode assente', () => {
    expect(resolveScenarioMode({ tier: 3, status: 'ready' })).toBe('explore');
  });

  it('tier 2 ready → gate se mode assente', () => {
    expect(resolveScenarioMode({ tier: 2, status: 'ready' })).toBe('gate');
  });

  it('rispetta mode esplicito', () => {
    expect(resolveScenarioMode({ tier: 2, status: 'ready', mode: 'explore' })).toBe('explore');
  });
});

describe('classifyFailure', () => {
  it('Discovery seed → T1', () => {
    const r = classifyFailure({
      error: new Error('Discovery: nessuna coppia terreni ambigua — verifica seed sim'),
      scenario: { tier: 2, expect: {} },
      observed: {},
    });
    expect(r.classification).toBe('T1_SEED_INADEQUATE');
  });

  it('usedGemini atteso false ma true → T2', () => {
    const r = classifyFailure({
      error: new Error('Expected: false Received: true // usedGemini'),
      scenario: { tier: 2, expect: { usedGemini: false }, messages: ['portami alle tariffe'] },
      observed: { perf: { usedGemini: true, cfCalled: true } },
    });
    expect(r.classification).toBe('T2_INTERCEPT_MISS');
  });

  it('tier 3 solo responseMustMatch → T7', () => {
    const r = classifyFailure({
      error: new Error('expect(received).toContain(expected) // responseMustMatch'),
      scenario: { tier: 3, expect: { responseMustMatch: ['tariff'] }, messages: ['quante tariffe?'] },
      observed: { commands: [], reply: 'Hai 3 voci tariffarie attive' },
    });
    expect(r.classification).toBe('T7_LLM_NONDETERMINISM');
  });

  it('campo inject null → T5', () => {
    const r = classifyFailure({
      error: new Error('campo inject terreno: expected truthy'),
      scenario: { tier: 2, category: 'inject', expect: { injectedFields: ['terreno'] } },
      observed: {},
    });
    expect(r.classification).toBe('T5_FORM_MAPPING_DRIFT');
  });

  it('latency budget → T6', () => {
    const r = classifyFailure({
      error: new Error('Expected: <= 800 Received: 1200 // latencyMsMax'),
      scenario: { tier: 2, expect: { latencyMsMax: 800 } },
      observed: { perf: { latencyMs: 1200 } },
    });
    expect(r.classification).toBe('T6_PERF_BUDGET_EXCEEDED');
  });
});

describe('buildFixOptions + recommendOptions', () => {
  it('T2 raccomanda B1 e B3', () => {
    const opts = buildFixOptions('T2_INTERCEPT_MISS', { messages: ['nav'] }, { message: 'nav' });
    const { recommended } = recommendOptions('T2_INTERCEPT_MISS', opts);
    expect(recommended).toContain('B1');
    expect(recommended).toContain('B3');
  });
});
