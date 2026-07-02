import { test, expect } from '@playwright/test';
import { gotoFruttetiList, loginAsManagerFrutteto } from './helpers/sim-login.js';
import { runFruttetiListAssertions } from './scenarios/frutteti.mjs';

test.describe('GFV Farm Simulator M4 — anagrafica frutteti', () => {
  test('lista frutteti seed (4)', async ({ page }) => {
    await loginAsManagerFrutteto(page);
    await gotoFruttetiList(page);
    await runFruttetiListAssertions(page, expect);
  });
});
