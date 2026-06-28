/**
 * GFV Farm Simulator v4 — scenario 3: lista terreni → colonna affitti con semafori.
 * Dati seed validati da v3 (seed-terreni-affitti); assert DOM visibile.
 */
import { test } from '@playwright/test';
import { gotoTerreniList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runTerreniAffittiAssertions } from './scenarios/terreni-affitti.mjs';

test.describe('GFV Farm Simulator v4 — terreni affitti semafori', () => {
  test('pagina dev → terreni con badge Affitto e dot grey/red/yellow/green', async ({ page, expect }) => {
    await loginAsManagerFromDevPage(page);
    await gotoTerreniList(page);
    await runTerreniAffittiAssertions(page, expect);
  });
});
