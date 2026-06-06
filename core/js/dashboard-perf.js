/**
 * Strumentazione tempi caricamento dashboard (console + window.__gfvDashboardPerf).
 * @module core/js/dashboard-perf
 */

function isLocalDevHost() {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch (e) {
    return false;
  }
}

/** @returns {boolean} */
export function isDashboardPerfEnabled() {
  try {
    if (typeof window !== 'undefined') {
      if (window.__gfvDashboardPerfForce === true) return true;
      if (window.location && window.location.search && /(?:\?|&)dashboardPerf=1(?:&|$)/.test(window.location.search)) {
        return true;
      }
      if (window.localStorage && window.localStorage.getItem('gfv_dashboard_perf') === '1') {
        return true;
      }
      if (window.localStorage && window.localStorage.getItem('gfv_dashboard_perf') === '0') {
        return false;
      }
    }
  } catch (e) {
    /* ignore */
  }
  return isLocalDevHost();
}

function isEnabled() {
  return isDashboardPerfEnabled();
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function ensureSession() {
  if (!window.__gfvDashboardPerf || !window.__gfvDashboardPerf.phases) {
    dashboardPerfBegin('dashboard');
  }
}

/**
 * Avvia una sessione di misura (es. all'ingresso auth dashboard).
 * @param {string} [sessionId]
 */
export function dashboardPerfBegin(sessionId) {
  if (!isEnabled()) return;
  window.__gfvDashboardPerf = {
    session: sessionId || 'dashboard',
    startedAt: new Date().toISOString(),
    t0: nowMs(),
    phases: [],
  };
  console.log('[Dashboard Perf] sessione avviata:', window.__gfvDashboardPerf.session);
}

/**
 * Registra una fase completata.
 * @param {string} name
 * @param {number} startedAt - performance.now() all'inizio fase
 * @param {object} [meta]
 */
export function dashboardPerfPhase(name, startedAt, meta) {
  if (!isEnabled()) return;
  ensureSession();
  const elapsed = Math.round(nowMs() - startedAt);
  const total = Math.round(nowMs() - window.__gfvDashboardPerf.t0);
  const entry = Object.assign({ name, ms: elapsed, totalMs: total }, meta || {});
  window.__gfvDashboardPerf.phases.push(entry);
  if (meta && Object.keys(meta).length) {
    console.log(`[Dashboard Perf] ${name}: ${elapsed} ms (totale ${total} ms)`, meta);
  } else {
    console.log(`[Dashboard Perf] ${name}: ${elapsed} ms (totale ${total} ms)`);
  }
}

/**
 * Wrapper async con misura automatica.
 * @template T
 * @param {string} name
 * @param {() => Promise<T>|T} fn
 * @param {object} [meta]
 * @returns {Promise<T>}
 */
export async function dashboardPerfAsync(name, fn, meta) {
  const t0 = nowMs();
  try {
    return await fn();
  } finally {
    dashboardPerfPhase(name, t0, meta);
  }
}

/**
 * Riepilogo tabellare in console.
 * @param {string} [label]
 */
export function dashboardPerfSummary(label) {
  if (!isEnabled() || !window.__gfvDashboardPerf) return;
  const phases = window.__gfvDashboardPerf.phases || [];
  const total = phases.length ? phases[phases.length - 1].totalMs : 0;
  window.__gfvDashboardPerf.summaryMs = total;
  console.log(`[Dashboard Perf] riepilogo${label ? ' — ' + label : ''} (totale ~${total} ms)`);
  if (console.table) {
    console.table(
      phases.map((p) => ({
        fase: p.name,
        ms: p.ms,
        totale_ms: p.totalMs,
        ...(p.detail != null ? { detail: p.detail } : {}),
      }))
    );
  }
  window.__gfvDashboardPerf.completedAt = new Date().toISOString();
  window.__gfvDashboardPerf.totalMs = total;
}
