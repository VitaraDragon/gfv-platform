import { test, expect } from './helpers/gfv-test.js';
import { runImpostazioniReadAssertions } from './scenarios/impostazioni-read.mjs';

test.describe('GFV Farm Simulator — impostazioni read', () => {
  test('manager vede sezione account impostazioni', async ({ page }) => {
    await runImpostazioniReadAssertions(page, expect);
  });
});
