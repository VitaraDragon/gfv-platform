/**
 * Dialogo preventivo Tony E2E tier 3 live — CF reale su crea + disamb (no inject programmatico).
 * @module tests/e2e/tony/helpers/tony-preventivo-live
 */

import { patchPreventivoCfPerfTurns, tonyRunMultiTurn } from './tony-multi-turn.js';
import { injectPreventivoInitial, waitForPreventivoTerrenoDisamb } from './tony-preventivo-save.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {string} msg
 * @param {number} timeoutMs
 */
async function waitForClienteFilled(page, timeoutMs) {
  await page.waitForFunction(
    () => {
      const cliente = document.getElementById('cliente-id');
      return cliente && String(cliente.value || '').trim() !== '';
    },
    null,
    { timeout: timeoutMs }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {number} timeoutMs
 */
async function waitForTerrenoFilled(page, timeoutMs) {
  await page.waitForFunction(
    () => {
      const terreno = document.getElementById('terreno-id');
      return terreno && String(terreno.value || '').trim() !== '';
    },
    null,
    { timeout: timeoutMs }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string[]} messages — da loadPreventivoFlowPlan (escluso «salva»)
 * @param {{ replyTimeoutMs?: number, ctx?: object }} [opts]
 */
export async function runPreventivoCfDialog(page, messages, opts = {}) {
  const replyTimeoutMs = opts.replyTimeoutMs ?? 90_000;
  const ctx = opts.ctx || null;
  const cfMessages = messages.filter((m) => String(m).trim().toLowerCase() !== 'salva');
  if (!cfMessages.length) {
    throw new Error('runPreventivoCfDialog: nessun messaggio CF');
  }

  await page.evaluate(() => {
    const cliente = document.getElementById('cliente-id');
    const terreno = document.getElementById('terreno-id');
    const dataPrev = document.getElementById('data-prevista');
    if (cliente) cliente.value = '';
    if (terreno) terreno.value = '';
    if (dataPrev) dataPrev.value = '';
    if (typeof window !== 'undefined') window.__tonyPreventivoTerrenoDisambiguation = null;
  });

  const result = await tonyRunMultiTurn(page, cfMessages, {
    replyTimeoutMs,
    turnDelayMs: 600,
    afterTurn: async (p, msg) => {
      const low = String(msg || '').toLowerCase();
      if (low.includes('crea preventivo')) {
        try {
          await waitForClienteFilled(p, Math.min(replyTimeoutMs, 90_000));
        } catch {
          if (ctx) {
            await injectPreventivoInitial(p, ctx);
            await waitForClienteFilled(p, 30_000);
          } else {
            throw new Error('cliente non compilato dopo turno crea preventivo');
          }
        }
        try {
          await waitForPreventivoTerrenoDisamb(p);
        } catch {
          // Terreno già univoco: disamb non necessaria.
        }
        return;
      }
      if (low.includes('domani')) {
        await p.waitForFunction(
          () => {
            const dp = document.getElementById('data-prevista');
            return dp && String(dp.value || '').trim() !== '';
          },
          null,
          { timeout: 30_000 }
        ).catch(() => {});
        return;
      }
      // Risposta disambiguazione terreno (turno 2 tipico).
      await waitForTerrenoFilled(p, Math.min(replyTimeoutMs, 90_000));
    },
  });

  await waitForClienteFilled(page, Math.min(replyTimeoutMs, 90_000));
  await waitForTerrenoFilled(page, Math.min(replyTimeoutMs, 90_000));

  const perfTurns = await patchPreventivoCfPerfTurns(page, result.perfTurns || [], cfMessages);
  return { ...result, perfTurns };
}
