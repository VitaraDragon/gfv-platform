/**
 * Persistenza roster giornaliero (partecipazioni su equipaggioGiorno).
 *
 * @module core/services/manodopera-roster-giorno-service
 */

import { getLavoro, updateLavoro, getAllLavori } from './lavori-service.js';
import { getCollectionData } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import {
  ensureRosterSlice,
  mergeEquipaggioGiornoPatch,
  isRosterMaterializzato,
  getEquipaggioSlice,
  addPartecipazioneManuale,
  removePartecipazioneManuale
} from './manodopera-roster-giorno-logic.js';
import { lavoroCopreGiornoKey } from './manodopera-impegni-giorno-logic.js';

export {
  ensureRosterSlice,
  isRosterMaterializzato,
  getEquipaggioSlice,
  resolvePrevistiOperaioIdsForGiorno,
  getRosterAttiviIds,
  getRosterPrevistiIds,
  canRemovePartecipazioneManuale,
  addPartecipazioneManuale,
  removePartecipazioneManuale
} from './manodopera-roster-giorno-logic.js';

/**
 * @param {string} [tenantId]
 * @returns {Promise<Object[]>}
 */
async function loadSquadre(tenantId) {
  try {
    return (await getCollectionData('squadre', { tenantId })) || [];
  } catch (e) {
    console.warn('[roster-giorno] load squadre:', e);
    return [];
  }
}

/**
 * Materializza (lazy) il roster del giorno su un lavoro e persiste se creato.
 *
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.giornoKey
 * @param {Array<Object>} [options.squadreList]
 * @param {Object} [options.lavoro] — se già caricato
 * @param {'auto'|'manager'} [options.materializzatoDa]
 * @returns {Promise<{ lavoro: Object, slice: Object, created: boolean, persisted: boolean }>}
 */
export async function ensureRosterGiornoPersisted(options = {}) {
  const {
    lavoroId,
    giornoKey,
    squadreList: squadreIn = null,
    lavoro: lavoroIn = null,
    materializzatoDa = 'auto'
  } = options;

  if (!lavoroId || !giornoKey) {
    throw new Error('lavoroId e giornoKey obbligatori');
  }

  const lavoro = lavoroIn || (await getLavoro(lavoroId));
  if (!lavoro) throw new Error('Lavoro non trovato');

  const squadreList = squadreIn || (await loadSquadre(getCurrentTenantId()));
  const { slice, created } = ensureRosterSlice({
    lavoro,
    giornoKey,
    squadreList,
    materializzatoDa
  });

  if (!created) {
    return { lavoro, slice, created: false, persisted: false };
  }

  // Non persistere slice vuoto (nessuna anagrafica e nessun delta)
  if (!isRosterMaterializzato(slice)) {
    return { lavoro, slice, created: false, persisted: false };
  }

  const equipaggioGiorno = mergeEquipaggioGiornoPatch(lavoro, giornoKey, slice);
  await updateLavoro(lavoroId, { equipaggioGiorno });
  const updated = { ...lavoro, equipaggioGiorno };
  return { lavoro: updated, slice, created: true, persisted: true };
}

/**
 * Materializza roster per tutti i lavori che coprono il giorno (lazy seed).
 * Usato dalla vista impegni: lettura + persistenza minima.
 *
 * @param {Object} options
 * @param {string} options.giornoKey
 * @param {Array<Object>} [options.lavoriList]
 * @param {Array<Object>} [options.squadreList]
 * @param {string} [options.tenantId]
 * @returns {Promise<{ materializzati: number, lavori: Object[] }>}
 */
