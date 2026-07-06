/**
 * Sync lavoro VM completato → piano stagione (vendemmiato + zone tracciate).
 * @module modules/vendemmia-meccanica/services/lavoro-piano-sync-service
 */

import { getCollectionData } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getTerreno } from '../../../core/services/terreni-service.js';
import { getAnnoStagioneCorrente } from '../config/vm-constants.js';
import {
  isLavoroVendemmiaMeccanica,
  isPianoStagioneLinkedToLavoro,
  toDateKeyString
} from './lavoro-vm-utils.js';
import { updateStagioneTerreno, revertVendemmiaLavoroInPiano, getPianoStagioneRows } from './piano-stagione-service.js';
import {
  normalizeLatLngCoord,
  shouldAutoGenerateZoneEscluse,
  computeZoneEscluseAutomatiche
} from './zone-escluse-service.js';

/**
 * @param {Object|null|undefined} lavoro
 * @param {number} [fallbackAnno]
 * @returns {number}
 */
export function deriveAnnoStagioneFromLavoro(lavoro, fallbackAnno) {
  const raw = lavoro?.dataInizio;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getFullYear();
  if (raw && typeof raw === 'object' && typeof raw.toDate === 'function') {
    const d = raw.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getFullYear();
  }
  const fb = fallbackAnno ?? getAnnoStagioneCorrente();
  return Number.isFinite(Number(fb)) ? Number(fb) : new Date().getFullYear();
}

/**
 * @param {Array<Object>} zoneLavorate
 * @returns {Array<{ coordinates: Array<{ lat: number, lng: number }>, superficieHa: number|null, data: string|null }>}
 */
export function zoneLavorateToVendemmiate(zoneLavorate) {
  if (!Array.isArray(zoneLavorate)) return [];

  return zoneLavorate
    .filter((z) => {
      const chiuso = z.isChiuso === true || z.tipo === 'poligono';
      const coords = z.coordinate || z.coordinates || [];
      return chiuso && Array.isArray(coords) && coords.length >= 3;
    })
    .map((z) => {
      const raw = z.coordinate || z.coordinates || [];
      const coordinates = raw.map(normalizeLatLngCoord).filter(Boolean);
      if (coordinates.length < 3) return null;
      return {
        coordinates,
        superficieHa: z.superficieHa != null ? Number(z.superficieHa) : null,
        data: toDateKeyString(z.data)
      };
    })
    .filter(Boolean);
}

/**
 * @param {string} lavoroId
 * @param {string} [tenantId]
 * @returns {Promise<Array<Object>>}
 */
export async function loadZoneLavorateForLavoro(lavoroId, tenantId = getCurrentTenantId()) {
  if (!lavoroId || !tenantId) return [];
  try {
    return await getCollectionData(`lavori/${lavoroId}/zoneLavorate`, { tenantId });
  } catch (err) {
    console.warn('[VM] loadZoneLavorateForLavoro:', err.message);
    return [];
  }
}

/**
 * @param {Array<Object>} zoneLavorate
 * @returns {number}
 */
export function sumSuperficieHaZoneLavorate(zoneLavorate) {
  if (!Array.isArray(zoneLavorate)) return 0;
  return zoneLavorate.reduce((sum, z) => {
    const ha = Number(z.superficieHa);
    return sum + (Number.isFinite(ha) && ha > 0 ? ha : 0);
  }, 0);
}

/**
 * @param {Array<Object>} zoneVendemmiate
 * @returns {string|null}
 */
