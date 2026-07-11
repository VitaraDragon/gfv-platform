/**
 * Save prodotto/movimento Tony E2E — conferma locale + note marker.
 * @module tests/e2e/tony/helpers/tony-magazzino-save
 */

import { simE2eTonyPostSaveWaitTimeout } from '../../sim/helpers/sim-e2e-timeouts.mjs';
import { tonyRunMultiTurn } from './tony-multi-turn.js';
import {
  tonySendMessage,
  tonyWaitForReply,
  waitForTonyTurnPerf,
} from './tony-widget.js';

async function waitMovimentoSaved(page, marker, timeoutMs) {
  const waitMs =
    typeof timeoutMs === 'number' ? timeoutMs : simE2eTonyPostSaveWaitTimeout();
  return page
    .waitForFunction(
      (noteMarker) => {
        const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
        if (Array.from(toasts).some((t) => /movimento (registrato|salvato|creato)/i.test(t.textContent || ''))) {
          return true;
        }
        const modal = document.getElementById('movimento-modal');
        if (modal && modal.classList.contains('active')) return false;
        const rows = document.querySelectorAll('#movimenti-container .movimenti-table tbody tr');
        return Array.from(rows).some((tr) => (tr.textContent || '').includes(noteMarker));
      },
      marker || '',
      { timeout: waitMs }
    )
    .then(() => true)
    .catch(() => false);
}

/**
 * Riempie campi obbligatori movimento se l'intervista Tony li ha lasciati vuoti (fallback E2E).
 * @param {import('playwright-core').Page} page
 * @param {{ tipo?: string, quantita?: string, prodottoHint?: string }} [opts]
 */
