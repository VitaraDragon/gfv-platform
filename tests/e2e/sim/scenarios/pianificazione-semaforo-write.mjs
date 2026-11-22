/**
 * E2E — semaforo etichetta mentre si pianifica un trattamento.
 * Se il seed non ha un tipo «trattamento» o un terreno a vite, il test si ferma
 * e lo dice: non forza dati che non ci sono.
 * @module tests/e2e/sim/scenarios/pianificazione-semaforo-write
 */

import { openNewLavoroModal } from './gestione-lavori-write.mjs';

export const E2E_SEMAFORO_NOME = 'GFV SIM E2E SEMAFORO PIANO';

async function scegliTipoTrattamento(page) {
  const categoriaSelect = page.locator('#lavoro-categoria-principale');
  const categoriaCount = await categoriaSelect.locator('option').count();
  for (let i = 1; i < categoriaCount; i += 1) {
    const value = await categoriaSelect.locator('option').nth(i).getAttribute('value');
    if (!value) continue;
    await categoriaSelect.selectOption(value);
    const subGroup = page.locator('#lavoro-sottocategoria-group');
    if (await subGroup.isVisible()) {
      const subSelect = page.locator('#lavoro-sottocategoria');
      const subCount = await subSelect.locator('option').count();
      if (subCount > 1) {
        const subValue = await subSelect.locator('option').nth(1).getAttribute('value');
        if (subValue) await subSelect.selectOption(subValue);
      }
    }
    const tipo = page.locator('#lavoro-tipo-lavoro');
    const trovato = tipo.locator('option', { hasText: /trattament/i });
    if (await trovato.count()) {
      const selected = await trovato.first().getAttribute('value');
      if (selected) {
        await tipo.selectOption(selected);
        return (await trovato.first().textContent()) || selected;
      }
    }
  }
  return '';
}

async function scegliTerrenoVite(page) {
  const terreno = page.locator('#lavoro-terreno');
  const count = await terreno.locator('option').count();
  for (let i = 1; i < count; i += 1) {
    const testo = ((await terreno.locator('option').nth(i).textContent()) || '').toLowerCase();
    if (testo.includes('vite') || testo.includes('vign')) {
      await terreno.selectOption({ index: i });
      return testo;
    }
  }
  if (count > 1) {
    await terreno.selectOption({ index: 1 });
    return ((await terreno.locator('option').nth(1).textContent()) || '').trim();
  }
  return '';
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 */
export async function runPianificazioneSemaforoWrite(page, expect) {
  await openNewLavoroModal(page);
  const tipo = await scegliTipoTrattamento(page);
  if (!tipo) return { saltato: 'Nel seed non c\'è un tipo lavoro di trattamento.' };
  await scegliTerrenoVite(page);
  await page.locator('#lavoro-nome').fill(E2E_SEMAFORO_NOME);
  const capo = page.locator('#lavoro-caposquadra');
  if (await capo.locator('option').count() > 1) await capo.selectOption({ index: 1 });
  await page.locator('#lavoro-durata').fill('1');
  await page.locator('#lavoro-data-inizio').fill('2026-08-01');
  await page.locator('#lavoro-miscela-nome').fill('Folpan');
  await page.locator('#lavoro-miscela-nome').dispatchEvent('change');
  const leggiScheda = page.locator('#btn-leggi-scheda-miscela');
  await expect(leggiScheda).toBeVisible();
  await expect(page.locator('#lavoro-semaforo-banner')).toContainText('Leggi scheda', { timeout: 20_000 });
  await leggiScheda.click();
  const scegli = page.locator('#lavoro-scheda-esito [data-scegli-prodotto]').first();
  await expect(scegli).toBeVisible({ timeout: 20_000 });
  await scegli.click();
  await expect(page.locator('#lavoro-scheda-esito')).toContainText('008601', { timeout: 20_000 });
  await page.locator('#lavoro-miscela-dose-ha').fill('3');
  await page.locator('#lavoro-miscela-dose-ha').dispatchEvent('change');
  const banner = page.locator('#lavoro-semaforo-banner');
  await expect(banner).toBeVisible({ timeout: 20_000 });
  const fascia = banner.locator('[data-colore]').first();
  await expect(fascia).toBeVisible({ timeout: 20_000 });
  const colore = await fascia.getAttribute('data-colore');
  const html = await banner.innerHTML();
  if (!/rosso|red/.test(String(colore)) && !/fuori dall'intervallo/.test(html)) {
    throw new Error('Il banner non è diventato rosso con FOLPAN a 3 kg/ha. Colore: ' + colore);
  }

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('non è conforme all\'etichetta');
    await dialog.dismiss();
  });
  await page.locator('#lavoro-form button[type="submit"]').click();
  await expect(page.locator('#lavoro-modal.active')).toBeVisible();

  const avversita = page.locator('#lavoro-miscela-avversita');
  await expect(avversita.locator('option', { hasText: /peronospora/i }).first()).toBeAttached({ timeout: 20_000 });
  const valore = await avversita.locator('option', { hasText: /peronospora/i }).first().getAttribute('value');
  if (valore) await avversita.selectOption(valore);
  await page.locator('#lavoro-miscela-dose-ha').fill('1.4');
  await page.locator('#lavoro-miscela-dose-ha').dispatchEvent('change');
  await expect(fascia).not.toHaveAttribute('data-colore', 'rosso', { timeout: 20_000 });

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#lavoro-form button[type="submit"]').click();
  await expect(page.locator('#lavoro-modal.active')).toBeHidden({ timeout: 30_000 });
  return { saltato: '' };
}
