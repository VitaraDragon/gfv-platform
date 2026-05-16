/**
 * Batch tenant: ore validate → skillCalcolate su profiliManodopera.
 *
 * @module core/services/profilo-manodopera-skill-batch-service
 */

import { getDb, collection, getDocs } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { TIPI_LAVORO_PREDEFINITI } from './tipi-lavoro-service.js';
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
const TIPI_LAVORO_COLLECTION = 'tipiLavoro';
const CATEGORIE_COLLECTION = 'categorie';

/**
 * @param {string} tenantId
 */
async function loadLavoriRaw(tenantId) {
  return getCollectionData(LAVORI_COLLECTION, {
    tenantId,
    orderBy: 'dataInizio',
    orderDirection: 'desc'
  });
}

/**
 * @param {string} tenantId
 */
async function loadTipiLavoroRaw(tenantId) {
  return getCollectionData(TIPI_LAVORO_COLLECTION, {
    tenantId,
    orderBy: 'nome',
    orderDirection: 'asc'
  });
}

/**
 * @param {string} tenantId
 */
async function loadCategorieRaw(tenantId) {
  return getCollectionData(CATEGORIE_COLLECTION, {
    tenantId,
    orderBy: 'ordine',
    orderDirection: 'asc'
  });
}

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
/**
 * @param {string} tenantId
 * @param {string} lavoroId
 * @returns {Promise<{ validate: Array<Record<string, unknown>>, daValidare: number }>}
 */
async function loadOreForLavoro(tenantId, lavoroId) {
  const db = getDb();
  if (!db) throw new Error('Firebase non inizializzato');

  const oreRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai');
  const snap = await getDocs(oreRef);
  const validate = [];
  let daValidare = 0;
  snap.forEach((oraDoc) => {
    const data = oraDoc.data();
    if (data.stato === 'validate') {
      validate.push({ id: oraDoc.id, ...data });
    } else if (data.stato === 'da_validare') {
      daValidare += 1;
    }
  });
  return { validate, daValidare };
}

/**
 * @param {string} tenantId
 */
async function loadSkillBatchResolverContext(tenantId) {
  const [tipiLavoro, categorie, macchineById, lavori] = await Promise.all([
    loadTipiLavoroRaw(tenantId),
    loadCategorieRaw(tenantId),
    loadMacchineById(tenantId),
    loadLavoriRaw(tenantId)
  ]);
  const categoriaCodiceById = buildCategoriaCodiceById(categorie);
  const nomeToSotto = buildNomeToSottocategoriaCodiceMap(TIPI_LAVORO_PREDEFINITI);
  const resolver = buildTipoLavoroResolver(tipiLavoro, categoriaCodiceById, nomeToSotto);
  return { resolver, macchineById, lavori };
}

/**
 * @param {string} tenantId
 * @param {string} userId
 * @param {Array<object>} skillCalcolate
 * @param {string} aggiornatoDa
 */
async function persistProfiloSkillCalcolate(tenantId, userId, skillCalcolate, aggiornatoDa) {
  const existing = await getDocumentData(PROFILI_COLLECTION, userId, tenantId);
  const patch = {
    userId,
    skillCalcolate,
    skillCalcolateAggiornatoIl: serverTimestamp(),
    skillCalcolateAggiornatoDa: aggiornatoDa
  };

  if (existing) {
    if (Array.isArray(existing.skillDichiarate)) {
      patch.skillDichiarate = existing.skillDichiarate;
    }
    if (existing.notaProfilo != null) {
      patch.notaProfilo = existing.notaProfilo;
    }
    await updateDocument(PROFILI_COLLECTION, userId, patch, tenantId);
    return;
  }

  await setDocument(
    PROFILI_COLLECTION,
    userId,
    {
      ...patch,
      skillDichiarate: [],
      notaProfilo: '',
      aggiornatoDa,
      aggiornatoIl: serverTimestamp()
    },
    tenantId
  );
}

/**
 * Ricalcola skillCalcolate per un solo operaio (tutte le ore validate del tenant).
 *
 * @param {{ tenantId: string, operaioId: string, aggiornatoDa: string, periodoDa?: Date, periodoA?: Date }} options
 * @returns {Promise<{ oreProcessate: number, skillCount: number }>}
 */
export async function recalculateSkillCalcolateForOperaio(options) {
  const { tenantId, operaioId, aggiornatoDa } = options;
  if (!tenantId || !operaioId || !aggiornatoDa) {
    throw new Error('tenantId, operaioId e aggiornatoDa obbligatori');
  }

  const period =
    options.periodoDa && options.periodoA
      ? { periodoDa: options.periodoDa, periodoA: options.periodoA }
      : getDefaultSkillBatchPeriod();

  const { resolver, macchineById, lavori } = await loadSkillBatchResolverContext(tenantId);
  const accumulator = new Map();
  let oreProcessate = 0;

  for (const lavoro of lavori) {
    const lavoroId = lavoro.id;
    if (!lavoroId) continue;

    const oreContext = resolveLavoroOreContext(lavoro, resolver, macchineById);
    const { validate: oreList } = await loadOreForLavoro(tenantId, lavoroId);

    for (const ora of oreList) {
      if (ora.operaioId !== operaioId) continue;
      accumulateValidatedOreForSkills(
        accumulator,
        {
          operaioId,
          oreNette: ora.oreNette,
          oreDate: parseOreRecordDate(ora.data),
          oreContext,
          ruoloOre: ora.ruoloOre || null
        },
        period
      );
      oreProcessate += 1;
    }
  }

  const aggiornatoIl = new Date().toISOString();
  const skillByOperaio = buildSkillCalcolateByOperaioFromAccumulator(accumulator, {
    ...period,
    aggiornatoIl
  });
  const skillCalcolate = skillByOperaio.get(operaioId) || [];

  await persistProfiloSkillCalcolate(tenantId, operaioId, skillCalcolate, aggiornatoDa);
  return { oreProcessate, skillCount: skillCalcolate.length };
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
  const { resolver, macchineById, lavori } = await loadSkillBatchResolverContext(tenantId);

  /** @type {import('./profilo-manodopera-batch.js').OreSkillAccumulator} */
  const accumulator = new Map();
  let oreProcessate = 0;
  let oreDaValidare = 0;
  let lavoriScansionati = 0;

  progress(`Analisi ore su ${lavori.length} lavori…`);

  for (const lavoro of lavori) {
    const lavoroId = lavoro.id;
    if (!lavoroId) continue;
    lavoriScansionati += 1;

    const oreContext = resolveLavoroOreContext(lavoro, resolver, macchineById);
    const { validate: oreList, daValidare } = await loadOreForLavoro(tenantId, lavoroId);
    oreDaValidare += daValidare;

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
    await persistProfiloSkillCalcolate(tenantId, userId, skillCalcolate, options.aggiornatoDa);
    operaiAggiornati += 1;
  }

  progress('Completato.');
  return { operaiAggiornati, oreProcessate, oreDaValidare, lavoriScansionati };
}
