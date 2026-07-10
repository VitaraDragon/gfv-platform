/**
 * Classificazione fallimenti E2E app sim (T1–T8 adattati al binario B).
 * @module tests/e2e/sim/helpers/sim-e2e-diagnostic
 */

import { parseSimFailureError } from './sim-e2e-failure-context.mjs';
import { resolveAppScenarioMode } from './sim-e2e-scenario-meta.mjs';

export const FAILURE_LABELS = {
  T1_SEED_INADEQUATE: 'Contesto seed insufficiente',
  T2_INTERCEPT_MISS: 'N/A app E2E',
  T3_PARSER_RECOVERY_GAP: 'N/A app E2E',
  T4_PRODUCT_REGRESSION: 'Regressione prodotto / save',
  T5_FORM_MAPPING_DRIFT: 'Drift DOM / selettori form',
  T6_PERF_BUDGET_EXCEEDED: 'Timeout / latenza pagina',
  T7_LLM_NONDETERMINISM: 'N/A app E2E',
  T8_TEST_HARNESS_FRAGILE: 'Test fragile (selettore/snapshot)',
};

export function classifySimFailure({ error, scenario, observed, hints }) {
  const errLower = String(error?.message || error || '').toLowerCase();
  const h = hints || parseSimFailureError(error);
  const category = scenario?.category || 'read';

  if (
    h.assertField === 'seed' ||
    /manifest|verifica seed|card non trovata|nessun[a-z]* (prodotto|lavoro|terreno|stub)/i.test(errLower)
  ) {
    return {
      classification: 'T1_SEED_INADEQUATE',
      confidence: 'high',
      likelyCause: `Seed/template "${scenario?.requiresSeedProfile || 'default'}" non soddisfa lo scenario.`,
    };
  }

  if (h.assertField === 'timeout' || /timeout \d+ms exceeded/i.test(errLower)) {
    return {
      classification: 'T6_PERF_BUDGET_EXCEEDED',
      confidence: 'high',
      likelyCause: 'Pagina o assert troppo lento — possibile regressione perf o wait insufficiente.',
    };
  }

  if (h.assertField === 'dom' || /locator\.|getbyrole|tobvisible|not found/i.test(errLower)) {
    if (category === 'write' && /save|submit|salva/i.test(errLower)) {
      return {
        classification: 'T4_PRODUCT_REGRESSION',
        confidence: 'medium',
        likelyCause: 'Save o render post-save fallito — verificare service/form prodotto.',
      };
    }
    return {
      classification: 'T5_FORM_MAPPING_DRIFT',
      confidence: 'medium',
      likelyCause: 'Selettore DOM o struttura pagina cambiata — verificare HTML standalone.',
    };
  }

  if (h.assertField === 'save' || h.assertField === 'business_error' || observed?.toastError) {
    return {
      classification: 'T4_PRODUCT_REGRESSION',
      confidence: 'high',
      likelyCause: 'Errore business o save non completato — bug prodotto probabile.',
    };
  }

  if (h.assertField === 'navigation') {
    return {
      classification: 'T4_PRODUCT_REGRESSION',
      confidence: 'medium',
      likelyCause: 'Navigazione o redirect post-azione non avvenuta.',
    };
  }

  if (category === 'read' && /tocontain|tomatch|text/i.test(errLower)) {
    return {
      classification: 'T8_TEST_HARNESS_FRAGILE',
      confidence: 'medium',
      likelyCause: 'Assert testo/contenuto troppo rigido — preferire invarianti strutturali.',
    };
  }

  return {
    classification: 'T4_PRODUCT_REGRESSION',
    confidence: 'low',
    likelyCause: 'Fallimento non classificato — verificare contratto scenario e pagina.',
  };
}

