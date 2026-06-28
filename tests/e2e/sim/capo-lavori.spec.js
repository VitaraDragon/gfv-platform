import { test, expect } from '@playwright/test';
import { gotoLavoriCaposquadra, loginAsCapoFromDevPage } from './helpers/sim-login.js';
import { runLavoriCaposquadraAssertions } from './scenarios/capo-lavori.mjs';

test.describe('GFV Farm Simulator — capo lavori desktop', () => {
  test('pagina dev (capo) → I miei lavori assegnati', async ({ page }) => {
    await loginAsCapoFromDevPage(page);
    await gotoLavoriCaposquadra(page);
    await runLavoriCaposquadraAssertions(page, expect);
  });
});
