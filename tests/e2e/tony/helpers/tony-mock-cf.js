/**
 * Stub client-side Tony.ask / askStream per Livello 2 E2E (zero Gemini).
 * @module tests/e2e/tony/helpers/tony-mock-cf
 */

import { buildMockCfBundle } from './tony-mock-responses.mjs';

/**
 * Installa flag mock CF (addInitScript — ogni navigazione).
 * @param {import('playwright-core').Page} page
 * @param {{ scenarioId?: string, scenario?: object }} [options]
 */
export async function installTonyMockCf(page, options = {}) {
  const scenarioId = options.scenarioId || options.scenario?.id || '';
  await page.addInitScript((sid) => {
    window.__GFV_TONY_E2E_MOCK_CF = true;
    window.__GFV_TONY_E2E_MOCK_SCENARIO = sid || null;
    window.__GFV_TONY_E2E_MOCK_INSTALLED = false;
  }, scenarioId);
}

/**
 * Attiva wrap ask/askStream dopo Tony.init.
 * @param {import('playwright-core').Page} page
 * @param {object} scenario — voce matrice
 */
export async function activateTonyMockCf(page, scenario) {
  const bundle = buildMockCfBundle(scenario);
  await page.evaluate((mockBundle) => {
    if (!window.__GFV_TONY_E2E_MOCK_CF || !window.Tony) return;

    function stripClientSuffix(raw) {
      var s = String(raw || '');
      var idx = s.indexOf('[ISTRUZIONE CLIENT');
      return (idx >= 0 ? s.slice(0, idx) : s).trim();
    }

    function resolveMock(userPrompt) {
      var text = stripClientSuffix(userPrompt).toLowerCase();

      if (mockBundle.dynamic === 'riassunto_tabella' && /\b(sintesi\s+tabella|tabella\s+lavori)\b/i.test(text)) {
        var pageCtx = (window.Tony && window.Tony.context && window.Tony.context.page) || {};
        var table = window.currentTableData || pageCtx.currentTableData || null;
        var summary =
          (typeof pageCtx.tableDataSummary === 'string' && pageCtx.tableDataSummary.trim()) ||
          (table && typeof table.summary === 'string' ? table.summary.trim() : '') ||
          'Elenco lavori caricato.';
        return { text: summary, command: { type: 'RIASSUNTO' } };
      }

      var staticMap = mockBundle.staticResponses || {};
      var keys = Object.keys(staticMap);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (text.indexOf(String(key).toLowerCase()) >= 0) {
          return staticMap[key];
        }
      }

      return {
        text: 'Mock CF (' + (mockBundle.scenarioId || 'unknown') + '): messaggio non mappato.',
        command: null,
      };
    }

    if (window.__GFV_TONY_E2E_MOCK_INSTALLED) return;
    window.__GFV_TONY_E2E_MOCK_INSTALLED = true;

    window.Tony.ask = async function mockedTonyAsk(userPrompt) {
      return resolveMock(userPrompt);
    };

    if (typeof window.Tony.askStream === 'function') {
      window.Tony.askStream = async function mockedTonyAskStream(userPrompt, opts) {
        var mock = resolveMock(userPrompt);
        var out = mock.text || 'Ok.';
        if (opts && typeof opts.onChunk === 'function' && out) opts.onChunk(out);
        return mock;
      };
    }

    window.__GFV_TONY_E2E_MOCK_PROBE = resolveMock('portami alle tariffe').text || '';
  }, bundle);

  const probe = await page.evaluate(() => ({
    flag: !!window.__GFV_TONY_E2E_MOCK_CF,
    installed: !!window.__GFV_TONY_E2E_MOCK_INSTALLED,
    probe: window.__GFV_TONY_E2E_MOCK_PROBE || '',
  }));
  if (!probe.installed) {
    throw new Error(`Mock CF non installato (${scenario.id})`);
  }
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function uninstallTonyMockCf(page) {
  await page.evaluate(() => {
    delete window.__GFV_TONY_E2E_MOCK_CF;
    delete window.__GFV_TONY_E2E_MOCK_SCENARIO;
    delete window.__GFV_TONY_E2E_MOCK_INSTALLED;
  });
}
