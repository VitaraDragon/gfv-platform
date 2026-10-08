/**
 * GFV Farm Simulator — rifiuto dalla coda in Validazione ore.
 */
import { test, expect } from '@playwright/test';
import { runValidazioneOreRifiutoAssertions } from './scenarios/validazione-ore-rifiuto-write.mjs';

test.describe('GFV Farm Simulator — rifiuto da Validazione ore', () => {
  test('manager rifiuta la riga in coda e compare il toast Ora rifiutata', async ({ page }) => {
    await runValidazioneOreRifiutoAssertions(page, expect);
  });
});
