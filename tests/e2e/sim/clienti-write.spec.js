/**
 * GFV Farm Simulator v5 — scenario write: nuovo cliente conto terzi.
 */
import { test, expect } from '@playwright/test';
import { gotoClientiList, loginAsManagerContoTerzi } from './helpers/sim-login.js';
import { runClientiWriteAssertions } from './scenarios/clienti-write.mjs';

test.describe('GFV Farm Simulator v5 — write cliente conto terzi', () => {
  test('manager → modale → salva → riga in tabella (marker ragione sociale)', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoClientiList(page);
    await runClientiWriteAssertions(page, expect);
  });
});
