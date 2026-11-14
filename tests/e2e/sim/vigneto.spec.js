/**
 * Letture vigneto in un solo login: hub, anagrafica, liste e pagine estese.
 */
import { test, expect } from './helpers/gfv-test.js';
import {
  gotoCalcoloMateriali,
  gotoConcimazioniList,
  gotoPianificaImpianto,
  gotoPotaturaList,
  gotoTrattamentiList,
  gotoVendemmia,
  gotoVignetiList,
  gotoVignetoDashboard,
  gotoVignetoStatistiche,
  loginAsManagerFromDevPage,
} from './helpers/sim-login.js';
import {
  runConcimazioniListAssertions,
  runPotaturaListAssertions,
  runTrattamentiListAssertions,
} from './scenarios/vigneto.mjs';
import { runVignetoDashboardAssertions } from './scenarios/vigneto-hub.mjs';
import { runVignetiListAssertions } from './scenarios/vigneti.mjs';
import {
  runCalcoloMaterialiReadAssertions,
  runPianificaImpiantoReadAssertions,
  runVendemmiaReadAssertions,
  runVignetoStatisticheAssertions,
} from './scenarios/vigneto-extended-read.mjs';

test.describe('GFV Farm Simulator — letture vigneto', () => {
  test('un login: dashboard, anagrafica, potature, trattamenti, concimazioni, statistiche, vendemmia, materiali, impianto', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerFromDevPage(page);
    await gotoVignetoDashboard(page);
    await runVignetoDashboardAssertions(page, expect);
    await gotoVignetiList(page);
    await runVignetiListAssertions(page, expect);
    await gotoPotaturaList(page);
    await runPotaturaListAssertions(page, expect);
    await gotoTrattamentiList(page);
    await runTrattamentiListAssertions(page, expect);
    await gotoConcimazioniList(page);
    await runConcimazioniListAssertions(page, expect);
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
