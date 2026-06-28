/**
 * GFV Farm Simulator v4 — scenario 4: diario attività (~20 record seed).
 * Dati seed validati da v3 orchestrator; assert DOM visibile.
 */
import { test } from '@playwright/test';
import { gotoAttivitaList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runAttivitaListAssertions } from './scenarios/attivita-list.mjs';

test.describe('GFV Farm Simulator v4 — diario attività', () => {
  test('pagina dev → lista attività con colonne e ~20 righe seed', async ({ page, expect }) => {
    await loginAsManagerFromDevPage(page);
    await gotoAttivitaList(page);
    await runAttivitaListAssertions(page, expect);
  });
});
