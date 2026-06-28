import { test, expect } from '@playwright/test';
import {
  gotoMagazzinoHome,
  gotoTracciabilitaConsumi,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runMagazzinoHomeAssertions,
  runTracciabilitaConsumiAssertions,
} from './scenarios/magazzino-hub.mjs';

test.describe('GFV Farm Simulator — hub magazzino', () => {
  test('pagina dev → home magazzino + tracciabilità consumi', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoMagazzinoHome(page);
    await runMagazzinoHomeAssertions(page, expect);
    await gotoTracciabilitaConsumi(page);
    await runTracciabilitaConsumiAssertions(page, expect);
  });
});
