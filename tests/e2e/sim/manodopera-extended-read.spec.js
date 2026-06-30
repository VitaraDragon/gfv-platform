import { test, expect } from '@playwright/test';
import {
  gotoCompensiOperai,
  gotoSegnalazioneGuasti,
  gotoSegnaturaOre,
  gotoStatisticheLavoratore,
  loginAsCapoFromDevPage,
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
  test('manager → compensi; capo → segnatura ore; operaio → segnalazione + statistiche', async ({
    page,
  }) => {
    await loginAsManagerManodopera(page);
    await gotoCompensiOperai(page);
    await runCompensiOperaiReadAssertions(page, expect);
    await loginAsCapoFromDevPage(page, { waitForWorkspace: false });
    await gotoSegnaturaOre(page);
    await runSegnaturaOreReadAssertions(page, expect);

    await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
    await gotoSegnalazioneGuasti(page);
    await runSegnalazioneGuastiReadAssertions(page, expect);
    await gotoStatisticheLavoratore(page);
    await runStatisticheLavoratoreReadAssertions(page, expect);
  });
});
