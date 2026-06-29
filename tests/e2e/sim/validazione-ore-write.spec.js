/**
 * GFV Farm Simulator v5 — scenario write: validazione ore manager.
 */
import { test, expect } from '@playwright/test';
import { gotoValidazioneOre, loginAsManagerManodopera } from './helpers/sim-login.js';
import { runValidazioneOreWriteAssertions } from './scenarios/validazione-ore-write.mjs';

test.describe('GFV Farm Simulator v5 — write validazione ore', () => {
  test('manager → valida riga marker GFV_SIM_E2E_WRITE_ORE', async ({ page }) => {
    await loginAsManagerManodopera(page);
    await gotoValidazioneOre(page);
    await runValidazioneOreWriteAssertions(page, expect);
  });
});
