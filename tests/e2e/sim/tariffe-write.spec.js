/**
 * GFV Farm Simulator v5 — scenario write: nuova tariffa conto terzi.
 */
import { test, expect } from '@playwright/test';
import { gotoTariffeList, loginAsManagerContoTerzi } from './helpers/sim-login.js';
import { runTariffeWriteAssertions } from './scenarios/tariffe-write.mjs';

test.describe('GFV Farm Simulator v5 — write tariffa conto terzi', () => {
  test('manager → modale → salva → riga in tabella (marker base 777 €/ha)', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoTariffeList(page);
    await runTariffeWriteAssertions(page, expect);
  });
});
