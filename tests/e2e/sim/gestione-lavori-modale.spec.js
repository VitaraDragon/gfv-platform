/**
 * GFV Farm Simulator — modifica trattore e Crea con campi subito editabili.
 */
import { test, expect } from '@playwright/test';
import { GESTIONE_LAVORI_PATH, gotoGestioneLavori, loginAsManagerManodopera } from './helpers/sim-login.js';
import {
    runGestioneLavoriCreaSubitoAssertions,
    runGestioneLavoriTrattoreAssertions,
} from './scenarios/gestione-lavori-modale.mjs';

test.describe('GFV Farm Simulator — modale gestione lavori', () => {
    test('modifica trattore su vigna, Salva, ricarica: resta il trattore nuovo', async ({ page }) => {
        test.setTimeout(180_000);
        await loginAsManagerManodopera(page, {
            preferTemplateId: 'mista-viticola-frutteto-conto-terzi-manodopera',
        });
        await gotoGestioneLavori(page);
        await runGestioneLavoriTrattoreAssertions(page, expect);
    });

    test('Crea appena il pulsante c’è: i campi non sono disabilitati', async ({ page }) => {
        test.setTimeout(120_000);
        await loginAsManagerManodopera(page);
        await page.goto(GESTIONE_LAVORI_PATH);
        await page.locator('#crea-lavoro-button').waitFor({ timeout: 45_000 });
        await runGestioneLavoriCreaSubitoAssertions(page, expect);
    });
});
