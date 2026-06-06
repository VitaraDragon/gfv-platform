/**
 * Assenze operai (giornata intera): segnalazione caposquadra / manager, conferma manager.
 * Firestore: tenants/{tenantId}/assenzeOperai/{assenzaId}
 *
 * @module core/services/manodopera-assenze-service
 */

import {
  createDocument,
  updateDocument,
  getDocumentData,
  getCollectionData,
  serverTimestamp
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import {
  ASSENZA_STATO_SEGNALATA,
  ASSENZA_STATO_CONFERMATA,
  ASSENZA_STATO_ANNULLATA,
  ASSENZA_CANALE_CAPOSQUADRA,
  ASSENZA_CANALE_MANAGER_DIRETTO,
  ASSENZA_CANALE_MANAGER,
  ASSENZA_TIPI,
  toGiornoKey,
  giornoInIntervalloAssenza,
  getAssenzaTipoLabel
} from '../config/manodopera-assenze-config.js';

export const COLLECTION_NAME = 'assenzeOperai';

const TIPI_VALIDI = new Set(ASSENZA_TIPI.map((t) => t.id));

/**
 * @param {Object} raw
 * @returns {Object}
 */
export function normalizeAssenza(raw = {}) {
  const dataInizioGiorno = raw.dataInizioGiorno || toGiornoKey(raw.dataInizio) || '';
  const dataFineGiorno = raw.dataFineGiorno || toGiornoKey(raw.dataFine) || dataInizioGiorno;
  return {
    id: raw.id,
    operaioId: raw.operaioId || '',
    tipo: TIPI_VALIDI.has(raw.tipo) ? raw.tipo : 'altro',
    stato: raw.stato || ASSENZA_STATO_SEGNALATA,
    dataInizioGiorno,
    dataFineGiorno,
    nota: raw.nota != null ? String(raw.nota).trim() : '',
    lavoroId: raw.lavoroId || null,
    canale: raw.canale || ASSENZA_CANALE_MANAGER,
    segnalatoDa: raw.segnalatoDa || null,
    segnalatoIl: raw.segnalatoIl || null,
    confermatoDa: raw.confermatoDa || null,
    confermatoIl: raw.confermatoIl || null,
    standbyLavoroId: raw.standbyLavoroId || null,
    tipoLabel: getAssenzaTipoLabel(raw.tipo)
  };
}

/**
 * @param {string} [tenantId]
 * @returns {Promise<Object[]>}
 */
export async function listAssenzeSegnalate(tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  const rows = await getCollectionData(COLLECTION_NAME, {
    tenantId: tid,
    where: [['stato', '==', ASSENZA_STATO_SEGNALATA]]
  });
  return (rows || []).map(normalizeAssenza).sort((a, b) =>
    (b.segnalatoIl?.seconds || 0) - (a.segnalatoIl?.seconds || 0)
  );
}

/**
 * Prima segnalazione in attesa collegata a un lavoro (se il caposquadra l'ha indicata).
 * @param {string} lavoroId
 * @param {string} [tenantId]
 * @returns {Promise<Object|null>}
 */
export async function findAssenzaSegnalataPerLavoro(lavoroId, tenantId = null) {
  if (!lavoroId) return null;
  const rows = await listAssenzeSegnalate(tenantId);
  return rows.find((a) => a.lavoroId === lavoroId) || null;
}

/**
 * Segnalazione in attesa per operaio (es. lavoro di squadra senza lavoroId in segnalazione).
 * @param {string} operaioId
 * @param {string} [tenantId]
 * @returns {Promise<Object|null>}
 */
export async function findAssenzaSegnalataPerOperaio(operaioId, tenantId = null) {
  if (!operaioId) return null;
  const rows = await listAssenzeSegnalate(tenantId);
  return rows.find((a) => a.operaioId === operaioId) || null;
}

/**
 * @param {string} operaioId
 * @param {string} giornoKey YYYY-MM-DD
 * @param {string} [tenantId]
 * @returns {Promise<Object|null>}
 */
export async function getAssenzaConfermataPerOperaioGiorno(operaioId, giornoKey, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid || !operaioId || !giornoKey) return null;
  const rows = await getCollectionData(COLLECTION_NAME, {
    tenantId: tid,
    where: [
      ['operaioId', '==', operaioId],
      ['stato', '==', ASSENZA_STATO_CONFERMATA]
    ]
  });
  const hit = (rows || []).find((r) =>
    giornoInIntervalloAssenza(giornoKey, r.dataInizioGiorno, r.dataFineGiorno)
  );
  return hit ? normalizeAssenza(hit) : null;
}

