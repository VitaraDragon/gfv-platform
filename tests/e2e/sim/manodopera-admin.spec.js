/**
 * Letture manodopera in un solo login.
 */
import { test, expect } from './helpers/gfv-test.js';
import {
  gotoGestioneLavori,
  gotoGestioneOperai,
  gotoGestioneSquadre,
  gotoGestisciUtenti,
  gotoManodoperaHome,
  gotoStatisticheManodopera,
  gotoValidazioneOre,
  loginAsManagerManodopera,
} from './helpers/sim-login.js';
import {
  runGestioneLavoriAssertions,
  runValidazioneOreAssertions,
} from './scenarios/manodopera-admin.mjs';
import {
  runGestioneOperaiAssertions,
  runGestioneSquadreAssertions,
  runManodoperaHomeAssertions,
  runStatisticheManodoperaAssertions,
} from './scenarios/manodopera-team.mjs';
import { runGestisciUtentiReadAssertions } from './scenarios/gestisci-utenti-read.mjs';

test.describe('GFV Farm Simulator — letture manodopera', () => {
  test('un login: lavori, ore, home, operai, squadre, statistiche, utenti', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerManodopera(page);
    await gotoGestioneLavori(page);
    await runGestioneLavoriAssertions(page, expect);
    await gotoValidazioneOre(page);
    await runValidazioneOreAssertions(page, expect);
    await gotoManodoperaHome(page);
    await runManodoperaHomeAssertions(page, expect);
    await gotoGestioneOperai(page);
    await runGestioneOperaiAssertions(page, expect);
    await gotoGestioneSquadre(page);
    await runGestioneSquadreAssertions(page, expect);
    await gotoStatisticheManodopera(page);
    await runStatisticheManodoperaAssertions(page, expect);
    await gotoGestisciUtenti(page);
    await runGestisciUtentiReadAssertions(page, expect);
  });
});
