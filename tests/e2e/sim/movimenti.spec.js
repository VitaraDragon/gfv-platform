/**
 * GFV Farm Simulator v4 — scenario 5: movimenti magazzino tracciabilità.
 * Dati seed validati da orchestrator v3; assert DOM visibile.
 */
import { test, expect } from '@playwright/test';
import { gotoMovimentiList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runMovimentiAssertions } from './scenarios/movimenti.mjs';

test.describe('GFV Farm Simulator v4 — movimenti magazzino', () => {
  test('pagina dev → lista uscite con tracciabilità attività', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoMovimentiList(page);
    await runMovimentiAssertions(page, expect);
  });
});
