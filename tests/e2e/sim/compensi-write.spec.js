import { test, expect } from '@playwright/test';
import { runCompensiWriteAssertions } from './scenarios/compensi-write.mjs';

test.describe('GFV Farm Simulator — compensi write', () => {
  test('manager calcola compensi mese dopo ore validate', async ({ page }) => {
    await runCompensiWriteAssertions(page, expect);
  });
});
