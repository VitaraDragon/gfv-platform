import { test, expect } from '@playwright/test';
import { runFruttetiWriteAssertions } from './scenarios/frutteti-write.mjs';

test.describe('GFV Farm Simulator M4 — frutteti write (anagrafica)', () => {
  test('manager frutteto → nuovo frutteto marker → riga in tabella', async ({ page }) => {
    test.setTimeout(240_000);
    await runFruttetiWriteAssertions(page, expect);
  });
});
