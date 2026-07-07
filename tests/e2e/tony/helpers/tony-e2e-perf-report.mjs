/**
 * Aggregazione metriche Tony E2E live (p50/p95, quickReplyHit, fallimenti per categoria).
 * @module tests/e2e/tony/helpers/tony-e2e-perf-report
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * @param {number[]} values
 * @returns {number|null}
 */
function percentile(values, p) {
  const sorted = values.filter((v) => typeof v === 'number' && v >= 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * @param {Array<{ id: string, category?: string, passed: boolean, latencyMs?: number, usedGemini?: boolean|null, error?: string }>} results
 * @param {object} [budgets]
 * @returns {object}
 */
export function buildTonyE2ePerfReport(results, budgets = {}) {
  const byCategory = {};
  const latencies = [];
  let quickReplyHits = 0;
  let quickReplyEligible = 0;
  const failures = [];

  for (const row of results) {
    const cat = row.category || 'unknown';
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, passed: 0, latencies: [] };
    }
    byCategory[cat].count += 1;
    if (row.passed) byCategory[cat].passed += 1;
    if (typeof row.latencyMs === 'number' && row.latencyMs >= 0) {
      byCategory[cat].latencies.push(row.latencyMs);
      latencies.push(row.latencyMs);
    }
    if (row.passed) {
      quickReplyEligible += 1;
      const budget =
        budgets.byCategory?.[cat]?.liveLatencyMsMax ??
        budgets.defaults?.liveQuickReplyMsMax ??
        3000;
      const mockQuick = row.usedGemini === false;
      const liveWithinBudget =
        typeof row.latencyMs === 'number' && row.latencyMs >= 0 && row.latencyMs <= budget;
      if (mockQuick || liveWithinBudget) quickReplyHits += 1;
    }
    if (!row.passed) {
      failures.push({
        id: row.id,
        category: cat,
        error: row.error || 'assert failed',
      });
    }
  }

  const categoryStats = {};
  for (const [cat, data] of Object.entries(byCategory)) {
    const budget =
      budgets.byCategory?.[cat]?.liveLatencyMsMax ??
      budgets.byCategory?.[cat]?.latencyMsMax ??
      budgets.defaults?.liveQuickReplyMsMax ??
      null;
    categoryStats[cat] = {
      count: data.count,
      passed: data.passed,
      p50LatencyMs: percentile(data.latencies, 50),
      p95LatencyMs: percentile(data.latencies, 95),
      budgetMsMax: budget,
      p95OverBudget:
        budget != null && percentile(data.latencies, 95) != null
          ? percentile(data.latencies, 95) > budget
          : null,
    };
  }

  const quickReplyHitPct =
    quickReplyEligible > 0 ? Math.round((quickReplyHits / quickReplyEligible) * 100) : null;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'live',
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: failures.length,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      quickReplyHitPct,
      quickReplyEligible,
    },
    byCategory: categoryStats,
    failures,
    scenarios: results,
  };
}

/**
 * @param {object|null|undefined} history
 * @returns {number}
 */
function countConsecutiveBreachesFromEnd(history) {
  const runs = history && Array.isArray(history.runs) ? history.runs : [];
  let n = 0;
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    if (runs[i].breach) n += 1;
    else break;
  }
  return n;
}

/**
 * @param {string} historyPath
 * @returns {Promise<object>}
 */
export async function loadTonyE2eP95GateHistory(historyPath) {
  try {
    const raw = await readFile(historyPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.runs)) return parsed;
  } catch (e) { /* ignore */ }
  return { schemaVersion: 1, runs: [] };
}

/**
 * @param {string} historyPath
 * @param {object} entry
 * @param {number} [maxRuns]
 */
export async function appendTonyE2eP95GateHistory(historyPath, entry, maxRuns = 30) {
  const history = await loadTonyE2eP95GateHistory(historyPath);
  history.runs.push(entry);
  if (history.runs.length > maxRuns) {
    history.runs = history.runs.slice(-maxRuns);
  }
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  return history;
}

/**
 * @param {object} report
 * @param {object} [budgets]
 * @param {object|null} [priorHistory] history prima del run corrente
 * @returns {{ ok: boolean, reasons: string[], breach: boolean, consecutiveBreaches: number, streakThreshold: number, warnOnly: boolean }}
 */
export function evaluateTonyE2ePerfGate(report, budgets = {}, priorHistory = null) {
  const reasons = [];
  const gate = budgets.p95Gate;
  if (!gate?.enabled) {
    return {
      ok: true,
      reasons,
      breach: false,
      consecutiveBreaches: 0,
      streakThreshold: gate?.consecutiveRunsToFail ?? 3,
      warnOnly: false,
    };
  }

  for (const [cat, limit] of Object.entries(gate.categories || {})) {
    const stats = report.byCategory?.[cat];
    if (!stats || stats.p95LatencyMs == null) continue;
    if (stats.p95LatencyMs > limit) {
      reasons.push(`p95 ${cat}=${stats.p95LatencyMs}ms > soglia ${limit}ms`);
    }
  }

  const breach = reasons.length > 0;
  const streakThreshold = gate.consecutiveRunsToFail ?? 3;
  const priorConsecutive = countConsecutiveBreachesFromEnd(priorHistory);
  const consecutiveBreaches = breach ? priorConsecutive + 1 : 0;
  const warnOnly = breach && consecutiveBreaches < streakThreshold;
  const ok = !breach || warnOnly;

  return {
    ok,
    reasons,
    breach,
    consecutiveBreaches,
    streakThreshold,
    warnOnly,
  };
}
