/**
 * Metriche latenza per scenario Tony E2E live (sopravvivono a navigazione post-save).
 * @module tests/e2e/tony/helpers/tony-e2e-scenario-perf
 */

/**
 * @param {Array<object|null|undefined>} perfTurns
 * @returns {object|null}
 */
export function pickTonyScenarioPerfFromTurns(perfTurns) {
  const turns = (perfTurns || []).filter((p) => p && typeof p.latencyMs === 'number' && p.latencyMs >= 0);
  if (!turns.length) return null;

  const cfTurns = turns.filter((p) => p.cfCalled === true || p.usedGemini === true);
  const pool = cfTurns.length ? cfTurns : turns;
  const worst = pool.reduce((best, p) => (p.latencyMs > best.latencyMs ? p : best), pool[0]);

  return {
    latencyMs: worst.latencyMs,
    usedGemini: typeof worst.usedGemini === 'boolean' ? worst.usedGemini : null,
    cfCalled: worst.cfCalled === true,
    at: worst.at || new Date().toISOString(),
  };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {object|null|undefined} perf
 */
export async function captureTonyScenarioPerf(page, perf) {
  if (!perf || typeof perf.latencyMs !== 'number') return;
  await page.evaluate((payload) => {
    window.__tonyE2eScenarioPerf = payload;
    try {
      sessionStorage.setItem('__tonyE2eScenarioPerf', JSON.stringify(payload));
    } catch (e) { /* ignore */ }
  }, perf);
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<object|null>}
 */
export async function readTonyScenarioPerf(page) {
  return page.evaluate(() => {
    if (window.__tonyE2eScenarioPerf) return window.__tonyE2eScenarioPerf;
    try {
      const raw = sessionStorage.getItem('__tonyE2eScenarioPerf');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return window.__tonyLastPerf || null;
  });
}

/**
 * Salva risposta Tony prima di navigazione cross-page (assert multi-dominio).
 * @param {import('playwright-core').Page} page
 * @param {string} replyText
 */
export async function captureTonyScenarioReply(page, replyText) {
  const text = String(replyText || '').trim();
  if (!text) return;
  await page.evaluate((payload) => {
    window.__tonyE2eScenarioReply = payload;
    try {
      sessionStorage.setItem('__tonyE2eScenarioReply', payload);
    } catch (e) { /* ignore */ }
  }, text);
}

/**
 * Pulisce metriche/risposta scenario E2E (sessionStorage condiviso tra tab stesso origin).
 * @param {import('playwright-core').Page} page
 */
export async function resetTonyE2eScenarioState(page) {
  await page.evaluate(() => {
    delete window.__tonyE2eScenarioPerf;
    delete window.__tonyE2eScenarioReply;
    delete window.__tonyLastPerf;
    try {
      sessionStorage.removeItem('__tonyE2eScenarioPerf');
      sessionStorage.removeItem('__tonyE2eScenarioReply');
    } catch (e) { /* ignore */ }
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} [fallbackReply]
 * @param {number} [bubbleCount]
 */
export async function readTonyScenarioReply(page, fallbackReply = '', bubbleCount = 4) {
  const fromPage = await page
    .evaluate((count) => {
      if (window.__tonyE2eScenarioReply) return String(window.__tonyE2eScenarioReply);
      try {
        const stored = sessionStorage.getItem('__tonyE2eScenarioReply');
        if (stored) return stored;
      } catch (e) { /* ignore */ }
      const nodes = document.querySelectorAll('#tony-messages .tony-msg.tony');
      if (!nodes.length) return '';
      return Array.from(nodes)
        .slice(-count)
        .map((n) => (n.textContent || '').trim())
        .filter(Boolean)
        .join('\n');
    }, bubbleCount)
    .catch(() => '');
  if (fromPage.trim()) return fromPage;
  return fallbackReply != null ? String(fallbackReply) : '';
}
