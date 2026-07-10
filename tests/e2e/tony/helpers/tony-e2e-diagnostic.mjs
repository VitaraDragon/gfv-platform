/**
 * Classificazione fallimenti Tony E2E (T1–T8) + opzioni di fix + report diagnostico.
 * @module tests/e2e/tony/helpers/tony-e2e-diagnostic
 */

import { parseFailureError } from './tony-e2e-failure-context.mjs';

/** @typedef {'T1_SEED_INADEQUATE'|'T2_INTERCEPT_MISS'|'T3_PARSER_RECOVERY_GAP'|'T4_PRODUCT_REGRESSION'|'T5_FORM_MAPPING_DRIFT'|'T6_PERF_BUDGET_EXCEEDED'|'T7_LLM_NONDETERMINISM'|'T8_TEST_HARNESS_FRAGILE'} FailureClass */

/** @type {Record<FailureClass, string>} */
export const FAILURE_LABELS = {
  T1_SEED_INADEQUATE: 'Contesto seed insufficiente',
  T2_INTERCEPT_MISS: 'Intercept locale mancato (0-CF)',
  T3_PARSER_RECOVERY_GAP: 'Parser / recovery NL',
  T4_PRODUCT_REGRESSION: 'Regressione prodotto',
  T5_FORM_MAPPING_DRIFT: 'Drift form mapping / DOM',
  T6_PERF_BUDGET_EXCEEDED: 'Budget latenza superato',
  T7_LLM_NONDETERMINISM: 'Non-determinismo LLM (tier 3)',
  T8_TEST_HARNESS_FRAGILE: 'Test fragile (snapshot vs contratto)',
};

/**
 * @param {object} scenario
 * @returns {'gate'|'explore'}
 */
export function resolveScenarioMode(scenario) {
  if (scenario.mode === 'gate' || scenario.mode === 'explore') return scenario.mode;
  if (scenario.tier === 3) return 'explore';
  if (scenario.status && scenario.status !== 'ready') return 'explore';
  return 'gate';
}

/**
 * @param {object} params
 * @returns {{ classification: FailureClass, confidence: 'high'|'medium'|'low', likelyCause: string }}
 */
export function classifyFailure({ error, scenario, observed, hints }) {
  const exp = scenario.expect || {};
  const tier = scenario.tier ?? 2;
  const errLower = String(error?.message || error || '').toLowerCase();
  const h = hints || parseFailureError(error);

  if (
    /discovery:/i.test(errLower) ||
    /manifest/i.test(errLower) ||
    /verifica seed/i.test(errLower) ||
    /nessun[a-z]* (prodotto|lavoro|terreno|operaio|stub|riga)/i.test(errLower) ||
    h.assertField === 'discovery' ||
    h.assertField === 'manifest' ||
    h.assertField === 'seed'
  ) {
    return {
      classification: 'T1_SEED_INADEQUATE',
      confidence: 'high',
      likelyCause: 'Il template seed o il manifest non soddisfa le precondizioni dello scenario.',
    };
  }

  const perf = observed?.perf;
  const expectNoGemini = exp.usedGemini === false || exp.quickReplyHit === true || exp.cfCallsMax === 0;
  const geminiUsed = perf?.usedGemini === true || perf?.cfCalled === true;
  const interceptMissByPerf =
    expectNoGemini && geminiUsed && (h.assertField === 'intercept' || /usedgemini|cfcalled|quickreply/i.test(errLower));
  const interceptMissByCommands =
    Array.isArray(exp.commands) &&
    exp.commands.length > 0 &&
    (h.assertField === 'commands' || /commands/i.test(errLower)) &&
    !(observed?.commands || []).some((c) => exp.commands.includes(c));

  if (interceptMissByPerf || interceptMissByCommands) {
    return {
      classification: 'T2_INTERCEPT_MISS',
      confidence: 'high',
      likelyCause: 'Nav/filter/save locale non attivato — possibile gap in tony-routes o quick reply.',
    };
  }

  if (
    h.assertField === 'latency' ||
    /latencymsmax|latenza|toBeLessThanOrEqual/i.test(errLower)
  ) {
    return {
      classification: 'T6_PERF_BUDGET_EXCEEDED',
      confidence: 'high',
      likelyCause: 'Comportamento funzionale possibilmente OK ma oltre soglia ms.',
    };
  }

  if (
    tier === 3 &&
    (h.assertField === 'response_text' || /responsemustmatch|tomatch/i.test(errLower)) &&
    !(h.assertField === 'commands' || h.assertField === 'save_verify' || h.assertField === 'dom_inject')
  ) {
    const commandsOk =
      !exp.commands?.length ||
      (observed?.commands || []).some((c) => exp.commands.includes(c));
    if (commandsOk) {
      return {
        classification: 'T7_LLM_NONDETERMINISM',
        confidence: 'medium',
        likelyCause: 'Gemini ha risposto in modo accettabile ma con wording diverso dall\'assert.',
      };
    }
  }

  if (
    h.assertField === 'dom_inject' ||
    /campo inject|injectedfields|getelementbyid/i.test(errLower)
  ) {
    return {
      classification: 'T5_FORM_MAPPING_DRIFT',
      confidence: 'high',
      likelyCause: 'ID DOM o voce tony-form-mapping non allineati alla pagina.',
    };
  }

  if (
    scenario.category === 'typo' ||
    /intervista|typo|parse|recovery|daklle|segna-ora/i.test(errLower) ||
    (scenario.category === 'typo' && tier <= 2)
  ) {
    return {
      classification: 'T3_PARSER_RECOVERY_GAP',
      confidence: 'medium',
      likelyCause: 'Parser client o recovery NL non gestisce la variante del messaggio.',
    };
  }

  if (
    h.assertField === 'save_verify' ||
    /cross-page|intervista follow-up|conferma salva|tobvisible|row/i.test(errLower)
  ) {
    return {
      classification: 'T4_PRODUCT_REGRESSION',
      confidence: 'medium',
      likelyCause: 'Flusso save/nav/inject non completa — possibile bug prodotto o service.',
    };
  }

  if (
    h.assertField === 'response_text' &&
    tier <= 2 &&
    !exp.usedGemini
  ) {
    return {
      classification: 'T8_TEST_HARNESS_FRAGILE',
      confidence: 'medium',
      likelyCause: 'Assert su testo risposta troppo rigido — verificare comandi/invarianti.',
    };
  }

  return {
    classification: 'T4_PRODUCT_REGRESSION',
    confidence: 'low',
    likelyCause: 'Fallimento non classificato con certezza — verificare contratto scenario.',
  };
}

