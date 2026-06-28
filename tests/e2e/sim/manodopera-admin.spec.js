import { test, expect } from '@playwright/test';
import {
  gotoGestioneLavori,
  gotoValidazioneOre,
  loginAsManagerManodopera,
} from './helpers/sim-login.js';
import {
  runGestioneLavoriAssertions,
  runValidazioneOreAssertions,
} from './scenarios/manodopera-admin.mjs';

test.describe('GFV Farm Simulator v4 — manodopera admin', () => {
  test('pagina dev (manodopera) → gestione lavori e validazione ore', async ({ page }) => {
    await loginAsManagerManodopera(page);
    await gotoGestioneLavori(page);
    await runGestioneLavoriAssertions(page, expect);
    await gotoValidazioneOre(page);
    await runValidazioneOreAssertions(page, expect);
  });
});
