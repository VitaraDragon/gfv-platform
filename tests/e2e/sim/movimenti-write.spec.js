/**
 * GFV Farm Simulator v5 — scenario write: nuovo movimento magazzino (entrata).
 */
import { test, expect } from '@playwright/test';
import { gotoMovimentiList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runMovimentiWriteAssertions } from './scenarios/movimenti-write.mjs';

test.describe('GFV Farm Simulator v5 — write movimento magazzino', () => {
  test('manager → modale entrata → salva → riga in tabella (marker note)', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoMovimentiList(page);
    await runMovimentiWriteAssertions(page, expect);
  });
});
