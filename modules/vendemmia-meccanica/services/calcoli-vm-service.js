/**
 * CRUD calcoli vendemmia meccanica salvati
 * @module modules/vendemmia-meccanica/services/calcoli-vm-service
 */

import {
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  getCollectionData
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getLavoro } from '../../../core/services/lavori-service.js';
import { toDateKeyString } from './lavoro-vm-utils.js';
import { CALCOLI_VM_COLLECTION } from '../config/vm-constants.js';

/**
 * Legge query string calcolatore (?clienteId, ?terrenoId(s), ?lavoroId, ?calcoloId).
 * @param {URLSearchParams|string} search
 * @returns {{ clienteId: string|null, terrenoIds: string[], lavoroId: string|null, calcoloId: string|null }}
 */
export function parseCalcolatoreUrlParams(search) {
  const p = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  const clienteIdRaw = p.get('clienteId');
  const terrenoId = p.get('terrenoId');
  const terrenoIds = terrenoId
    ? [String(terrenoId).trim()]
    : String(p.get('terrenoIds') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const lavoroIdRaw = p.get('lavoroId');
  const calcoloIdRaw = p.get('calcoloId');
  return {
    clienteId: clienteIdRaw && String(clienteIdRaw).trim() ? String(clienteIdRaw).trim() : null,
    terrenoIds,
    lavoroId: lavoroIdRaw && String(lavoroIdRaw).trim() ? String(lavoroIdRaw).trim() : null,
    calcoloId: calcoloIdRaw && String(calcoloIdRaw).trim() ? String(calcoloIdRaw).trim() : null
  };
}

/**
 * Quintali da documento lavoro (campi opzionali futuri / legacy).
 * @param {Object|null|undefined} lavoro
 * @returns {number|null}
 */
export function resolveQuintaliFromLavoro(lavoro) {
  if (!lavoro) return null;
  for (const key of ['quintali', 'quantitaQli', 'quantitaRaccolta', 'qli']) {
    const v = Number(lavoro[key]);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}

/**
 * Data vendemmia da lavoro (campo esplicito o data inizio).
 * @param {Object|null|undefined} lavoro
 * @returns {string|null} YYYY-MM-DD
 */
export function resolveDataVendemmiaFromLavoro(lavoro) {
  if (!lavoro) return null;
  for (const key of ['dataVendemmia', 'dataCompletamento', 'dataFine']) {
    const dk = toDateKeyString(lavoro[key]);
    if (dk) return dk;
  }
  return toDateKeyString(lavoro.dataInizio);
}

/**
 * Prefill form calcolatore da lavoro VM.
 * @param {Object|null|undefined} lavoro
 * @returns {Object|null}
 */
export function buildPrefillFromLavoro(lavoro) {
  if (!lavoro?.id) return null;
  const terrenoIds = lavoro.terrenoId ? [String(lavoro.terrenoId)] : [];
  return {
    lavoroId: lavoro.id,
    clienteId: lavoro.clienteId || null,
    terrenoIds,
    quintali: resolveQuintaliFromLavoro(lavoro),
    dataVendemmia: resolveDataVendemmiaFromLavoro(lavoro),
    preventivoId: lavoro.preventivoId || null,
    scontoMaggiorazione: 0,
    destinazioneTrasporto: null,
    calcoloId: null
  };
}

/**
 * Prefill form calcolatore da calcolo salvato (riedit).
 * @param {Object|null|undefined} calcolo
 * @returns {Object|null}
 */
export function buildPrefillFromCalcoloSalvato(calcolo) {
  if (!calcolo?.id) return null;
  const terrenoIds = (Array.isArray(calcolo.terreni) ? calcolo.terreni : [])
    .map((t) => t.terrenoId || t.id)
    .filter(Boolean);
  return {
    calcoloId: calcolo.id,
    lavoroId: calcolo.lavoroId || null,
    clienteId: calcolo.clienteId || null,
    terrenoIds,
    quintali: Number(calcolo.quintali) || 0,
    dataVendemmia: calcolo.dataVendemmia || null,
    scontoMaggiorazione: Number(calcolo.scontoMaggiorazione) || 0,
    destinazioneTrasporto: calcolo.destinazioneTrasporto || null,
    preventivoId: calcolo.preventivoId || null
  };
}

/**
 * Carica contesto prefill da URL (lavoroId e/o calcoloId hanno priorità su cliente/terreni).
 * @param {{ lavoroId?: string|null, calcoloId?: string|null, clienteId?: string|null, terrenoIds?: string[] }} params
 * @returns {Promise<Object|null>}
 */
export async function loadCalcoloPrefillContext(params = {}) {
  const { lavoroId, calcoloId, clienteId, terrenoIds = [] } = params;

  if (calcoloId) {
    const calcolo = await getCalcoloVm(calcoloId);
    if (!calcolo) return null;
    const prefill = buildPrefillFromCalcoloSalvato({ ...calcolo, id: calcoloId });
    if (prefill && !prefill.clienteId && clienteId) prefill.clienteId = clienteId;
    if (prefill && (!prefill.terrenoIds || !prefill.terrenoIds.length) && terrenoIds.length) {
      prefill.terrenoIds = terrenoIds.slice();
    }
    return prefill;
  }

  if (lavoroId) {
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;
    const prefill = buildPrefillFromLavoro({ ...lavoro, id: lavoroId });
    if (prefill && !prefill.clienteId && clienteId) prefill.clienteId = clienteId;
    if (prefill && terrenoIds.length) {
      prefill.terrenoIds = [...new Set([...(prefill.terrenoIds || []), ...terrenoIds])];
    }
    return prefill;
  }

  if (!clienteId) return null;
  return {
    calcoloId: null,
    lavoroId: null,
    clienteId,
    terrenoIds: terrenoIds.slice(),
    quintali: null,
    dataVendemmia: null,
    scontoMaggiorazione: 0,
    destinazioneTrasporto: null,
    preventivoId: null
  };
}

/**
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function getAllCalcoliVm(options = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const { orderBy = 'createdAt', orderDirection = 'desc', anno = null, clienteId = null } = options;
  const docs = await getCollectionData(CALCOLI_VM_COLLECTION, {
    tenantId,
    orderBy,
    orderDirection
  });

  let list = docs;
  if (anno != null) list = list.filter((d) => Number(d.anno) === Number(anno));
  if (clienteId) list = list.filter((d) => d.clienteId === clienteId);
  return list;
}

/**
 * @param {string} calcoloId
 */
export async function getCalcoloVm(calcoloId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return getDocumentData(CALCOLI_VM_COLLECTION, calcoloId, tenantId);
}

/**
 * @param {Object} breakdown — output calcolaCompensoVendemmia().breakdown + metadati
 */
export async function saveCalcoloVm(breakdown, extra = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  if (!breakdown || !breakdown.clienteId) throw new Error('Breakdown calcolo non valido');

  const payload = {
    clienteId: breakdown.clienteId,
    clienteNome: breakdown.clienteNome || extra.clienteNome || '',
    dataVendemmia: extra.dataVendemmia || new Date().toISOString().slice(0, 10),
    anno: breakdown.anno,
    destinazioneTrasporto: breakdown.destinazioneTrasporto,
    quintali: breakdown.quintali,
    scontoMaggiorazione: breakdown.scontoMaggiorazione || 0,
    terreni: breakdown.terreni,
    totaleVendemmia: breakdown.totaleVendemmia,
    totaleTrasporto: breakdown.totaleTrasporto,
    totaleFinale: breakdown.totaleFinale,
    note: extra.note || '',
    preventivoId: extra.preventivoId || null,
    lavoroId: extra.lavoroId || null
  };

  return createDocument(CALCOLI_VM_COLLECTION, payload, tenantId);
}

/**
 * Aggiorna preventivo CT con riferimento al calcolo VM salvato.
 * @param {string} calcoloId
 * @param {string|null|undefined} preventivoId
 */
export async function linkCalcoloVmToPreventivo(calcoloId, preventivoId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId || !calcoloId || !preventivoId) return null;
  await updateDocument('preventivi', preventivoId, { calcoloVmId: calcoloId }, tenantId);
  return calcoloId;
}

/**
 * Ricava preventivoId univoco dai terreni selezionati (stato piano stagione anno).
 * @param {Array<Object>} terreni
 * @param {number|string} anno
 * @returns {string|null}
 */
export function resolvePreventivoIdFromTerreni(terreni, anno) {
  const annoKey = String(anno);
  const ids = new Set();
  (Array.isArray(terreni) ? terreni : []).forEach((t) => {
    const raw = t._originalData || t;
    const vm = (raw.vendemmiaMeccanica || t.vendemmiaMeccanica || {})[annoKey] || {};
    if (vm.preventivoId) ids.add(String(vm.preventivoId));
  });
  if (ids.size === 1) return [...ids][0];
  return null;
}

export async function deleteCalcoloVm(calcoloId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  await deleteDocument(CALCOLI_VM_COLLECTION, calcoloId, tenantId);
}

export async function updateCalcoloVm(calcoloId, updates) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  await updateDocument(CALCOLI_VM_COLLECTION, calcoloId, updates, tenantId);
}

export default {
  getAllCalcoliVm,
  getCalcoloVm,
  saveCalcoloVm,
  deleteCalcoloVm,
  updateCalcoloVm,
  linkCalcoloVmToPreventivo,
  resolvePreventivoIdFromTerreni,
  parseCalcolatoreUrlParams,
  resolveQuintaliFromLavoro,
  resolveDataVendemmiaFromLavoro,
  buildPrefillFromLavoro,
  buildPrefillFromCalcoloSalvato,
  loadCalcoloPrefillContext
};
