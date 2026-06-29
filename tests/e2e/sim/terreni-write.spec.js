/**
 * GFV Farm Simulator v5 — scenario write: nuovo terreno azienda.
 */
import { test, expect } from '@playwright/test';
import { gotoTerreniList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runTerreniWriteAssertions } from './scenarios/terreni-write.mjs';

test.describe('GFV Farm Simulator v5 — write terreno', () => {
  test('manager → modale → salva → riga in lista terreni', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoTerreniList(page);
    await runTerreniWriteAssertions(page, expect);
  });
});
