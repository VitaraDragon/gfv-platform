import { test, expect } from './helpers/gfv-test.js';
import { gotoFruttetoDashboard, loginAsManagerFrutteto } from './helpers/sim-login.js';
import { runFruttetoDashboardAssertions } from './scenarios/frutteto-hub.mjs';

test.describe('GFV Farm Simulator M4 — dashboard frutteto', () => {
  test('dashboard frutteto con KPI seed', async ({ page }) => {
    await loginAsManagerFrutteto(page);
    await gotoFruttetoDashboard(page);
    await runFruttetoDashboardAssertions(page, expect);
  });
});
