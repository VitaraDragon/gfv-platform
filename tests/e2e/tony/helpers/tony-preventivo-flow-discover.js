/**
 * Discovery contesto preventivo Tony E2E — cliente multi-terreno, tipo lavoro sim.
 * @module tests/e2e/tony/helpers/tony-preventivo-flow-discover
 */

import { NUOVO_PREVENTIVO_PATH } from '../../sim/helpers/sim-login.js';
import { gotoTonyE2ePage, restoreTonyTenantSnapshot } from './tony-sim-context.js';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';
const COLTURA_HINT = 'vite';

/**
 * @param {import('playwright-core').Page} page
 */
export async function waitForPreventivoStateReady(page) {
  await page.waitForFunction(
    () => {
      const ps = window.preventivoState;
      const cliente = document.getElementById('cliente-id');
      const cat = document.getElementById('lavoro-categoria-principale');
      if (!ps || !cliente || !cat) return false;
      return (
        Array.isArray(ps.clienti) &&
        ps.clienti.length >= 1 &&
        Array.isArray(ps.tipiLavoroList) &&
        ps.tipiLavoroList.length >= 1 &&
        cliente.options.length > 1 &&
        cat.options.length > 1
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
export async function discoverPreventivoFlowContext(page) {
  await waitForPreventivoStateReady(page);

  const clienteSelect = page.locator('#cliente-id');
  const optionCount = await clienteSelect.locator('option').count();
  if (optionCount < 2) {
    throw new Error('Discovery preventivo: nessun cliente nel form — verifica seed sim conto terzi');
  }

  for (let i = 1; i < optionCount; i += 1) {
    const clienteId = (await clienteSelect.locator('option').nth(i).getAttribute('value')) || '';
    const clienteNome = ((await clienteSelect.locator('option').nth(i).textContent()) || '').trim();
    if (!clienteId) continue;

    await clienteSelect.selectOption(clienteId);

    await page.waitForFunction(
      async ({ expectedClienteId }) => {
        const cliente = document.getElementById('cliente-id');
        if (!cliente || cliente.value !== expectedClienteId) return false;
        if (typeof window.__preventivoAwaitTerreniClienteReady === 'function') {
          await window.__preventivoAwaitTerreniClienteReady(25_000);
        }
        const sel = document.getElementById('terreno-id');
        return sel && sel.options.length >= 3;
      },
      { expectedClienteId: clienteId },
      { timeout: 60_000, polling: 300 }
    );

    const ctx = await page.evaluate(
      ({ colturaHint, preferredTipo }) => {
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

        const ps = window.preventivoState;
        const list = ps && Array.isArray(ps.terreni) ? ps.terreni : [];
        if (list.length < 2) return null;

        const tipi = (ps && ps.tipiLavoroList) || [];
        const preferred = tipi.find((t) => new RegExp(preferredTipo, 'i').test(String(t.nome || '')));
        const tipoPick = preferred || tipi[0];
        if (!tipoPick) return null;

        const pick = list[0];
        const alt = list[1];
        const pickNome = String(pick.nome || '').trim();
        const pickId = String(pick.id || '').trim();
        const altNome = String(alt.nome || '').trim();
        const pickWords = pickNome.split(/\s+/).filter((w) => w.length >= 3);
        const altWords = altNome.split(/\s+/).filter((w) => w.length >= 3);
        let disambReply = pickWords[pickWords.length - 1] || pickNome;
        for (const w of pickWords) {
          const wNorm = normalizeTonyText(w);
          if (wNorm.length < 3) continue;
          if (normalizeTonyText(altNome).indexOf(wNorm) < 0) {
            disambReply = wNorm;
            break;
          }
        }
        if (normalizeTonyText(disambReply) === normalizeTonyText(altWords[0] || '')) {
          disambReply = pickWords[0] || disambReply;
        }

        return {
          terrenoAmbig: {
            query: colturaHint,
            disambReply: String(disambReply).toLowerCase(),
            pickNome,
            pickId,
            candidateCount: list.length,
          },
          tipoLavoro: {
            id: tipoPick.id || null,
            nome: String(tipoPick.nome || '').trim(),
          },
        };
      },
      { colturaHint: COLTURA_HINT, preferredTipo: PREFERRED_TIPO_LAVORO }
    );

    if (!ctx) continue;

    const clienteShort =
      clienteNome.split(/\s+/).find((w) => w.length >= 4 && !/^(s\.?r\.?l\.?|az\.?|soc\.?)$/i.test(w)) ||
      clienteNome.split(/\s+/)[0] ||
      clienteNome;

    return {
      clienteId,
      clienteNome,
      clienteShort: clienteShort.toLowerCase(),
      colturaHint: COLTURA_HINT,
      ...ctx,
    };
  }

  throw new Error('Discovery preventivo: nessun cliente con ≥2 terreni — verifica seed sim conto terzi');
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function loadPreventivoFlowPlan(page) {
  await gotoTonyE2ePage(page, NUOVO_PREVENTIVO_PATH);
  await restoreTonyTenantSnapshot(page);
  const ctx = await discoverPreventivoFlowContext(page);
  const { clienteShort, colturaHint, terrenoAmbig, tipoLavoro } = ctx;

  return {
    ctx,
    messages: [
      `crea preventivo ${clienteShort} ${tipoLavoro.nome.toLowerCase()} ${colturaHint}`,
      terrenoAmbig.disambReply,
      'domani',
      'salva',
    ],
  };
}
