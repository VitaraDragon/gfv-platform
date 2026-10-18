/**
 * GFV Farm Simulator — annulla segnalazione e risolto da me.
 */
import { test, expect } from '@playwright/test';
import { runGuastiAnnullaWriteAssertions } from './scenarios/guasti-annulla-write.mjs';

test.describe('GFV Farm Simulator — annulla e risolto da me', () => {
  test('operaio annulla o chiude; il manager vede l’annullato solo in Tutti', async ({ page }) => {
    test.setTimeout(360_000);
    await runGuastiAnnullaWriteAssertions(page, expect);
  });
});
