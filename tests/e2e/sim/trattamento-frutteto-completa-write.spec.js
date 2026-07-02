import { test, expect } from '@playwright/test';
import { runTrattamentoFruttetoCompletaWriteAssertions } from './scenarios/trattamento-frutteto-completa-write.mjs';

test.describe('GFV Farm Simulator M4 — trattamento frutteto completa write', () => {
  test('manager completa trattamento stub + scarico magazzino', async ({ page }) => {
    await runTrattamentoFruttetoCompletaWriteAssertions(page, expect);
  });
});
