/**
 * Letture parco macchine in un solo login.
 */
import { test, expect } from './helpers/gfv-test.js';
import {
  gotoAttrezziList,
  gotoFlottaList,
  gotoGestioneMacchine,
  gotoGuastiList,
  gotoMacchineDashboard,
  gotoScadenzeList,
  gotoTrattoriList,
  loginAsManagerManodopera,
} from './helpers/sim-login.js';
import {
  runGuastiListAssertions,
  runMacchineDashboardAssertions,
} from './scenarios/macchine-hub.mjs';
import { runGestioneMacchineAssertions } from './scenarios/macchine-admin-read.mjs';
import {
  runAttrezziListAssertions,
  runFlottaListAssertions,
  runTrattoriListAssertions,
} from './scenarios/parco-macchine.mjs';
import { runScadenzeListAssertions } from './scenarios/scadenze-list.mjs';

test.describe('GFV Farm Simulator — letture parco macchine', () => {
  test('un login: dashboard, officina, gestione, trattori, attrezzi, flotta, scadenze', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerManodopera(page);
    await gotoMacchineDashboard(page);
    await runMacchineDashboardAssertions(page, expect);
    await gotoGuastiList(page);
    await runGuastiListAssertions(page, expect);
    await gotoGestioneMacchine(page);
    await runGestioneMacchineAssertions(page, expect);
    await gotoTrattoriList(page);
    await runTrattoriListAssertions(page, expect);
    await gotoAttrezziList(page);
    await runAttrezziListAssertions(page, expect);
    await gotoFlottaList(page);
    await runFlottaListAssertions(page, expect);
    await gotoScadenzeList(page);
    await runScadenzeListAssertions(page, expect);
  });
});
