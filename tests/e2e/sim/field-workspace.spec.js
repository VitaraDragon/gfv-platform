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

  test('caposquadra: la guida ha ruolo=caposquadra anche se resolveDestinatariIdsForSend è bloccato', async ({ page }) => {
    await page.route('**/field-workspace-controller.js*', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const marker = 'async function resolveDestinatariIdsForSend() {';
      if (!body.includes(marker)) {
        throw new Error('resolveDestinatariIdsForSend non trovato nel controller servito');
      }
      const patched = body.replace(
        marker,
        `${marker}\n    window.__gfvResolveDestinatariBloccato = true;\n    throw new Error('resolveDestinatariIdsForSend bloccato');\n`
      );
      await route.fulfill({ response, body: patched });
    });

    await loginAsCapoFromDevPage(page, { waitForWorkspace: false });
    await page.waitForFunction(
      () => window.__gfvResolveDestinatariBloccato === true,
      null,
      { timeout: 90_000 }
    );

    const href = await page.locator('#field-documentation-guide-link').getAttribute('href');
    expect(href || '').toContain('ruolo=caposquadra');
    expect(href || '').not.toContain('ruolo=operaio');
    await expect(page.locator('#field-options-menu')).toHaveAttribute('data-pronto', '1');
    await expect(page.locator('#field-mobile-status')).not.toHaveText(/Workspace mobile attivo/i);
  });
});
