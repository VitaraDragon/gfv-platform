import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_PERF_SLO_MS,
  checkDashboardPerfSlo,
} from '../core/js/dashboard-perf-slo.js';

describe('dashboard-perf-slo', () => {
  it('passa con canary post-Fase 4 (~861 ms)', () => {
    const perf = {
      summaryMs: 861,
      phases: [
        { name: 'counts.loadSnapshot', ms: 111, totalMs: 542 },
        { name: 'hub.refreshAttention', ms: 1, totalMs: 544 },
        { name: 'widgets.parallelBatch', ms: 319, totalMs: 861 },
        { name: 'counts.oreDaValidare', ms: 313, totalMs: 852 },
      ],
    };
    const { ok, violations } = checkDashboardPerfSlo(perf);
    expect(ok).toBe(true);
    expect(violations).toEqual([]);
  });

  it('fallisce se summary supera SLO', () => {
    const { ok, violations } = checkDashboardPerfSlo({
      summaryMs: 4500,
      phases: [],
    });
    expect(ok).toBe(false);
    expect(violations.some((v) => v.includes('summaryTotal'))).toBe(true);
  });

  it('fallisce se hub.refreshAttention supera SLO', () => {
    const { ok, violations } = checkDashboardPerfSlo({
      summaryMs: 900,
      phases: [{ name: 'hub.refreshAttention', ms: 800, totalMs: 900 }],
    });
    expect(ok).toBe(false);
    expect(violations.some((v) => v.includes('hub.refreshAttention'))).toBe(true);
  });

  it('esporta soglie documentate nel piano', () => {
    expect(DASHBOARD_PERF_SLO_MS.summaryTotal).toBe(3000);
    expect(DASHBOARD_PERF_SLO_MS.hubRefreshAttention).toBe(500);
  });
});

describe('isDashboardPerfEnabled (prod default off)', () => {
  it('disattivato in prod senza flag', async () => {
    const { isDashboardPerfEnabled } = await import('../core/js/dashboard-perf.js');
    const prev = global.window;
    global.window = {
      location: { hostname: 'app.example.com', search: '' },
      localStorage: { getItem: () => null },
    };
    expect(isDashboardPerfEnabled()).toBe(false);
    global.window = prev;
  });

  it('attivo su localhost', async () => {
    const { isDashboardPerfEnabled } = await import('../core/js/dashboard-perf.js');
    const prev = global.window;
    global.window = {
      location: { hostname: 'localhost', search: '' },
      localStorage: { getItem: () => null },
    };
    expect(isDashboardPerfEnabled()).toBe(true);
    global.window = prev;
  });

  it('forzabile con dashboardPerf=1 in prod', async () => {
    const { isDashboardPerfEnabled } = await import('../core/js/dashboard-perf.js');
    const prev = global.window;
    global.window = {
      location: { hostname: 'app.example.com', search: '?dashboardPerf=1' },
      localStorage: { getItem: () => null },
    };
    expect(isDashboardPerfEnabled()).toBe(true);
    global.window = prev;
  });
});
