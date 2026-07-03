import { test, expect } from '@playwright/test';
import { runConcimazioneFruttetoCompletaWriteAssertions } from './scenarios/concimazione-frutteto-completa-write.mjs';

test.describe('GFV Farm Simulator M4 — concimazione frutteto completa write', () => {
  test('manager completa concimazione stub da attività seed + scarico magazzino', async ({ page }) => {
    test.setTimeout(240_000);
    await runConcimazioneFruttetoCompletaWriteAssertions(page, expect);
  });
});
