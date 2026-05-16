/**
 * Batch tenant: ore validate → skillCalcolate su profiliManodopera.
 *
 * @module core/services/profilo-manodopera-skill-batch-service
 */

import { getDb, collection, getDocs, query, where } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getAllTipiLavoro, TIPI_LAVORO_PREDEFINITI } from './tipi-lavoro-service.js';
import { getAllCategorie } from './categorie-service.js';
import { getAllLavori } from './lavori-service.js';
import { getCollectionData, getDocumentData, updateDocument, setDocument, serverTimestamp } from './firebase-service.js';
import { COLLECTION_NAME as PROFILI_COLLECTION } from './profilo-manodopera-service.js';
import {
  getDefaultSkillBatchPeriod,
  buildCategoriaCodiceById,
  buildNomeToSottocategoriaCodiceMap,
  buildTipoLavoroResolver,
  resolveLavoroOreContext,
  accumulateValidatedOreForSkills,
  buildSkillCalcolateByOperaioFromAccumulator,
  parseOreRecordDate
} from './profilo-manodopera-batch.js';

const MACCHINE_COLLECTION = 'macchine';
const LAVORI_COLLECTION = 'lavori';

/**
 * @param {string} tenantId
 * @returns {Promise<Map<string, Record<string, unknown>>>}
 */
async function loadMacchineById(tenantId) {
  const docs = await getCollectionData(MACCHINE_COLLECTION, { tenantId });
  const map = new Map();
  for (const doc of docs) {
    if (doc?.id) map.set(doc.id, doc);
  }
  return map;
}

/**
 * @param {string} tenantId
 * @param {string} lavoroId
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function loadValidatedOreForLavoro(tenantId, lavoroId) {
  const db = getDb();
  if (!db) throw new Error('Firebase non inizializzato');

  const oreRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai');
  const oreQuery = query(oreRef, where('stato', '==', 'validate'));
  const snap = await getDocs(oreQuery);
  const rows = [];
  snap.forEach((oraDoc) => {
    rows.push({ id: oraDoc.id, ...oraDoc.data() });
  });
  return rows;
}

/**
 * Ricalcola skillCalcolate per tutti gli operai con ore validate nel tenant.
 *
 * @param {{ tenantId?: string, aggiornatoDa: string, periodoDa?: Date, periodoA?: Date, onProgress?: (msg: string) => void }} options
 * @returns {Promise<{ operaiAggiornati: number, oreProcessate: number, lavoriScansionati: number }>}
 */
export async function recalculateSkillCalcolateForTenant(options) {
  const tenantId = options.tenantId || getCurrentTenantId();
  if (!tenantId) {
    throw new Error('tenantId obbligatorio');
  }
  if (!options?.aggiornatoDa) {
    throw new Error('aggiornatoDa obbligatorio');
  }

  const progress = options.onProgress || (() => {});
  const period =
    options.periodoDa && options.periodoA
      ? { periodoDa: options.periodoDa, periodoA: options.periodoA }
      : getDefaultSkillBatchPeriod();

  progress('Caricamento anagrafiche lavoro…');
  const [tipiLavoro, categorie, macchineById, lavori] = await Promise.all([
    getAllTipiLavoro(),
    getAllCategorie(),
    loadMacchineById(tenantId),
    getAllLavori({ orderBy: 'dataInizio', orderDirection: 'desc' })
  ]);

  const categoriaCodiceById = buildCategoriaCodiceById(categorie);
  const nomeToSotto = buildNomeToSottocategoriaCodiceMap(TIPI_LAVORO_PREDEFINITI);
  const resolver = buildTipoLavoroResolver(tipiLavoro, categoriaCodiceById, nomeToSotto);

  /** @type {import('./profilo-manodopera-batch.js').OreSkillAccumulator} */
  const accumulator = new Map();
  let oreProcessate = 0;
  let lavoriScansionati = 0;

  progress(`Analisi ore su ${lavori.length} lavori…`);

  for (const lavoro of lavori) {
    const lavoroId = lavoro.id;
    if (!lavoroId) continue;
    lavoriScansionati += 1;

    const oreContext = resolveLavoroOreContext(lavoro, resolver, macchineById);
    const oreList = await loadValidatedOreForLavoro(tenantId, lavoroId);

    for (const ora of oreList) {
      const oreDate = parseOreRecordDate(ora.data);
      accumulateValidatedOreForSkills(
        accumulator,
        {
          operaioId: ora.operaioId,
          oreNette: ora.oreNette,
          oreDate,
          oreContext,
          ruoloOre: ora.ruoloOre || null
        },
        period
      );
      oreProcessate += 1;
    }

    if (lavoriScansionati % 25 === 0) {
      progress(`Lavori analizzati: ${lavoriScansionati}/${lavori.length}…`);
    }
  }

  const aggiornatoIl = new Date().toISOString();
  const skillByOperaio = buildSkillCalcolateByOperaioFromAccumulator(accumulator, {
    ...period,
    aggiornatoIl
  });

  progress(`Salvataggio profili (${skillByOperaio.size} operai con ore)…`);

  let operaiAggiornati = 0;
  for (const [userId, skillCalcolate] of skillByOperaio.entries()) {
    const existing = await getDocumentData(PROFILI_COLLECTION, userId, tenantId);
    const patch = {
      userId,
      skillCalcolate,
      skillCalcolateAggiornatoIl: serverTimestamp(),
      skillCalcolateAggiornatoDa: options.aggiornatoDa
    };

    if (existing) {
      if (Array.isArray(existing.skillDichiarate)) {
        patch.skillDichiarate = existing.skillDichiarate;
      }
      if (existing.notaProfilo != null) {
        patch.notaProfilo = existing.notaProfilo;
      }
      await updateDocument(PROFILI_COLLECTION, userId, patch, tenantId);
    } else {
      await setDocument(
        PROFILI_COLLECTION,
        userId,
        {
          ...patch,
          skillDichiarate: [],
          notaProfilo: '',
          aggiornatoDa: options.aggiornatoDa,
          aggiornatoIl: serverTimestamp()
        },
        tenantId
      );
    }
    operaiAggiornati += 1;
  }

  progress('Completato.');
  return { operaiAggiornati, oreProcessate, lavoriScansionati };
}
