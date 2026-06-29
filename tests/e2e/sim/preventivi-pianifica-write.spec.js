/**
 * GFV Farm Simulator v5 — scenario write: pianifica preventivo conto terzi.
 */
import { test, expect } from '@playwright/test';
import { gotoPreventiviList, loginAsManagerContoTerzi } from './helpers/sim-login.js';
import { runPreventiviPianificaWriteAssertions } from './scenarios/preventivi-pianifica-write.mjs';

test.describe('GFV Farm Simulator v5 — write pianifica preventivo', () => {
  test('manager → Pianifica → badge Pianificato + lavoro creato (marker 9.99 ha)', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoPreventiviList(page);
    await runPreventiviPianificaWriteAssertions(page, expect);
  });
});
