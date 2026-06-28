import { test, expect } from '@playwright/test';
import { gotoVignetiList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runVignetiListAssertions } from './scenarios/vigneti.mjs';

test.describe('GFV Farm Simulator v4 — anagrafica vigneti', () => {
  test('pagina dev → lista vigneti seed', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoVignetiList(page);
    await runVignetiListAssertions(page, expect);
  });
});
