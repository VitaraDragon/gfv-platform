/**
 * GFV Farm Simulator v4 — primo scenario E2E: login dev → dashboard widget scadenze.
 * Dati seed validati da v3 (sim:inspect, cascade-v3-live-smoke); qui solo assert DOM visibile.
 */
import { test } from '@playwright/test';
import { loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runDashboardDeadlinesAssertions } from './scenarios/dashboard-deadlines.mjs';

test.describe('GFV Farm Simulator v4 — dashboard scadenze', () => {
  test('pagina dev → Entra manager → widget affitti e in arrivo', async ({ page, expect }) => {
    await loginAsManagerFromDevPage(page);
    await runDashboardDeadlinesAssertions(page, expect);
  });
});
