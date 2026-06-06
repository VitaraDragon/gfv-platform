/**
 * SLO performance dashboard — soglie canary e verifica riepilogo perf.
 * @module core/js/dashboard-perf-slo
 */

/** @type {Record<string, number>} ms */
export const DASHBOARD_PERF_SLO_MS = {
  summaryTotal: 3000,
  hubRefreshAttention: 500,
  countsLoadSnapshot: 2000,
  widgetsParallelBatch: 2000,
  countsOreDaValidareBackground: 500,
};

/**
 * @param {{ phases?: Array<{ name: string, ms: number, totalMs?: number }>, summaryMs?: number, totalMs?: number }|null|undefined} perf
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkDashboardPerfSlo(perf) {
  const violations = [];
  if (!perf) {
    violations.push('perf session missing');
    return { ok: false, violations };
  }

  const summaryMs =
    perf.summaryMs != null
      ? perf.summaryMs
      : perf.totalMs != null
        ? perf.totalMs
        : perf.phases && perf.phases.length
          ? perf.phases[perf.phases.length - 1].totalMs
          : null;

  if (summaryMs != null && summaryMs > DASHBOARD_PERF_SLO_MS.summaryTotal) {
    violations.push(`summaryTotal ${summaryMs}ms > ${DASHBOARD_PERF_SLO_MS.summaryTotal}ms`);
  }

  const phases = Array.isArray(perf.phases) ? perf.phases : [];
  for (const p of phases) {
    if (p.name === 'hub.refreshAttention' && p.ms > DASHBOARD_PERF_SLO_MS.hubRefreshAttention) {
      violations.push(`${p.name} ${p.ms}ms > ${DASHBOARD_PERF_SLO_MS.hubRefreshAttention}ms`);
    }
    if (p.name === 'counts.loadSnapshot' && p.ms > DASHBOARD_PERF_SLO_MS.countsLoadSnapshot) {
      violations.push(`${p.name} ${p.ms}ms > ${DASHBOARD_PERF_SLO_MS.countsLoadSnapshot}ms`);
    }
    if (p.name === 'widgets.parallelBatch' && p.ms > DASHBOARD_PERF_SLO_MS.widgetsParallelBatch) {
      violations.push(`${p.name} ${p.ms}ms > ${DASHBOARD_PERF_SLO_MS.widgetsParallelBatch}ms`);
    }
    if (
      p.name === 'counts.oreDaValidare' &&
      p.ms > DASHBOARD_PERF_SLO_MS.countsOreDaValidareBackground
    ) {
      violations.push(`${p.name} ${p.ms}ms > ${DASHBOARD_PERF_SLO_MS.countsOreDaValidareBackground}ms`);
    }
  }

  return { ok: violations.length === 0, violations };
}
