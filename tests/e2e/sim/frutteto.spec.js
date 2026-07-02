/**
 * GFV Farm Simulator M4 — frutteto potature + trattamenti + concimazioni + raccolta read.
 */
import { test, expect } from '@playwright/test';
import {
  gotoFruttetoConcimazioniList,
  gotoFruttetoPotaturaList,
  gotoFruttetoTrattamentiList,
  gotoRaccoltaFrutta,
  loginAsManagerFrutteto,
} from './helpers/sim-login.js';
import {
  runFruttetoConcimazioniListAssertions,
  runFruttetoPotaturaListAssertions,
  runFruttetoTrattamentiListAssertions,
  runRaccoltaFruttaReadAssertions,
} from './scenarios/frutteto.mjs';

test.describe('GFV Farm Simulator M4 — frutteto operativo read', () => {
  test('pagina dev → potature + trattamenti + concimazioni + raccolta stub seed', async ({ page }) => {
    await loginAsManagerFrutteto(page);
    await gotoFruttetoPotaturaList(page);
    await runFruttetoPotaturaListAssertions(page, expect);
    await gotoFruttetoTrattamentiList(page);
    await runFruttetoTrattamentiListAssertions(page, expect);
    await gotoFruttetoConcimazioniList(page);
    await runFruttetoConcimazioniListAssertions(page, expect);
    await gotoRaccoltaFrutta(page);
    await runRaccoltaFruttaReadAssertions(page, expect);
  });
});
