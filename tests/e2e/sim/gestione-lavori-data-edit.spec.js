/**
 * GFV Farm Simulator — edit gestione lavori: data inizio senza shift UTC (−1 giorno).
 * timezoneId Europe/Rome: a mezzanotte locale toISOString() cade sul giorno prima.
 */
import { test, expect } from '@playwright/test';
import { gotoGestioneLavori, loginAsManagerManodopera } from './helpers/sim-login.js';
import { runGestioneLavoriDataEditAssertions } from './scenarios/gestione-lavori-data-edit.mjs';

test.use({ timezoneId: 'Europe/Rome' });

test.describe('GFV Farm Simulator v5 — data inizio lavoro in modifica', () => {
  test('edit lavoro a mezzanotte locale → campo = giorno salvato, salva e resta', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerManodopera(page);
    await gotoGestioneLavori(page);
    await runGestioneLavoriDataEditAssertions(page, expect);
  });
});
