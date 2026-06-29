/**
 * GFV Farm Simulator v5 — scenario write: nuovo movimento magazzino (uscita).
 */
import { test, expect } from '@playwright/test';
import { gotoMovimentiList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runMovimentiUscitaWriteAssertions } from './scenarios/movimenti-uscita-write.mjs';

test.describe('GFV Farm Simulator v5 — write movimento magazzino uscita', () => {
  test('manager → modale uscita → salva → riga in tabella (marker note)', async ({ page }) => {
    await loginAsManagerFromDevPage(page);
    await gotoMovimentiList(page);
    await runMovimentiUscitaWriteAssertions(page, expect);
  });
});
