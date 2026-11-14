import { test, expect } from './helpers/gfv-test.js';
import { runConcimazioneDiarioCompletaWriteAssertions } from './scenarios/concimazione-diario-completa-write.mjs';

test.describe('GFV Farm Simulator — concimazione diario completa write (catena diario → magazzino)', () => {
  test('manager crea attività Concimazione, completa stub e scarico magazzino', async ({ page }) => {
    await runConcimazioneDiarioCompletaWriteAssertions(page, expect);
  });
});
