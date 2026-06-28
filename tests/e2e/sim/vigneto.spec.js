/**
 * GFV Farm Simulator v4 — scenario 6: vigneto potature + trattamenti/concimazioni.
 * Dati seed validati da orchestrator v3; assert DOM visibile.
 */
import { test } from '@playwright/test';
import {
  gotoConcimazioniList,
  gotoPotaturaList,
  gotoTrattamentiList,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runConcimazioniListAssertions,
  runPotaturaListAssertions,
  runTrattamentiListAssertions,
} from './scenarios/vigneto.mjs';

test.describe('GFV Farm Simulator v4 — vigneto potature e trattamenti', () => {
  test('pagina dev → potature (4) + trattamenti (8) + concimazioni (4) seed', async ({
    page,
    expect,
  }) => {
    await loginAsManagerFromDevPage(page);
    await gotoPotaturaList(page);
    await runPotaturaListAssertions(page, expect);
    await gotoTrattamentiList(page);
    await runTrattamentiListAssertions(page, expect);
    await gotoConcimazioniList(page);
    await runConcimazioniListAssertions(page, expect);
  });
});
