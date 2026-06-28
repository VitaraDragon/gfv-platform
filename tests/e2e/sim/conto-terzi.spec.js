/**
 * GFV Farm Simulator v4 — scenario 7: moduli Conto Terzi.
 * Richiede tenant template viticola-conto-terzi* in manifest.
 * Dati seed validati da orchestrator v2.2 + sim:audit; assert DOM visibile.
 */
import { test, expect } from '@playwright/test';
import {
  gotoClientiList,
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

test.describe('GFV Farm Simulator v4 — conto terzi', () => {
  test('pagina dev (template conto terzi) → clienti, tariffe, preventivi, terreni clienti', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoClientiList(page);
    await runClientiListAssertions(page, expect);
    await gotoTariffeList(page);
    await runTariffeListAssertions(page, expect);
    await gotoPreventiviList(page);
    await runPreventiviListAssertions(page, expect);
    await gotoTerreniClientiList(page);
    await runTerreniClientiAssertions(page, expect);
  });
});