/**
 * @param {FailureClass} classification
 * @param {object} scenario
 * @param {object} observed
 * @returns {Array<object>}
 */
export function buildFixOptions(classification, scenario, observed) {
  const msg = observed?.message || (scenario.messages || [])[0] || '';
  /** @type {Array<object>} */
  const options = [];

  switch (classification) {
    case 'T1_SEED_INADEQUATE':
      options.push(
        {
          id: 'A1',
          label: 'Estendere template seed (simulator/templates/)',
          effort: 'medium',
          generalizes: true,
          files: ['simulator/templates/', 'simulator/phases/'],
        },
        {
          id: 'A2',
          label: 'Aggiungere requiresSeedProfile allo scenario',
          effort: 'low',
          generalizes: true,
          files: ['tests/e2e/tony/fixtures/scenarios-matrix.json'],
        },
        {
          id: 'A4',
          label: 'Non patchare assert — rigenerare seed (npm run sim:run)',
          effort: 'low',
          generalizes: false,
          files: ['simulator/manifest.json'],
        }
      );
      break;

    case 'T2_INTERCEPT_MISS':
      options.push(
        {
          id: 'B1',
          label: `Aggiungere sinonimo nav in tony-routes.json${msg ? ` per "${msg.slice(0, 40)}"` : ''}`,
          effort: 'low',
          generalizes: true,
          files: ['core/config/tony-routes.json'],
        },
        {
          id: 'B2',
          label: 'Estendere parser nav/filter in functions/',
          effort: 'medium',
          generalizes: true,
          files: ['functions/tony-nav-quick-reply.js', 'functions/tony-filter-table-quick-reply.js'],
        },
        {
          id: 'B3',
          label: 'Test Vitest sul quick reply / nav',
          effort: 'low',
          generalizes: true,
          files: ['tests/tony-nav-quick-reply.test.js', 'tests/tony-filter-table-quick-reply.test.js'],
        },
        {
          id: 'B4',
          label: 'Allentare assert risposta (solo se comando/nav OK)',
          effort: 'trivial',
          generalizes: false,
          files: ['tests/e2e/tony/fixtures/scenarios-matrix.json'],
        }
      );
      break;

    case 'T3_PARSER_RECOVERY_GAP':
      options.push(
        {
          id: 'C1',
          label: 'Nuovo caso Vitest con input fallito',
          effort: 'low',
          generalizes: true,
          files: ['tests/tony-segna-ora-time-range.test.js', 'tests/tony-intent-router.test.js', 'tests/tony/'],
        },
        {
          id: 'C2',
          label: 'Estendere parser/normalize in functions o client',
          effort: 'medium',
          generalizes: true,
          files: ['functions/tony-lavoro-entity-parser.js', 'core/js/tony/'],
        },
        {
          id: 'C4',
          label: 'Usare responseMustMatchAny in matrice (solo tier 3)',
          effort: 'trivial',
          generalizes: false,
          files: ['tests/e2e/tony/fixtures/scenarios-matrix.json'],
        }
      );
      break;

    case 'T4_PRODUCT_REGRESSION':
      options.push(
        {
          id: 'D1',
          label: 'Fix prodotto (inject, save, service, pagina)',
          effort: 'medium',
          generalizes: true,
          files: ['core/js/tony-form-injector.js', 'core/js/tony/main.js', 'core/services/'],
        },
        {
          id: 'D2',
          label: 'Aggiungere Vitest contratto se mancante',
          effort: 'low',
          generalizes: true,
          files: ['tests/tony-form-save-local.test.js'],
        }
      );
      break;

    case 'T5_FORM_MAPPING_DRIFT':
      options.push(
        {
          id: 'E1',
          label: 'Aggiornare tony-form-mapping.js',
          effort: 'low',
          generalizes: true,
          files: ['core/config/tony-form-mapping.js'],
        },
        {
          id: 'E2',
          label: 'Ripristinare ID stabile nel HTML form',
          effort: 'low',
          generalizes: true,
          files: ['modules/*/views/*-standalone.html', 'core/admin/'],
        },
        {
          id: 'E3',
          label: 'Shadow check DOM vs mapping (explore suite)',
          effort: 'medium',
          generalizes: true,
          files: ['tests/e2e/tony/helpers/'],
        }
      );
      break;

    case 'T6_PERF_BUDGET_EXCEEDED':
      options.push(
        {
          id: 'F1',
          label: 'Ottimizzare path lento (cache, intercept, tier)',
          effort: 'medium',
          generalizes: true,
          files: ['functions/tony-context-cache.js', 'core/js/tony/main.js'],
        },
        {
          id: 'F3',
          label: 'Tenere perf in explore — non alzare timeout E2E',
          effort: 'trivial',
          generalizes: false,
          files: ['tests/e2e/tony/perf/latency-budgets.json'],
        }
      );
      break;

    case 'T7_LLM_NONDETERMINISM':
      options.push(
        {
          id: 'G1',
          label: 'Assert strutturati: comandi, tier, gruppi — non frase esatta',
          effort: 'low',
          generalizes: true,
          files: ['tests/e2e/tony/fixtures/scenarios-matrix.json', 'tests/e2e/tony/helpers/assert-scenario-expect.mjs'],
        },
        {
          id: 'G3',
          label: 'Confermare scenario in mode explore (non gate PR)',
          effort: 'trivial',
          generalizes: true,
          files: ['tests/e2e/tony/fixtures/scenarios-matrix.json'],
        }
      );
      break;

    case 'T8_TEST_HARNESS_FRAGILE':
      options.push(
        {
          id: 'H1',
          label: 'Riscrivere assert su invarianti (comandi, stato DOM, riga tabella)',
          effort: 'medium',
          generalizes: true,
          files: ['tests/e2e/tony/fixtures/scenarios-matrix.json', 'tests/e2e/tony/helpers/assert-scenario-expect.mjs'],
        },
        {
          id: 'H2',
          label: 'Spostare scenario in mode explore',
          effort: 'trivial',
          generalizes: true,
          files: ['tests/e2e/tony/fixtures/scenarios-matrix.json'],
        },
        {
          id: 'H4',
          label: 'Non modificare prodotto — refactor test',
          effort: 'low',
          generalizes: true,
          files: [],
        }
      );
      break;

    default:
      break;
  }

  return options;
}

