import { test, expect } from './helpers/gfv-test.js';
import { runPotaturaCompletaWriteAssertions } from './scenarios/potatura-completa-write.mjs';

test.describe('GFV Farm Simulator — potatura completa write (catena A)', () => {
  test('manager completa potatura stub da attività/lavoro', async ({ page }) => {
    await runPotaturaCompletaWriteAssertions(page, expect);
  });
});
