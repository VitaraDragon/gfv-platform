/**
 * Dopo nav cross-page Tony → gestione-lavori: ripristina emulator/tonyE2e e pending intent.
 * @module tests/e2e/tony/helpers/tony-lavoro-cross-page
 */

import { GESTIONE_LAVORI_PATH } from '../../sim/helpers/sim-login.js';
import {
  withTonyE2eQuery,
  restoreTonyTenantSnapshot,
  bootstrapTonyWidgetOnStandalonePage,
} from './tony-sim-context.js';
import { waitForLavoriStateReady } from './tony-lavoro-flow-discover.js';
import { tonySendMessageCrossPage, waitForTonyReady } from './tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 */
export async function waitForLavoroModalOpen(page) {
  await page.waitForFunction(
    () => {
      const modal = document.getElementById('lavoro-modal');
      return modal && modal.classList.contains('active');
    },
    null,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function waitForTerrenoDisambReady(page) {
  await page.waitForFunction(
    () => {
      if (
        window.__tonyLavoroTerrenoDisambCandidates &&
        window.__tonyLavoroTerrenoDisambCandidates.length > 1
      ) {
        return true;
      }
      const nodes = document.querySelectorAll('#tony-messages .tony-msg.tony');
      if (!nodes.length) return false;
      const last = (nodes[nodes.length - 1].textContent || '').toLowerCase();
      return /pi[uù]\s+terren|su quale terren|ho trovato pi[uù]/i.test(last);
    },
    null,
    { timeout: 90_000 }
  );
}

/**
 * Attende TonyFormInjector (caricato async con il widget).
 * @param {import('playwright-core').Page} page
 */
async function waitForTonyFormInjectorReady(page) {
  await page.waitForFunction(
    () =>
      typeof window.TonyFormInjector?.applyLavoroInterviewFromUserReply === 'function' &&
      typeof window.TonyFormInjector?.findTerrenoInInterviewText === 'function',
    null,
    { timeout: 30_000 }
  );
}

/**
 * Attende disamb terreno da pending-after-nav Tony (~500ms post-init).
 * @param {import('playwright-core').Page} page
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
async function waitForPendingTonyLavoroDisamb(page, { timeoutMs = 12_000 } = {}) {
  try {
    await page.waitForFunction(
      () => {
        if (
          window.__tonyLavoroTerrenoDisambCandidates &&
          window.__tonyLavoroTerrenoDisambCandidates.length > 1
        ) {
          return true;
        }
        const nodes = document.querySelectorAll('#tony-messages .tony-msg.tony');
        if (!nodes.length) return false;
        const last = (nodes[nodes.length - 1].textContent || '').toLowerCase();
        return /pi[uù]\s+terren|su quale terren|ho trovato pi[uù]/i.test(last);
      },
      null,
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Applica messaggio cross-page e forza disamb terreno se l'injector non l'ha impostata.
 * @param {import('playwright-core').Page} page
 * @param {string} crossPageMsg
 * @param {{ terrenoAmbig?: { query?: string } | null }} [opts]
 */
async function applyCrossPageLavoroInterview(page, crossPageMsg, opts = {}) {
  await page.evaluate(
    async (payload) => {
      const text = String(payload.text || '').trim();
      const ambig = payload.ambig || null;
      const inj = window.TonyFormInjector;
      if (!inj) return;

      function ensureTerrenoDisamb() {
        if (
          window.__tonyLavoroTerrenoDisambCandidates &&
          window.__tonyLavoroTerrenoDisambCandidates.length > 1
        ) {
          return true;
        }
        const list = (window.lavoriState && window.lavoriState.terreniList) || [];
        if (!list.length) return false;

        const parsed = inj.stripLavoroCreationIntentPrefix
          ? inj.stripLavoroCreationIntentPrefix(text)
          : text.replace(/^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\s+/i, '').trim();

        let hit = inj.findTerrenoInInterviewText(parsed, list);
        if (!hit && parsed !== text) hit = inj.findTerrenoInInterviewText(text, list);
        if (hit && hit.ambiguous && inj.offerTerrenoDisambResponse) {
          inj.offerTerrenoDisambResponse(hit, text);
          return (
            window.__tonyLavoroTerrenoDisambCandidates &&
            window.__tonyLavoroTerrenoDisambCandidates.length > 1
          );
        }

        const q = ambig && ambig.query ? String(ambig.query).trim() : parsed;
        if (q && inj.findTerrenoInInterviewText && inj.offerTerrenoDisambResponse) {
          const ambHit = inj.findTerrenoInInterviewText(q, list);
          if (ambHit && ambHit.ambiguous) {
            inj.offerTerrenoDisambResponse(ambHit, text);
            return (
              window.__tonyLavoroTerrenoDisambCandidates &&
              window.__tonyLavoroTerrenoDisambCandidates.length > 1
            );
          }
        }
        return false;
      }

      if (ensureTerrenoDisamb()) return;

      window.__tonyLavoroCreationFlow = true;
      if (typeof inj.resetLavoroInterviewSessionState === 'function') {
        inj.resetLavoroInterviewSessionState();
      }
      const waitReady = inj.waitForLavoriFormDataReady
        ? inj.waitForLavoriFormDataReady(8000)
        : Promise.resolve(true);
      const waitMan = inj.waitForLavoriManodoperaReady
        ? inj.waitForLavoriManodoperaReady(6000)
        : Promise.resolve(true);
      await Promise.all([waitReady, waitMan]);

      if (typeof inj.applyLavoroInterviewFromUserReply === 'function') {
        await inj.applyLavoroInterviewFromUserReply(text);
      }
      ensureTerrenoDisamb();
    },
    { text: crossPageMsg, ambig: opts.terrenoAmbig || null }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} crossPageMsg
 * @param {{ terrenoAmbig?: { query?: string } | null }} [opts]
 */
export async function stabilizeGestioneLavoriAfterCrossPage(page, crossPageMsg, opts = {}) {
  const current = new URL(page.url());
  const fixed = withTonyE2eQuery(current.pathname);
  const params = new URLSearchParams(fixed.split('?')[1] || '');
  params.set('tnyNotify', 'lavori');
  const target = `${current.origin}${current.pathname}?${params.toString()}`;
  if (page.url() !== target) {
    await page.goto(target);
  }

  await restoreTonyTenantSnapshot(page);
  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
  await waitForLavoriStateReady(page);
  await waitForTonyFormInjectorReady(page);

  // Tony pending-after-nav (checkTonyPendingAfterNav) applica l'intent ~500ms dopo init.
  // Non resettare subito: attendi prima che produca disamb terreno.
  if (await waitForPendingTonyLavoroDisamb(page)) {
    return;
  }

  await page.evaluate(() => {
    try {
      sessionStorage.removeItem('tony_pending_intent');
      sessionStorage.removeItem('tony_pending_lavoro_local_intent');
    } catch {
      /* ignore */
    }
  });

  await page.evaluate(async () => {
    if (
      typeof window.openCreaModal === 'function' &&
      !document.getElementById('lavoro-modal')?.classList.contains('active')
    ) {
      await window.openCreaModal();
    }
  });
  await waitForLavoroModalOpen(page);

  await applyCrossPageLavoroInterview(page, crossPageMsg, opts);
  await waitForTerrenoDisambReady(page);
}

/**
 * Dashboard → gestione lavori (Tony nav o fallback sessionStorage).
 * @param {import('playwright-core').Page} page
 * @param {string} crossPageMsg
 * @param {{ terrenoAmbig?: { query?: string } | null }} [opts]
 */
export async function bootstrapCrossPageLavoro(page, crossPageMsg, opts = {}) {
  if (!/gestione-lavori-standalone/.test(page.url())) {
    let navigated = false;
    try {
      await tonySendMessageCrossPage(page, crossPageMsg, { timeoutMs: 35_000 });
      navigated = /gestione-lavori-standalone/.test(page.url());
    } catch {
      /* fallback sotto */
    }

    if (!navigated) {
      await page.evaluate((text) => {
        sessionStorage.setItem(
          'tony_pending_lavoro_local_intent',
          JSON.stringify({ text: String(text || '').trim(), ts: Date.now() })
        );
        sessionStorage.setItem(
          'tony_pending_intent',
          JSON.stringify({
            target: 'gestione lavori',
            modalId: 'lavoro-modal',
            fields: null,
            lavoroLocalIntent: true,
          })
        );
      }, crossPageMsg);
      const qs = new URLSearchParams(withTonyE2eQuery(GESTIONE_LAVORI_PATH).split('?')[1] || '');
      qs.set('tnyNotify', 'lavori');
      await page.goto(`${GESTIONE_LAVORI_PATH.split('?')[0]}?${qs.toString()}`);
    }
  }
  await stabilizeGestioneLavoriAfterCrossPage(page, crossPageMsg, opts);
}
