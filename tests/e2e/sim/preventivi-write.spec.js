/**
 * GFV Farm Simulator v5 — scenario write: nuovo preventivo conto terzi.
 */
import { test, expect } from '@playwright/test';
import { gotoPreventiviList, loginAsManagerContoTerzi } from './helpers/sim-login.js';
import { runPreventiviWriteAssertions } from './scenarios/preventivi-write.mjs';

test.describe('GFV Farm Simulator v5 — write preventivo conto terzi', () => {
  test('manager → nuovo preventivo → salva → riga in tabella (marker superficie)', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoPreventiviList(page);
    await runPreventiviWriteAssertions(page, expect);
  });
});
