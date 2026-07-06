/**
 * Assert `expect` da scenarios-matrix.json.
 * @module tests/e2e/tony/helpers/assert-scenario-expect
 */

import latencyBudgets from '../perf/latency-budgets.json' with { type: 'json' };
import {
  isTonyAdvancedActive,
  tonyGetExecutedCommands,
  tonyGetLastLatency,
  tonyGetLastPerfMetrics,
  tonyGetLastReplyText,
} from './tony-widget.js';

/** @type {Record<string, string>} */
const INJECTED_FIELD_DOM = {
  terreno: 'lavoro-terreno',
  'tipo-lavoro': 'lavoro-tipo-lavoro',
  'ora-inizio': 'ora-start',
  'ora-fine': 'ora-end',
};

/**
 * @param {import('playwright-core').Page} page
 * @param {string} fieldKey
 */
async function readInjectedFieldValue(page, fieldKey) {
  const domId = INJECTED_FIELD_DOM[fieldKey] || fieldKey;
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return (opt && (opt.textContent || opt.value)) || el.value || null;
    }
    return el.value || el.textContent || null;
  }, domId);
}

/**
 * @param {object} scenario
 * @param {object} expectBlock
 * @returns {number|undefined}
 */
function resolveLatencyBudget(scenario, expectBlock) {
  if (typeof expectBlock.latencyMsMax === 'number') return expectBlock.latencyMsMax;
  const cat = scenario.category && latencyBudgets.byCategory?.[scenario.category];
  if (cat && typeof cat.latencyMsMax === 'number') return cat.latencyMsMax;
  return latencyBudgets.defaults?.quickReplyMsMax;
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 * @param {{ urlBefore?: string }} [ctx]
 */
export async function assertScenarioExpect(page, expect, scenario, ctx = {}) {
  const exp = scenario.expect || {};

  if (exp.widgetVisible) {
    await expect(page.locator('#tony-fab')).toBeVisible();
  }

  if (exp.tonyAdvancedActive === true) {
    expect(await isTonyAdvancedActive(page)).toBe(true);
  }
  if (exp.tonyAdvancedActive === false) {
    expect(await isTonyAdvancedActive(page)).toBe(false);
  }

  const reply = ctx.lastReply != null ? String(ctx.lastReply) : await tonyGetLastReplyText(page);
  const perf = ctx.lastPerf || (await tonyGetLastPerfMetrics(page));
  const commands = ctx.lastCommands || (await tonyGetExecutedCommands(page));
  const latency = ctx.lastPerf
    ? {
        latencyMs: ctx.lastPerf.latencyMs,
        usedGemini: typeof ctx.lastPerf.usedGemini === 'boolean' ? ctx.lastPerf.usedGemini : null,
      }
    : await tonyGetLastLatency(page);

  if (Array.isArray(exp.responseMustMatch) && exp.responseMustMatch.length) {
    const low = reply.toLowerCase();
    for (const fragment of exp.responseMustMatch) {
      expect(low).toContain(String(fragment).toLowerCase());
    }
  }

  if (Array.isArray(exp.responseMustNotMatch)) {
    const low = reply.toLowerCase();
    for (const fragment of exp.responseMustNotMatch) {
      expect(low).not.toContain(String(fragment).toLowerCase());
    }
  }

  if (Array.isArray(exp.commands)) {
    for (const cmd of exp.commands) {
      expect(commands).toContain(cmd);
    }
  }

  if (Array.isArray(exp.commandsMustNot)) {
    for (const cmd of exp.commandsMustNot) {
      expect(commands).not.toContain(cmd);
    }
  }

  if (typeof exp.cfCallsMax === 'number') {
    const cfCalls = perf && typeof perf.cfCalled === 'boolean' ? (perf.cfCalled ? 1 : 0) : (perf?.usedGemini ? 1 : 0);
    expect(cfCalls).toBeLessThanOrEqual(exp.cfCallsMax);
  }

  if (typeof exp.usedGemini === 'boolean') {
    if (latency.usedGemini !== null) {
      expect(latency.usedGemini).toBe(exp.usedGemini);
    } else if (perf) {
      expect(!!perf.usedGemini).toBe(exp.usedGemini);
    }
  }

  const budget = resolveLatencyBudget(scenario, exp);
  if (typeof budget === 'number' && latency.latencyMs >= 0) {
    expect(latency.latencyMs).toBeLessThanOrEqual(budget);
  }

  if (Array.isArray(exp.injectedFields) && exp.injectedFields.length) {
    const needsLavoroModal = exp.injectedFields.some((k) => k === 'terreno' || k === 'tipo-lavoro');
    if (needsLavoroModal) {
      await page.locator('#lavoro-terreno').waitFor({ state: 'attached', timeout: 30_000 });
    }
    await page.waitForTimeout(800);
    for (const key of exp.injectedFields) {
      const val = await readInjectedFieldValue(page, key);
      expect(val, `campo inject ${key}`).toBeTruthy();
      if (key === 'ora-inizio' || key === 'ora-fine') {
        expect(String(val)).toMatch(/^\d{2}:\d{2}/);
      }
    }
  }

  if (exp.navigation) {
    const urlNow = page.url();
    if (exp.navigation.urlIncludes) {
      expect(urlNow).toContain(exp.navigation.urlIncludes);
    }
    if (exp.navigation.mustNotChange && ctx.urlBefore) {
      const beforePath = new URL(ctx.urlBefore).pathname;
      const nowPath = new URL(urlNow).pathname;
      expect(nowPath).toBe(beforePath);
    }
  }
}
