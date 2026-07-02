import { test, expect } from '@playwright/test';
import { runConcimazioneDiarioCompletaWriteAssertions } from './scenarios/concimazione-diario-completa-write.mjs';

test.describe('GFV Farm Simulator — concimazione diario completa write (catena diario → magazzino)', () => {
  test('manager crea attività Concimazione, completa stub e scarico magazzino', async ({ page }) => {
    await runConcimazioneDiarioCompletaWriteAssertions(page, expect);
  });
});
