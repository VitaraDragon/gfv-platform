/**
 * Gate Manodopera / Diario.
 * Senza modulo: Gestione lavori non è nel menu e la pagina non è operativa.
 * Con modulo: i link Conto Terzi non aprono il Diario editabile.
 */
import { test, expect } from '@playwright/test';
import {
  ATTIVITA_LIST_PATH,
  CONTO_TERZI_HOME_PATH,
  GESTIONE_LAVORI_PATH,
  loginAsManagerFrutteto,
  loginAsManagerManodopera,
} from './helpers/sim-login.js';

test.describe('Gate Manodopera / Diario', () => {
  test('senza Manodopera Gestione lavori non è nel menu e non è apribile', async ({ page }) => {
    await loginAsManagerFrutteto(page);
    await page.waitForSelector('#gfv-pelle-shell a.gfv-pelle-mod');
    await page.waitForSelector('#gfv-pelle-home-actions');

    await expect(page.locator('#gfv-pelle-lab a', { hasText: 'Gestione lavori' })).toHaveCount(0);
    await expect(page.locator('#gfv-pelle-home-actions a', { hasText: 'Gestione lavori' })).toHaveCount(0);
    await expect(page.locator('#gfv-pelle-alt-lab a', { hasText: 'Gestione lavori' })).toHaveCount(0);
    await expect(page.locator('#gfv-pelle-lab a', { hasText: 'Diario attività' })).toHaveCount(1);

    await page.goto(GESTIONE_LAVORI_PATH);
    await expect(page.locator('#gestione-lavori-gate')).toBeVisible();
    await expect(page.locator('#gestione-lavori-gate')).toContainText('Modulo Manodopera non attivo');
    await expect(page.locator('#crea-lavoro-button')).toBeHidden();
  });

  test('con Manodopera i link CT non aprono il Diario editabile', async ({ page }) => {
    await loginAsManagerManodopera(page);
    await page.waitForSelector('#gfv-pelle-shell a.gfv-pelle-mod');
    await page.waitForSelector('#gfv-pelle-home-actions');

    await expect(page.locator('#gfv-pelle-lab a', { hasText: 'Gestione lavori' })).toHaveCount(1);
    await expect(page.locator('#gfv-pelle-home-actions a', { hasText: 'Gestione lavori' })).toHaveCount(1);
    await expect(page.locator('#gfv-pelle-lab a', { hasText: 'Diario attività' })).toHaveCount(0);
    await expect(page.locator('#gfv-pelle-alt-lab a', { hasText: 'Diario' })).toHaveCount(0);

    await page.goto(CONTO_TERZI_HOME_PATH);
    await page.waitForFunction(() => document.body.dataset.gfvRegistro === 'lavori');

    const inCorso = page.locator('a[data-gfv-registro="in_corso"]');
    const completati = page.locator('a[data-gfv-registro="completato"]');
    await expect(inCorso.first()).toBeVisible();
    const hrefCorso = await inCorso.first().getAttribute('href');
    const hrefFatti = await completati.first().getAttribute('href');
    expect(hrefCorso).toContain('gestione-lavori-standalone.html');
    expect(hrefCorso).toContain('stato=in_corso');
    expect(hrefCorso).not.toContain('attivita-standalone');
    expect(hrefFatti).toContain('gestione-lavori-standalone.html');
    expect(hrefFatti).toContain('stato=completato');
    expect(hrefFatti).not.toContain('attivita-standalone');

    await page.goto(ATTIVITA_LIST_PATH);
    await page.waitForFunction(() => document.body.dataset.gfvDiario === 'storico');
    await expect(page.locator('h1').filter({ hasText: 'Diario Attività' })).toBeVisible();
    await expect(page.locator('#btn-aggiungi-attivita')).toBeHidden();
    await page.waitForFunction(() => {
      const container = document.getElementById('attivita-container');
      return container && container.querySelectorAll('.attivita-row').length >= 1;
    }, { timeout: 60_000 });
  });
});
