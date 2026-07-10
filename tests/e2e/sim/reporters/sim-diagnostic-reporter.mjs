/**
 * Playwright reporter — report diagnostico T1–T8 per E2E app sim.
 * @module tests/e2e/sim/reporters/sim-diagnostic-reporter
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSimDiagnosticReport,
  buildSimFinding,
  printSimDiagnosticSummary,
} from '../helpers/sim-e2e-diagnostic.mjs';
import { buildScenarioMetaFromSpec } from '../helpers/sim-e2e-scenario-meta.mjs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

class SimDiagnosticReporter {
  constructor(options = {}) {
    this.runMode = process.env.GFV_E2E_MODE || options.runMode || 'gate';
    this.strict =
      process.argv.includes('--strict') ||
      process.env.GFV_E2E_STRICT === '1' ||
      process.env.GFV_E2E_STRICT === 'true' ||
      this.runMode === 'gate';
    this.outputPath =
      process.env.GFV_E2E_DIAGNOSTIC ||
      join(rootDir, 'test-results', 'sim-e2e-diagnostic-report.json');
    /** @type {Array<object>} */
    this.results = [];
    /** @type {Array<object>} */
    this.findings = [];
    this._shouldFail = false;
  }

  /**
   * @param {import('@playwright/test/reporter').TestCase} test
   * @param {import('@playwright/test/reporter').TestResult} result
   */
  onTestEnd(test, result) {
    const specFile = test.location.file.replace(/\\/g, '/');
    const basename = specFile.split('/').pop() || '';
    const scenario = buildScenarioMetaFromSpec(basename);
    const passed = result.status === 'passed' || result.status === 'skipped';

    /** @type {object} */
    const row = {
      id: scenario.id,
      specFile: scenario.specFile,
      mode: scenario.mode,
      category: scenario.category,
      passed,
      durationMs: result.duration,
      status: result.status,
    };

    if (!passed && result.status !== 'skipped') {
      const err = result.error || new Error(`status ${result.status}`);
      const observed = {
        url: '',
        errorMessage: err.message || String(err),
        attachments: (result.attachments || []).map((a) => a.name),
      };
      const finding = buildSimFinding({ scenario, error: err, observed });
      this.findings.push(finding);
      row.classification = finding.classification;
      row.error = err.message || String(err);
      if (this.runMode === 'gate' || this.strict) {
        this._shouldFail = true;
      }
    }

    this.results.push(row);
  }

  async onEnd() {
    const report = buildSimDiagnosticReport({
      runMode: this.runMode,
      results: this.results,
      findings: this.findings,
      strict: this.strict,
    });

    await mkdir(dirname(this.outputPath), { recursive: true });
    await writeFile(this.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`[sim:e2e] diagnostic → ${this.outputPath}`);
    printSimDiagnosticSummary(report);

    if (this.findings.length && this.runMode === 'explore' && !this.strict) {
      console.warn(
        `[sim:e2e] explore: ${this.findings.length} finding(s) — exit 0 (usa --strict o mode=gate per bloccare)`
      );
    }
  }

  printsToStdio() {
    return true;
  }
}

export default SimDiagnosticReporter;
