/**
 * Helper condivisi manodopera/labour per Report Economici e Report Manodopera.
 * Nessuna logica specifica di aggregazione UI: solo tariffe, range lavori/attività.
 *
 * @module modules/report/services/report-labour-shared
 */

import {
  getCollectionData,
  getDb,
  doc,
  getDoc,
  dateToTimestamp
} from '../../../core/services/firebase-service.js';
import {
  dataIsoFromAny,
  dataIsoInRange,
  inRange
} from './report-economici-aggregate.js';

export const TARIFFE_OPERAI_DEFAULT = {
  semplice: 10.0,
  specializzato: 12.0,
  trattorista: 15.0,
  meccanico: 14.0,
  elettricista: 14.0,
  altro: 10.0
};

/**
 * Risolve tariffa oraria operaio (personalizzata → config tipo → default).
 * @param {object|null} tariffeOperai
 * @param {object|null} operaio
 * @returns {{ tariffa: number, fromConfig: boolean }}
 */
export function resolveTariffaOperaio(tariffeOperai, operaio) {
  if (operaio && operaio.tariffaPersonalizzata != null && operaio.tariffaPersonalizzata !== '') {
    return { tariffa: Number(operaio.tariffaPersonalizzata), fromConfig: true };
  }
  const tipo = (operaio && operaio.tipoOperaio) || null;
  if (tariffeOperai && tipo && tariffeOperai[tipo] != null) {
    return { tariffa: Number(tariffeOperai[tipo]), fromConfig: true };
  }
  if (tipo && TARIFFE_OPERAI_DEFAULT[tipo] != null) {
    return { tariffa: TARIFFE_OPERAI_DEFAULT[tipo], fromConfig: false };
  }
  return { tariffa: 10.0, fromConfig: false };
}

/**
 * Carica tariffe operai + proprietario dal tenant.
 * @param {string} tenantId
 * @returns {Promise<{ tariffeOperai: object|null, tariffaProprietario: number, tariffaProprietarioConfigurata: boolean }>}
 */
export async function loadTariffe(tenantId) {
  const db = getDb();
  let tariffeOperai = null;
  let tariffaProprietario = null;
  let tariffaProprietarioConfigurata = false;
  if (!db || !tenantId) {
    return { tariffeOperai, tariffaProprietario: 15, tariffaProprietarioConfigurata: false };
  }
  try {
    const snap = await getDoc(doc(db, `tenants/${tenantId}/tariffe`, 'operai'));
    if (snap.exists()) tariffeOperai = snap.data() || null;
  } catch (_) { /* ignore */ }
  try {
    const snap = await getDoc(doc(db, `tenants/${tenantId}/tariffe`, 'proprietario'));
    if (snap.exists()) {
      const data = snap.data() || {};
      const t = data.tariffaOraria != null ? data.tariffaOraria : data.tariffa;
      if (t != null && t !== '') {
        tariffaProprietario = Number(t);
        tariffaProprietarioConfigurata = true;
      }
    }
  } catch (_) { /* ignore */ }
  if (tariffaProprietario == null) tariffaProprietario = 15;
  return { tariffeOperai, tariffaProprietario, tariffaProprietarioConfigurata };
}

/**
 * Attività (diario) nel range: campo `data` ISO YYYY-MM-DD.
 * @param {string} tenantId
 * @param {Date} start
 * @param {Date} end
 * @param {{ logPrefix?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function loadAttivitaInRange(tenantId, start, end, opts = {}) {
  const logPrefix = opts.logPrefix || '[report-labour]';
  const dataDaStr = dataIsoFromAny(start);
  const dataAStr = dataIsoFromAny(end);
  try {
    const docs = await getCollectionData('attivita', {
      tenantId,
      where: [
        ['data', '>=', dataDaStr],
        ['data', '<=', dataAStr]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (e) {
    try {
      const raw = await getCollectionData('attivita', {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        limit: 2000
      });
      return (raw || []).filter((a) => dataIsoInRange(a.data, start, end));
    } catch (e2) {
      console.warn(`${logPrefix} attività`, e2 && e2.message);
      return [];
    }
  }
}

/**
 * Lavori nel range: campo `dataInizio` Timestamp.
 * @param {string} tenantId
 * @param {Date} start
 * @param {Date} end
 * @param {{ logPrefix?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function loadLavoriInRange(tenantId, start, end, opts = {}) {
  const logPrefix = opts.logPrefix || '[report-labour]';
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  try {
    const docs = await getCollectionData('lavori', {
      tenantId,
      where: [
        ['dataInizio', '>=', t0],
        ['dataInizio', '<=', t1]
      ],
      orderBy: 'dataInizio',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (e) {
    try {
      const docs = await getCollectionData('lavori', {
        tenantId,
        orderBy: 'dataInizio',
        orderDirection: 'desc'
      });
      return (docs || []).filter((l) => inRange(l.dataInizio || l.data, start, end));
    } catch (e2) {
      console.warn(`${logPrefix} lavori`, e2 && e2.message);
      return [];
    }
  }
}

/**
 * Nome display utente.
 * @param {object|null} user
 * @param {string} [fallbackId]
 * @returns {string}
 */
export function displayNameUser(user, fallbackId = '') {
  if (!user) return fallbackId || '—';
  return (`${user.nome || ''} ${user.cognome || ''}`.trim() || user.displayName || fallbackId || '—');
}

/**
 * Determina se la tariffa operaio è “configurata” (personalizzata o tipo in config/default noto).
 * Allinea la regola Economici: senza config e senza tipo → prezzo mancante.
 * @param {object|null} tariffeOperai
 * @param {object|null} user
 * @returns {{ tariffa: number, fromConfig: boolean, missing: boolean }}
 */
export function resolveTariffaOperaioWithMissing(tariffeOperai, user) {
  if (!user) {
    return { tariffa: 10, fromConfig: false, missing: true };
  }
  const { tariffa, fromConfig } = resolveTariffaOperaio(tariffeOperai, user);
  const missing = !fromConfig && user.tariffaPersonalizzata == null
    && !tariffeOperai && !user.tipoOperaio;
  return { tariffa, fromConfig, missing: !!missing };
}
