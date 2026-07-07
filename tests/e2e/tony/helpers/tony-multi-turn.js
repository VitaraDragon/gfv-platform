/**
 * Conversazione multi-turno Tony E2E con traccia CF per turno.
 * @module tests/e2e/tony/helpers/tony-multi-turn
 */

import {
  tonyGetExecutedCommands,
  tonyGetLastPerfMetrics,
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
    const perf = await waitForTonyTurnPerf(page, {
      timeoutMs: Math.min(replyTimeoutMs, 60_000),
    });
    perfTurns.push(perf);
    turnCtx = {
      lastReply: reply,
      lastPerf: perf,
      lastCommands: await tonyGetExecutedCommands(page),
    };
    if (typeof opts.afterTurn === 'function') {
      await opts.afterTurn(page, msg, turnCtx);
    }
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
 * @param {import('@playwright/test').Expect} expect
 * @param {Array<object|null|undefined>} perfTurns
 * @param {{ minCfTurns?: number }} [opts]
 */
export function assertCfTurnsMin(expect, perfTurns, opts = {}) {
  const min = typeof opts.minCfTurns === 'number' ? opts.minCfTurns : 1;
  const cfHits = perfTurns.filter(
    (p) => p && (p.cfCalled === true || p.usedGemini === true)
  ).length;
  expect(cfHits).toBeGreaterThanOrEqual(min);
}
