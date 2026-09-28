/**
 * CRUD semine seminativo e allineamento stato campagna.
 * @module modules/seminativo/services/semine-service
 */

import {
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  getCollectionData
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { SEMINE_SEMINATIVO_COLLECTION } from '../config/seminativo-hub.js';
import {
  SeminativoSemina,
  statoDopoSemina,
  statoDopoRimozioneSemina
} from '../models/SeminativoSemina.js';
import { getSeminativo, updateSeminativo } from './seminativi-service.js';

const COLLECTION_NAME = SEMINE_SEMINATIVO_COLLECTION;

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return tenantId;
}

function toSemina(doc) {
  return SeminativoSemina.fromData(doc);
}

export async function getAllSemine() {
  const tenantId = requireTenantId();
  const documents = await getCollectionData(COLLECTION_NAME, { tenantId });
  const rows = documents.map(toSemina);
  rows.sort((a, b) => String(b.dataSemina || '').localeCompare(String(a.dataSemina || '')));
  return rows;
}

export async function getSemineByCampagna(campagnaId) {
  const rows = await getAllSemine();
  return rows.filter((row) => row.campagnaId === campagnaId);
}

export async function getSemina(seminaId) {
  const tenantId = requireTenantId();
  if (!seminaId) throw new Error('ID semina obbligatorio');
  const data = await getDocumentData(COLLECTION_NAME, seminaId, tenantId);
  return data ? toSemina(data) : null;
}

async function snapshotFromCampagna(semina) {
  const campagna = await getSeminativo(semina.campagnaId);
  if (!campagna) throw new Error('Campagna seminativo non trovata');
  semina.terrenoId = campagna.terrenoId;
  semina.campagna = campagna.campagna;
  semina.colturaId = campagna.colturaId;
  semina.colturaNome = campagna.colturaNome;
  if (!semina.varieta && campagna.varieta) semina.varieta = campagna.varieta;
  return campagna;
}

async function syncStatoCampagna(campagnaId) {
  if (!campagnaId) return;
  const campagna = await getSeminativo(campagnaId);
  if (!campagna) return;
  const semine = await getSemineByCampagna(campagnaId);
  const next = semine.length > 0
    ? statoDopoSemina(campagna.stato)
    : statoDopoRimozioneSemina(campagna.stato);
  if (next !== campagna.stato) {
    await updateSeminativo(campagnaId, { stato: next });
  }
}

export async function createSemina(seminaData) {
  const tenantId = requireTenantId();
  const semina = new SeminativoSemina(seminaData);
  await snapshotFromCampagna(semina);
  const validation = semina.validate();
  if (!validation.valid) {
    throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
  }
  const id = await createDocument(COLLECTION_NAME, semina.toFirestore(), tenantId);
  await syncStatoCampagna(semina.campagnaId);
  return id;
}

export async function updateSemina(seminaId, updates) {
  const tenantId = requireTenantId();
  if (!seminaId) throw new Error('ID semina obbligatorio');
  const esistente = await getSemina(seminaId);
  if (!esistente) throw new Error('Semina non trovata');
  const campagnaPrecedente = esistente.campagnaId;
  esistente.update(updates);
  await snapshotFromCampagna(esistente);
  const validation = esistente.validate();
  if (!validation.valid) {
    throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
  }
  await updateDocument(COLLECTION_NAME, seminaId, esistente.toFirestore(), tenantId);
  await syncStatoCampagna(esistente.campagnaId);
  if (campagnaPrecedente && campagnaPrecedente !== esistente.campagnaId) {
    await syncStatoCampagna(campagnaPrecedente);
  }
}

export async function deleteSemina(seminaId) {
  const tenantId = requireTenantId();
  if (!seminaId) throw new Error('ID semina obbligatorio');
  const esistente = await getSemina(seminaId);
  if (!esistente) throw new Error('Semina non trovata');
  await deleteDocument(COLLECTION_NAME, seminaId, tenantId);
  await syncStatoCampagna(esistente.campagnaId);
}
