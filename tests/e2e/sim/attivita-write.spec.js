/**
 * GFV Farm Simulator v5 — scenario write: nuova attività (modale diario).
 */
import { test, expect } from '@playwright/test';
import { gotoAttivitaList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runAttivitaWriteAssertions } from './scenarios/attivita-write.mjs';

test.describe('GFV Farm Simulator v5 — write attività', () => {
  test('manager → modale → salva → riga in lista (marker note)', async ({ page }) => {
    // Creazione dal Diario resta il percorso senza Manodopera. Le assert della riga non cambiano.
    await loginAsManagerFromDevPage(page, { preferTemplateId: 'solo-titolare-viticola' });
    await gotoAttivitaList(page);
    await runAttivitaWriteAssertions(page, expect);
  });
});
