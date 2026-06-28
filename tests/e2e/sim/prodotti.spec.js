import { test, expect } from '@playwright/test';
import { gotoProdottiList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runProdottiListAssertions } from './scenarios/prodotti.mjs';

test.describe('GFV Farm Simulator v4 — prodotti magazzino', () => {
  test('pagina dev → anagrafica prodotti seed', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoProdottiList(page);
    await runProdottiListAssertions(page, expect);
  });
});
