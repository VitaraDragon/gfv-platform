/**
 * Vista impegni giornalieri — fetch Firestore + snapshot.
 *
 * @module core/services/manodopera-impegni-giorno-service
 */

import {
  getCollectionData,
  getDocs,
  collection,
  query,
  where,
  getDb
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getAllLavori } from './lavori-service.js';
import { listAssenzeConfermatePerGiorno } from './manodopera-assenze-service.js';
import { toGiornoKey } from '../config/manodopera-assenze-config.js';
import { resolveRequiredSkillsForLavoro } from '../config/manodopera-skills-config.js';
import { buildImpegniGiornoSnapshot } from './manodopera-impegni-giorno-logic.js';
import { ensureRosterGiornoPerLavoriDelGiorno } from './manodopera-roster-giorno-service.js';

export {
  buildImpegniGiornoSnapshot,
  IMPEGNO_STATO_LIBERO,
  IMPEGNO_STATO_IMPEGNATO,
  IMPEGNO_STATO_ASSENTE,
  IMPEGNO_STATO_PRESTATO,
  IMPEGNO_STATO_SOSTITUTO,
  lavoroCopreGiornoKey
} from './manodopera-impegni-giorno-logic.js';

/**
 * @param {string} tenantId
 * @returns {Promise<Object[]>}
 */
async function loadOperaiAttivi(tenantId) {
  const db = getDb();
  const q = query(
    collection(db, 'users'),
    where('tenantId', '==', tenantId),
    where('ruoli', 'array-contains', 'operaio'),
    where('stato', '==', 'attivo')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {string} tenantId
 * @returns {Promise<Object[]>}
 */
async function loadSquadre(tenantId) {
  try {
    return (await getCollectionData('squadre', { tenantId })) || [];
  } catch (e) {
    console.warn('[impegni-giorno] load squadre:', e);
    return [];
  }
}

/**
 * @param {Object} [options]
 * @param {string} [options.giornoKey] YYYY-MM-DD (default oggi)
 * @param {Array<Object>} [options.operaiList]
 * @param {Array<Object>} [options.squadreList]
 * @param {Array<Object>} [options.attrezziList]
 * @param {string} [options.tenantId]
 * @returns {Promise<Object>}
 */
export async function buildImpegniGiorno(options = {}) {
  const {
    giornoKey: giornoIn,
    operaiList: operaiIn = null,
    squadreList: squadreIn = null,
    attrezziList = [],
    tenantId: tidIn = null
  } = options;

  const tenantId = tidIn || getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');

  const giornoKey = giornoIn || toGiornoKey(new Date());
  if (!giornoKey) throw new Error('Giorno non valido');

  const [lavoriRaw, assenzeConfermate, operaiList, squadreList] = await Promise.all([
    getAllLavori(),
    listAssenzeConfermatePerGiorno(giornoKey, tenantId),
    operaiIn ? Promise.resolve(operaiIn) : loadOperaiAttivi(tenantId),
    squadreIn ? Promise.resolve(squadreIn) : loadSquadre(tenantId)
  ]);

  // Lazy seed roster giornaliero (partecipazioni) sui lavori del giorno
  let lavoriList = lavoriRaw || [];
  let rosterMaterializzati = 0;
  try {
    const rosterRes = await ensureRosterGiornoPerLavoriDelGiorno({
      giornoKey,
      lavoriList,
      squadreList: squadreList || [],
      tenantId
    });
    lavoriList = rosterRes.lavori || lavoriList;
    rosterMaterializzati = rosterRes.materializzati || 0;
  } catch (e) {
    console.warn('[impegni-giorno] ensure roster:', e);
  }

  const attrezziById = new Map((attrezziList || []).map((a) => [a.id, a]));
  const equipaggioMinimoByLavoroId = new Map();
  for (const lav of lavoriList || []) {
    const attrezzo =
      (lav.attrezzoId && attrezziById.get(lav.attrezzoId)) || lav.attrezzo || null;
    const req = resolveRequiredSkillsForLavoro({
      tipoLavoroNome: lav.tipoLavoro,
      sottocategoriaCodice: lav.sottocategoriaCodice,
      categoriaCodice: lav.categoriaCodice,
      attrezzo,
      macchinaId: lav.macchinaId,
      operatoreMacchinaId: lav.operatoreMacchinaId
    });
    if (req.equipaggioMinimo != null) {
      equipaggioMinimoByLavoroId.set(lav.id, req.equipaggioMinimo);
    }
  }

  const snapshot = buildImpegniGiornoSnapshot({
    giornoKey,
    operaiList: operaiList || [],
    lavoriList: lavoriList || [],
    squadreList: squadreList || [],
    assenzeConfermate: assenzeConfermate || [],
    equipaggioMinimoByLavoroId
  });

  return {
    ...snapshot,
    tenantId,
    rosterMaterializzati,
    operaiList: operaiList || []
  };
}
