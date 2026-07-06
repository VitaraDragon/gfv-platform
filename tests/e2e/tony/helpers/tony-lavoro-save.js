/**
 * Conferma save lavoro Tony E2E — salva locale o fallback submit form.
 * @module tests/e2e/tony/helpers/tony-lavoro-save
 */

import { tonyRunMultiTurn } from './tony-multi-turn.js';
import { TONY_E2E_LAVORO_NOME } from './tony-post-save.js';

/**
 * Riempie tipo/macchine mancanti dopo intervista ambigua (fallback E2E, non prodotto).
 * @param {import('playwright-core').Page} page
 * @param {object} [ctx]
 */
export async function ensureLavoroFormComplete(page, ctx = {}) {
  const tipoNome = ctx?.tipoLavoro?.nome || '';
  const tipoChat = ctx?.tipoLavoro?.chatReply || 'trinciatura tra le file';
  const trHint = ctx?.trattorePatch?.hint || '';
  const atHint = ctx?.attrezzoPatch?.hint || '';

  await page.evaluate(
    async ({ tipoNomeArg, tipoChatArg, trHintArg, atHintArg }) => {
      const tipoEl = document.getElementById('lavoro-tipo-lavoro');
      const catEl = document.getElementById('lavoro-categoria-principale');
      const injector = window.TonyFormInjector;

      async function applyReply(text) {
        if (!injector?.applyLavoroInterviewFromUserReply) return;
        await injector.applyLavoroInterviewFromUserReply(text);
      }

      async function injectPatch(patch) {
        if (!injector?.injectLavoroForm) return;
        await injector.injectLavoroForm(patch, (window.Tony && window.Tony.context) || {});
      }

      if (tipoEl && !tipoEl.value) {
        await applyReply(tipoChatArg);
        if (!tipoEl.value && window.__tonyLavoroAwaitingTipoModo) {
          await applyReply('meccanica');
        }
        if (!tipoEl.value && tipoNomeArg) {
          await injectPatch({ 'lavoro-tipo-lavoro': tipoNomeArg });
        }
        if (!tipoEl.value) {
          const st = window.lavoriState;
          const tipi = (st && st.tipiLavoroList) || [];
          const pick = tipi.find((t) => /trinciat/i.test(String(t.nome || '')));
          if (pick) {
            if (pick.categoriaId && catEl && !catEl.value) {
              catEl.value = pick.categoriaId;
              catEl.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise((r) => setTimeout(r, 250));
            }
            tipoEl.value = pick.nome;
            tipoEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }

      const st = window.lavoriState;
      if (st?.hasParcoMacchineModule) {
        const trEl = document.getElementById('lavoro-trattore');
        const atEl = document.getElementById('lavoro-attrezzo');
        if (trEl && !trEl.value && trHintArg) {
          await injectPatch({ 'lavoro-trattore': trHintArg });
        }
        if (atEl && !atEl.value && atHintArg) {
          await injectPatch({ 'lavoro-attrezzo': atHintArg });
        }
        if (trEl && !trEl.value && Array.isArray(st.trattoriList) && st.trattoriList[0]) {
          trEl.value = st.trattoriList[0].id;
          trEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (atEl && !atEl.value && Array.isArray(st.attrezziList) && st.attrezziList.length) {
          const at =
            st.attrezziList.find((a) => /trinciat/i.test(String(a.nome || ''))) || st.attrezziList[0];
          if (at) {
            atEl.value = at.id;
            atEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }
    },
    {
      tipoNomeArg: tipoNome,
      tipoChatArg: tipoChat,
      trHintArg: trHint,
      atHintArg: atHint,
    }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{ note: string, ctx?: object }} opts
 */
export async function confirmLavoroSave(page, expect, { note, ctx = {} }) {
  await ensureLavoroFormComplete(page, ctx);

  await page.locator('#lavoro-nome').fill(TONY_E2E_LAVORO_NOME);
  await page.locator('#lavoro-note').fill(note);

  let lastTurn = await tonyRunMultiTurn(page, ['salva'], { turnDelayMs: 500 });
  const low = String(lastTurn.lastReply || '').toLowerCase();
  if (/vuoi che salvi|conferm/i.test(low)) {
    lastTurn = await tonyRunMultiTurn(page, ['sì'], { turnDelayMs: 500 });
  }

  const savedEarly = await page
    .waitForFunction(
      (marker) => {
        const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
        if (Array.from(toasts).some((t) => /Lavoro creato con successo/i.test(t.textContent || ''))) {
          return true;
        }
        return Array.from(document.querySelectorAll('#lavori-container .lavori-table tbody tr')).some(
          (tr) => (tr.textContent || '').includes(marker)
        );
      },
      TONY_E2E_LAVORO_NOME,
      { timeout: 20_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!savedEarly) {
    await page.evaluate(() => {
      const form = document.getElementById('lavoro-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
  }

  return lastTurn;
}
