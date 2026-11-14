/**
 * Letture frutteto in un solo login: dashboard, anagrafica e operazioni seed.
 */
import { test, expect } from './helpers/gfv-test.js';
import {
  gotoFruttetiList,
  gotoFruttetoConcimazioniList,
  gotoFruttetoDashboard,
  gotoFruttetoPotaturaList,
  gotoFruttetoTrattamentiList,
  gotoRaccoltaFrutta,
  loginAsManagerFrutteto,
} from './helpers/sim-login.js';
import { runFruttetoDashboardAssertions } from './scenarios/frutteto-hub.mjs';
import { runFruttetiListAssertions } from './scenarios/frutteti.mjs';
import {
  runFruttetoConcimazioniListAssertions,
  runFruttetoPotaturaListAssertions,
  runFruttetoTrattamentiListAssertions,
  runRaccoltaFruttaReadAssertions,
} from './scenarios/frutteto.mjs';

test.describe('GFV Farm Simulator — letture frutteto', () => {
  test('un login: dashboard, anagrafica, potature, trattamenti, concimazioni, raccolta', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerFrutteto(page);
    await gotoFruttetoDashboard(page);
    await runFruttetoDashboardAssertions(page, expect);
    await gotoFruttetiList(page);
    await runFruttetiListAssertions(page, expect);
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
