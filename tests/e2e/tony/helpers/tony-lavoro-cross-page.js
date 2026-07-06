/**
 * Dopo nav cross-page Tony → gestione-lavori: ripristina emulator/tonyE2e e pending intent.
 * @module tests/e2e/tony/helpers/tony-lavoro-cross-page
 */

import { GESTIONE_LAVORI_PATH } from '../../sim/helpers/sim-login.js';
import {
  gotoTonyE2ePage,
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
 * @param {import('playwright-core').Page} page
 * @param {string} crossPageMsg
 */
export async function stabilizeGestioneLavoriAfterCrossPage(page, crossPageMsg) {
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

  await page.evaluate(() => {
    if (
      typeof window.openCreaModal === 'function' &&
      !document.getElementById('lavoro-modal')?.classList.contains('active')
    ) {
      window.openCreaModal();
    }
  });
  await waitForLavoroModalOpen(page);

  await page.evaluate(async (text) => {
    if (
      window.__tonyLavoroTerrenoDisambCandidates &&
      window.__tonyLavoroTerrenoDisambCandidates.length > 1
    ) {
      return;
    }
    window.__tonyLavoroCreationFlow = true;
    if (typeof window.TonyFormInjector?.resetLavoroInterviewSessionState === 'function') {
      window.TonyFormInjector.resetLavoroInterviewSessionState();
    }
    const waitReady = window.TonyFormInjector?.waitForLavoriFormDataReady
      ? window.TonyFormInjector.waitForLavoriFormDataReady(8000)
      : Promise.resolve(true);
    const waitMan = window.TonyFormInjector?.waitForLavoriManodoperaReady
      ? window.TonyFormInjector.waitForLavoriManodoperaReady(6000)
      : Promise.resolve(true);
    await Promise.all([waitReady, waitMan]);
    if (typeof window.TonyFormInjector?.applyLavoroInterviewFromUserReply === 'function') {
      await window.TonyFormInjector.applyLavoroInterviewFromUserReply(String(text || '').trim());
    }
  }, crossPageMsg);

  await waitForTerrenoDisambReady(page);
}

/**
 * Dashboard → gestione lavori (Tony nav o fallback sessionStorage).
 * @param {import('playwright-core').Page} page
 * @param {string} crossPageMsg
 */
export async function bootstrapCrossPageLavoro(page, crossPageMsg) {
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
  await stabilizeGestioneLavoriAfterCrossPage(page, crossPageMsg);
}
