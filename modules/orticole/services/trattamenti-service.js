/**
 * Lista e salvataggio trattamenti orticole (categoria Trattamenti su diario e lavori).
 * @module modules/orticole/services/trattamenti-service
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
import { TRATTAMENTI_ORTICOLE_COLLECTION } from '../config/orticole-hub.js';
import { isLavorazioneDiFilare } from '../models/OrticolaLavorazione.js';
import { getAllOrticole, listTerreniOrticole } from './orticole-service.js';
import {
  OrticolaTrattamento,
  nomiSeedCategoriaCampo,
  selezionaRigheTrattamento
} from '../models/OrticolaTrattamento.js';
import { intervalloCampagna } from '../models/OrticolaSpese.js';
import {
  createTrattamentoCampoFromLavoro,
  findTrattamentoCampoByLavoroId,
  syncTrattamentoCampoFromLavoro
} from '../../../shared/js/trattamento-campo-from-lavoro.js';

const COLLECTION_NAME = TRATTAMENTI_ORTICOLE_COLLECTION;
const LOG_PREFIX = 'TRATTAMENTI-ORTICOLE';

function mapDocs(docs) {
  return (docs || []).map((doc) => OrticolaTrattamento.fromData(doc));
}

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
    console.warn('[orticole] tipi ' + root + ':', err && err.message);
    return seed;
  }
}

export async function nomiTipiTrattamento() {
  const { isTipoIrrigazione } = await import('../models/OrticolaIrrigazione.js');
  const nomi = await nomiTipiCategoriaCampo('trattamenti');
  return (nomi || []).filter((nome) => !isTipoIrrigazione(nome));
}

export function nomiTipiConcimazione() {
  return nomiTipiCategoriaCampo('concimazione');
}

export async function getAllTrattamentiOrticole() {
  const tenantId = requireTenantId();
  const documents = await getCollectionData(COLLECTION_NAME, { tenantId });
  return (documents || []).map((doc) => OrticolaTrattamento.fromData(doc));
}

export async function listRigheTrattamento(options = {}) {
  const includeLavori = options.includeLavori !== false;
  const [terreni, campagne, nomi, trattamenti, attivita, lavori] = await Promise.all([
    listTerreniOrticole({ includiArchiviati: true }),
    getAllOrticole().catch(() => []),
    (options.categoria === 'concimazione' ? nomiTipiConcimazione() : nomiTipiTrattamento()),
    getAllTrattamentiOrticole().catch(() => []),
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
    modulo: 'orticole',
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

export async function saveTrattamentoOrticole(data, options = {}) {
  const tenantId = requireTenantId();
  const trattamento = new OrticolaTrattamento(data);
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

export async function deleteTrattamentoOrticole(id, opzioni = {}) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID trattamento obbligatorio');
  const existing = await getDocumentData(COLLECTION_NAME, id, tenantId);
  const { valutaCancellazioneRegistro } = await import('../../../shared/js/registro-trattamenti.js');
  const verdict = valutaCancellazioneRegistro(existing, { exportConfermato: opzioni.exportConfermato === true });
  if (!verdict.consentita) {
    const err = new Error(verdict.messaggio);
    err.code = 'REGISTRO_CONSERVAZIONE';
    throw err;
  }
  await deleteDocument(COLLECTION_NAME, id, tenantId);
}

/**
 * @param {string} lavoroId
 * @returns {Promise<{ trattamentoId: string, campagnaId: string|null, trattamento: object }|null>}
 */
export async function findTrattamentoByLavoroId(lavoroId) {
  try {
    return await findTrattamentoCampoByLavoroId({
      collectionName: COLLECTION_NAME,
      lavoroId,
      tenantId: getCurrentTenantId(),
      mapDocs
    });
  } catch (error) {
    console.error(`[${LOG_PREFIX}] findTrattamentoByLavoroId:`, error);
    return null;
  }
}

/**
 * Crea (o sincronizza) il doc in trattamentiOrticole dal lavoro. Niente scarico magazzino.
 * @param {string} lavoroId
 * @returns {Promise<string|null>}
 */
export async function createTrattamentoFromLavoro(lavoroId) {
  try {
    return await createTrattamentoCampoFromLavoro({
      collectionName: COLLECTION_NAME,
      logPrefix: LOG_PREFIX,
      lavoroId,
      tenantId: getCurrentTenantId(),
      loadCampagne: () => getAllOrticole().catch(() => []),
      intervalloCampagna,
      Model: OrticolaTrattamento,
      mapDocs
    });
  } catch (error) {
    console.error(`[${LOG_PREFIX}] createTrattamentoFromLavoro:`, error);
    return null;
  }
}

/**
 * @param {string} lavoroId
 * @returns {Promise<string|null>}
 */
export async function syncTrattamentoFromLavoro(lavoroId) {
  try {
    return await syncTrattamentoCampoFromLavoro({
      collectionName: COLLECTION_NAME,
      logPrefix: LOG_PREFIX,
      lavoroId,
      tenantId: getCurrentTenantId(),
      Model: OrticolaTrattamento,
      mapDocs
    });
  } catch (error) {
    console.error(`[${LOG_PREFIX}] syncTrattamentoFromLavoro:`, error);
    return null;
  }
}
