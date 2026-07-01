import { test, expect } from '@playwright/test';
import {
  gotoGestioneGuastiAdmin,
  gotoGestioneMacchine,
  loginAsManagerManodopera,
} from './helpers/sim-login.js';
import {
  runGestioneGuastiAdminAssertions,
  runGestioneMacchineAssertions,
} from './scenarios/macchine-admin-read.mjs';

test.describe('GFV Farm Simulator — admin macchine read', () => {
  test('pagina dev → gestione macchine + gestione guasti', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsManagerManodopera(page);
    await gotoGestioneMacchine(page);
    await runGestioneMacchineAssertions(page, expect);
    await gotoGestioneGuastiAdmin(page);
    await runGestioneGuastiAdminAssertions(page, expect);
  });
});
