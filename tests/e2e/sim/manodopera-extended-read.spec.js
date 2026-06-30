import { test, expect } from '@playwright/test';
import {
  gotoCompensiOperai,
  gotoSegnalazioneGuasti,
  gotoSegnaturaOre,
  gotoStatisticheLavoratore,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from './helpers/sim-login.js';
import {
  runCompensiOperaiReadAssertions,
  runSegnalazioneGuastiReadAssertions,
  runSegnaturaOreReadAssertions,
  runStatisticheLavoratoreReadAssertions,
} from './scenarios/manodopera-extended-read.mjs';

test.describe('GFV Farm Simulator — manodopera extended read', () => {
  test('manager → compensi + segnatura ore; operaio → segnalazione + statistiche', async ({
    page,
  }) => {
    await loginAsManagerManodopera(page);
    await gotoCompensiOperai(page);
    await runCompensiOperaiReadAssertions(page, expect);
    await gotoSegnaturaOre(page);
    await runSegnaturaOreReadAssertions(page, expect);

    await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
    await gotoSegnalazioneGuasti(page);
    await runSegnalazioneGuastiReadAssertions(page, expect);
    await gotoStatisticheLavoratore(page);
    await runStatisticheLavoratoreReadAssertions(page, expect);
  });
});
