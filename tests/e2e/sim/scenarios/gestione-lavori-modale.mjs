/**
 * E2E — trattore in modifica e campi editabili appena si apre Crea.
 * @module tests/e2e/sim/scenarios/gestione-lavori-modale
 */

import { simE2eTimeout } from '../helpers/sim-e2e-timeouts.mjs';

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
    const onDialog = (dialog) => {
        console.log(`[e2e] dialog: ${dialog.message()}`);
        return dialog.accept();
    };
    page.on('dialog', onDialog);
    try {
    await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
    await attendiTabella(page);

    const scelto = await page.evaluate(() => {
        const lavori = (window.lavoriState && window.lavoriState.lavoriList) || [];
        const terreni = (window.lavoriState && window.lavoriState.terreniList) || [];
        const eVite = (id) => {
            const terreno = terreni.find((t) => t.id === id);
            return terreno && String(terreno.coltura || '').toLowerCase().includes('vite');
        };
        const senzaMiscela = (l) => l && !l.attrezzoId && !l.miscelaPrevista;
        const lav = lavori.find((l) => eVite(l.terrenoId) && senzaMiscela(l))
            || lavori.find((l) => senzaMiscela(l));
        return lav ? { id: lav.id, macchinaId: lav.macchinaId || '' } : null;
    });
    expect(scelto && scelto.id, 'serve un lavoro su vigna senza attrezzo e senza miscela').toBeTruthy();

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

    const esitoSalva = await page.waitForFunction(() => {
        const toasts = Array.from(document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert'));
        for (const t of toasts) {
            const text = (t.textContent || '').trim();
            if (/Lavoro modificato con successo/i.test(text)) return { ok: true, text };
        }
        for (const t of toasts) {
            const text = (t.textContent || '').trim();
            const cls = String(t.className || '');
            if (/alert-danger|alert-error|is-error/i.test(cls) || /errore|impossibile|non riuscit/i.test(text)) {
                return { ok: false, text };
            }
        }
        return null;
    }, { timeout: simE2eTimeout(60_000) });
    const salva = await esitoSalva.jsonValue();
    if (!salva.ok) throw new Error(salva.text || 'Salvataggio lavoro fallito');
    await page.locator('#lavoro-modal.active').waitFor({ state: 'hidden', timeout: simE2eTimeout(15_000) });

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
    } finally {
        page.off('dialog', onDialog);
    }
}

/**
 * Crea subito, anche se gli elenchi stanno ancora arrivando:
 * appena il modale è visibile i campi non restano grigi.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriCreaSubitoAssertions(page, expect) {
    await page.waitForFunction(() => (
        typeof window.openCreaModal === 'function'
        && window.lavoriState
        && window.lavoriState.hasManodoperaModule !== undefined
    ), { timeout: simE2eTimeout(45_000) });
    await page.locator('#crea-lavoro-button').click();
    await page.locator('#lavoro-modal.active').waitFor({ timeout: simE2eTimeout(45_000) });

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
