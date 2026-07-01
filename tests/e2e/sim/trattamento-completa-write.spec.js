import { test, expect } from '@playwright/test';
import { runTrattamentoCompletaWriteAssertions } from './scenarios/trattamento-completa-write.mjs';

test.describe('GFV Farm Simulator — trattamento completa write (catena A+B)', () => {
  test('manager completa trattamento stub da lavoro e scarico magazzino', async ({ page }) => {
    await runTrattamentoCompletaWriteAssertions(page, expect);
  });
});
