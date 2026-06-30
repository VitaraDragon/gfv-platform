import { test, expect } from '@playwright/test';
import {
  gotoMappaAziendale,
  gotoStatisticheCore,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runMappaAziendaleAssertions,
  runStatisticheCoreAssertions,
} from './scenarios/core-analytics-read.mjs';

test.describe('GFV Farm Simulator — core analytics read', () => {
  test('pagina dev → mappa aziendale + statistiche core', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoMappaAziendale(page);
    await runMappaAziendaleAssertions(page, expect);
    await gotoStatisticheCore(page);
    await runStatisticheCoreAssertions(page, expect);
  });
});
