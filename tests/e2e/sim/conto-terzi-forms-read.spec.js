import { test, expect } from '@playwright/test';
import { gotoNuovoPreventivo, loginAsManagerContoTerzi } from './helpers/sim-login.js';
import { runNuovoPreventivoReadAssertions } from './scenarios/conto-terzi-forms-read.mjs';

test.describe('GFV Farm Simulator — conto terzi forms read', () => {
  test('login conto terzi → nuovo preventivo (form)', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoNuovoPreventivo(page);
    await runNuovoPreventivoReadAssertions(page, expect);
  });
});
