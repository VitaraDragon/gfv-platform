import { test, expect } from '@playwright/test';
import { runVignetiWriteAssertions } from './scenarios/vigneti-write.mjs';

test.describe('GFV Farm Simulator — vigneti write (anagrafica)', () => {
  test('manager manodopera → nuovo vigneto marker → riga in tabella', async ({ page }) => {
    test.setTimeout(240_000);
    await runVignetiWriteAssertions(page, expect);
  });
});
