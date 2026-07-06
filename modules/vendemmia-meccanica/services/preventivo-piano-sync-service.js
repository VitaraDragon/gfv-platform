/**
 * Sincronizza preventivi VM accettati → piano stagione (inPiano su terreno).
 * @module modules/vendemmia-meccanica/services/preventivo-piano-sync-service
 */

import { getCollectionData } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllTerreni, getTerreno } from '../../../core/services/terreni-service.js';
import { getAnnoStagioneCorrente } from '../config/vm-constants.js';
import {
  isPreventivoVendemmiaMeccanica,
  isPreventivoAccettato,
  deriveAnnoStagioneFromPreventivo
} from './lavoro-vm-utils.js';
import { updateStagioneTerreno } from './piano-stagione-service.js';
import { buildVignetoDetectionContext, isTerrenoVignetoCliente } from './piano-stagione-utils.js';

const PREVENTIVI_COLLECTION = 'preventivi';

/**
 * Terreni da mettere in piano per un preventivo accettato.
 * @param {Object} preventivo
 * @returns {Promise<string[]>}
 */
export async function resolveTerrenoIdsForPreventivo(preventivo) {
  if (!preventivo) return [];

  const terrenoId = preventivo.terrenoId && String(preventivo.terrenoId).trim();
  if (terrenoId) return [terrenoId];

  const clienteId = preventivo.clienteId && String(preventivo.clienteId).trim();
  if (!clienteId) return [];

  const vignetoCtx = await buildVignetoDetectionContext();
  const terreni = await getAllTerreni({ clienteId, orderBy: 'nome' });
  const vigneti = terreni.filter((t) => isTerrenoVignetoCliente(t, vignetoCtx));
  return vigneti.map((t) => t.id).filter(Boolean);
}

/**
 * Imposta inPiano per un preventivo VM accettato (idempotente).
 * @param {Object} preventivo — documento plain o modello Preventivo
 * @param {{ anno?: number|string, skipIfAlreadyInPiano?: boolean }} [options]
 * @returns {Promise<{ synced: boolean, reason?: string, terrenoIds?: string[], anno?: number, added?: number }>}
 */
export async function syncPreventivoAccettatoToPiano(preventivo, options = {}) {
  if (!isPreventivoVendemmiaMeccanica(preventivo)) {
    return { synced: false, reason: 'not-vm' };
  }
  if (!isPreventivoAccettato(preventivo.stato)) {
    return { synced: false, reason: 'not-accepted' };
  }

  const anno = String(options.anno ?? deriveAnnoStagioneFromPreventivo(preventivo, getAnnoStagioneCorrente()));
  const terrenoIds = await resolveTerrenoIdsForPreventivo(preventivo);
  if (!terrenoIds.length) {
    return { synced: false, reason: 'no-terreno', anno: Number(anno) };
  }

  let added = 0;
  const syncedIds = [];

  for (const id of terrenoIds) {
    if (options.skipIfAlreadyInPiano) {
      const terreno = await getTerreno(id);
      const stato = terreno?.vendemmiaMeccanica?.[anno];
      if (stato?.inPiano) {
        syncedIds.push(id);
        continue;
      }
    }
    await updateStagioneTerreno(id, anno, {
      inPiano: true,
      preventivoId: preventivo.id || null,
      preventivoNumero: preventivo.numero || null
    });
    syncedIds.push(id);
    added += 1;
  }

  return {
    synced: true,
    terrenoIds: syncedIds,
    anno: Number(anno),
    added
  };
}

/**
 * Backfill: allinea piano stagione con tutti i preventivi VM già accettati.
 * @param {number|string} [anno]
 * @returns {Promise<{ processed: number, addedTerreni: number, skipped: number }>}
 */
export async function syncPreventiviAccettatiToPiano(anno = getAnnoStagioneCorrente()) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const docs = await getCollectionData(PREVENTIVI_COLLECTION, { tenantId });
  const accettati = (Array.isArray(docs) ? docs : []).filter(
    (p) => isPreventivoVendemmiaMeccanica(p) && isPreventivoAccettato(p.stato)
  );

  let processed = 0;
  let addedTerreni = 0;
  let skipped = 0;

  for (const p of accettati) {
    const targetAnno = deriveAnnoStagioneFromPreventivo(p, anno);
    if (String(targetAnno) !== String(anno)) {
      skipped += 1;
      continue;
    }
    const result = await syncPreventivoAccettatoToPiano(p, {
      anno: targetAnno,
      skipIfAlreadyInPiano: true
    });
    processed += 1;
    if (result.synced) addedTerreni += result.added || 0;
  }

  return { processed, addedTerreni, skipped };
}

export default {
  resolveTerrenoIdsForPreventivo,
  syncPreventivoAccettatoToPiano,
  syncPreventiviAccettatiToPiano
};
