/**
 * GFV Farm Simulator v5 — scenario write: nuovo prodotto magazzino.
 */
import { test, expect } from '@playwright/test';
import { gotoProdottiList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runProdottiWriteAssertions } from './scenarios/prodotti-write.mjs';

test.describe('GFV Farm Simulator v5 — write prodotto magazzino', () => {
  test('manager → modale → salva → riga in tabella (marker codice)', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoProdottiList(page);
    await runProdottiWriteAssertions(page, expect);
  });
});
