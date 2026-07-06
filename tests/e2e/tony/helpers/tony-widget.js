/**
 * Helper widget Tony per E2E browser (Playwright + seed sim).
 * @module tests/e2e/tony/helpers/tony-widget
 */

const DEFAULT_REPLY_TIMEOUT_MS = 45_000;
const REPLY_STABLE_MS = 400;

/**
 * Attende Tony.init + FAB visibile (non piano Free bloccato).
 * @param {import('playwright-core').Page} page
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function waitForTonyReady(page, { timeoutMs = 90_000 } = {}) {
  try {
    await page.waitForFunction(
      () => {
        const fab = document.getElementById('tony-fab');
        if (!fab) return false;
        if (fab.style.display === 'none') return false;
        return (
          window.Tony &&
          typeof window.Tony.isReady === 'function' &&
          window.Tony.isReady()
        );
      },
      null,
      { timeout: timeoutMs }
    );
  } catch (err) {
    const diag = await page.evaluate(() => ({
      path: (window.location && window.location.pathname) || '',
      fab: !!document.getElementById('tony-fab'),
      fabDisplay: document.getElementById('tony-fab') ? document.getElementById('tony-fab').style.display : null,
      tony: !!(window.Tony && typeof window.Tony.isReady === 'function'),
      ready: window.Tony && typeof window.Tony.isReady === 'function' ? window.Tony.isReady() : false,
      freemium: !!window.__tonyFreemiumBlocked,
    }));
    throw new Error(`Tony non pronto (${JSON.stringify(diag)}): ${err.message || err}`);
  }
  await page.waitForFunction(
    () => typeof window.__tonyDisplayProactive === 'function',
    null,
    { timeout: timeoutMs }
  ).catch(() => {});
}

/**
 * Apre il pannello chat Tony.
 * @param {import('playwright-core').Page} page
 */
export async function openTonyPanel(page) {
  const ok = await page.evaluate(() => {
    const fab = document.getElementById('tony-fab');
    const panel = document.getElementById('tony-panel');
    if (fab) fab.style.display = '';
    if (panel) {
      panel.style.display = '';
      panel.classList.add('is-open');
    }
    if (typeof window.__tonyOpenChatPanel === 'function') {
      window.__tonyOpenChatPanel();
      return true;
    }
    if (fab) {
      fab.click();
      return true;
    }
    return false;
  });
  if (!ok) throw new Error('Tony FAB non trovato — widget non caricato?');
  await page.locator('#tony-input').waitFor({ state: 'attached', timeout: 15_000 });
}

/**
 * Invia messaggio testo via input chat (non STT).
 * @param {import('playwright-core').Page} page
 * @param {string} text
 */
