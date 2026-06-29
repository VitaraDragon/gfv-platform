/**
 * GFV Farm Simulator v5 — scenario write: nuova attività (modale diario).
 */
import { test, expect } from '@playwright/test';
import { gotoAttivitaList, loginAsManagerManodopera } from './helpers/sim-login.js';
import { runAttivitaWriteAssertions } from './scenarios/attivita-write.mjs';

test.describe('GFV Farm Simulator v5 — write attività', () => {
  test('manager → modale → salva → riga in lista (marker note)', async ({ page }) => {
    await loginAsManagerManodopera(page);
    await gotoAttivitaList(page);
    await runAttivitaWriteAssertions(page, expect);
  });
});
