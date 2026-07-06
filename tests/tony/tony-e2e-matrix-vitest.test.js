/**
 * Livello 1 — ogni scenario typo/forbidden in scenarios-matrix.json ha copertura Vitest.
 * @see docs-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md §M-T2
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  matchSegnaOraTimeRangeFromBlob,
} from '../../core/js/tony/engine.js';
import {
  isTonySaveConfirmText,
  tryInterceptQuickHoursSaveBeforeCf,
} from '../../core/js/tony-form-save-local.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const matrixPath = join(__dirname, '../e2e/tony/fixtures/scenarios-matrix.json');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));

function segnaOraTimes(blob) {
  const m = matchSegnaOraTimeRangeFromBlob(blob);
  if (!m) return null;
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const h1 = parseInt(m[1], 10);
  const mi1 = m[2] ? parseInt(m[2], 10) : 0;
  const h2 = parseInt(m[3], 10);
  const mi2 = m[4] ? parseInt(m[4], 10) : 0;
  return {
    'ora-inizio': `${pad(h1)}:${pad(mi1)}`,
    'ora-fine': `${pad(h2)}:${pad(mi2)}`,
  };
}

/** @type {Record<string, () => void>} */
const TYPO_VITEST = {
  'T-TYPO-001'() {
    const fd = segnaOraTimes('daklle 6 aslle 18');
    expect(fd).toEqual({ 'ora-inizio': '06:00', 'ora-fine': '18:00' });
  },
  'T-TYPO-002'() {
    const fd = segnaOraTimes('dalle 6 al 18');
    expect(fd).toEqual({ 'ora-inizio': '06:00', 'ora-fine': '18:00' });
  },
  'T-TYPO-004'() {
    expect(isTonySaveConfirmText('ok salva')).toBe(true);
    globalThis.window = {};
    globalThis.document = {
      getElementById: (id) => {
        const vals = {
          'quick-hours-form': { id: 'quick-hours-form' },
          'selected-work': { value: 'lav1' },
          'ora-data': { value: '2026-07-05' },
          'ora-start': { value: '07:00' },
          'ora-end': { value: '18:00' },
          'ora-break': { value: '60' },
        };
        return vals[id] || null;
      },
    };
    globalThis.window.__tonyGetCurrentFormContext = () => ({
      formId: 'field-workspace-ore-form',
      requiredEmpty: [],
      interviewEmpty: [],
    });
    let saved = false;
    const out = tryInterceptQuickHoursSaveBeforeCf('ok salva', {
      salvaQuickHours: () => {
        saved = true;
      },
    });
    expect(out.handled).toBe(true);
    expect(saved).toBe(true);
    delete globalThis.window;
    delete globalThis.document;
  },
};

/** Scenario forbidden tier 1 — logica in tests/tony-field-role-guard.test.js */
const FORBIDDEN_VITEST_FILE = 'tests/tony-field-role-guard.test.js';
/** @type {Record<string, string>} */
const FORBIDDEN_VITEST = {
  'T-DENY-001': FORBIDDEN_VITEST_FILE,
  'T-DENY-004': FORBIDDEN_VITEST_FILE,
};

const typoScenarios = matrix.scenarios.filter((s) => s.category === 'typo');
const forbiddenScenarios = matrix.scenarios.filter((s) => s.category === 'forbidden');

describe('Tony E2E matrix — traceabilità Vitest tier 1', () => {
  it('matrice caricata con scenari typo/forbidden', () => {
    expect(typoScenarios.length).toBeGreaterThanOrEqual(1);
    expect(forbiddenScenarios.length).toBeGreaterThanOrEqual(1);
  });

  it('ogni scenario typo in matrice ha runner Vitest', () => {
    for (const s of typoScenarios) {
      expect(TYPO_VITEST[s.id], `manca TYPO_VITEST[${s.id}]`).toBeTypeOf('function');
    }
  });

  it('ogni scenario forbidden in matrice ha test Vitest dedicato', () => {
    for (const s of forbiddenScenarios) {
      expect(FORBIDDEN_VITEST[s.id], `mappa FORBIDDEN_VITEST[${s.id}]`).toBeTruthy();
    }
  });
});

for (const scenario of typoScenarios) {
  describe(`[matrix] ${scenario.id}`, () => {
    it(scenario.description, () => {
      TYPO_VITEST[scenario.id]();
    });
  });
}
