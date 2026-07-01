/**
 * Eseguito per ultimo (prefisso z): dipende da field-workspace-write + validazione-ore-write.
 */
import { test, expect } from '@playwright/test';
import { runCompensiWriteAssertions } from './scenarios/compensi-write.mjs';

test.describe('GFV Farm Simulator — compensi write', () => {
  test('manager calcola compensi mese dopo ore validate', async ({ page }) => {
    test.setTimeout(120_000);
    await runCompensiWriteAssertions(page, expect);
  });
});
