/**
 * Letture conto terzi in un solo login.
 */
import { test, expect } from './helpers/gfv-test.js';
import {
  gotoClientiList,
  gotoContoTerziHome,
  gotoMappaClienti,
  gotoNuovoPreventivo,
  gotoPreventiviList,
  gotoTariffeList,
  gotoTerreniClientiList,
  loginAsManagerContoTerzi,
} from './helpers/sim-login.js';
import {
  runClientiListAssertions,
  runPreventiviListAssertions,
  runTariffeListAssertions,
  runTerreniClientiAssertions,
} from './scenarios/conto-terzi.mjs';
import {
  runContoTerziHomeAssertions,
  runMappaClientiAssertions,
} from './scenarios/conto-terzi-hub.mjs';
import { runNuovoPreventivoReadAssertions } from './scenarios/conto-terzi-forms-read.mjs';

test.describe('GFV Farm Simulator — letture conto terzi', () => {
  test('un login: home, mappa, clienti, tariffe, preventivi, terreni clienti, nuovo preventivo', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerContoTerzi(page);
    await gotoContoTerziHome(page);
    await runContoTerziHomeAssertions(page, expect);
    await gotoMappaClienti(page);
    await runMappaClientiAssertions(page, expect);
    await gotoClientiList(page);
    await runClientiListAssertions(page, expect);
    await gotoTariffeList(page);
    await runTariffeListAssertions(page, expect);
    await gotoPreventiviList(page);
    await runPreventiviListAssertions(page, expect);
    await gotoTerreniClientiList(page);
    await runTerreniClientiAssertions(page, expect);
    await gotoNuovoPreventivo(page);
    await runNuovoPreventivoReadAssertions(page, expect);
  });
});
