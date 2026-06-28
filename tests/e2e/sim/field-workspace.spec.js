/**
 * GFV Farm Simulator v4 — scenario 8: manodopera mobile (field workspace).
 * Richiede tenant template *manodopera* con personas[] in manifest.
 * Dati seed validati da inspectManodoperaSeed + sim:audit; assert DOM visibile.
 */
import { test, expect } from '@playwright/test';
import {
  loginAsCapoFromDevPage,
  loginAsOperaioFromDevPage,
} from './helpers/sim-login.js';
import {
  runCapoFieldWorkspaceAssertions,
  runOperaioFieldWorkspaceAssertions,
} from './scenarios/field-workspace.mjs';

test.describe('GFV Farm Simulator v4 — field workspace manodopera', () => {
  test('pagina dev (template manodopera) → operaio e capo mobile', async ({ page }) => {
    await loginAsOperaioFromDevPage(page);
    await runOperaioFieldWorkspaceAssertions(page, expect);

    await loginAsCapoFromDevPage(page);
    await runCapoFieldWorkspaceAssertions(page, expect);
  });
});
