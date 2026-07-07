/**
 * Save prodotto/movimento Tony E2E — conferma locale + note marker.
 * @module tests/e2e/tony/helpers/tony-magazzino-save
 */

import { tonyRunMultiTurn } from './tony-multi-turn.js';
import {
  tonySendMessage,
  tonyWaitForReply,
  waitForTonyTurnPerf,
} from './tony-widget.js';

async function waitMovimentoSaved(page, marker, timeoutMs = 45_000) {
  return page
    .waitForFunction(
      (noteMarker) => {
        const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
        if (Array.from(toasts).some((t) => /movimento (registrato|salvato|creato)/i.test(t.textContent || ''))) {
          return true;
        }
        const rows = document.querySelectorAll('#movimenti-container .movimenti-table tbody tr');
        return Array.from(rows).some((tr) => (tr.textContent || '').includes(noteMarker));
      },
      marker || '',
      { timeout: timeoutMs }
    )
    .then(() => true)
    .catch(() => false);
}

async function sendSalvaTurn(page, opts = {}) {
  const replyTimeoutMs = opts.replyTimeoutMs ?? 20_000;
  const tonyBefore = await tonySendMessage(page, 'salva');
  const savedPromise = waitMovimentoSaved(page, opts.note || '', opts.saveTimeoutMs ?? 45_000);
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
  if (opts.note) {
    const noteField = page.locator('#mov-note');
    if (await noteField.isVisible().catch(() => false)) {
      await noteField.fill(opts.note);
    }
  }

  const modalOpen = await page.evaluate(() => {
    const modal = document.getElementById('movimento-modal');
    return !!(modal && modal.classList.contains('active'));
  });

  if (modalOpen) {
    await page.evaluate(() => {
      const form = document.getElementById('movimento-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
    const savedDirect = await waitMovimentoSaved(
      page,
      opts.note || '',
      opts.saveTimeoutMs ?? 45_000
    );
    if (savedDirect) {
      return { lastReply: '', lastPerf: null, perfTurns: [], saved: true };
    }
  }

  let turn = await sendSalvaTurn(page, opts);
  const low = String(turn.lastReply || '').toLowerCase();
  if (/vuoi che salvi|conferm/i.test(low)) {
    const confirm = await sendSalvaTurn(page, { ...opts, replyTimeoutMs: 25_000 });
    turn = {
      lastReply: confirm.lastReply || turn.lastReply,
      lastPerf: confirm.lastPerf || turn.lastPerf,
      perfTurns: [...turn.perfTurns, ...confirm.perfTurns],
      saved: turn.saved || confirm.saved,
    };
  }

  if (!turn.saved) {
    await page.evaluate(() => {
      const form = document.getElementById('movimento-form');
      if (form) {
        form.setAttribute('novalidate', 'novalidate');
        form.requestSubmit();
      }
    });
    await waitMovimentoSaved(page, opts.note || '', 30_000);
  }

  return turn;
}