export function buildSimFixOptions(classification, scenario) {
  const id = scenario?.id || 'scenario';
  const options = [];

  switch (classification) {
    case 'T1_SEED_INADEQUATE':
      options.push(
        { id: 'A1', label: 'Estendere template seed o fase orchestrator', effort: 'medium', generalizes: true, files: ['simulator/templates/', 'simulator/phases/'] },
        { id: 'A4', label: `Rigenerare seed (${scenario?.requiresSeedProfile || 'sim:run'})`, effort: 'low', generalizes: false, files: ['simulator/manifest.json'] },
        { id: 'A2', label: 'Verificare requiresSeedProfile in registry', effort: 'low', generalizes: true, files: ['tests/e2e/sim/helpers/sim-e2e-scenario-meta.mjs'] }
      );
      break;
    case 'T4_PRODUCT_REGRESSION':
      options.push(
        { id: 'D1', label: `Fix prodotto pagina/form ${id}`, effort: 'medium', generalizes: true, files: ['modules/', 'core/admin/', 'core/services/'] },
        { id: 'D2', label: 'Vitest service/model se logica business', effort: 'low', generalizes: true, files: ['tests/services/'] }
      );
      break;
    case 'T5_FORM_MAPPING_DRIFT':
      options.push(
        { id: 'E2', label: 'Allineare selettori test a ID stabili in HTML', effort: 'low', generalizes: true, files: [`tests/e2e/sim/scenarios/${id}.mjs`] },
        { id: 'E1', label: 'Ripristinare struttura DOM se regressione accidentale', effort: 'medium', generalizes: true, files: ['modules/*/views/', 'core/admin/'] }
      );
      break;
    case 'T6_PERF_BUDGET_EXCEEDED':
      options.push(
        { id: 'F1', label: 'Ottimizzare caricamento pagina o wait semantici', effort: 'medium', generalizes: true, files: [`tests/e2e/sim/scenarios/${id}.mjs`] },
        { id: 'F3', label: 'Non alzare timeout senza analisi root cause', effort: 'trivial', generalizes: false, files: [] }
      );
      break;
    case 'T8_TEST_HARNESS_FRAGILE':
      options.push(
        { id: 'H1', label: 'Assert strutturali (riga visibile, h1, badge) non testo cella', effort: 'medium', generalizes: true, files: [`tests/e2e/sim/scenarios/${id}.mjs`] },
        { id: 'H4', label: 'Non modificare prodotto se UI corretta', effort: 'low', generalizes: true, files: [] }
      );
      break;
    default:
      options.push({ id: 'D1', label: 'Analisi manuale scenario', effort: 'medium', generalizes: false, files: [] });
      break;
  }

  return options;
}

export function recommendSimOptions(classification, options) {
  const ids = options.map((o) => o.id);
  switch (classification) {
    case 'T1_SEED_INADEQUATE':
      return { recommended: ids.filter((id) => ['A1', 'A4'].includes(id)), avoid: ['Patch assert senza seed'] };
    case 'T4_PRODUCT_REGRESSION':
      return { recommended: ids.filter((id) => id === 'D1'), avoid: ['H1 senza verificare UI'] };
    case 'T5_FORM_MAPPING_DRIFT':
      return { recommended: ids.filter((id) => ['E2', 'E1'].includes(id)), avoid: ['Timeout bump'] };
    case 'T6_PERF_BUDGET_EXCEEDED':
      return { recommended: ids.filter((id) => id === 'F1'), avoid: ['F3 come unica azione'] };
    case 'T8_TEST_HARNESS_FRAGILE':
      return { recommended: ids.filter((id) => ['H1', 'H4'].includes(id)), avoid: ['D1 senza evidenza bug'] };
    default:
      return {
        recommended: options.filter((o) => o.generalizes).map((o) => o.id),
        avoid: options.filter((o) => !o.generalizes).map((o) => `${o.id} (patch isolata)`),
      };
  }
}

