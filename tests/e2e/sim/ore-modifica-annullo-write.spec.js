/**
 * GFV Farm Simulator — modifica ore proprie e annullo validazione.
 */
import { test, expect } from '@playwright/test';
import { runOreModificaAnnulloAssertions } from './scenarios/ore-modifica-annullo.mjs';

test.describe('GFV Farm Simulator — modifica ore e annullo validazione', () => {
  test('operaio modifica ed elimina; manager annulla una validazione', async ({ page }) => {
    await runOreModificaAnnulloAssertions(page, expect);
  });
});
