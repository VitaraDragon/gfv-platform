/**
 * Assert `expect` da scenarios-matrix.json.
 * @module tests/e2e/tony/helpers/assert-scenario-expect
 */

import { simE2ePause } from '../../sim/helpers/sim-e2e-timeouts.mjs';
import latencyBudgets from '../perf/latency-budgets.json' with { type: 'json' };
import { readTonyScenarioReply } from './tony-e2e-scenario-perf.mjs';
import {
  isTonyAdvancedActive,
  tonyGetExecutedCommands,
  tonyGetLastLatency,
  tonyGetLastPerfMetrics,
  tonyGetLastReplyText,
} from './tony-widget.js';

/** @type {Record<string, string | string[]>} */
const INJECTED_FIELD_DOM = {
  terreno: 'lavoro-terreno',
  'tipo-lavoro': 'lavoro-tipo-lavoro',
  // Mobile workspace (#ora-start) e desktop segnatura (#ora-inizio)
  'ora-inizio': ['ora-inizio', 'ora-start'],
  'ora-fine': ['ora-fine', 'ora-end'],
};

/**
 * @param {import('playwright-core').Page} page
 * @param {string} fieldKey
 */
async function readInjectedFieldValue(page, fieldKey) {
  const mapped = INJECTED_FIELD_DOM[fieldKey] || fieldKey;
  const domIds = Array.isArray(mapped) ? mapped : [mapped];
  for (const domId of domIds) {
    const val = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      if (el.tagName === 'SELECT') {
        const opt = el.options[el.selectedIndex];
        return (opt && (opt.textContent || opt.value)) || el.value || null;
      }
      return el.value || el.textContent || null;
    }, domId);
    if (val) return val;
  }
  return null;
}

/**
 * @param {object} scenario
 * @param {object} expectBlock
 * @returns {number|undefined}
 */
