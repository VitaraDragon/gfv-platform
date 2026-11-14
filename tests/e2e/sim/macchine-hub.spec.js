import { test, expect } from './helpers/gfv-test.js';
import {
  gotoGuastiList,
  gotoMacchineDashboard,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runGuastiListAssertions,
  runMacchineDashboardAssertions,
} from './scenarios/macchine-hub.mjs';

test.describe('GFV Farm Simulator — hub parco macchine', () => {
  test('pagina dev → dashboard macchine + officina guasti', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoMacchineDashboard(page);
    await runMacchineDashboardAssertions(page, expect);
    await gotoGuastiList(page);
    await runGuastiListAssertions(page, expect);
  });
});