export function deriveDataVendemmiaFromZone(zoneVendemmiate) {
  if (!Array.isArray(zoneVendemmiate) || !zoneVendemmiate.length) return null;
  const dates = zoneVendemmiate.map((z) => z.data).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/**
 * Annulla sync piano stagione quando un lavoro VM viene eliminato.
 * @param {Object} lavoro — con id
 * @param {{ anno?: number|string, hasVmModule?: boolean, tenantId?: string }} [options]
 */
export async function clearLavoroFromPianoStagione(lavoro, options = {}) {
  if (options.hasVmModule === false) {
    return { cleared: false, reason: 'no-vm-module' };
  }
  if (!isLavoroVendemmiaMeccanica(lavoro, { hasVmModule: options.hasVmModule !== false })) {
    return { cleared: false, reason: 'not-vm' };
  }
  if (!lavoro?.terrenoId || !lavoro?.id) {
    return { cleared: false, reason: 'missing-ids' };
  }

  const anno = String(options.anno ?? deriveAnnoStagioneFromLavoro(lavoro));
  const terreno = await getTerreno(lavoro.terrenoId);
  const stato = terreno?.vendemmiaMeccanica?.[anno] || {};

  if (!isPianoStagioneLinkedToLavoro(stato, lavoro.id)) {
    return { cleared: false, reason: 'not-linked', terrenoId: lavoro.terrenoId, anno: Number(anno) };
  }

  await revertVendemmiaLavoroInPiano(lavoro.terrenoId, anno);
  return { cleared: true, terrenoId: lavoro.terrenoId, anno: Number(anno) };
}

/**
 * Ripulisce righe piano con lavoroId puntato a un lavoro inesistente (es. già eliminato).
 * @param {number|string} [anno]
 */
export async function cleanupOrphanedPianoStagioneLavori(anno = getAnnoStagioneCorrente()) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { checked: 0, cleared: 0 };

  const annoKey = String(anno);
  let lavori = [];
  try {
    lavori = await getCollectionData('lavori', { tenantId });
  } catch (err) {
    console.warn('[VM] cleanupOrphanedPianoStagioneLavori load lavori:', err.message);
    return { checked: 0, cleared: 0 };
  }

  const lavoriIds = new Set(lavori.map((l) => l.id).filter(Boolean));
  const rows = await getPianoStagioneRows(anno, { soloVigneti: true });

  let checked = 0;
  let cleared = 0;

  for (const row of rows) {
    const stato = row.stato || {};
    if (!stato.vendemmiato || !stato.lavoroId) continue;
    checked += 1;
    if (lavoriIds.has(stato.lavoroId)) continue;
    try {
      await revertVendemmiaLavoroInPiano(row.terrenoId, annoKey);
      cleared += 1;
    } catch (err) {
      console.warn('[VM] cleanupOrphanedPianoStagioneLavori revert:', row.terrenoId, err.message);
    }
  }

  return { checked, cleared };
}

/**
 * Sincronizza piano stagione quando un lavoro VM è completato/approvato.
 * @param {Object} lavoro — documento lavoro (plain, con id)
 * @param {{ anno?: number|string, hasVmModule?: boolean, tenantId?: string }} [options]
 * @returns {Promise<{ synced: boolean, reason?: string, terrenoId?: string, anno?: number }>}
 */
