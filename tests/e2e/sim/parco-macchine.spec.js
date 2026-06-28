import { test, expect } from '@playwright/test';
import {
  gotoAttrezziList,
  gotoFlottaList,
  gotoTrattoriList,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runAttrezziListAssertions,
  runFlottaListAssertions,
  runTrattoriListAssertions,
} from './scenarios/parco-macchine.mjs';

test.describe('GFV Farm Simulator v4 — parco macchine liste', () => {
  test('pagina dev → trattori, attrezzi e flotta seed', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoTrattoriList(page);
    await runTrattoriListAssertions(page, expect);
    await gotoAttrezziList(page);
    await runAttrezziListAssertions(page, expect);
    await gotoFlottaList(page);
    await runFlottaListAssertions(page, expect);
  });
});
