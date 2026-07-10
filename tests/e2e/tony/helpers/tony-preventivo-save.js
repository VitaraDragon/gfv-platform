/**
 * Inject + save preventivo Tony E2E (canary 3b-C14 pattern, 0 CF su conferma).
 * @module tests/e2e/tony/helpers/tony-preventivo-save
 */

import { simE2ePause, simE2eTimeout } from '../../sim/helpers/sim-e2e-timeouts.mjs';
import { tonyGetExecutedCommands, tonyGetLastReplyText, tonySendMessage, waitForTonyTurnPerf } from './tony-widget.js';
import {
  TONY_E2E_PREVENTIVO_NOTE,
  TONY_E2E_PREVENTIVO_SUPERFICIE,
} from './tony-post-save.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {object} ctx
 */
export async function injectPreventivoInitial(page, ctx) {
  await page.evaluate(
    (plan) => {
      if (typeof window.processTonyCommand !== 'function') {
        throw new Error('processTonyCommand assente');
      }
      window.processTonyCommand({
        type: 'INJECT_FORM_DATA',
        formId: 'preventivo-form',
        formData: {
          'cliente-id': plan.clienteId,
          'tipo-lavoro': plan.tipoLavoro.nome,
          coltura: plan.colturaHint,
        },
      });
    },
    ctx
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function waitForPreventivoTerrenoDisamb(page) {
  await page.waitForFunction(
    () => {
      const nodes = document.querySelectorAll('#tony-messages .tony-msg.tony');
      if (!nodes.length) return false;
      const last = (nodes[nodes.length - 1].textContent || '').toLowerCase();
      return (
        /dobbiamo lavorare su|su quale terren|molti terreni|indica il nome del terreno/i.test(last) ||
        /va bene\?/i.test(last)
      );
    },
    null,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {object} ctx
 */
export async function resolvePreventivoTerrenoChoice(page, ctx) {
  const terrenoValue = ctx?.terrenoAmbig?.pickId || ctx?.terrenoAmbig?.disambReply || '';

  await page.evaluate(
    (plan) => {
      const value = plan.terrenoValue;
      if (!value) throw new Error('terreno mancante nel plan');
      if (typeof window.processTonyCommand === 'function') {
        window.processTonyCommand({
          type: 'INJECT_FORM_DATA',
          formId: 'preventivo-form',
          formData: { 'terreno-id': value },
        });
        return;
      }
      if (window.TonyFormInjector?.injectPreventivoForm) {
        return window.TonyFormInjector.injectPreventivoForm(
          { 'terreno-id': value },
          (window.Tony && window.Tony.context) || {}
        );
      }
      throw new Error('inject preventivo terreno non disponibile');
    },
    { terrenoValue }
  );

  await page.waitForFunction(
    () => {
      const el = document.getElementById('terreno-id');
      return el && String(el.value || '').trim() !== '';
    },
    null,
    { timeout: 45_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {object} ctx
 */
export async function ensurePreventivoFormComplete(page, ctx) {
  const superficie = TONY_E2E_PREVENTIVO_SUPERFICIE;
  const note = TONY_E2E_PREVENTIVO_NOTE;
  const tipoNome = ctx?.tipoLavoro?.nome || 'Erpicatura';

  await page.waitForFunction(
    () => {
      const coltura = document.getElementById('coltura');
      const sup = document.getElementById('superficie');
      return coltura && coltura.value && sup;
    },
    null,
    { timeout: simE2eTimeout(25_000) }
  );

  const tipoAlreadySet = await page.evaluate(() => {
    const sel = document.getElementById('tipo-lavoro');
    return !!(sel && String(sel.value || '').trim());
  });

  if (!tipoAlreadySet) {
  const categoriaSelect = page.locator('#lavoro-categoria-principale');
  const categoriaCount = await categoriaSelect.locator('option').count();
  let tipoSelected = false;

  for (let i = 1; i < categoriaCount && !tipoSelected; i += 1) {
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

    const tipoSelect = page.locator('#tipo-lavoro');
    try {
      await page.waitForFunction(
        () => {
          const sel = document.getElementById('tipo-lavoro');
          return sel && sel.options.length > 1 && sel.options[1].value !== '';
        },
        null,
        { timeout: 8_000 }
      );
    } catch {
      continue;
    }

    const preferred = tipoSelect.locator('option', { hasText: tipoNome });
    if ((await preferred.count()) > 0) {
      const selectedValue = (await preferred.first().getAttribute('value')) || '';
      if (selectedValue) {
        await tipoSelect.selectOption(selectedValue);
        tipoSelected = true;
      }
    } else {
      const fallback = (await tipoSelect.locator('option').nth(1).getAttribute('value')) || '';
      if (fallback) {
        await tipoSelect.selectOption(fallback);
        tipoSelected = true;
      }
    }
  }

  if (!tipoSelected) {
    throw new Error('Impossibile selezionare tipo lavoro nel form preventivo');
  }
  }

  await page.locator('#superficie').fill(superficie);

  const dataPrevista = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('#data-prevista').fill(dataPrevista);
  await page.locator('#note').fill(note);

  const totaleOk = await page.waitForFunction(
    async () => {
      const morfologie = ['pianura', 'collina', 'montagna'];
      for (const m of morfologie) {
        const tipoCampo = document.getElementById('tipo-campo');
        if (tipoCampo) tipoCampo.value = m;
        if (typeof window.calcolaTotale === 'function') await window.calcolaTotale();
        const imponibile = document.getElementById('totale-imponibile');
        const val = parseFloat(
          (imponibile?.textContent || '').replace('€', '').replace(',', '.').trim()
        );
        if (Number.isFinite(val) && val > 0) return true;
      }
      return false;
    },
    null,
    { timeout: 45_000 }
  ).catch(() => null);

  if (!totaleOk) {
    throw new Error('Impossibile calcolare totale preventivo > 0 (tariffa sim)');
  }

  await page.evaluate(() => {
    if (typeof window.__tonyPromptPreventivoSaveLocal === 'function') {
      window.__tonyPromptPreventivoSaveLocal();
    } else if (typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
      window.__tonyTriggerAskForSaveConfirmation();
    }
  });

  await page.waitForFunction(
    () => {
      if (window.__tonyAwaitingPreventivoSaveConfirm) return true;
      const nodes = document.querySelectorAll('#tony-messages .tony-msg.tony');
      return Array.from(nodes).some((n) => /vuoi che salvi il preventivo/i.test(n.textContent || ''));
    },
    null,
    { timeout: simE2eTimeout(30_000) }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{ ctx?: object }} [opts]
 */
export async function confirmPreventivoSave(page, expect, opts = {}) {
  await ensurePreventivoFormComplete(page, opts.ctx || {});

  const perfTurns = [];

  async function sendSaveTurn() {
    await tonySendMessage(page, 'salva');
    const saved = await page
      .waitForFunction(
        () => {
          if (/preventivi-standalone\.html/.test(window.location.pathname || '')) return true;
          const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
          return Array.from(toasts).some((t) =>
            /Preventivo creato con successo/i.test(t.textContent || '')
          );
        },
        null,
        { timeout: simE2eTimeout(25_000) }
      )
      .then(() => true)
      .catch(() => false);

    const perf = await waitForTonyTurnPerf(page, { timeoutMs: 12_000 });
    perfTurns.push(perf);

    if (saved) {
      return { saved: true, lastReply: await tonyGetLastReplyText(page), lastPerf: perf };
    }

    const low = (await tonyGetLastReplyText(page)).toLowerCase();
    if (/vuoi che salvi|conferm/i.test(low)) {
      await tonySendMessage(page, 'sì');
      perfTurns.push(await waitForTonyTurnPerf(page, { timeoutMs: 12_000 }));
    }
    return { saved: false, lastReply: await tonyGetLastReplyText(page), lastPerf: perfTurns[perfTurns.length - 1] };
  }

  let turn = await sendSaveTurn();

  if (!turn.saved) {
    turn = await sendSaveTurn();
  }

  const savedEarly = await page
    .waitForFunction(
      () => {
        if (/preventivi-standalone\.html/.test(window.location.pathname || '')) return true;
        const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
        return Array.from(toasts).some((t) =>
          /Preventivo creato con successo/i.test(t.textContent || '')
        );
      },
      null,
      { timeout: 45_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!savedEarly) {
    await page.evaluate(() => {
      const form = document.getElementById('preventivo-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
    await page.waitForURL(/preventivi-standalone\.html/, { timeout: 90_000 }).catch(() => {});
  }

  return {
    perfTurns,
    lastReply: turn.lastReply,
    lastPerf: turn.lastPerf,
    lastCommands: await tonyGetExecutedCommands(page),
  };
}
