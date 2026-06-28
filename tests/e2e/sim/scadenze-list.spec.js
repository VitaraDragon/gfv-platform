/**
 * GFV Farm Simulator v4 — scenario 2: parco macchine → lista scadenze urgenti.
 * Dati seed validati da v3 (sim:inspect, seed-parco-macchine-details); assert DOM visibile.
 */
import { test, expect } from '@playwright/test';
import { gotoScadenzeList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runScadenzeListAssertions } from './scenarios/scadenze-list.mjs';

test.describe('GFV Farm Simulator v4 — scadenze parco macchine', () => {
  test('pagina dev → scadenze-list con semafori black/red/yellow', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoScadenzeList(page);
    await runScadenzeListAssertions(page, expect);
  });
});
