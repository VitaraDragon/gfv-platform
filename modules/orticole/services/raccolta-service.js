/**
 * Lista e salvataggio mietiture orticole (categoria Raccolta su diario e lavori).
 * @module modules/orticole/services/raccolta-service
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
import { RACCOLTE_ORTICOLE_COLLECTION } from '../config/orticole-hub.js';
import { isLavorazioneDiFilare } from '../models/OrticolaLavorazione.js';
import {
  OrticolaRaccolta,
  isRaccoltaDiVigneto,
  nomiSeedRaccoltaCampo,
  selezionaRigheRaccolta,
  statoDopoRaccolta,
  statoDopoRimozioneRaccolta
} from '../models/OrticolaRaccolta.js';
import { getAllOrticole, getOrticola, listTerreniOrticole, updateOrticola } from './orticole-service.js';
import { nomiTipiCategoriaCampo } from './trattamenti-service.js';

const COLLECTION_NAME = RACCOLTE_ORTICOLE_COLLECTION;

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return tenantId;
}

export async function nomiTipiRaccolta() {
  const nomi = await nomiTipiCategoriaCampo('raccolta');
  return (nomi || []).filter((nome) => !isRaccoltaDiVigneto(nome) && !isLavorazioneDiFilare(nome));
}

export async function getAllRaccolteOrticole() {
  const tenantId = requireTenantId();
  const documents = await getCollectionData(COLLECTION_NAME, { tenantId });
  return (documents || []).map((doc) => OrticolaRaccolta.fromData(doc));
}

export async function listRigheRaccolta(options = {}) {
  const includeLavori = options.includeLavori !== false;
  const [terreni, campagne, nomi, raccolte, attivita, lavori] = await Promise.all([
    listTerreniOrticole({ includiArchiviati: true }),
    getAllOrticole().catch(() => []),
    nomiTipiRaccolta().catch(() => nomiSeedRaccoltaCampo()),
    getAllRaccolteOrticole().catch(() => []),
    getAllAttivita().catch(() => []),
    includeLavori ? getAllLavori().catch(() => []) : Promise.resolve([])
  ]);
  const byId = new Map((campagne || []).filter((row) => row && row.id).map((row) => [String(row.id), row]));
  const righe = selezionaRigheRaccolta({
    terreni,
    campagne,
    nomiTipi: nomi,
    trattamenti: raccolte,
    attivita,
    lavori,
    includeLavori
  }).map((row) => {
    const campagna = byId.get(String(row.campagnaId));
    return {
      ...row,
      varieta: campagna && campagna.varieta ? campagna.varieta : '',
      raccolta: row.trattamento || null
    };
  });
  return { terreni, campagne, righe };
}

async function syncStatoCampagna(campagnaId) {
  if (!campagnaId) return;
  const campagna = await getOrticola(campagnaId);
  if (!campagna) return;
  const tutte = await getAllRaccolteOrticole();
  const presenti = tutte.filter((row) => row.campagnaId === campagnaId);
  const next = presenti.length > 0
    ? statoDopoRaccolta(campagna.stato)
    : statoDopoRimozioneRaccolta(campagna.stato);
  if (next !== campagna.stato) {
    await updateOrticola(campagnaId, { stato: next });
  }
}

export async function saveRaccoltaOrticole(data) {
  const tenantId = requireTenantId();
  const raccolta = new OrticolaRaccolta(data);
  const check = raccolta.validate();
  if (!check.valid) throw new Error(check.errors[0]);
  const payload = raccolta.toFirestore();
  let id = raccolta.id;
  if (id) {
    await updateDocument(COLLECTION_NAME, id, payload, tenantId);
  } else {
    id = await createDocument(COLLECTION_NAME, payload, tenantId);
  }
  await syncStatoCampagna(raccolta.campagnaId);
  return id;
}

export async function deleteRaccoltaOrticole(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID raccolta obbligatorio');
  const existing = await getDocumentData(COLLECTION_NAME, id, tenantId);
  await deleteDocument(COLLECTION_NAME, id, tenantId);
  if (existing && existing.campagnaId) await syncStatoCampagna(existing.campagnaId);
}
