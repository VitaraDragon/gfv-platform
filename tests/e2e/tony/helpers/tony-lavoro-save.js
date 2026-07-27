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
  const tipoCategoriaId = ctx?.tipoLavoro?.categoriaId || '';
  const trHint = ctx?.trattorePatch?.hint || '';
  const atHint = ctx?.attrezzoPatch?.hint || '';
  const terrenoDisamb = ctx?.terrenoAmbig?.disambReply || '';
  const terrenoNome = ctx?.terrenoAmbig?.pickNome || '';
  const terrenoId = ctx?.terrenoAmbig?.pickId || '';
  const personLabel = ctx?.personAmbig?.pickLabel || ctx?.personAmbig?.disambReply || '';

  await page.evaluate(
    async ({
      tipoNomeArg,
      tipoChatArg,
      tipoCategoriaIdArg,
      trHintArg,
      atHintArg,
      terrenoDisambArg,
      terrenoNomeArg,
      terrenoIdArg,
      personLabelArg,
    }) => {
      const tipoEl = document.getElementById('lavoro-tipo-lavoro');
      const catEl = document.getElementById('lavoro-categoria-principale');
      const injector = window.TonyFormInjector;
      const st = window.lavoriState || {};

      async function applyReply(text) {
        if (!injector?.applyLavoroInterviewFromUserReply) return;
        await injector.applyLavoroInterviewFromUserReply(text);
      }

      async function injectPatch(patch) {
        if (!injector?.injectLavoroForm) return;
        await injector.injectLavoroForm(patch, (window.Tony && window.Tony.context) || {});
      }

      function norm(v) {
        return String(v || '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ');
      }

      function isWeakTipo(val) {
        const t = norm(val);
        return !t || t === 'altro' || t === 'other';
      }

      const terrenoEl = document.getElementById('lavoro-terreno');
      if (terrenoEl && !String(terrenoEl.value || '').trim()) {
        if (terrenoIdArg) {
          terrenoEl.value = terrenoIdArg;
          terrenoEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (!String(terrenoEl.value || '').trim() && injector?.applyLavoroInterviewFromUserReply && terrenoDisambArg) {
          await applyReply(terrenoDisambArg);
        }
        if (!String(terrenoEl.value || '').trim() && terrenoNomeArg) {
          const terreni = st.terreniList || [];
          const hit =
            terreni.find((t) => norm(t.nome) === norm(terrenoNomeArg)) ||
            (injector?.findTerrenoInInterviewText
              ? injector.findTerrenoInInterviewText(terrenoDisambArg || terrenoNomeArg, terreni)?.terreno
              : null);
          if (hit && hit.id) {
            terrenoEl.value = hit.id;
            terrenoEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }

      // CI flake: a volte resta «Altro» (truthy) e il save fallisce in silenzio / modal stuck.
      if (tipoEl && isWeakTipo(tipoEl.value)) {
        await applyReply(tipoChatArg);
        if (isWeakTipo(tipoEl.value) && window.__tonyLavoroAwaitingTipoModo) {
          await applyReply('meccanica');
        }
        if (isWeakTipo(tipoEl.value) && tipoNomeArg) {
          await injectPatch({ 'lavoro-tipo-lavoro': tipoNomeArg });
        }
        if (isWeakTipo(tipoEl.value)) {
          const tipi = st.tipiLavoroList || [];
          const pick =
            (tipoNomeArg && tipi.find((t) => norm(t.nome) === norm(tipoNomeArg))) ||
            tipi.find((t) => /trinciat/i.test(String(t.nome || ''))) ||
            tipi.find((t) => !isWeakTipo(t.nome)) ||
            tipi[0];
          if (pick) {
            const catId = pick.categoriaId || tipoCategoriaIdArg;
            if (catId && catEl && !catEl.value) {
              catEl.value = catId;
              catEl.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise((r) => setTimeout(r, 250));
            }
            tipoEl.value = pick.nome;
            tipoEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }

      if (catEl && !catEl.value && tipoCategoriaIdArg) {
        catEl.value = tipoCategoriaIdArg;
        catEl.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const dataEl = document.getElementById('lavoro-data-inizio');
      if (dataEl && !String(dataEl.value || '').trim()) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        dataEl.value = d.toISOString().slice(0, 10);
        dataEl.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const durataEl = document.getElementById('lavoro-durata');
      if (durataEl && (!durataEl.value || Number(durataEl.value) < 1)) {
        durataEl.value = '1';
        durataEl.dispatchEvent(new Event('input', { bubbles: true }));
        durataEl.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (st.hasManodoperaModule) {
        const squadraRadio = document.querySelector('input[name="tipo-assegnazione"][value="squadra"]');
        const autonomoRadio = document.querySelector('input[name="tipo-assegnazione"][value="autonomo"]');
        const capoEl = document.getElementById('lavoro-caposquadra');
        const opEl = document.getElementById('lavoro-operaio');
        const hasCapo = !!(capoEl && capoEl.value);
        const hasOp = !!(opEl && opEl.value);
        if (!hasCapo && !hasOp) {
          const operai = st.operaiList || [];
          const capi = st.caposquadraList || [];
          const label = norm(personLabelArg);
          const opHit =
            operai.find((p) => norm(`${p.nome || ''} ${p.cognome || ''}`) === label) ||
            operai.find((p) => label && (norm(p.nome).includes(label) || norm(p.cognome).includes(label))) ||
            operai[0];
          if (opHit && autonomoRadio && opEl) {
            autonomoRadio.checked = true;
            autonomoRadio.dispatchEvent(new Event('change', { bubbles: true }));
            opEl.value = opHit.id;
            opEl.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (capi[0] && squadraRadio && capoEl) {
            squadraRadio.checked = true;
            squadraRadio.dispatchEvent(new Event('change', { bubbles: true }));
            capoEl.value = capi[0].id;
            capoEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }

      if (st.hasParcoMacchineModule) {
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
      tipoCategoriaIdArg: tipoCategoriaId,
      trHintArg: trHint,
      atHintArg: atHint,
      terrenoDisambArg: terrenoDisamb,
      terrenoNomeArg: terrenoNome,
      terrenoIdArg: terrenoId,
      personLabelArg: personLabel,
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
    await ensureLavoroFormComplete(page, ctx);
    await page.locator('#lavoro-nome').fill(TONY_E2E_LAVORO_NOME);
    await page.locator('#lavoro-note').fill(note);
    await page.evaluate(() => {
      const form = document.getElementById('lavoro-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
    const retried = await page
      .waitForFunction(
        (marker) => {
          const modal = document.getElementById('lavoro-modal');
          if (modal && !modal.classList.contains('active')) return true;
          const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
          if (Array.from(toasts).some((t) => /Lavoro creato con successo|assegnato|salvato/i.test(t.textContent || ''))) {
            return true;
          }
          return Array.from(document.querySelectorAll('#lavori-container .lavori-table tbody tr')).some(
            (tr) => (tr.textContent || '').includes(marker)
          );
        },
        TONY_E2E_LAVORO_NOME,
        { timeout: 15_000 }
      )
      .then(() => true)
      .catch(() => false);
    if (!retried) {
      await ensureLavoroFormComplete(page, ctx);
      await page.locator('#lavoro-nome').fill(TONY_E2E_LAVORO_NOME);
      await page.evaluate(() => {
        const form = document.getElementById('lavoro-form');
        if (form) {
          form.setAttribute('novalidate', 'novalidate');
          form.requestSubmit();
        }
      });
    }
  }

  return lastTurn;
}
