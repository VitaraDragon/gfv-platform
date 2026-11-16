/**
 * Lista e salvataggio irrigazioni orticole (tipi Irrigazione su diario e lavori).
 * @module modules/orticole/services/irrigazione-service
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
import { IRRIGAZIONI_ORTICOLE_COLLECTION } from '../config/orticole-hub.js';
import { isLavorazioneDiFilare } from '../models/OrticolaLavorazione.js';
import {
  OrticolaIrrigazione,
  isTipoIrrigazione,
  nomiSeedIrrigazioneCampo,
  selezionaRigheIrrigazione
} from '../models/OrticolaIrrigazione.js';
import { getAllOrticole, listTerreniOrticole } from './orticole-service.js';
import { nomiTipiCategoriaCampo } from './trattamenti-service.js';

const COLLECTION_NAME = IRRIGAZIONI_ORTICOLE_COLLECTION;

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return tenantId;
}

export async function nomiTipiIrrigazione() {
  const nomi = await nomiTipiCategoriaCampo('trattamenti');
  const filtrati = (nomi || []).filter((nome) => isTipoIrrigazione(nome) && !isLavorazioneDiFilare(nome));
  return filtrati.length > 0 ? filtrati : nomiSeedIrrigazioneCampo();
}

export async function getAllIrrigazioniOrticole() {
  const tenantId = requireTenantId();
  const documents = await getCollectionData(COLLECTION_NAME, { tenantId });
  return (documents || []).map((doc) => OrticolaIrrigazione.fromData(doc));
}

export async function listRigheIrrigazione(options = {}) {
  const includeLavori = options.includeLavori !== false;
  const [terreni, campagne, nomi, irrigazioni, attivita, lavori] = await Promise.all([
    listTerreniOrticole({ includiArchiviati: true }),
    getAllOrticole().catch(() => []),
    nomiTipiIrrigazione().catch(() => nomiSeedIrrigazioneCampo()),
    getAllIrrigazioniOrticole().catch(() => []),
    getAllAttivita().catch(() => []),
    includeLavori ? getAllLavori().catch(() => []) : Promise.resolve([])
  ]);
  const righe = selezionaRigheIrrigazione({
    terreni,
    campagne,
    nomiTipi: nomi,
    trattamenti: irrigazioni,
    attivita,
    lavori,
    includeLavori
  }).map((row) => ({
    ...row,
    irrigazione: row.trattamento || null
  }));
  return { terreni, campagne, righe };
}

export async function saveIrrigazioneOrticole(data) {
  const tenantId = requireTenantId();
  const irrigazione = new OrticolaIrrigazione(data);
  const check = irrigazione.validate();
  if (!check.valid) throw new Error(check.errors[0]);
  const payload = irrigazione.toFirestore();
  let id = irrigazione.id;
  if (id) {
    await updateDocument(COLLECTION_NAME, id, payload, tenantId);
  } else {
    id = await createDocument(COLLECTION_NAME, payload, tenantId);
  }
  return id;
}

export async function deleteIrrigazioneOrticole(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID irrigazione obbligatorio');
  await getDocumentData(COLLECTION_NAME, id, tenantId);
  await deleteDocument(COLLECTION_NAME, id, tenantId);
}
