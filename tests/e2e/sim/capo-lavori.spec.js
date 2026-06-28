import { test, expect } from '@playwright/test';
import { loginAsCapoForLavoriDesktop } from './helpers/sim-login.js';
import { runLavoriCaposquadraAssertions } from './scenarios/capo-lavori.mjs';

test.describe('GFV Farm Simulator — capo lavori desktop', () => {
  test('pagina dev (capo) → I miei lavori assegnati', async ({ page }) => {
    await loginAsCapoForLavoriDesktop(page);
    await runLavoriCaposquadraAssertions(page, expect);
  });
});