/**
 * @param {FailureClass} classification
 * @param {Array<object>} options
 * @returns {{ recommended: string[], avoid: string[] }}
 */
export function recommendOptions(classification, options) {
  const ids = options.map((o) => o.id);

  switch (classification) {
    case 'T2_INTERCEPT_MISS':
      return {
        recommended: ids.filter((id) => ['B1', 'B3'].includes(id)),
        avoid: ['B4 senza B1/B3'],
      };
    case 'T3_PARSER_RECOVERY_GAP':
      return { recommended: ids.filter((id) => ['C1', 'C2'].includes(id)), avoid: ['C4 su tier 2'] };
    case 'T7_LLM_NONDETERMINISM':
      return { recommended: ids.filter((id) => ['G1', 'G3'].includes(id)), avoid: ['Fix prompt Tony senza G1'] };
    case 'T8_TEST_HARNESS_FRAGILE':
      return { recommended: ids.filter((id) => ['H1', 'H4'].includes(id)), avoid: ['D1 senza verifica contratto'] };
    case 'T1_SEED_INADEQUATE':
      return { recommended: ids.filter((id) => ['A1', 'A4'].includes(id)), avoid: ['Patch assert senza seed'] };
    default:
      return {
        recommended: options.filter((o) => o.generalizes).map((o) => o.id),
        avoid: options.filter((o) => !o.generalizes).map((o) => `${o.id} (patch isolata)`),
      };
  }
}

