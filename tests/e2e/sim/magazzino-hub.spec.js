/**
 * Letture magazzino in un solo login: home, movimenti, prodotti, tracciabilità.
 */
import { test, expect } from './helpers/gfv-test.js';
import {
  gotoMagazzinoHome,
  gotoMovimentiList,
  gotoProdottiList,
  gotoTracciabilitaConsumi,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runMagazzinoHomeAssertions,
  runTracciabilitaConsumiAssertions,
} from './scenarios/magazzino-hub.mjs';
import { runMovimentiAssertions } from './scenarios/movimenti.mjs';
import { runProdottiListAssertions } from './scenarios/prodotti.mjs';

test.describe('GFV Farm Simulator — letture magazzino', () => {
  test('un login: home, movimenti, prodotti, tracciabilità consumi', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerFromDevPage(page);
    await gotoMagazzinoHome(page);
    await runMagazzinoHomeAssertions(page, expect);
    await gotoMovimentiList(page);
    await runMovimentiAssertions(page, expect);
    await gotoProdottiList(page);
    await runProdottiListAssertions(page, expect);
    await gotoTracciabilitaConsumi(page);
    await runTracciabilitaConsumiAssertions(page, expect);
  });
});
