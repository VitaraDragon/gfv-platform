/**
 * GFV Farm Simulator v5 — scenario write: nuovo lavoro manodopera (gestione lavori).
 */
import { test, expect } from '@playwright/test';
import { gotoGestioneLavori, loginAsManagerManodopera } from './helpers/sim-login.js';
import { runGestioneLavoriWriteAssertions } from './scenarios/gestione-lavori-write.mjs';
import { runGestioneLavoriSospendiRinviaAssertions } from './scenarios/gestione-lavori-sospendi-rinvia.mjs';

test.describe('GFV Farm Simulator v5 — write gestione lavori', () => {
  test('manager → modale → salva → riga in tabella (marker nome)', async ({ page }) => {
    await loginAsManagerManodopera(page);
    await gotoGestioneLavori(page);
    await runGestioneLavoriWriteAssertions(page, expect);
  });

  test('manager sospende / rinvia (causa + ripresa) senza standby assenza', async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsManagerManodopera(page);
    await gotoGestioneLavori(page);
    await runGestioneLavoriSospendiRinviaAssertions(page, expect);
  });
});
