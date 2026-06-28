import { test, expect } from '@playwright/test';
import {
  gotoGestioneOperai,
  gotoGestioneSquadre,
  gotoManodoperaHome,
  gotoStatisticheManodopera,
  loginAsManagerManodopera,
} from './helpers/sim-login.js';
import {
  runGestioneOperaiAssertions,
  runGestioneSquadreAssertions,
  runManodoperaHomeAssertions,
  runStatisticheManodoperaAssertions,
} from './scenarios/manodopera-team.mjs';

test.describe('GFV Farm Simulator — team manodopera manager', () => {
  test('pagina dev (manodopera) → home, operai, squadre, statistiche', async ({ page }) => {
    await loginAsManagerManodopera(page);
    await gotoManodoperaHome(page);
    await runManodoperaHomeAssertions(page, expect);
    await gotoGestioneOperai(page);
    await runGestioneOperaiAssertions(page, expect);
    await gotoGestioneSquadre(page);
    await runGestioneSquadreAssertions(page, expect);
    await gotoStatisticheManodopera(page);
    await runStatisticheManodoperaAssertions(page, expect);
  });
});