/**
 * Caposquadra (o altro) segnala assenza — in attesa manager.
 * @param {Object} payload
 * @param {string} [tenantId]
 * @returns {Promise<string>} assenzaId
 */
export async function segnalaAssenza(payload, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid) throw new Error('Tenant non disponibile');
  if (!payload?.operaioId) throw new Error('Operaio obbligatorio');
  if (!payload?.segnalatoDa) throw new Error('segnalatoDa obbligatorio');

  const giorno = toGiornoKey(payload.dataGiorno || new Date());
  if (!giorno) throw new Error('Data non valida');

  const doc = {
    operaioId: payload.operaioId,
    tipo: TIPI_VALIDI.has(payload.tipo) ? payload.tipo : 'malattia',
    stato: ASSENZA_STATO_SEGNALATA,
    dataInizioGiorno: giorno,
    dataFineGiorno: giorno,
    nota: payload.nota != null ? String(payload.nota).trim() : '',
    lavoroId: payload.lavoroId || null,
    canale: payload.canale || ASSENZA_CANALE_CAPOSQUADRA,
    segnalatoDa: payload.segnalatoDa,
    segnalatoIl: serverTimestamp()
  };

  return createDocument(COLLECTION_NAME, doc, tid);
}

/**
 * Manager crea assenza già confermata (es. ferie programmate).
 * @param {Object} payload
 * @param {string} [tenantId]
 * @returns {Promise<string>}
 */
export async function creaAssenzaConfermata(payload, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid) throw new Error('Tenant non disponibile');
  if (!payload?.operaioId || !payload?.confermatoDa) {
    throw new Error('Operaio e confermatoDa obbligatori');
  }

  const inizio = toGiornoKey(payload.dataInizioGiorno || payload.dataGiorno);
  const fine = toGiornoKey(payload.dataFineGiorno || inizio);
  if (!inizio || !fine) throw new Error('Date non valide');
  if (fine < inizio) throw new Error('Data fine precedente alla data inizio');

  const doc = {
    operaioId: payload.operaioId,
    tipo: TIPI_VALIDI.has(payload.tipo) ? payload.tipo : 'ferie',
    stato: ASSENZA_STATO_CONFERMATA,
    dataInizioGiorno: inizio,
    dataFineGiorno: fine,
    nota: payload.nota != null ? String(payload.nota).trim() : '',
    lavoroId: payload.lavoroId || null,
    canale: payload.canale || ASSENZA_CANALE_MANAGER,
    segnalatoDa: payload.confermatoDa,
    segnalatoIl: serverTimestamp(),
    confermatoDa: payload.confermatoDa,
    confermatoIl: serverTimestamp()
  };

  return createDocument(COLLECTION_NAME, doc, tid);
}

/**
 * @param {string} assenzaId
 * @param {string} confermatoDa
 * @param {string} [tenantId]
 */
export async function confermaAssenza(assenzaId, confermatoDa, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  const row = await getDocumentData(COLLECTION_NAME, assenzaId, tid);
  if (!row) throw new Error('Assenza non trovata');
  if (row.stato !== ASSENZA_STATO_SEGNALATA) {
    throw new Error('Assenza già gestita');
  }
  await updateDocument(
    COLLECTION_NAME,
    assenzaId,
    {
      stato: ASSENZA_STATO_CONFERMATA,
      confermatoDa,
      confermatoIl: serverTimestamp()
    },
    tid
  );
}

/**
 * @param {string} assenzaId
 * @param {string} lavoroId
 * @param {string} [tenantId]
 */
export async function collegaAssenzaALavoroStandby(assenzaId, lavoroId, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  await updateDocument(
    COLLECTION_NAME,
    assenzaId,
    { standbyLavoroId: lavoroId || null },
    tid
  );
}

/**
 * @param {string} assenzaId
 * @param {string} [tenantId]
 * @returns {Promise<Object>}
 */
export async function getAssenza(assenzaId, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  const row = await getDocumentData(COLLECTION_NAME, assenzaId, tid);
  return row ? normalizeAssenza(row) : null;
}

/**
 * @param {string} assenzaId
 * @param {string} sostitutoOperaioId
 * @param {string} managerId
 * @param {string} [tenantId]
 */
export async function registraSostitutoSuAssenza(
  assenzaId,
  sostitutoOperaioId,
  managerId,
  tenantId = null
) {
  const tid = tenantId || getCurrentTenantId();
  await updateDocument(
    COLLECTION_NAME,
    assenzaId,
    {
      sostitutoOperaioId,
      sostitutoDa: managerId,
      sostitutoIl: serverTimestamp()
    },
    tid
  );
}
