import { test, expect } from '@playwright/test';
import { runMistaAziendaReadAssertions } from './scenarios/mista-azienda-read.mjs';

test.describe('GFV Farm Simulator — azienda mista viticola + frutteto', () => {
  test('vigneti, frutteti e conto terzi sullo stesso tenant seed', async ({ page }) => {
    await runMistaAziendaReadAssertions(page, expect);
  });
});
