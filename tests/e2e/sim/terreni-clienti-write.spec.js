/**
 * GFV Farm Simulator v5 — scenario write: nuovo terreno cliente conto terzi.
 */
import { test, expect } from '@playwright/test';
import { gotoTerreniClientiList, loginAsManagerContoTerzi } from './helpers/sim-login.js';
import { runTerreniClientiWriteAssertions } from './scenarios/terreni-clienti-write.mjs';

test.describe('GFV Farm Simulator v5 — write terreno cliente CT', () => {
  test('manager CT → modale → salva → card terreno con marker', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoTerreniClientiList(page);
    await runTerreniClientiWriteAssertions(page, expect);
  });
});
