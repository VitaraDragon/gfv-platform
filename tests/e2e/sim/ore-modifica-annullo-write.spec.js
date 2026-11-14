/**
 * GFV Farm Simulator — modifica ore proprie e annullo validazione.
 */
import { test, expect } from './helpers/gfv-test.js';
import { runOreModificaAnnulloAssertions } from './scenarios/ore-modifica-annullo.mjs';

test.describe('GFV Farm Simulator — modifica ore e annullo validazione', () => {
  test('operaio modifica ed elimina; manager annulla una validazione', async ({ page }) => {
    await runOreModificaAnnulloAssertions(page, expect);
  });
});