export async function ensureRosterGiornoPerLavoriDelGiorno(options = {}) {
  const {
    giornoKey,
    lavoriList: lavoriIn = null,
    squadreList: squadreIn = null,
    tenantId: tidIn = null
  } = options;

  if (!giornoKey) throw new Error('giornoKey obbligatorio');

  const tenantId = tidIn || getCurrentTenantId();
  const [lavoriList, squadreList] = await Promise.all([
    lavoriIn ? Promise.resolve(lavoriIn) : getAllLavori(),
    squadreIn ? Promise.resolve(squadreIn) : loadSquadre(tenantId)
  ]);

  const delGiorno = (lavoriList || []).filter((l) =>
    lavoroCopreGiornoKey(giornoKey, l)
  );

  let materializzati = 0;
  const updatedById = new Map();

  for (const lav of delGiorno) {
    try {
      const res = await ensureRosterGiornoPersisted({
        lavoroId: lav.id,
        giornoKey,
        squadreList,
        lavoro: lav,
        materializzatoDa: 'auto'
      });
      if (res.persisted) materializzati += 1;
      updatedById.set(lav.id, res.lavoro);
    } catch (e) {
      console.warn('[roster-giorno] ensure fallito per', lav.id, e);
      updatedById.set(lav.id, lav);
    }
  }

  const lavori = (lavoriList || []).map((l) => updatedById.get(l.id) || l);
  return { materializzati, lavori };
}

/**
 * Persist helper A2: materializza se serve, applica patch slice, salva.
 *
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.giornoKey
 * @param {(slice: Object) => Object} options.applyFn
 * @param {string|null} [options.daManagerId]
 * @returns {Promise<{ lavoro: Object, slice: Object }>}
 */
async function persistRosterSliceMutation(options = {}) {
  const { lavoroId, giornoKey, applyFn, daManagerId = null } = options;
  if (!lavoroId || !giornoKey || typeof applyFn !== 'function') {
    throw new Error('lavoroId, giornoKey e applyFn obbligatori');
  }

  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) throw new Error('Lavoro non trovato');

  const squadreList = await loadSquadre(getCurrentTenantId());
  let { slice } = ensureRosterSlice({
    lavoro,
    giornoKey,
    squadreList,
    materializzatoDa: 'manager'
  });

  slice = applyFn(slice, daManagerId);
  if (!slice.materializzatoIl) {
    slice = {
      ...slice,
      materializzatoIl: new Date().toISOString(),
      materializzatoDa: 'manager'
    };
  }

  const equipaggioGiorno = mergeEquipaggioGiornoPatch(lavoro, giornoKey, slice);
  await updateLavoro(lavoroId, { equipaggioGiorno });
  return {
    lavoro: { ...lavoro, equipaggioGiorno },
    slice: getEquipaggioSlice({ equipaggioGiorno }, giornoKey)
  };
}

/**
 * A2 — aggiunge partecipazione manuale e persiste.
 *
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.giornoKey
 * @param {string} options.operaioId
 * @param {string|null} [options.daManagerId]
 * @returns {Promise<{ lavoro: Object, slice: Object }>}
 */
export async function aggiungiPartecipazioneRosterGiorno(options = {}) {
  const { lavoroId, giornoKey, operaioId, daManagerId = null } = options;
  if (!operaioId) throw new Error('operaioId obbligatorio');
  return persistRosterSliceMutation({
    lavoroId,
    giornoKey,
    daManagerId,
    applyFn: (slice, mgrId) =>
      addPartecipazioneManuale(slice, { operaioId, daManagerId: mgrId })
  });
}

/**
 * A2 — rimuove partecipazione giornaliera e persiste.
 *
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.giornoKey
 * @param {string} options.operaioId
 * @param {string|null} [options.daManagerId]
 * @returns {Promise<{ lavoro: Object, slice: Object }>}
 */
export async function rimuoviPartecipazioneRosterGiorno(options = {}) {
  const { lavoroId, giornoKey, operaioId, daManagerId = null } = options;
  if (!operaioId) throw new Error('operaioId obbligatorio');
  return persistRosterSliceMutation({
    lavoroId,
    giornoKey,
    daManagerId,
    applyFn: (slice) => removePartecipazioneManuale(slice, { operaioId })
  });
}
