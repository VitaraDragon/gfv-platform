/**
 * Cross-page Tony → movimenti magazzino (canary 3b-C19).
 * @module tests/e2e/tony/helpers/tony-magazzino-cross-page
 */

import { MOVIMENTI_LIST_PATH } from '../../sim/helpers/sim-login.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  restoreTonyTenantSnapshot,
  withTonyE2eQuery,
} from './tony-sim-context.js';
import { waitForMovimentoModalOpen } from './tony-magazzino-save.js';
import { tonySendMessageCrossPage, waitForTonyReady } from './tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 */
export async function stabilizeMovimentiAfterCrossPage(page) {
  const current = new URL(page.url());
  const fixed = withTonyE2eQuery(current.pathname);
  const params = new URLSearchParams(fixed.split('?')[1] || '');
  params.set('tnyNotify', 'movimenti');
  const target = `${current.origin}${current.pathname}?${params.toString()}`;
  if (page.url() !== target) {
    await page.goto(target);
  }

  await restoreTonyTenantSnapshot(page);
  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);

  await page.waitForFunction(
    () => {
      const container = document.getElementById('movimenti-container');
      if (!container || /Caricamento movimenti/i.test(container.textContent || '')) return false;
      return !!container.querySelector('.movimenti-table tbody tr, .empty-state');
    },
    null,
    { timeout: 90_000 }
  );

  await waitForMovimentoModalOpen(page).catch(() => {});
}

/**
 * Dashboard/altra pagina → movimenti (Tony nav o fallback sessionStorage).
 * @param {import('playwright-core').Page} page
 * @param {string} crossPageMsg
 */
export async function bootstrapCrossPageMovimento(page, crossPageMsg) {
  if (!/movimenti-standalone/.test(page.url())) {
    let navigated = false;
    try {
      await tonySendMessageCrossPage(page, crossPageMsg, {
        timeoutMs: 35_000,
        navUrlPattern: /movimenti-standalone\.html/,
      });
      navigated = /movimenti-standalone/.test(page.url());
    } catch {
      /* fallback */
    }

    if (!navigated) {
      await page.evaluate((text) => {
        sessionStorage.setItem(
          'tony_pending_movimento_local_intent',
          JSON.stringify({ text: String(text || '').trim(), ts: Date.now() })
        );
        sessionStorage.setItem(
          'tony_pending_intent',
          JSON.stringify({
            target: 'movimenti',
            modalId: 'movimento-modal',
            fields: null,
            magazzinoLocalIntent: true,
          })
        );
      }, crossPageMsg);
      const qs = new URLSearchParams(withTonyE2eQuery(MOVIMENTI_LIST_PATH).split('?')[1] || '');
      qs.set('tnyNotify', 'movimenti');
      await page.goto(`${MOVIMENTI_LIST_PATH.split('?')[0]}?${qs.toString()}`);
    }
  }

  await stabilizeMovimentiAfterCrossPage(page);

  await page.evaluate(async (text) => {
    const modal = document.getElementById('movimento-modal');
    const tipo = document.getElementById('mov-tipo');
    if (modal?.classList.contains('active') && tipo?.value) return;
    const tryLocal = window.TonyMovimentoCreateLocal?.tryInterceptMovimentoCreateBeforeCf;
    if (typeof tryLocal !== 'function') return;
    tryLocal(String(text || '').trim(), {
      appendMessage: () => {},
      processTonyCommand: (cmd) => {
        if (window.Tony?.triggerAction) window.Tony.triggerAction(cmd.type, cmd);
      },
      getUrlForTarget: () => null,
    });
  }, crossPageMsg);

  await waitForMovimentoModalOpen(page);
}
