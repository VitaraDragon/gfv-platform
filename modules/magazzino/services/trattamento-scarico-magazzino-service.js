/**
 * Sincronizza scarichi magazzino da trattamenti Vigneto/Frutteto (stesso pattern per altre colture in futuro).
 * Un solo registro movimenti. Ogni scarico ha un ID deterministico
 * (`trattamento_<modulo>_<colturaId>_<trattamentoId>_<prodottoId>`): salvare due volte lo stesso
 * trattamento riscrive lo stesso documento, non ne crea un altro.
 * `magazzinoMovimentoIds` sul trattamento serve a ritrovare i movimenti da rimuovere
 * (riga tolta, checkbox deselezionato, ID legacy casuali).
 *
 * @module modules/magazzino/services/trattamento-scarico-magazzino-service
 */

import { getDocumentData, updateDocument } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId, getCurrentUser } from '../../../core/services/tenant-service.js';
import { hasModuleAccessFromTenant } from '../../../core/utils/module-access-resolver.js';
import { getProdotto } from './prodotti-service.js';
import { setMovimentoConId, deleteMovimento } from './movimenti-service.js';

/** Stesso valore di `MOVIMENTO_NON_TROVATO` in movimenti-service (non importato: resta mockabile nei test). */
const CODICE_MOVIMENTO_NON_TROVATO = 'MOVIMENTO_NON_TROVATO';

/**
 * Dove sta il documento trattamento per ogni modulo (serve per aggiornarlo dopo uno storno da Movimenti).
 * @type {Record<string, (colturaId: string) => string>}
 */
const PATH_TRATTAMENTI_PER_MODULO = {
  vigneto: (colturaId) => `vigneti/${colturaId}/trattamenti`,
  frutteto: (colturaId) => `frutteti/${colturaId}/trattamenti`,
  seminativo: () => 'trattamentiSeminativo'
};

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
    return hasModuleAccessFromTenant(data, 'magazzino');
  } catch (e) {
    console.warn('[trattamento-scarico-magazzino] tenant modules:', e);
    return false;
  }
}

/**
 * ID deterministico del movimento di scarico per un prodotto di un trattamento.
 * @param {{ modulo: string, colturaId: string, trattamentoId: string, prodottoId: string }} p
 * @returns {string}
 */
export function movimentoIdScaricoTrattamento({ modulo, colturaId, trattamentoId, prodottoId }) {
  const part = (v) => String(v == null ? '' : v).trim().replace(/\//g, '_');
  return `trattamento_${part(modulo)}_${part(colturaId)}_${part(trattamentoId)}_${part(prodottoId)}`;
}

/**
 * Righe prodotto con lo stesso prodottoId sommate (quantità e costo); scartate righe senza prodotto o quantità ≤ 0.
 * @param {Array<{prodottoId?: string|null, quantita?: number|null, costo?: number|null}>} rows
 * @returns {Map<string, { prodottoId: string, quantita: number, costo: number|null }>}
 */
function aggregaRigheProdotto(rows) {
  /** @type {Map<string, { prodottoId: string, quantita: number, costo: number|null }>} */
  const out = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const pid = row && row.prodottoId ? String(row.prodottoId).trim() : '';
    const q = row && row.quantita != null ? parseFloat(row.quantita) : NaN;
    if (!pid || !(q > 0)) continue;
    const costo = row.costo != null ? parseFloat(row.costo) : NaN;
    const prev = out.get(pid);
    if (!prev) {
      out.set(pid, { prodottoId: pid, quantita: q, costo: Number.isFinite(costo) ? costo : null });
    } else {
      prev.quantita += q;
      if (Number.isFinite(costo)) prev.costo = (prev.costo == null ? 0 : prev.costo) + costo;
    }
  }
  return out;
}

/**
 * @param {unknown} e
 * @returns {boolean}
 */
function isMovimentoNonTrovato(e) {
  if (!e) return false;
  if (e.code === CODICE_MOVIMENTO_NON_TROVATO) return true;
  return /movimento non trovato/i.test(String(e.message || ''));
}

/**
 * Elimina movimenti collegati (ripristina giacenze).
 * «Movimento non trovato» = già rimosso (ok). Qualsiasi altro errore interrompe e viene propagato:
 * chi chiama non deve scrivere altro finché lo scarico precedente non è davvero stornato.
 * @param {string[]|null|undefined} movimentoIds
 * @returns {Promise<void>}
 */
export async function rimuoviMovimentiTrattamento(movimentoIds) {
  const ids = [...new Set(Array.isArray(movimentoIds) ? movimentoIds.filter(Boolean) : [])];
  for (const id of ids) {
    try {
      await deleteMovimento(id);
    } catch (e) {
      if (isMovimentoNonTrovato(e)) continue;
      console.error('[trattamento-scarico-magazzino] deleteMovimento', id, e);
      const err = new Error(
        `Impossibile stornare il movimento di magazzino ${id}: ${(e && e.message) || e}`
      );
      err.cause = e;
      throw err;
    }
  }
}