export async function tonySendMessage(page, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('tonySendMessage: testo vuoto');
  await openTonyPanel(page);
  await page.waitForTimeout(600);
  const tonyCountBefore = await page.evaluate(
    () =>
      document.querySelectorAll(
        '#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error'
      ).length
  );
  await page.locator('#tony-input').waitFor({ state: 'attached', timeout: 15_000 });
  await page.evaluate((msg) => {
    const input = document.getElementById('tony-input');
    const send = document.getElementById('tony-send');
    if (input) {
      input.value = msg;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (send) send.click();
  }, trimmed);
  await page.waitForFunction(
    (expected) => {
      const errNodes = document.querySelectorAll('#tony-messages .tony-msg.error');
      if (errNodes.length) {
        const errText = errNodes[errNodes.length - 1].textContent.toLowerCase();
        if (errText.includes('piano free') || errText.includes('abbonament')) return true;
      }
      const nodes = document.querySelectorAll('#tony-messages .tony-msg.user');
      if (!nodes.length) return false;
      return nodes[nodes.length - 1].textContent.trim() === expected;
    },
    trimmed,
    { timeout: 10_000 }
  );
  return tonyCountBefore;
}

/**
 * Invio messaggio che può innescare navigazione cross-page (no attesa bolla utente).
 * @param {import('playwright-core').Page} page
 * @param {string} text
 * @param {{ navUrlPattern?: RegExp|string, timeoutMs?: number }} [opts]
 */
export async function tonySendMessageCrossPage(page, text, opts = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('tonySendMessageCrossPage: testo vuoto');
  const timeoutMs = opts.timeoutMs || 90_000;
  const navPattern = opts.navUrlPattern || /gestione-lavori-standalone\.html/;

  await openTonyPanel(page);
  await page.waitForTimeout(600);
  const tonyCountBefore = await page.evaluate(
    () =>
      document.querySelectorAll(
        '#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error'
      ).length
  );
  await page.locator('#tony-input').waitFor({ state: 'attached', timeout: 15_000 });
  await page.evaluate((msg) => {
    const input = document.getElementById('tony-input');
    const send = document.getElementById('tony-send');
    if (input) {
      input.value = msg;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (send) send.click();
  }, trimmed);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (navPattern.test(page.url())) return tonyCountBefore;
    await page.waitForTimeout(250);
  }

  const hasPending = await page.evaluate(() => {
    try {
      return !!sessionStorage.getItem('tony_pending_lavoro_local_intent');
    } catch {
      return false;
    }
  });
  if (hasPending && !navPattern.test(page.url())) {
    return tonyCountBefore;
  }

  throw new Error('tonySendMessageCrossPage: navigazione non avviata');
}

/**
 * Attende risposta assistant stabile (no typing / busy E2E).
 * @param {import('playwright-core').Page} page
 * @param {{ timeoutMs?: number, stableMs?: number, tonyCountBefore?: number }} [opts]
 * @returns {Promise<string>} testo ultima bolla assistant
 */
export async function tonyWaitForReply(page, { timeoutMs = DEFAULT_REPLY_TIMEOUT_MS, stableMs = REPLY_STABLE_MS, tonyCountBefore = null } = {}) {
  const countBefore = typeof tonyCountBefore === 'number'
    ? tonyCountBefore
    : await page.evaluate(() => document.querySelectorAll('#tony-messages .tony-msg.tony').length);
  const deadline = Date.now() + timeoutMs;
  let lastText = '';
  let stableSince = 0;

  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => {
      const typing = !!document.querySelector('#tony-messages .tony-msg.typing');
      const nodes = document.querySelectorAll(
        '#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error'
      );
      return {
        typing,
        count: nodes.length,
        text: nodes.length ? nodes[nodes.length - 1].textContent.trim() : '',
      };
    });
    const hasNewReply = snapshot.count > countBefore;
    const text = hasNewReply ? snapshot.text : '';

    if (!snapshot.typing && hasNewReply && text) {
      if (text === lastText) {
        if (Date.now() - stableSince >= stableMs) return text;
      } else {
        lastText = text;
        stableSince = Date.now();
      }
    } else {
      lastText = text;
      stableSince = Date.now();
    }
    await page.waitForTimeout(100);
  }
  if (lastText) return lastText;
  throw new Error(`tonyWaitForReply: timeout ${timeoutMs}ms (ultimo: "${lastText.slice(0, 80)}")`);
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>}
 */
export async function tonyGetLastReplyText(page) {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll(
      '#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error'
    );
    if (!nodes.length) return '';
    return nodes[nodes.length - 1].textContent.trim();
  });
}

/**
 * Metriche ultimo turno (`window.__tonyLastPerf` se hook E2E attivo).
 * @param {import('playwright-core').Page} page
 */
export async function tonyGetLastPerfMetrics(page) {
  return page.evaluate(() => window.__tonyLastPerf || null);
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string[]>}
 */
export async function tonyGetExecutedCommands(page) {
  return page.evaluate(() => (window.__tonyLastCommands || []).slice());
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<{ latencyMs: number, usedGemini: boolean|null }>}
 */
export async function tonyGetLastLatency(page) {
  const perf = await tonyGetLastPerfMetrics(page);
  if (perf && typeof perf.latencyMs === 'number') {
    return {
      latencyMs: perf.latencyMs,
      usedGemini: typeof perf.usedGemini === 'boolean' ? perf.usedGemini : null,
    };
  }
  return { latencyMs: -1, usedGemini: null };
}

/**
 * Conferma dialog Tony APRI_PAGINA se visibile (E2E).
 * @param {import('playwright-core').Page} page
 */
export async function tonyConfirmNavigationIfNeeded(page) {
  const overlay = page.locator('#tony-confirm-overlay');
  const visible = await overlay.isVisible().catch(() => false);
  if (!visible) return;
  await page.locator('#tony-confirm-ok').click();
  await overlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<boolean>}
 */
export async function isTonyAdvancedActive(page) {
  return page.evaluate(
    () => typeof window.__tonyIsAdvancedActive === 'function' && window.__tonyIsAdvancedActive()
  );
}
