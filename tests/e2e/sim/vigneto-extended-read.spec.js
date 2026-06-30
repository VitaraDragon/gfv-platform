import { test, expect } from '@playwright/test';
import {
  gotoCalcoloMateriali,
  gotoPianificaImpianto,
  gotoVendemmia,
  gotoVignetoStatistiche,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runCalcoloMaterialiReadAssertions,
  runPianificaImpiantoReadAssertions,
  runVendemmiaReadAssertions,
  runVignetoStatisticheAssertions,
} from './scenarios/vigneto-extended-read.mjs';

test.describe('GFV Farm Simulator — vigneto extended read', () => {
  test('pagina dev → statistiche, vendemmia, calcolo materiali, pianifica impianto', async ({
    page,
  }) => {
    await loginAsManagerFromDevPage(page);
    await gotoVignetoStatistiche(page);
    await runVignetoStatisticheAssertions(page, expect);
    await gotoVendemmia(page);
    await runVendemmiaReadAssertions(page, expect);
    await gotoCalcoloMateriali(page);
    await runCalcoloMaterialiReadAssertions(page, expect);
    await gotoPianificaImpianto(page);
    await runPianificaImpiantoReadAssertions(page, expect);
  });
});
