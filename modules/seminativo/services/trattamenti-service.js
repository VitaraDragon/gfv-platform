/**
 * Lista e salvataggio trattamenti seminativo (categoria Trattamenti su diario e lavori).
 * @module modules/seminativo/services/trattamenti-service
 */

import {
  createDocument,
  deleteDocument,
  getCollectionData,
  getDocumentData,
  updateDocument
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllAttivita } from '../../../core/services/attivita-service.js';
import { getAllLavori } from '../../../core/services/lavori-service.js';
import { TRATTAMENTI_SEMINATIVO_COLLECTION } from '../config/seminativo-hub.js';
import { isLavorazioneDiFilare } from '../models/SeminativoLavorazione.js';
import { getAllSeminativi, listTerreniSeminativo } from './seminativi-service.js';
import {
  SeminativoTrattamento,
  nomiSeedCategoriaCampo,
  selezionaRigheTrattamento
} from '../models/SeminativoTrattamento.js';

const COLLECTION_NAME = TRATTAMENTI_SEMINATIVO_COLLECTION;

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return tenantId;
}

export async function nomiTipiCategoriaCampo(codice) {
  const root = String(codice || '').toLowerCase();
  const seed = nomiSeedCategoriaCampo(root);
  try {
    const { getAllCategorie } = await import('../../../core/services/categorie-service.js');
    const { getAllTipiLavoro } = await import('../../../core/services/tipi-lavoro-service.js');
    const categorie = await getAllCategorie();
    const byId = new Map((categorie || []).filter((cat) => cat && cat.id).map((cat) => [String(cat.id), cat]));
    const rootCodice = (cat) => {
      let current = cat;
      const seen = new Set();
      while (current && current.parentId && byId.has(String(current.parentId)) && !seen.has(String(current.id))) {
        seen.add(String(current.id));
        current = byId.get(String(current.parentId));
      }
      return String((current && current.codice) || '').toLowerCase();
    };
    const tipi = await getAllTipiLavoro();
    const names = new Set(seed);
    (tipi || []).forEach((tipo) => {
      const cat = byId.get(String(tipo.categoriaId || tipo.sottocategoriaId || ''));
      const nome = String(tipo.nome || '').trim();
      if (cat && rootCodice(cat) === root && nome && !isLavorazioneDiFilare(nome)) {
        names.add(nome.toLowerCase());
      }
    });
    return Array.from(names);
  } catch (err) {
    console.warn('[seminativo] tipi ' + root + ':', err && err.message);
    return seed;
  }
}

export function nomiTipiTrattamento() {
  return nomiTipiCategoriaCampo('trattamenti');
}

export function nomiTipiConcimazione() {
  return nomiTipiCategoriaCampo('concimazione');
}

export async function getAllTrattamentiSeminativo() {
  const tenantId = requireTenantId();
  const documents = await getCollectionData(COLLECTION_NAME, { tenantId });
  return (documents || []).map((doc) => SeminativoTrattamento.fromData(doc));
}

export async function listRigheTrattamento(options = {}) {
  const includeLavori = options.includeLavori !== false;
  const [terreni, campagne, nomi, trattamenti, attivita, lavori] = await Promise.all([
    listTerreniSeminativo(),
    getAllSeminativi().catch(() => []),
    (options.categoria === 'concimazione' ? nomiTipiConcimazione() : nomiTipiTrattamento()),
    getAllTrattamentiSeminativo().catch(() => []),
    getAllAttivita().catch(() => []),
    includeLavori ? getAllLavori().catch(() => []) : Promise.resolve([])
  ]);
  return {
    terreni,
    campagne,
    righe: selezionaRigheTrattamento({
      terreni,
      campagne,
      nomiTipi: nomi,
      trattamenti,
      attivita,
      lavori,
      includeLavori
    })
  };
}

async function syncScarico(trattamentoId, payload, registraScaricoMagazzino, previousIds) {
  const { syncScarichiMagazzinoTrattamento } = await import('../../magazzino/services/trattamento-scarico-magazzino-service.js');
  const { movimentoIds } = await syncScarichiMagazzinoTrattamento({
    modulo: 'seminativo',
    colturaId: payload.campagnaId,
    trattamentoId,
    dataTrattamento: payload.data,
    lavoroId: payload.lavoroId,
    attivitaId: payload.attivitaId,
    prodotti: payload.prodotti,
    registraScaricoMagazzino: !!registraScaricoMagazzino,
    previousMovimentoIds: previousIds
  });
  return movimentoIds;
}

export async function saveTrattamentoSeminativo(data, options = {}) {
  const tenantId = requireTenantId();
  const trattamento = new SeminativoTrattamento(data);
  const check = trattamento.validate();
  if (!check.valid) throw new Error(check.errors[0]);
  const payload = trattamento.toFirestore();
  const registra = options.registraScaricoMagazzino;
  if (trattamento.id) {
    const existing = await getDocumentData(COLLECTION_NAME, trattamento.id, tenantId);
    const previousIds = existing && Array.isArray(existing.magazzinoMovimentoIds)
      ? existing.magazzinoMovimentoIds
      : [];
    await updateDocument(COLLECTION_NAME, trattamento.id, payload, tenantId);
    if (registra !== undefined) {
      const movimentoIds = await syncScarico(trattamento.id, payload, registra, previousIds);
      await updateDocument(COLLECTION_NAME, trattamento.id, { magazzinoMovimentoIds: movimentoIds }, tenantId);
    }
    return trattamento.id;
  }
  const createdId = await createDocument(COLLECTION_NAME, payload, tenantId);
  if (registra) {
    const movimentoIds = await syncScarico(createdId, payload, true, []);
    await updateDocument(COLLECTION_NAME, createdId, { magazzinoMovimentoIds: movimentoIds }, tenantId);
  }
  return createdId;
}

export async function deleteTrattamentoSeminativo(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID trattamento obbligatorio');
  const existing = await getDocumentData(COLLECTION_NAME, id, tenantId);
  if (existing && Array.isArray(existing.magazzinoMovimentoIds) && existing.magazzinoMovimentoIds.length) {
    const { rimuoviMovimentiTrattamento } = await import('../../magazzino/services/trattamento-scarico-magazzino-service.js');
    await rimuoviMovimentiTrattamento(existing.magazzinoMovimentoIds);
  }
  await deleteDocument(COLLECTION_NAME, id, tenantId);
}
