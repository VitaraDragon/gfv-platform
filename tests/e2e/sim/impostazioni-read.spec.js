import { test, expect } from '@playwright/test';
import { runImpostazioniReadAssertions } from './scenarios/impostazioni-read.mjs';

test.describe('GFV Farm Simulator — impostazioni read', () => {
  test('manager vede sezione account impostazioni', async ({ page }) => {
    await runImpostazioniReadAssertions(page, expect);
  });
});
