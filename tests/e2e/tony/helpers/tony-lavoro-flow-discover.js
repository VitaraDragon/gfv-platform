/**
 * Discovery contesto lavoro Tony E2E — terreni/operai ambigui su seed sim.
 * @module tests/e2e/tony/helpers/tony-lavoro-flow-discover
 */

import { GESTIONE_LAVORI_PATH } from '../../sim/helpers/sim-login.js';
import { gotoTonyE2ePage, restoreTonyTenantSnapshot } from './tony-sim-context.js';

/**
 * Attende lavoriState popolato su gestione-lavori.
 * @param {import('playwright-core').Page} page
 */
export async function waitForLavoriStateReady(page) {
  await page.waitForFunction(
    () => {
      const st = window.lavoriState;
      if (!st) return false;
      const terreni = st.terreniList;
      const operai = st.operaiList;
      const trattori = st.trattoriList;
      return (
        Array.isArray(terreni) &&
        terreni.length >= 2 &&
        Array.isArray(operai) &&
        operai.length >= 1 &&
        (!Array.isArray(trattori) || trattori.length >= 0)
      );
    },
    null,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<object>}
 */
export async function discoverLavoroAmbiguiContext(page) {
  await waitForLavoriStateReady(page);

  return page.evaluate(() => {
    function normalizeTonyText(value) {
      return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[àáâãä]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u');
    }

    function scoreTerrenoInterviewMatch(queryText, terrenoNome) {
      const t = normalizeTonyText(queryText);
      const n = normalizeTonyText(terrenoNome || '');
      if (!t || !n || t.length < 2) return 0;
      if (t === n) return 1000;
      if (n.indexOf(t) >= 0) return 800 + Math.min(t.length, 40);
      if (t.indexOf(n) >= 0) return 700 + Math.min(n.length, 40);
      const queryParts = t.split(/\s+/).filter((w) => w.length >= 2);
      if (queryParts.length >= 2) {
        const matched = queryParts.filter((w) => n.indexOf(w) >= 0);
        if (matched.length === queryParts.length) return 500 + matched.length * 10;
        if (matched.length > 0) return 100 + matched.length * 10;
        return 0;
      }
      if (queryParts.length === 1 && n.indexOf(queryParts[0]) >= 0) return 300;
      return 0;
    }

    function findAmbiguousTerreno(terreni) {
      const queries = new Set();
      terreni.forEach((tr) => {
        (tr.nome || '').split(/\s+/).forEach((w) => {
          if (w.length >= 2) queries.add(w.toLowerCase());
        });
      });
      queries.add('le');

      let best = null;
      for (const q of queries) {
        const scored = terreni
          .map((tr) => ({ tr, sc: scoreTerrenoInterviewMatch(q, tr.nome || '') }))
          .filter((x) => x.sc > 0);
        if (scored.length < 2) continue;
        scored.sort((a, b) => b.sc - a.sc);
        const top = scored[0].sc;
        const tied = scored.filter((s) => s.sc === top);
        if (tied.length < 2) continue;

        const pick = tied[0].tr;
        const pickNome = String(pick.nome || '').trim();
        const pickWords = pickNome.split(/\s+/).filter((w) => w.length >= 3);
        let disambReply = pickWords[pickWords.length - 1] || pickNome;
        for (const w of pickWords) {
          const wLow = w.toLowerCase();
          const unique = tied.every((t) => {
            if (t.tr.id === pick.id) return true;
            return scoreTerrenoInterviewMatch(wLow, t.tr.nome || '') === 0;
          });
          if (unique) {
            disambReply = wLow;
            break;
          }
        }

        if (!best || tied.length > best.candidateCount) {
          best = {
            query: q,
            disambReply: String(disambReply).toLowerCase(),
            pickNome,
            candidateCount: tied.length,
          };
        }
      }
      return best;
    }

    function findAmbiguousOperaio(operaiList) {
      const byCognome = {};
      operaiList.forEach((p) => {
        const cognome = String(p.cognome || '').trim();
        if (cognome.length < 3) return;
        if (!byCognome[cognome]) byCognome[cognome] = [];
        byCognome[cognome].push(p);
      });
      for (const [cognome, list] of Object.entries(byCognome)) {
        if (list.length >= 2) {
          const pick = list[0];
          return {
            query: cognome,
            disambReply: String(pick.nome || pick.cognome || cognome).trim(),
            pickLabel: `${pick.nome || ''} ${pick.cognome || ''}`.trim(),
          };
        }
      }

      const byFirst = {};
      operaiList.forEach((p) => {
        const first = String(p.nome || '').trim();
        if (first.length < 3) return;
        if (!byFirst[first]) byFirst[first] = [];
        byFirst[first].push(p);
      });
      for (const [first, list] of Object.entries(byFirst)) {
        if (list.length >= 2) {
          const pick = list[0];
          return {
            query: first,
            disambReply: String(pick.cognome || first).trim(),
            pickLabel: `${pick.nome || ''} ${pick.cognome || ''}`.trim(),
          };
        }
      }
      return null;
    }

    function findTipoLavoroTrinciatura(tipiLavoroList) {
      const tipi = Array.isArray(tipiLavoroList) ? tipiLavoroList : [];
      const matches = tipi.filter((t) => /trinciat/i.test(String(t.nome || '')));
      const pick =
        matches.find((t) => /tra le file/i.test(String(t.nome || ''))) ||
        matches[0] ||
        tipi[0];
      if (!pick) {
        throw new Error('Discovery: nessun tipo lavoro nel tenant');
      }
      const nome = String(pick.nome || '').trim();
      let chatReply = nome.toLowerCase();
      if (/tra le file/i.test(nome)) chatReply = 'trinciatura tra le file';
      else if (/trinciat/i.test(nome)) chatReply = 'trinciatura';
      return {
        id: pick.id || null,
        nome,
        categoriaId: pick.categoriaId || null,
        chatReply,
      };
    }

    function findTrattorePatch(trattoriList) {
      const t = trattoriList && trattoriList[0];
      if (!t) return null;
      return {
        id: t.id || null,
        hint: String(t.marca || t.nome || t.modello || '').trim(),
      };
    }

    function findAttrezzoPatch(attrezziList) {
      if (!Array.isArray(attrezziList) || !attrezziList.length) return null;
      const pick =
        attrezziList.find((a) => /trinciat/i.test(String(a.nome || ''))) || attrezziList[0];
      return {
        id: pick.id || null,
        hint: String(pick.nome || pick.marca || '').trim(),
      };
    }

    const terreni = window.lavoriState.terreniList || [];
    const operai = window.lavoriState.operaiList || [];
    const trattori = window.lavoriState.trattoriList || [];
    const attrezzi = window.lavoriState.attrezziList || [];
    const tipiLavoro = window.lavoriState.tipiLavoroList || [];

    const terrenoAmbig = findAmbiguousTerreno(terreni);
    const personAmbig = findAmbiguousOperaio(operai);
    const tipoLavoro = findTipoLavoroTrinciatura(tipiLavoro);

    if (!terrenoAmbig) {
      throw new Error('Discovery: nessuna coppia terreni ambigua — verifica seed sim');
    }
    if (!personAmbig) {
      throw new Error('Discovery: nessun operaio ambiguo — verifica seed manodopera');
    }

    return {
      terrenoAmbig,
      personAmbig,
      tipoLavoro,
      trattorePatch: findTrattorePatch(trattori),
      attrezzoPatch: findAttrezzoPatch(attrezzi),
    };
  });
}

/**
 * Carica gestione-lavori e restituisce messaggi canary 3b-C13 adattati al tenant.
 * @param {import('playwright-core').Page} page
 */
export async function loadLavoroFlowPlan(page) {
  await gotoTonyE2ePage(page, GESTIONE_LAVORI_PATH);
  await restoreTonyTenantSnapshot(page);
  const ctx = await discoverLavoroAmbiguiContext(page);
  const { terrenoAmbig, personAmbig, tipoLavoro } = ctx;

  return {
    ctx,
    messages: [
      `crea lavoro ${terrenoAmbig.query}`,
      terrenoAmbig.disambReply,
      `a ${personAmbig.query}`,
      personAmbig.disambReply,
      tipoLavoro.chatReply,
      'domani',
      '1',
      'salva',
    ],
  };
}
