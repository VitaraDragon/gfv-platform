import { test, expect } from './helpers/gfv-test.js';
import { runTerreniCatalogoReadAssertions } from './scenarios/terreni-catalogo-read.mjs';

test.describe('GFV Farm Simulator — terreni catalogo read', () => {
  test('lista terreni con coltura podere ettari', async ({ page }) => {
    await runTerreniCatalogoReadAssertions(page, expect);
  });
});
