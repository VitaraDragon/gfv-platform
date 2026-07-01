import { test, expect } from '@playwright/test';
import {
  gotoGestioneMacchine,
  gotoGuastiList,
  loginAsManagerManodopera,
} from './helpers/sim-login.js';
import { runGuastiListAssertions } from './scenarios/macchine-hub.mjs';
import { runGestioneMacchineAssertions } from './scenarios/macchine-admin-read.mjs';

test.describe('GFV Farm Simulator — admin macchine read', () => {
  test('pagina dev → gestione macchine + officina guasti', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManagerManodopera(page);
    await gotoGestioneMacchine(page);
    await runGestioneMacchineAssertions(page, expect);
    await gotoGuastiList(page);
    await runGuastiListAssertions(page, expect);
  });
});
