/**
 * GFV Farm Simulator — semaforo etichetta in pianificazione trattamento.
 */
import { test, expect } from './helpers/gfv-test.js';
import { gotoGestioneLavori, loginAsManagerManodopera } from './helpers/sim-login.js';
import { runPianificazioneSemaforoWrite } from './scenarios/pianificazione-semaforo-write.mjs';

test.describe('GFV Farm Simulator — semaforo pianificazione trattamento', () => {
  test('dose fuori etichetta è rossa e il rifiuto non crea il lavoro', async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsManagerManodopera(page);
    await gotoGestioneLavori(page);
    const esito = await runPianificazioneSemaforoWrite(page, expect);
    if (esito && esito.saltato) test.skip(true, esito.saltato);
  });
});
