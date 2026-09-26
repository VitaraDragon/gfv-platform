/**
 * Seminativi Service — CRUD campagne (terreno + campagna + coltura).
 * Unicità terreno+campagna lato client (stesso schema di existsFruttetoForTerreno).
 *
 * @module modules/seminativo/services/seminativi-service
 */

import {
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  getCollectionData
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllTerreni } from '../../../core/services/terreni-service.js';
import { getAllColture } from '../../../core/services/colture-service.js';
import { getAllCategorie } from '../../../core/services/categorie-service.js';
import { SEMINATIVO_COLLECTION } from '../config/seminativo-hub.js';
import {
  SeminativoCampagna,
  findDuplicateCampagna,
  isTerrenoSeminativo
} from '../models/SeminativoCampagna.js';

export {
  findDuplicateCampagna,
  isTerrenoSeminativo,
  normalizeCampagnaKey,
  sameCampagnaKey,
  defaultCampagnaLabel,
  SEMINATIVO_CAMPAGNA_STATI,
  SEMINATIVO_CAMPAGNA_STATO_LABELS
} from '../models/SeminativoCampagna.js';

const COLLECTION_NAME = SEMINATIVO_COLLECTION;
const CATEGORIA_CODICE = 'seminativo';

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile');
  }
  return tenantId;
}

function toCampagna(doc) {
  return SeminativoCampagna.fromData(doc);
}

async function assertUniqueTerrenoCampagna(candidato, excludeId) {
  const esistenti = await getAllSeminativi();
  const dup = findDuplicateCampagna(esistenti, candidato, excludeId);
  if (dup) {
    throw new Error(
      `Esiste già una campagna ${candidato.campagna || ''} per questo terreno`
    );
  }
}

/**
 * @param {Object} [options]
 * @param {string} [options.terrenoId]
 * @param {string} [options.campagna]
 * @param {string} [options.colturaId]
 * @param {string} [options.stato]
 * @param {string} [options.orderBy]
 * @param {string} [options.orderDirection]
 * @returns {Promise<SeminativoCampagna[]>}
 */
export async function getAllSeminativi(options = {}) {
  try {
    const tenantId = requireTenantId();
    const {
      orderBy = null,
      orderDirection = 'desc',
      terrenoId = null,
      campagna = null,
      colturaId = null,
      stato = null
    } = options;

    const whereFilters = [];
    if (terrenoId) whereFilters.push(['terrenoId', '==', terrenoId]);
    if (campagna) whereFilters.push(['campagna', '==', campagna]);
    if (colturaId) whereFilters.push(['colturaId', '==', colturaId]);
    if (stato) whereFilters.push(['stato', '==', stato]);

    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy: orderBy || undefined,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });

    const rows = documents.map(toCampagna);
    rows.sort((a, b) => {
      const c = String(b.campagna || '').localeCompare(String(a.campagna || ''));
      if (c !== 0) return c;
      return String(a.colturaNome || '').localeCompare(String(b.colturaNome || ''));
    });
    return rows;
  } catch (error) {
    console.error('[SEMINATIVI-SERVICE] Errore recupero campagne:', error);
    if (error.message && (error.message.includes('tenant') || error.message.includes('obbligatorio'))) {
      throw new Error(`Errore recupero campagne: ${error.message}`);
    }
    return [];
  }
}

export async function getSeminativo(campagnaId) {
  const tenantId = requireTenantId();
  if (!campagnaId) throw new Error('ID campagna obbligatorio');
  const data = await getDocumentData(COLLECTION_NAME, campagnaId, tenantId);
  return data ? toCampagna(data) : null;
}

export async function createSeminativo(campagnaData) {
  const tenantId = requireTenantId();
  const campagna = new SeminativoCampagna(campagnaData);
  const validation = campagna.validate();
  if (!validation.valid) {
    throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
  }
  await assertUniqueTerrenoCampagna(campagna, null);
  return createDocument(COLLECTION_NAME, campagna.toFirestore(), tenantId);
}

export async function updateSeminativo(campagnaId, updates) {
  const tenantId = requireTenantId();
  if (!campagnaId) throw new Error('ID campagna obbligatorio');
  const esistente = await getSeminativo(campagnaId);
  if (!esistente) throw new Error('Campagna seminativo non trovata');
  esistente.update(updates);
  const validation = esistente.validate();
  if (!validation.valid) {
    throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
  }
  await assertUniqueTerrenoCampagna(esistente, campagnaId);
  await updateDocument(COLLECTION_NAME, campagnaId, esistente.toFirestore(), tenantId);
}

export async function deleteSeminativo(campagnaId) {
  const tenantId = requireTenantId();
  if (!campagnaId) throw new Error('ID campagna obbligatorio');
  await deleteDocument(COLLECTION_NAME, campagnaId, tenantId);
}

export async function getSeminativiByTerreno(terrenoId) {
  return getAllSeminativi({ terrenoId });
}

export async function existsCampagnaForTerreno(terrenoId, campagna, excludeId) {
  const list = await getSeminativiByTerreno(terrenoId);
  return !!findDuplicateCampagna(list, { terrenoId, campagna }, excludeId);
}

/**
 * Terreni aziendali con categoria Seminativo (non prato, non ortive).
 * @returns {Promise<Array>}
 */
export async function listTerreniSeminativo() {
  const terreni = await getAllTerreni();
  return terreni.filter(isTerrenoSeminativo);
}

/**
 * Colture della categoria catalogo `seminativo`.
 * @returns {Promise<Array<{id: string, nome: string}>>}
 */
export async function listColtureSeminativo() {
  const categorie = await getAllCategorie({
    applicabileA: 'colture',
    orderBy: 'ordine'
  });
  const categoria = categorie.find((c) => {
    const codice = String(c.codice || '').toLowerCase();
    const nome = String(c.nome || '').toLowerCase();
    return codice === CATEGORIA_CODICE || nome.includes('seminativ');
  });
  const tutte = await getAllColture({ orderBy: 'nome', orderDirection: 'asc' });
  if (!categoria) {
    return tutte.filter((c) => String(c.categoriaCodice || '').toLowerCase() === CATEGORIA_CODICE);
  }
  return tutte.filter((c) => c.categoriaId === categoria.id);
}
