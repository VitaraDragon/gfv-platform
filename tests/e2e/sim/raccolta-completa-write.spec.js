import { test, expect } from './helpers/gfv-test.js';
import { runRaccoltaCompletaWriteAssertions } from './scenarios/raccolta-completa-write.mjs';

test.describe('GFV Farm Simulator M4 — raccolta completa write (catena A)', () => {
  test('manager completa raccolta stub da attività diario', async ({ page }) => {
    await runRaccoltaCompletaWriteAssertions(page, expect);
  });
});