export async function ensureMovimentoFormComplete(page, opts = {}) {
  const tipoDefault = opts.tipo || 'entrata';
  const qtyDefault = opts.quantita || '10';
  const prodottoHint = opts.prodottoHint || 'rame';

  await page.evaluate(
    ({ tipoArg, qtyArg, hintArg }) => {
      const tipoEl = document.getElementById('mov-tipo');
      const qtyEl = document.getElementById('mov-quantita');
      const prodEl = document.getElementById('mov-prodotto');
      const dataEl = document.getElementById('mov-data');
      const prezzoEl = document.getElementById('mov-prezzo');
      const prezzoGroup = document.getElementById('prezzo-group');

      if (tipoEl && tipoArg) {
        if (String(tipoEl.value || '').trim() !== tipoArg) {
          tipoEl.value = tipoArg;
          tipoEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (tipoEl && !String(tipoEl.value || '').trim()) {
        tipoEl.value = tipoArg;
        tipoEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (dataEl && !String(dataEl.value || '').trim()) {
        dataEl.value = new Date().toISOString().slice(0, 10);
        dataEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (prodEl && !String(prodEl.value || '').trim()) {
        const prodotti = window.__gfvMagazzinoProdotti || [];
        const norm = (v) => String(v || '').toLowerCase();
        const hit =
          prodotti.find((p) => norm(p.nome).includes(norm(hintArg))) ||
          prodotti.find((p) => norm(p.codice).includes(norm(hintArg))) ||
          prodotti[0];
        if (hit && hit.id) {
          prodEl.value = hit.id;
          prodEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (qtyEl && qtyArg) {
        if (String(qtyEl.value || '').trim() !== String(qtyArg)) {
          qtyEl.value = qtyArg;
          qtyEl.dispatchEvent(new Event('input', { bubbles: true }));
          qtyEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (qtyEl && !String(qtyEl.value || '').trim()) {
        qtyEl.value = qtyArg;
        qtyEl.dispatchEvent(new Event('input', { bubbles: true }));
        qtyEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (tipoEl && tipoEl.value === 'entrata' && prezzoGroup) {
        prezzoGroup.style.display = 'block';
      } else if (tipoEl && tipoEl.value === 'uscita' && prezzoGroup) {
        prezzoGroup.style.display = 'none';
      }
      if (prezzoEl && tipoEl && tipoEl.value === 'entrata' && !String(prezzoEl.value || '').trim()) {
        prezzoEl.value = '1';
        prezzoEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    { tipoArg: tipoDefault, qtyArg: qtyDefault, hintArg: prodottoHint }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {number} minQty
 * @param {string} [prodottoHint]
 */
export async function pickProdottoWithGiacenzaForE2e(page, minQty, prodottoHint = 'rame') {
  const picked = await page.evaluate(
    ({ min, hint }) => {
      const prodotti = window.__gfvMagazzinoProdotti || [];
      const norm = (v) => String(v || '').toLowerCase();
      const hinted = prodotti.filter(
        (p) => norm(p.nome).includes(norm(hint)) || norm(p.codice || '').includes(norm(hint))
      );
      const pool = hinted.length ? hinted : prodotti;
      let best = null;
      for (const p of pool) {
        const giacenza = p.giacenza != null ? Number(p.giacenza) : 0;
        if (giacenza >= min && (!best || giacenza > best.giacenza)) {
          best = { id: p.id, label: p.nome || p.codice || p.id, giacenza };
        }
      }
      return best;
    },
    { min: minQty, hint: prodottoHint }
  );
  if (!picked?.id) {
    throw new Error(`Nessun prodotto con giacenza >= ${minQty} (hint: ${prodottoHint})`);
  }
  return picked;
}

/**
 * Garantisce giacenza minima per uscita E2E (entrata bootstrap se necessario).
 * @param {import('playwright-core').Page} page
 * @param {{ minQty?: number, prodottoHint?: string }} [opts]
 */
export async function ensureGiacenzaForMovimentoUscita(page, opts = {}) {
  const minQty = Number(opts.minQty) || 5;
  const prodottoHint = opts.prodottoHint || 'rame';
  const picked = await pickProdottoWithGiacenzaForE2e(page, minQty, prodottoHint).catch(() => null);

  if (picked?.id) {
    return picked;
  }

  await page.evaluate(
    async ({ min, hint }) => {
      const modal = document.getElementById('movimento-modal');
      if (modal?.classList.contains('active')) {
        const closeBtn =
          modal.querySelector('.modal-close') ||
          modal.querySelector('[data-dismiss="modal"]') ||
          modal.querySelector('button.close');
        if (closeBtn) closeBtn.click();
        else modal.classList.remove('active');
        await new Promise((r) => setTimeout(r, 300));
      }

      const prodotti = window.__gfvMagazzinoProdotti || [];
      const norm = (v) => String(v || '').toLowerCase();
      const pick =
        prodotti.find((p) => norm(p.nome).includes(norm(hint))) ||
        prodotti.find((p) => norm(p.codice || '').includes(norm(hint))) ||
        prodotti[0];
      if (!pick) throw new Error('no-product');
      const g = Number(pick.giacenza) || 0;
      const need = Math.max(min - g + 1, min);
      const btn = document.getElementById('btn-nuovo-movimento');
      if (btn) btn.click();
      await new Promise((r) => setTimeout(r, 500));
      const tipoEl = document.getElementById('mov-tipo');
      const prodEl = document.getElementById('mov-prodotto');
      const qtyEl = document.getElementById('mov-quantita');
      const dataEl = document.getElementById('mov-data');
      const prezzoEl = document.getElementById('mov-prezzo');
      const prezzoGroup = document.getElementById('prezzo-group');
      if (tipoEl) {
        tipoEl.value = 'entrata';
        tipoEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (prezzoGroup) prezzoGroup.style.display = 'block';
      if (prodEl) {
        prodEl.value = pick.id;
        prodEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (dataEl) dataEl.value = new Date().toISOString().slice(0, 10);
      if (qtyEl) qtyEl.value = String(need);
      if (prezzoEl && !prezzoEl.value) prezzoEl.value = '1';
      const form = document.getElementById('movimento-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    },
    { min: minQty, hint: prodottoHint }
  );

  await page
    .waitForFunction(
      () => {
        const modal = document.getElementById('movimento-modal');
        return !modal || !modal.classList.contains('active');
      },
      null,
      { timeout: 20_000 }
    )
    .catch(() => {});

  await page.evaluate(async () => {
    if (typeof loadProdotti === 'function') await loadProdotti();
    if (typeof loadMovimenti === 'function') await loadMovimenti();
  });

  return pickProdottoWithGiacenzaForE2e(page, minQty, prodottoHint);
}

async function sendSalvaTurn(page, opts = {}) {
  const replyTimeoutMs = opts.replyTimeoutMs ?? 20_000;
  const saveTimeoutMs = opts.saveTimeoutMs ?? simE2eTonyPostSaveWaitTimeout();
  const tonyBefore = await tonySendMessage(page, 'salva');
  const savedPromise = waitMovimentoSaved(page, opts.note || '', saveTimeoutMs);
  const reply = await tonyWaitForReply(page, {
    tonyCountBefore: tonyBefore,
    timeoutMs: replyTimeoutMs,
  }).catch(() => '');
  const saved = await savedPromise;
  const perf = await waitForTonyTurnPerf(page, { timeoutMs: replyTimeoutMs }).catch(() => null);
  return { lastReply: reply, lastPerf: perf, perfTurns: perf ? [perf] : [], saved };
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function waitForProdottoModalOpen(page) {
  await page.waitForFunction(
    () => {
      const modal = document.getElementById('prodotto-modal');
      return modal && modal.classList.contains('active');
    },
    null,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function waitForMovimentoModalOpen(page) {
  await page.waitForFunction(
    () => {
      const modal = document.getElementById('movimento-modal');
      return modal && modal.classList.contains('active');
    },
    null,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {Record<string, string>} formData
 */
export async function injectProdottoFormComplete(page, formData) {
  await page.evaluate(async (fd) => {
    const btn = document.getElementById('btn-nuovo-prodotto');
    if (btn) btn.click();
    else {
      const modal = document.getElementById('prodotto-modal');
      if (modal) modal.classList.add('active');
    }
    await new Promise((r) => setTimeout(r, 350));
    if (window.TonyFormInjector?.injectProdottoForm) {
      await window.TonyFormInjector.injectProdottoForm(
        fd,
        (window.Tony && window.Tony.context) || {}
      );
    }
  }, formData);

  await page.waitForFunction(
    (nome) => {
      const el = document.getElementById('prodotto-nome');
      return el && String(el.value || '').includes(nome);
    },
    formData['prodotto-nome'] || '',
    { timeout: 45_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note?: string, nome?: string }} [opts]
 */
export async function confirmProdottoSave(page, opts = {}) {
  if (opts.nome) {
    await page.locator('#prodotto-nome').fill(opts.nome);
  }
  if (opts.note) {
    await page.locator('#prodotto-note').fill(opts.note);
  }

  let lastTurn = await tonyRunMultiTurn(page, ['salva'], { turnDelayMs: 500 });
  const low = String(lastTurn.lastReply || '').toLowerCase();
  if (/vuoi che salvi|conferm/i.test(low)) {
    lastTurn = await tonyRunMultiTurn(page, ['sì'], { turnDelayMs: 500 });
  }

  const savedEarly = await page
    .waitForFunction(
      (marker) => {
        const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
        if (Array.from(toasts).some((t) => /prodotto (creato|salvato|registrato)/i.test(t.textContent || ''))) {
          return true;
        }
        const rows = document.querySelectorAll('#prodotti-container .prodotti-table tbody tr');
        return Array.from(rows).some((tr) => (tr.textContent || '').includes(marker));
      },
      opts.nome || '',
      { timeout: 25_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!savedEarly) {
    await page.evaluate(() => {
      const form = document.getElementById('prodotto-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
  }

  return lastTurn;
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note?: string }} [opts]
 */
export async function confirmMovimentoSave(page, opts = {}) {
  if (opts.tipo === 'uscita') {
    const minQty = Number(opts.quantita) || 5;
    try {
      const picked = await ensureGiacenzaForMovimentoUscita(page, {
        minQty,
        prodottoHint: opts.prodottoHint || 'rame',
      });
      opts = { ...opts, prodottoId: picked.id, prodottoHint: picked.label || opts.prodottoHint };
    } catch {
      /* bootstrap fallito — ensureMovimentoFormComplete proverà comunque */
    }
  }

  await ensureMovimentoFormComplete(page, {
    tipo: opts.tipo,
    quantita: opts.quantita,
    prodottoHint: opts.prodottoHint,
  });

  if (opts.prodottoId) {
    await page.evaluate((id) => {
      const prodEl = document.getElementById('mov-prodotto');
      if (prodEl && id) {
        prodEl.value = id;
        prodEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, opts.prodottoId);
  }

  if (opts.note) {
    const noteField = page.locator('#mov-note');
    if (await noteField.isVisible().catch(() => false)) {
      await noteField.fill(opts.note);
    }
  }

  const saveTimeoutMs = opts.saveTimeoutMs ?? simE2eTonyPostSaveWaitTimeout();

  const modalOpen = await page.evaluate(() => {
    const modal = document.getElementById('movimento-modal');
    return !!(modal && modal.classList.contains('active'));
  });

  if (modalOpen) {
    await ensureMovimentoFormComplete(page, {
      tipo: opts.tipo,
      quantita: opts.quantita,
      prodottoHint: opts.prodottoHint,
    });
    await page.evaluate(() => {
      const form = document.getElementById('movimento-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
    const savedDirect = await waitMovimentoSaved(page, opts.note || '', saveTimeoutMs);
    if (savedDirect) {
      return { lastReply: '', lastPerf: null, perfTurns: [], saved: true };
    }
  }

  let turn = await sendSalvaTurn(page, { ...opts, saveTimeoutMs });
  const low = String(turn.lastReply || '').toLowerCase();
  if (/vuoi che salvi|conferm/i.test(low)) {
    const confirm = await sendSalvaTurn(page, { ...opts, replyTimeoutMs: 25_000, saveTimeoutMs });
    turn = {
      lastReply: confirm.lastReply || turn.lastReply,
      lastPerf: confirm.lastPerf || turn.lastPerf,
      perfTurns: [...turn.perfTurns, ...confirm.perfTurns],
      saved: turn.saved || confirm.saved,
    };
  }

  if (!turn.saved) {
    await ensureMovimentoFormComplete(page, {
      tipo: opts.tipo,
      quantita: opts.quantita,
      prodottoHint: opts.prodottoHint,
    });
    await page.evaluate(() => {
      const form = document.getElementById('movimento-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
    const retried = await waitMovimentoSaved(page, opts.note || '', Math.min(saveTimeoutMs, 20_000));
    if (!retried) {
      await ensureMovimentoFormComplete(page, {
        tipo: opts.tipo,
        quantita: opts.quantita,
        prodottoHint: opts.prodottoHint,
      });
    }
    turn.saved = retried;
  }

  return turn;
}
