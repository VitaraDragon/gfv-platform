/**
 * Sincronizza scarichi magazzino da trattamenti Vigneto/Frutteto (stesso pattern per altre colture in futuro).
 * Un solo registro movimenti; idempotenza tramite magazzinoMovimentoIds sul documento trattamento.
 *
 * @module modules/magazzino/services/trattamento-scarico-magazzino-service
 */

import { getDocumentData } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId, getCurrentUser } from '../../../core/services/tenant-service.js';
import { getProdotto } from './prodotti-service.js';
import { createMovimento, deleteMovimento } from './movimenti-service.js';

/**
 * Prezzo unitario per valorizzazione movimento: anagrafica prodotto, altrimenti costo riga trattamento / quantità.
 * @param {Map<string, number|undefined>} prezzoDaAnagrafica - id → prezzo (solo se presente in anagrafica)
 * @param {string} prodottoId
 * @param {{ costo?: number|null, quantita?: number|null }} row
 * @returns {number|null}
 */
function prezzoUnitarioPerScarico(prezzoDaAnagrafica, prodottoId, row) {
  if (prezzoDaAnagrafica.has(prodottoId)) {
    const p = prezzoDaAnagrafica.get(prodottoId);
    if (p !== undefined && Number.isFinite(p) && p >= 0) return p;
  }
  const costo = row.costo != null ? parseFloat(row.costo) : NaN;
  const q = row.quantita != null ? parseFloat(row.quantita) : NaN;
  if (Number.isFinite(costo) && Number.isFinite(q) && q > 0) {
    const u = costo / q;
    if (Number.isFinite(u) && u >= 0) return u;
  }
  return null;
}

/**
 * @returns {Promise<boolean>}
 */
export async function tenantHasMagazzinoModule() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return false;
    const data = await getDocumentData('tenants', tenantId, null);
    const modules = Array.isArray(data?.modules) ? data.modules : [];
    return modules.includes('magazzino');
  } catch (e) {
    console.warn('[trattamento-scarico-magazzino] tenant modules:', e);
    return false;
  }
}

/**
 * Elimina movimenti collegati (ripristina giacenze). Ignora ID mancanti o errori singoli.
 * @param {string[]|null|undefined} movimentoIds
 * @returns {Promise<void>}
 */
export async function rimuoviMovimentiTrattamento(movimentoIds) {
  const ids = Array.isArray(movimentoIds) ? movimentoIds.filter(Boolean) : [];
  for (const id of ids) {
    try {
      await deleteMovimento(id);
    } catch (e) {
      console.warn('[trattamento-scarico-magazzino] deleteMovimento', id, e);
    }
  }
}

/**
 * Rimuove i movimenti precedenti e, se richiesto, crea uscite per ogni riga prodotto con prodottoId e quantità > 0.
 *
 * @param {Object} params
 * @param {'vigneto'|'frutteto'} params.modulo
 * @param {string} params.colturaId - vignetoId o fruttetoId
 * @param {string} params.trattamentoId
 * @param {Date|import('firebase/firestore').Timestamp} params.dataTrattamento
 * @param {string|null} [params.lavoroId]
 * @param {string|null} [params.attivitaId]
 * @param {Array<{prodottoId?: string|null, quantita?: number|null, costo?: number|null}>} [params.prodotti]
 * @param {boolean} params.registraScaricoMagazzino
 * @param {string[]|null|undefined} params.previousMovimentoIds - ID da eliminare prima di ricreare
 * @returns {Promise<{ movimentoIds: string[] }>}
 */
export async function syncScarichiMagazzinoTrattamento(params) {
  const {
    modulo,
    colturaId,
    trattamentoId,
    dataTrattamento,
    lavoroId,
    attivitaId,
    prodotti,
    registraScaricoMagazzino,
    previousMovimentoIds
  } = params;

  const prev = Array.isArray(previousMovimentoIds) ? [...previousMovimentoIds].filter(Boolean) : [];
  await rimuoviMovimentiTrattamento(prev);

  const hasMod = await tenantHasMagazzinoModule();
  if (!hasMod || !registraScaricoMagazzino) {
    return { movimentoIds: [] };
  }

  const dataMov =
    dataTrattamento instanceof Date
      ? dataTrattamento
      : dataTrattamento?.toDate
        ? dataTrattamento.toDate()
        : new Date(dataTrattamento);

  const user = getCurrentUser();
  const userId = user?.uid || null;

  const newIds = [];
  const rows = Array.isArray(prodotti) ? prodotti : [];

  const idsPerScarico = [
    ...new Set(
      rows
        .map((r) => {
          const pid = r.prodottoId ? String(r.prodottoId).trim() : '';
          const q = r.quantita != null ? parseFloat(r.quantita) : NaN;
          return pid && q > 0 ? pid : null;
        })
        .filter(Boolean)
    )
  ];

  /** @type {Map<string, number>} */
  const prezzoDaAnagrafica = new Map();
  await Promise.all(
    idsPerScarico.map(async (id) => {
      try {
        const prod = await getProdotto(id);
        if (!prod || prod.prezzoUnitario === undefined || prod.prezzoUnitario === null || prod.prezzoUnitario === '') {
          return;
        }
        const p = parseFloat(prod.prezzoUnitario);
        if (Number.isFinite(p) && p >= 0) prezzoDaAnagrafica.set(id, p);
      } catch (e) {
        console.warn('[trattamento-scarico-magazzino] getProdotto', id, e);
      }
    })
  );

  for (const row of rows) {
    const pid = row.prodottoId ? String(row.prodottoId).trim() : '';
    const q = row.quantita != null ? parseFloat(row.quantita) : NaN;
    if (!pid || !(q > 0)) continue;

    const note = `Scarico da trattamento ${modulo} (${String(trattamentoId).slice(0, 8)}…)`;
    const prezzoU = prezzoUnitarioPerScarico(prezzoDaAnagrafica, pid, row);
    const movimentoId = await createMovimento({
      prodottoId: pid,
      data: dataMov,
      tipo: 'uscita',
      quantita: q,
      prezzoUnitario: prezzoU,
      lavoroId: lavoroId || null,
      attivitaId: attivitaId || null,
      note,
      userId,
      origineTrattamentoModulo: modulo,
      origineTrattamentoColturaId: colturaId,
      origineTrattamentoId: trattamentoId
    });
    newIds.push(movimentoId);
  }

  return { movimentoIds: newIds };
}
