/**
 * GFV Farm Simulator v5 — scenario write: accetta preventivo conto terzi (manager).
 */
import { test, expect } from '@playwright/test';
import { gotoPreventiviList, loginAsManagerContoTerzi } from './helpers/sim-login.js';
import { runPreventiviAccettaWriteAssertions } from './scenarios/preventivi-accetta-write.mjs';

test.describe('GFV Farm Simulator v5 — write accetta preventivo', () => {
  test('manager → Accetta → badge Accettato (Manager) + Pianifica (marker 9.99 ha)', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerContoTerzi(page);
    await gotoPreventiviList(page);
    await runPreventiviAccettaWriteAssertions(page, expect);
  });
});
