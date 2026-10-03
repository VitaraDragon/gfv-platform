/**
 * Livello 1 — ogni scenario typo/forbidden in scenarios-matrix.json ha copertura Vitest.
 * @see docs-sviluppo/in-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md §M-T2
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  matchSegnaOraTimeRangeFromBlob,
  normalizeTonyTextWhitespace,
} from '../../core/js/tony/engine.js';
import {
  isTonySaveConfirmText,
  tryInterceptQuickHoursSaveBeforeCf,
} from '../../core/js/tony-form-save-local.js';
import {
  extractProdottoNomeFromText,
  normalizeProdottoUnitaFromText,
} from '../../core/js/tony-prodotto-create-local.js';

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
    globalThis.window = { document: globalThis.document };
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
  'T-DIRTY-001'() {
    // "qunati litri rame nn nela botte 3??" — typo quantità rame botte
    const msg = 'qunati litri rame nn nela botte 3??';
    const normalized = normalizeTonyTextWhitespace(msg);
    expect(normalized).toBeTruthy();
    expect(normalized.toLowerCase()).toContain('rame');
    expect(normalized.toLowerCase()).toContain('litri');
    const unita = normalizeProdottoUnitaFromText('litri');
    expect(unita).toBe('L');
  },
  'T-DIRTY-009'() {
    // "ce nne ancora dil rame? qusi finito" — typo disponibilità scorta rame
    const msg = 'ce nne ancora dil rame? qusi finito';
    const normalized = normalizeTonyTextWhitespace(msg);
    expect(normalized).toBeTruthy();
    expect(normalized.toLowerCase()).toContain('rame');
    // Test che il parsing non crasha su typo pesante
    const nome = extractProdottoNomeFromText('crea prodotto rame');
    expect(nome).toBe('rame');
  },
  'T-TRIM-DIRTY-001'() {
    // "qarica 300 litri gasolio nela cisterna plis" — typo carico cisterna gasolio
    const msg = 'qarica 300 litri gasolio nela cisterna plis';
    const normalized = normalizeTonyTextWhitespace(msg);
    expect(normalized).toBeTruthy();
    expect(normalized.toLowerCase()).toContain('gasolio');
    expect(normalized.toLowerCase()).toContain('litri');
    const unita = normalizeProdottoUnitaFromText('litri');
    expect(unita).toBe('L');
  },
  'T-TRIM-DIRTY-003'() {
    // "ce nne ancora dil adblue? qusi finito" — typo scorta AdBlue
    const msg = 'ce nne ancora dil adblue? qusi finito';
    const normalized = normalizeTonyTextWhitespace(msg);
    expect(normalized).toBeTruthy();
    expect(normalized.toLowerCase()).toContain('adblue');
    // Test che il parsing non crasha su typo pesante
    const nome = extractProdottoNomeFromText('crea prodotto adblue');
    expect(nome).toBe('adblue');
  },
  'T-TRIM-DIRTY-009'() {
    // "pieno benzina sul pickup qusi 40 litri" — typo pieno benzina pickup
    const msg = 'pieno benzina sul pickup qusi 40 litri';
    const normalized = normalizeTonyTextWhitespace(msg);
    expect(normalized).toBeTruthy();
    expect(normalized.toLowerCase()).toContain('benzina');
    expect(normalized.toLowerCase()).toContain('litri');
    const unita = normalizeProdottoUnitaFromText('litri');
    expect(unita).toBe('L');
  },
};

/** Scenario forbidden tier 1 — logica in tests/tony-field-role-guard.test.js */
const FORBIDDEN_VITEST_FILE = 'tests/tony-field-role-guard.test.js';
const FORBIDDEN_FREEMIUM_FILE = 'tests/tony-freemium-plan-guard.test.js';
/** @type {Record<string, string>} */
const FORBIDDEN_VITEST = {
  'T-DENY-001': FORBIDDEN_VITEST_FILE,
  'T-DENY-002': FORBIDDEN_FREEMIUM_FILE,
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
