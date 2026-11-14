import { test, expect } from './helpers/gfv-test.js';
import { gotoVignetoDashboard, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runVignetoDashboardAssertions } from './scenarios/vigneto-hub.mjs';

test.describe('GFV Farm Simulator — hub vigneto', () => {
  test('pagina dev → dashboard vigneto con KPI seed', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoVignetoDashboard(page);
    await runVignetoDashboardAssertions(page, expect);
  });
});
