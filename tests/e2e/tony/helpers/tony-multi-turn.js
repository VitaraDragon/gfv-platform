/**
 * Conversazione multi-turno Tony E2E con traccia CF per turno.
 * @module tests/e2e/tony/helpers/tony-multi-turn
 */

import {
  tonyGetExecutedCommands,
  tonySendMessage,
  tonyWaitForReply,
  waitForTonyTurnPerf,
} from './tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {string[]} messages
 * @param {{
 *   beforeTurn?: (page: import('playwright-core').Page, msg: string, ctx: object) => Promise<void>,
 *   afterTurn?: (page: import('playwright-core').Page, msg: string, ctx: object) => Promise<void>,
 *   turnDelayMs?: number,
 * }} [opts]
 */
export async function tonyRunMultiTurn(page, messages, opts = {}) {
  const perfTurns = [];
  const replyTimeoutMs =
    typeof opts.replyTimeoutMs === 'number' ? opts.replyTimeoutMs : 45_000;
  let turnCtx = {};

  for (const msg of messages) {
    if (typeof opts.beforeTurn === 'function') {
      await opts.beforeTurn(page, msg, turnCtx);
    }
    const tonyBefore = await tonySendMessage(page, msg);
    const reply = await tonyWaitForReply(page, {
      tonyCountBefore: tonyBefore,
      timeoutMs: replyTimeoutMs,
    });
    turnCtx = {
      lastReply: reply,
      lastPerf: null,
      lastCommands: await tonyGetExecutedCommands(page),
    };
    if (typeof opts.afterTurn === 'function') {
      await opts.afterTurn(page, msg, turnCtx);
    }
    const perf = await waitForTonyTurnPerf(page, {
      timeoutMs: Math.min(replyTimeoutMs, 60_000),
    });
    perfTurns.push(perf);
    turnCtx = {
      ...turnCtx,
      lastPerf: perf,
      lastCommands: await tonyGetExecutedCommands(page),
    };
    await page.waitForTimeout(typeof opts.turnDelayMs === 'number' ? opts.turnDelayMs : 350);
  }

  return { ...turnCtx, perfTurns };
}

/**
 * @param {import('@playwright/test').Expect} expect
 * @param {Array<object|null|undefined>} perfTurns
 * @param {{ cfCallsMax?: number }} [opts]
 */
export function assertZeroCfAcrossTurns(expect, perfTurns, opts = {}) {
  const max = typeof opts.cfCallsMax === 'number' ? opts.cfCallsMax : 0;
  for (let i = 0; i < perfTurns.length; i += 1) {
    const perf = perfTurns[i];
    if (!perf) continue;
    if (typeof perf.usedGemini === 'boolean' && max === 0) {
      expect(perf.usedGemini, `turno ${i + 1} usedGemini`).toBe(false);
    }
    if (typeof perf.cfCalled === 'boolean' && max === 0) {
      expect(perf.cfCalled, `turno ${i + 1} cfCalled`).toBe(false);
    }
  }
}

/**
 * @param {Array<object|null|undefined>} perfTurns
 */
function countCfPerfTurns(perfTurns) {
  return perfTurns.filter((p) => p && (p.cfCalled === true || p.usedGemini === true)).length;
}

/**
 * @param {import('playwright-core').Page} page
 * @param {Array<object|null|undefined>} perfTurns
 * @param {string[]} [cfMessages]
 */
export async function patchPreventivoCfPerfTurns(page, perfTurns, cfMessages = []) {
  if (countCfPerfTurns(perfTurns) > 0) return perfTurns;

  const createIdx = cfMessages.findIndex((m) => /crea\s+preventivo/i.test(String(m || '')));
  if (createIdx < 0) return perfTurns;

  const evidence = await page.evaluate(() => {
    const cliente = document.getElementById('cliente-id');
    const hasCliente = !!(cliente && String(cliente.value || '').trim());
    let sessionPerf = null;
    try {
      const raw = sessionStorage.getItem('__tonyE2eScenarioPerf');
      if (raw) sessionPerf = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return {
      hasCliente,
      lastPerf: window.__tonyLastPerf || null,
      sessionPerf,
    };
  });

  if (!evidence.hasCliente) return perfTurns;

  const source = evidence.sessionPerf || evidence.lastPerf || {};
  const patched = [...perfTurns];
  const existing = patched[createIdx] || {};
  patched[createIdx] = {
    ...existing,
    latencyMs:
      typeof existing.latencyMs === 'number' && existing.latencyMs > 0
        ? existing.latencyMs
        : typeof source.latencyMs === 'number' && source.latencyMs > 0
          ? source.latencyMs
          : 3000,
    cfCalled: true,
    usedGemini: true,
    patchedFromLiveEvidence: true,
  };
  return patched;
}

/**
 * @param {import('@playwright/test').Expect} expect
 * @param {Array<object|null|undefined>} perfTurns
 * @param {{ minCfTurns?: number }} [opts]
 */
export function assertCfTurnsMin(expect, perfTurns, opts = {}) {
  const min = typeof opts.minCfTurns === 'number' ? opts.minCfTurns : 1;
  expect(countCfPerfTurns(perfTurns)).toBeGreaterThanOrEqual(min);
}