/**
 * @param {object} params
 * @returns {object}
 */
export function buildFinding({ scenario, error, observed }) {
  const hints = parseFailureError(error);
  const { classification, confidence, likelyCause } = classifyFailure({
    error,
    scenario,
    observed,
    hints,
  });
  const options = buildFixOptions(classification, scenario, observed);
  const { recommended, avoid } = recommendOptions(classification, options);
  const contract = scenario.contract || {};

  return {
    scenarioId: scenario.id,
    scenarioMode: resolveScenarioMode(scenario),
    tier: scenario.tier,
    category: scenario.category,
    classification,
    classificationLabel: FAILURE_LABELS[classification],
    confidence,
    invariant: contract.invariant || null,
    likelyCause,
    observed,
    errorHints: hints,
    options,
    recommended,
    avoid,
    patchIsolatedRisk:
      recommended.length === 0 || (options.length > 0 && recommended.length < options.filter((o) => o.generalizes).length),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
export function buildDiagnosticReport({
  runMode,
  binario = 'C-tony-e2e',
  isLiveMode,
  results,
  findings,
}) {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  /** @type {Record<string, number>} */
  const improvementSignals = {
    seedInadequateCount: 0,
    interceptMissCount: 0,
    parserRecoveryGapCount: 0,
    productRegressionCount: 0,
    formMappingDriftCount: 0,
    perfBudgetExceededCount: 0,
    llmNondeterminismCount: 0,
    testHarnessFragileCount: 0,
    patchIsolatedRiskCount: 0,
  };

  for (const f of findings) {
    switch (f.classification) {
      case 'T1_SEED_INADEQUATE':
        improvementSignals.seedInadequateCount += 1;
        break;
      case 'T2_INTERCEPT_MISS':
        improvementSignals.interceptMissCount += 1;
        break;
      case 'T3_PARSER_RECOVERY_GAP':
        improvementSignals.parserRecoveryGapCount += 1;
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
      case 'T7_LLM_NONDETERMINISM':
        improvementSignals.llmNondeterminismCount += 1;
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
    binario,
    isLiveMode: !!isLiveMode,
    summary: {
      total: results.length,
      passed,
      failed,
      findings: findings.length,
    },
    improvementSignals,
    findings,
    scenarios: results,
  };
}

/**
 * @param {object} report
 */
export function printDiagnosticSummary(report) {
  const { summary, runMode, findings, improvementSignals } = report;
  console.log(`\n=== Tony E2E Diagnostic Report (mode: ${runMode}) ===`);
  console.log(
    `${summary.passed}/${summary.total} passed | ${summary.failed} failed | ${summary.findings} findings`
  );

  if (findings.length === 0) {
    console.log('Nessun finding — tutti gli scenari rispettano i contratti.\n');
    return;
  }

  console.log('\nSegnali miglioramento:');
  const signalLines = Object.entries(improvementSignals).filter(([, n]) => n > 0);
  if (signalLines.length) {
    for (const [key, count] of signalLines) {
      console.log(`  • ${key}: ${count}`);
    }
  } else {
    console.log('  (nessuno)');
  }

  console.log('\n--- Findings ---\n');
  for (const f of findings) {
    console.log(`[${f.scenarioId}] ${f.classification} — ${f.classificationLabel} (${f.confidence})`);
    if (f.invariant) console.log(`  Contratto: ${f.invariant}`);
    console.log(`  Causa probabile: ${f.likelyCause}`);
    if (f.observed?.message) console.log(`  Messaggio: "${f.observed.message}"`);
    if (f.observed?.perf) {
      const p = f.observed.perf;
      console.log(
        `  Perf: latency=${p.latencyMs ?? 'n/a'}ms usedGemini=${p.usedGemini} cfCalled=${p.cfCalled} localIntercept=${p.localIntercept}`
      );
    }
    if (f.observed?.commands?.length) {
      console.log(`  Comandi: ${f.observed.commands.join(', ')}`);
    }
    if (f.recommended?.length) {
      console.log(`  → Raccomandato: ${f.recommended.join(', ')}`);
      for (const optId of f.recommended) {
        const opt = f.options.find((o) => o.id === optId);
        if (opt) console.log(`      ${opt.id}: ${opt.label}`);
      }
    }
    if (f.avoid?.length) {
      console.log(`  ⚠ Evitare: ${f.avoid.join('; ')}`);
    }
    if (f.patchIsolatedRisk) {
      console.log('  ⚠ Rischio patch isolata — preferire opzione con generalizes:true + Vitest');
    }
    console.log('');
  }

  console.log('Workflow: classificazione → opzioni → decisione umana → fix + Vitest se T2/T3/T4\n');
}
