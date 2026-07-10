#!/usr/bin/env node
/**
 * Unifica report diagnostici app + Tony in un unico artefatto per review/Cursor.
 * @module scripts/sim-diagnostic-merge
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const appPath = join(rootDir, 'test-results', 'sim-e2e-diagnostic-report.json');
const tonyPath = join(rootDir, 'test-results', 'tony-e2e-diagnostic-report.json');
const outPath =
  process.env.GFV_DIAGNOSTIC_MERGED ||
  join(rootDir, 'test-results', 'diagnostic-merged-report.json');

/**
 * @param {string} path
 */
async function readReport(path) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {object|null} report
 * @param {string} binario
 */
function flattenFindings(report, binario) {
  if (!report || !Array.isArray(report.findings)) return [];
  return report.findings.map((f) => ({
    binario,
    scenarioId: f.scenarioId,
    classification: f.classification,
    classificationLabel: f.classificationLabel,
    confidence: f.confidence,
    invariant: f.invariant,
    likelyCause: f.likelyCause,
    recommended: f.recommended,
    avoid: f.avoid,
    patchIsolatedRisk: f.patchIsolatedRisk,
    requiresSeedProfile: f.requiresSeedProfile || null,
  }));
}

function printMergedSummary(merged) {
  const { summary, findings, improvementSignals } = merged;
  console.log('\n=== Diagnostic Merged Report ===');
  console.log(
    `App: ${summary.app.passed}/${summary.app.total} | Tony: ${summary.tony.passed}/${summary.tony.total} | Findings: ${summary.findingsTotal}`
  );

  if (!findings.length) {
    console.log('Nessun finding — pronto per gate/push.\n');
    return;
  }

  console.log('\nSegnali aggregati:');
  for (const [k, v] of Object.entries(improvementSignals)) {
    if (v > 0) console.log(`  • ${k}: ${v}`);
  }

  console.log('\nPriorità suggerita (fix prima di gate):');
  const priority = ['T4_PRODUCT_REGRESSION', 'T1_SEED_INADEQUATE', 'T2_INTERCEPT_MISS', 'T5_FORM_MAPPING_DRIFT', 'T3_PARSER_RECOVERY_GAP', 'T6_PERF_BUDGET_EXCEEDED', 'T8_TEST_HARNESS_FRAGILE', 'T7_LLM_NONDETERMINISM'];
  for (const cls of priority) {
    const group = findings.filter((f) => f.classification === cls);
    if (!group.length) continue;
    console.log(`\n  ${cls} (${group.length})`);
    for (const f of group) {
      console.log(`    [${f.binario}] ${f.scenarioId}: ${f.likelyCause}`);
      if (f.recommended?.length) console.log(`      → ${f.recommended.join(', ')}`);
    }
  }
  console.log(`\nReport completo: ${outPath}\n`);
}

async function main() {
  const app = await readReport(appPath);
  const tony = await readReport(tonyPath);

  if (!app && !tony) {
    console.error('[sim:diagnostic:merge] Nessun report trovato. Esegui prima sim:diagnostic:explore o i singoli explore.');
    process.exit(1);
  }

  const appFindings = flattenFindings(app, 'B-app-e2e');
  const tonyFindings = flattenFindings(tony, 'C-tony-e2e');
  const findings = [...appFindings, ...tonyFindings];

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

  const merged = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: {
      app: app ? appPath : null,
      tony: tony ? tonyPath : null,
    },
    summary: {
      app: {
        total: app?.summary?.total ?? 0,
        passed: app?.summary?.passed ?? 0,
        failed: app?.summary?.failed ?? 0,
        runMode: app?.runMode ?? null,
      },
      tony: {
        total: tony?.summary?.total ?? 0,
        passed: tony?.summary?.passed ?? 0,
        failed: tony?.summary?.failed ?? 0,
        runMode: tony?.runMode ?? null,
      },
      findingsTotal: findings.length,
    },
    improvementSignals,
    findings,
    workflow: [
      '1. Leggere findings per classification',
      '2. Applicare recommended (generalizes:true) + Vitest',
      '3. Evitare patch isolate segnalate',
      '4. Rilanciare sim:diagnostic:explore',
      '5. Gate: sim:diagnostic:gate prima del push',
    ],
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  printMergedSummary(merged);
}

main().catch((err) => {
  console.error('[sim:diagnostic:merge]', err.message || err);
  process.exit(1);
});
