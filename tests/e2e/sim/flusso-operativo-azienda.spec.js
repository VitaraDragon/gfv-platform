import { test, expect } from './helpers/gfv-test.js';
import { runFlussoOperativoAziendaAssertions } from './scenarios/flusso-operativo-azienda.mjs';

test.describe('GFV Farm Simulator — flusso operativo azienda', () => {
  test('percorso end-to-end diario → vigneto → manodopera → conto terzi', async ({ page }) => {
    await runFlussoOperativoAziendaAssertions(page, expect);
  });
});