export async function syncLavoroCompletatoToPianoStagione(lavoro, options = {}) {
  if (options.hasVmModule === false) {
    return { synced: false, reason: 'no-vm-module' };
  }
  if (!isLavoroVendemmiaMeccanica(lavoro, { hasVmModule: options.hasVmModule !== false })) {
    return { synced: false, reason: 'not-vm' };
  }
  if (!lavoro?.terrenoId) {
    return { synced: false, reason: 'no-terreno' };
  }

  const tenantId = options.tenantId || getCurrentTenantId();
  if (!tenantId) return { synced: false, reason: 'no-tenant' };

  const anno = String(options.anno ?? deriveAnnoStagioneFromLavoro(lavoro));
  const lavoroId = lavoro.id;
  const zoneLavorate = lavoroId ? await loadZoneLavorateForLavoro(lavoroId, tenantId) : [];
  const zoneVendemmiate = zoneLavorateToVendemmiate(zoneLavorate);

  const terreno = await getTerreno(lavoro.terrenoId);
  const ettariTotali = Number(terreno?.superficie) || 0;
  const statoEsistente = terreno?.vendemmiaMeccanica?.[anno] || {};
  const ettariEsclusiManuali = statoEsistente.zoneEscluseModificateManualmente === true
    ? (Number(statoEsistente.ettariEsclusi) || 0)
    : 0;

  let ettariVendemmiati = Number(lavoro.superficieTotaleLavorata);
  if (!Number.isFinite(ettariVendemmiati) || ettariVendemmiati <= 0) {
    ettariVendemmiati = sumSuperficieHaZoneLavorate(zoneLavorate);
  }
  if (!Number.isFinite(ettariVendemmiati) || ettariVendemmiati <= 0) {
    ettariVendemmiati = Math.max(0, ettariTotali - ettariEsclusiManuali);
  }
  ettariVendemmiati = Math.min(
    ettariVendemmiati,
    Math.max(0, ettariTotali - ettariEsclusiManuali)
  );

  const dataVendemmia =
    deriveDataVendemmiaFromZone(zoneVendemmiate) ||
    toDateKeyString(lavoro.approvatoIl || lavoro.aggiornatoIl || lavoro.dataInizio) ||
    null;

  const patch = {
    inPiano: true,
    vendemmiato: true,
    lavoroId: lavoroId || null,
    dataVendemmia,
    zoneVendemmiate,
    ettariVendemmiatiManuali: ettariVendemmiati > 0 ? ettariVendemmiati : undefined
  };

  let zoneEscluseAuto = null;
  if (shouldAutoGenerateZoneEscluse(statoEsistente)) {
    zoneEscluseAuto = await computeZoneEscluseAutomatiche({
      terrenoPolygonCoords: terreno?.polygonCoords,
      zoneVendemmiate,
      ettariTotali,
      ettariVendemmiati
    });
    patch.zoneEscluse = zoneEscluseAuto.zoneEscluse;
    patch.ettariEsclusi = zoneEscluseAuto.ettariEsclusi;
    patch.zoneEscluseAutoDaLavoro = true;
    patch.zoneEscluseModificateManualmente = false;
  }

  await updateStagioneTerreno(lavoro.terrenoId, anno, patch);

  return {
    synced: true,
    terrenoId: lavoro.terrenoId,
    anno: Number(anno),
    zoneCount: zoneVendemmiate.length,
    zoneEscluseCount: zoneEscluseAuto?.zoneEscluse?.length ?? null,
    ettariEsclusi: zoneEscluseAuto?.ettariEsclusi ?? null,
    ettariVendemmiati
  };
}

/**
 * Backfill: allinea piano stagione con lavori VM già completati.
 * @param {number|string} [anno]
 * @returns {Promise<{ processed: number, synced: number }>}
 */
export async function syncLavoriCompletatiToPiano(anno = getAnnoStagioneCorrente()) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { processed: 0, synced: 0 };

  let lavori = [];
  try {
    lavori = await getCollectionData('lavori', {
      tenantId,
      where: [['stato', '==', 'completato']]
    });
  } catch (err) {
    console.warn('[VM] syncLavoriCompletatiToPiano load:', err.message);
    return { processed: 0, synced: 0 };
  }

  let processed = 0;
  let synced = 0;

  for (const lavoro of lavori) {
    if (!isLavoroVendemmiaMeccanica(lavoro)) continue;
    const targetAnno = deriveAnnoStagioneFromLavoro(lavoro, anno);
    if (String(targetAnno) !== String(anno)) continue;

    processed += 1;
    const terreno = lavoro.terrenoId ? await getTerreno(lavoro.terrenoId) : null;
    const stato = terreno?.vendemmiaMeccanica?.[String(anno)];
    if (stato?.vendemmiato && stato?.lavoroId === lavoro.id) {
      if (stato.zoneEscluseModificateManualmente === true) continue;
      if (stato.zoneEscluseAutoDaLavoro === true) continue;
    }

    const result = await syncLavoroCompletatoToPianoStagione(lavoro, {
      anno: targetAnno,
      tenantId
    });
    if (result.synced) synced += 1;
  }

  return { processed, synced };
}

export { isPianoStagioneLinkedToLavoro } from './lavoro-vm-utils.js';

export default {
  deriveAnnoStagioneFromLavoro,
  zoneLavorateToVendemmiate,
  loadZoneLavorateForLavoro,
  clearLavoroFromPianoStagione,
  cleanupOrphanedPianoStagioneLavori,
  syncLavoroCompletatoToPianoStagione,
  syncLavoriCompletatiToPiano
};
