import { test, expect } from '@playwright/test';
import { runTrattoriWriteAssertions } from './scenarios/trattori-write.mjs';

test.describe('GFV Farm Simulator — trattori write (parco macchine)', () => {
  test('manager → nuovo trattore marker → riga in tabella', async ({ page }) => {
    test.setTimeout(240_000);
    await runTrattoriWriteAssertions(page, expect);
  });
});
