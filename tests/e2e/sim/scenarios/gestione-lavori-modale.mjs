/**
 * E2E — trattore in modifica e campi editabili appena si apre Crea.
 * @module tests/e2e/sim/scenarios/gestione-lavori-modale
 */

/**
 * @param {import('playwright-core').Page} page
 */
async function attendiTabella(page) {
    await page.waitForFunction(() => {
        const container = document.getElementById('lavori-container');
        return container && container.querySelectorAll('.lavori-table tbody tr').length >= 1;
    }, { timeout: 45_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriTrattoreAssertions(page, expect) {
    expect.configure({ timeout: 60_000 });
    await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
    await attendiTabella(page);

    const scelto = await page.evaluate(() => {
        const lavori = (window.lavoriState && window.lavoriState.lavoriList) || [];
        const terreni = (window.lavoriState && window.lavoriState.terreniList) || [];
        const eVite = (id) => {
            const terreno = terreni.find((t) => t.id === id);
            return terreno && String(terreno.coltura || '').toLowerCase().includes('vite');
        };
        const lav = lavori.find((l) => eVite(l.terrenoId)) || lavori[0];
        return lav ? { id: lav.id, macchinaId: lav.macchinaId || '' } : null;
    });
    expect(scelto && scelto.id, 'serve un lavoro, meglio su vigna').toBeTruthy();

    await page.evaluate((id) => window.openModificaModal(id), scelto.id);
    await page.locator('#lavoro-modal.active').waitFor({ timeout: 30_000 });
    await page.waitForFunction(() => {
        const sel = document.getElementById('lavoro-trattore');
        return sel && sel.options.length > 1;
    }, { timeout: 20_000 });

    const prossimo = await page.evaluate(() => {
        const sel = document.getElementById('lavoro-trattore');
        const corrente = sel.value;
        const opt = Array.from(sel.options).find((o) => o.value && !o.disabled && o.value !== corrente);
        if (!opt) return null;
        sel.value = opt.value;
        sel.dataset.userTouched = '1';
        sel.dataset.gfvUserValue = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return opt.value;
    });
    expect(prossimo, 'servono almeno due trattori selezionabili').toBeTruthy();

    await page.evaluate(() => {
        const btn = document.querySelector('#lavoro-form button[type="submit"]');
        if (btn) btn.scrollIntoView({ block: 'center' });
    });
    await expect(page.locator('#lavoro-form button[type="submit"]')).toBeVisible();
    await page.locator('#lavoro-form button[type="submit"]').click();

    await page.waitForFunction(() => {
        const modal = document.getElementById('lavoro-modal');
        const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
        const ok = Array.from(toasts).some((t) => /Lavoro modificato con successo/i.test(t.textContent || ''));
        return ok && modal && !modal.classList.contains('active');
    }, { timeout: 60_000 });

    await page.reload();
    await attendiTabella(page);
    await page.evaluate((id) => window.openModificaModal(id), scelto.id);
    await page.locator('#lavoro-modal.active').waitFor({ timeout: 30_000 });
    await page.waitForFunction(
        (expected) => document.getElementById('lavoro-trattore')?.value === expected,
        prossimo,
        { timeout: 30_000 }
    );
    await expect(page.locator('#lavoro-trattore')).toHaveValue(prossimo);
}

/**
 * Crea subito, anche se gli elenchi stanno ancora arrivando:
 * appena il modale è visibile i campi non restano grigi.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriCreaSubitoAssertions(page, expect) {
    expect.configure({ timeout: 30_000 });
    await page.locator('#crea-lavoro-button').click();
    await page.locator('#lavoro-modal.active').waitFor({ timeout: 20_000 });

    const stato = await page.evaluate(() => {
        const nome = document.getElementById('lavoro-nome');
        const modal = document.getElementById('lavoro-modal');
        return {
            attivo: !!(modal && modal.classList.contains('active')),
            nomeDisabled: !!(nome && nome.disabled),
        };
    });
    expect(stato.attivo).toBe(true);
    expect(stato.nomeDisabled).toBe(false);
}