export function buildSimFinding({ scenario, error, observed }) {
  const hints = parseSimFailureError(error);
  const { classification, confidence, likelyCause } = classifySimFailure({
    error,
    scenario,
    observed,
    hints,
  });
  const options = buildSimFixOptions(classification, scenario);
  const { recommended, avoid } = recommendSimOptions(classification, options);

  return {
    scenarioId: scenario.id,
    specFile: scenario.specFile,
    scenarioMode: resolveAppScenarioMode(scenario),
    category: scenario.category,
    requiresSeedProfile: scenario.requiresSeedProfile,
    classification,
    classificationLabel: FAILURE_LABELS[classification] || classification,
    confidence,
    invariant: scenario.contract?.invariant || null,
    likelyCause,
    observed,
    errorHints: hints,
    options,
    recommended,
    avoid,
    patchIsolatedRisk: recommended.length === 0 || options.some((o) => !o.generalizes && !recommended.includes(o.id)),
  };
}

export function buildSimDiagnosticReport({ runMode, results, findings, strict }) {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  const improvementSignals = {
    seedInadequateCount: 0,
    productRegressionCount: 0,
    formMappingDriftCount: 0,
    perfBudgetExceededCount: 0,
    testHarnessFragileCount: 0,
    patchIsolatedRiskCount: 0,
  };

  for (const f of findings) {
    switch (f.classification) {
      case 'T1_SEED_INADEQUATE':
        improvementSignals.seedInadequateCount += 1;
        break;
      case 'T4_PRODUCT_REGRESSION':
        improvementSignals.productRegressionCount += 1;
        break;
      case 'T5_FORM_MAPPING_DRIFT':
        improvementSignals.formMappingDriftCount += 1;
        break;
      case 'T6_PERF_BUDGET_EXCEEDED':
        improvementSignals.perfBudgetExceededCount += 1;
        break;
      case 'T8_TEST_HARNESS_FRAGILE':
        improvementSignals.testHarnessFragileCount += 1;
        break;
      default:
        break;
    }
    if (f.patchIsolatedRisk) improvementSignals.patchIsolatedRiskCount += 1;
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runMode,
    binario: 'B-app-e2e',
    strict: !!strict,
    summary: { total: results.length, passed, failed, findings: findings.length },
    improvementSignals,
    findings,
    scenarios: results,
  };
}

export function printSimDiagnosticSummary(report) {
  const { summary, runMode, findings, improvementSignals, strict } = report;
  console.log(`\n=== Sim E2E Diagnostic Report (mode: ${runMode}${strict ? ', strict' : ''}) ===`);
  console.log(`${summary.passed}/${summary.total} passed | ${summary.failed} failed | ${summary.findings} findings`);

  if (!findings.length) {
    console.log('Nessun finding.\n');
    return;
  }

  console.log('\nSegnali miglioramento:');
  for (const [key, count] of Object.entries(improvementSignals)) {
    if (count > 0) console.log(`  • ${key}: ${count}`);
  }

  console.log('\n--- Findings ---\n');
  for (const f of findings) {
    console.log(`[${f.scenarioId}] ${f.classification} — ${f.classificationLabel} (${f.confidence})`);
    if (f.invariant) console.log(`  Contratto: ${f.invariant}`);
    if (f.requiresSeedProfile) console.log(`  Seed: ${f.requiresSeedProfile}`);
    console.log(`  Causa probabile: ${f.likelyCause}`);
    if (f.observed?.url) console.log(`  URL: ${f.observed.url}`);
    if (f.observed?.h1) console.log(`  H1: ${f.observed.h1}`);
    if (f.observed?.toastError) console.log(`  Toast: ${f.observed.toastError}`);
    if (f.recommended?.length) {
      console.log(`  → Raccomandato: ${f.recommended.join(', ')}`);
      for (const optId of f.recommended) {
        const opt = f.options.find((o) => o.id === optId);
        if (opt) console.log(`      ${opt.id}: ${opt.label}`);
      }
    }
    if (f.avoid?.length) console.log(`  ⚠ Evitare: ${f.avoid.join('; ')}`);
    if (f.patchIsolatedRisk) console.log('  ⚠ Rischio patch isolata');
    console.log('');
  }

  console.log('Workflow: classificazione → opzioni → decisione → fix + test service se T4\n');
}
