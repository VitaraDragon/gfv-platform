import { test, expect } from '@playwright/test';
import { runRaccoltaCompletaWriteAssertions } from './scenarios/raccolta-completa-write.mjs';

test.describe('GFV Farm Simulator M4 — raccolta completa write (catena A)', () => {
  test('manager completa raccolta stub da attività diario', async ({ page }) => {
    await runRaccoltaCompletaWriteAssertions(page, expect);
  });
});
