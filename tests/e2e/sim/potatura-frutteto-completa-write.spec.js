import { test, expect } from '@playwright/test';
import { runPotaturaFruttetoCompletaWriteAssertions } from './scenarios/potatura-frutteto-completa-write.mjs';

test.describe('GFV Farm Simulator M4 — potatura frutteto completa write', () => {
  test('manager completa potatura stub da attività', async ({ page }) => {
    await runPotaturaFruttetoCompletaWriteAssertions(page, expect);
  });
});