/**
 * Allinea gli scarichi di magazzino al trattamento.
 * 1. Elimina i movimenti precedenti non più voluti (riga rimossa, checkbox tolto, ID legacy); un errore
 *    diverso da «non trovato» ferma tutto prima di qualsiasi scrittura.
 * 2. Se richiesto, scrive (setDoc) un'uscita per ogni prodotto con ID deterministico; righe con lo stesso
 *    prodotto sono sommate; la giacenza varia solo della differenza rispetto al movimento già esistente.
 *
 * @param {Object} params
 * @param {'vigneto'|'frutteto'|'seminativo'} params.modulo
 * @param {string} params.colturaId - vignetoId, fruttetoId o campagnaId
 * @param {string} params.trattamentoId
 * @param {Date|import('firebase/firestore').Timestamp} params.dataTrattamento
 * @param {string|null} [params.lavoroId]
 * @param {string|null} [params.attivitaId]
 * @param {Array<{prodottoId?: string|null, quantita?: number|null, costo?: number|null}>} [params.prodotti]
 * @param {boolean} params.registraScaricoMagazzino
 * @param {string[]|null|undefined} params.previousMovimentoIds - ID registrati sul trattamento
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

  const prev = Array.isArray(previousMovimentoIds) ? previousMovimentoIds.filter(Boolean) : [];

  const hasMod = await tenantHasMagazzinoModule();
  const righe = hasMod && registraScaricoMagazzino ? aggregaRigheProdotto(prodotti) : new Map();

  /** @type {Array<{ id: string, riga: { prodottoId: string, quantita: number, costo: number|null } }>} */
  const target = [...righe.values()].map((riga) => ({
    id: movimentoIdScaricoTrattamento({ modulo, colturaId, trattamentoId, prodottoId: riga.prodottoId }),
    riga
  }));
  const targetIds = new Set(target.map((t) => t.id));

  // Solo ciò che non è più voluto: gli ID deterministici ancora validi vengono riscritti sotto, con delta.
  await rimuoviMovimentiTrattamento(prev.filter((id) => !targetIds.has(id)));

  if (!target.length) {
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

  /** @type {Map<string, number>} */
  const prezzoDaAnagrafica = new Map();
  await Promise.all(
    target.map(async ({ riga }) => {
      const id = riga.prodottoId;
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

  const note = `Scarico da trattamento ${modulo} (${String(trattamentoId).slice(0, 8)}…)`;
  const movimentoIds = [];
  for (const { id, riga } of target) {
    await setMovimentoConId(id, {
      prodottoId: riga.prodottoId,
      data: dataMov,
      tipo: 'uscita',
      quantita: riga.quantita,
      prezzoUnitario: prezzoUnitarioPerScarico(prezzoDaAnagrafica, riga.prodottoId, riga),
      lavoroId: lavoroId || null,
      attivitaId: attivitaId || null,
      note,
      userId,
      origineTrattamentoModulo: modulo,
      origineTrattamentoColturaId: colturaId,
      origineTrattamentoId: trattamentoId
    });
    movimentoIds.push(id);
  }

  return { movimentoIds };
}

/**
 * Dopo l'eliminazione di un movimento di scarico da Magazzino → Movimenti: toglie l'ID dal trattamento
 * e imposta `magazzinoScaricoStornatoIl`, così il checkbox del trattamento non resta spuntato.
 * Se il trattamento non esiste più non c'è nulla da aggiornare. Errori di scrittura propagati.
 *
 * @param {{ id: string, origineTrattamentoModulo?: string|null, origineTrattamentoColturaId?: string|null, origineTrattamentoId?: string|null }} movimento
 * @returns {Promise<{ aggiornato: boolean }>}
 */
export async function aggiornaTrattamentoDopoStornoMovimento(movimento) {
  const modulo = movimento && movimento.origineTrattamentoModulo;
  const trattamentoId = movimento && movimento.origineTrattamentoId;
  const pathFor = modulo ? PATH_TRATTAMENTI_PER_MODULO[modulo] : null;
  if (!movimento || !trattamentoId || !pathFor) return { aggiornato: false };

  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const colturaId = movimento.origineTrattamentoColturaId;
  if (modulo !== 'seminativo' && !colturaId) return { aggiornato: false };

  const path = pathFor(colturaId);
  const trattamento = await getDocumentData(path, trattamentoId, tenantId);
  if (!trattamento) return { aggiornato: false };

  const ids = Array.isArray(trattamento.magazzinoMovimentoIds) ? trattamento.magazzinoMovimentoIds : [];
  await updateDocument(
    path,
    trattamentoId,
    {
      magazzinoMovimentoIds: ids.filter((id) => id && String(id) !== String(movimento.id)),
      magazzinoScaricoStornatoIl: new Date()
    },
    tenantId
  );
  return { aggiornato: true };
}

/**
 * Elimina un movimento con il servizio condiviso e, se è lo scarico di un trattamento,
 * aggiorna anche il trattamento. «Non trovato» = già eliminato.
 * @param {{ id: string, origineTrattamentoModulo?: string|null, origineTrattamentoColturaId?: string|null, origineTrattamentoId?: string|null }} movimento
 * @returns {Promise<void>}
 */
export async function eliminaMovimentoConStornoTrattamento(movimento) {
  if (!movimento || !movimento.id) throw new Error('ID movimento obbligatorio');
  try {
    await deleteMovimento(movimento.id);
  } catch (e) {
    if (!isMovimentoNonTrovato(e)) throw e;
  }
  if (movimento.origineTrattamentoId) {
    await aggiornaTrattamentoDopoStornoMovimento(movimento);
  }
}