function resolveLatencyBudget(scenario, expectBlock) {
  if (typeof expectBlock.latencyMsMax === 'number') return expectBlock.latencyMsMax;
  const cat = scenario.category && latencyBudgets.byCategory?.[scenario.category];
  if (scenario.tier === 3 && cat && typeof cat.liveLatencyMsMax === 'number') {
    return cat.liveLatencyMsMax;
  }
  if (cat && typeof cat.latencyMsMax === 'number') return cat.latencyMsMax;
  return undefined;
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 * @param {{ urlBefore?: string }} [ctx]
 */
async function readTonyBubblesText(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error'))
      .map((node) => node.textContent || '')
      .join('\n')
  );
}

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

  const lastReply = ctx.lastReply != null ? String(ctx.lastReply) : await tonyGetLastReplyText(page);
  const reply =
    Array.isArray(exp.responseMustMatchGroups) && exp.responseMustMatchGroups.length
      ? await readTonyScenarioReply(page, lastReply)
      : lastReply;
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

  if (Array.isArray(exp.responseMustMatchAny) && exp.responseMustMatchAny.length) {
    const low = reply.toLowerCase();
    const hit = exp.responseMustMatchAny.some((fragment) =>
      low.includes(String(fragment).toLowerCase())
    );
    expect(hit).toBe(true);
  }

  if (Array.isArray(exp.responseMustNotMatch)) {
    const low = reply.toLowerCase();
    for (const fragment of exp.responseMustNotMatch) {
      expect(low).not.toContain(String(fragment).toLowerCase());
    }
  }

  if (Array.isArray(exp.chatMustNotMatch) && exp.chatMustNotMatch.length) {
    const allChat = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error'))
        .map((node) => node.textContent || '')
        .join('\n')
        .toLowerCase()
    );
    for (const fragment of exp.chatMustNotMatch) {
      expect(allChat, `chat non deve contenere «${fragment}»`).not.toContain(String(fragment).toLowerCase());
    }
  }

  if (Array.isArray(exp.responseMustMatchGroups) && exp.responseMustMatchGroups.length) {
    const low = reply.toLowerCase();
    let matched = 0;
    for (const group of exp.responseMustMatchGroups) {
      if (!Array.isArray(group) || !group.length) continue;
      const groupHit = group.some((fragment) => low.includes(String(fragment).toLowerCase()));
      if (groupHit) matched += 1;
    }
    const minGroups =
      typeof exp.responseMustMatchGroupsMin === 'number'
        ? exp.responseMustMatchGroupsMin
        : exp.responseMustMatchGroups.length;
    expect(matched).toBeGreaterThanOrEqual(minGroups);
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

  if (exp.quickReplyHit === true) {
    const geminiUsed =
      latency.usedGemini !== null
        ? latency.usedGemini
        : perf && typeof perf.usedGemini === 'boolean'
          ? perf.usedGemini
          : null;
    expect(geminiUsed).toBe(false);
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
    await page.waitForTimeout(simE2ePause(800));
    for (const key of exp.injectedFields) {
      const val = await readInjectedFieldValue(page, key);
      expect(val, `campo inject ${key}`).toBeTruthy();
      if (key === 'ora-inizio' || key === 'ora-fine') {
        expect(String(val)).toMatch(/^\d{2}:\d{2}/);
      }
    }
  }

  if (exp.formFieldEquals || exp.formFieldIncludes || exp.injectPayloadEquals) {
    await waitForScenarioFormFields(page, exp);
  }

  if (Array.isArray(exp.bubblesMustMatch) && exp.bubblesMustMatch.length) {
    const blob = (await readTonyBubblesText(page)).toLowerCase();
    for (const fragment of exp.bubblesMustMatch) {
      expect(blob, `le bolle Tony devono contenere «${fragment}»`).toContain(String(fragment).toLowerCase());
    }
  }
  if (Array.isArray(exp.bubblesMustNotMatch) && exp.bubblesMustNotMatch.length) {
    const blob = (await readTonyBubblesText(page)).toLowerCase();
    for (const fragment of exp.bubblesMustNotMatch) {
      expect(blob, `nessuna bolla Tony deve contenere «${fragment}»`).not.toContain(String(fragment).toLowerCase());
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
    if (exp.navigation.mustChange && ctx.urlBefore) {
      const beforePath = new URL(ctx.urlBefore).pathname;
      const nowPath = new URL(urlNow).pathname;
      expect(nowPath).not.toBe(beforePath);
    }
  }
}

/**
 * Assert sul singolo turno (catene multi-messaggio). Non sostituisce `expect` finale.
 * @param {import('@playwright/test').Expect} expect
 * @param {string} reply
 * @param {object} [turnExpect]
 */
/**
 * Attende che il form movimento (o l'ultimo inject) abbia i valori del turno.
 * `formFieldEquals` è uguaglianza sul value DOM. `formFieldIncludes` è sottostringa.
 * `injectPayloadEquals` legge `window.__tonyMagazzinoLastInject.formData`.
 * @param {import('playwright-core').Page} page
 * @param {object} [spec]
 */
export async function waitForScenarioFormFields(page, spec) {
  if (!spec) return;
  const equals = spec.formFieldEquals || null;
  const includes = spec.formFieldIncludes || null;
  const payload = spec.injectPayloadEquals || null;
  if (!equals && !includes && !payload) return;
  await page.waitForFunction(
    ({ eq, inc, pay }) => {
      function read(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        return el.value != null ? String(el.value) : '';
      }
      if (eq) {
        const keys = Object.keys(eq);
        for (let i = 0; i < keys.length; i++) {
          if (read(keys[i]) !== String(eq[keys[i]])) return false;
        }
      }
      if (inc) {
        const keys = Object.keys(inc);
        for (let i = 0; i < keys.length; i++) {
          if (read(keys[i]).toLowerCase().indexOf(String(inc[keys[i]]).toLowerCase()) < 0) return false;
        }
      }
      if (pay) {
        const inj = window.__tonyMagazzinoLastInject;
        const fd = inj && inj.formData;
        if (!fd) return false;
        const keys = Object.keys(pay);
        for (let i = 0; i < keys.length; i++) {
          if (String(fd[keys[i]] == null ? '' : fd[keys[i]]) !== String(pay[keys[i]])) return false;
        }
      }
      return true;
    },
    { eq: equals, inc: includes, pay: payload },
    { timeout: 20000 }
  );
}

export function assertTurnExpect(expect, reply, turnExpect) {
  if (!turnExpect) return;
  const low = String(reply || '').toLowerCase();
  if (Array.isArray(turnExpect.responseMustMatch)) {
    for (const fragment of turnExpect.responseMustMatch) {
      expect(low, `turno deve contenere «${fragment}»`).toContain(String(fragment).toLowerCase());
    }
  }
  if (Array.isArray(turnExpect.responseMustMatchAny) && turnExpect.responseMustMatchAny.length) {
    const hit = turnExpect.responseMustMatchAny.some((fragment) =>
      low.includes(String(fragment).toLowerCase())
    );
    expect(hit, `turno deve contenere uno di: ${turnExpect.responseMustMatchAny.join(', ')}`).toBe(true);
  }
  if (Array.isArray(turnExpect.responseMustNotMatch)) {
    for (const fragment of turnExpect.responseMustNotMatch) {
      expect(low, `turno non deve contenere «${fragment}»`).not.toContain(String(fragment).toLowerCase());
    }
  }
}
