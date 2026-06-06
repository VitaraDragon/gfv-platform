/**
 * Shortlist sostituti per lavoro in standby (MVP: skill + impegni giornata).
 *
 * @module core/services/manodopera-sostituti-shortlist-service
 */

import { getCollectionData } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getAllLavori, getLavoro } from './lavori-service.js';
import { COLLECTION_NAME as PROFILI_COLLECTION } from './profilo-manodopera-service.js';
import { normalizeProfiloManodopera } from './profilo-manodopera-normalize.js';
import {
  resolveRequiredSkillsForLavoro,
  getManodoperaSkillLabel,
  formatStelleDisplay
} from '../config/manodopera-skills-config.js';
import { toGiornoKey } from '../config/manodopera-assenze-config.js';
import {
  SHORTLIST_MAX_CANDIDATI,
  LAVORO_STATI_IMPEGNO,
  DISPONIBILITA_LIBERO,
  DISPONIBILITA_IMPEGNATO,
  getMinStelleSuSkillRichieste,
  operaioQualificatoPerSkill,
  buildOperaioSquadreMap,
  findImpegnoLavoroOperaio,
  rankAndLimitShortlist
} from './manodopera-sostituti-shortlist-logic.js';

export {
  SHORTLIST_MAX_CANDIDATI,
  LAVORO_STATI_IMPEGNO,
  DISPONIBILITA_LIBERO,
  DISPONIBILITA_IMPEGNATO,
  getMinStelleSuSkillRichieste,
  operaioQualificatoPerSkill,
  buildOperaioSquadreMap,
  findImpegnoLavoroOperaio,
  rankAndLimitShortlist
};

/**
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {Array<Object>} [options.operaiList]
 * @param {Array<Object>} [options.squadreList]
 * @param {string} [options.tenantId]
 */
export async function buildShortlistSostitutiPerLavoroStandby(options) {
  const { lavoroId, operaiList = [], squadreList = [], tenantId: tidIn } = options;
  const tenantId = tidIn || getCurrentTenantId();
  if (!tenantId || !lavoroId) {
    throw new Error('tenantId e lavoroId obbligatori');
  }

  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) throw new Error('Lavoro non trovato');
  if (lavoro.stato !== 'in_standby') {
    throw new Error('Il lavoro non è in standby per assenza');
  }

  const assenteOperaioId = lavoro.standbyOperaioId || lavoro.operaioId || null;
  const req = resolveRequiredSkillsForLavoro({
    tipoLavoroNome: lavoro.tipoLavoro,
    sottocategoriaCodice: lavoro.sottocategoriaCodice,
    categoriaCodice: lavoro.categoriaCodice,
    attrezzo: lavoro.attrezzo || null,
    macchinaId: lavoro.macchinaId,
    operatoreMacchinaId: lavoro.operatoreMacchinaId
  });
  const requiredSkillIds = req.skillIds || [];

  const profiliRaw = await getCollectionData(PROFILI_COLLECTION, { tenantId });
  const profiliByUser = new Map();
  for (const row of profiliRaw || []) {
    const uid = row.id || row.userId;
    if (uid) profiliByUser.set(uid, normalizeProfiloManodopera({ ...row, userId: uid }));
  }

  const lavori = await getAllLavori();
  const squadreMap = buildOperaioSquadreMap(squadreList);

  const candidati = [];
  for (const op of operaiList) {
    const operaioId = op.id || op.uid;
    if (!operaioId || operaioId === assenteOperaioId) continue;

    const profilo =
      profiliByUser.get(operaioId) ||
      normalizeProfiloManodopera({
        userId: operaioId,
        skillDichiarate: [],
        skillCalcolate: []
      });

    if (!operaioQualificatoPerSkill(profilo, requiredSkillIds)) continue;

    const stelleMinime = getMinStelleSuSkillRichieste(profilo, requiredSkillIds);
    const impegno = findImpegnoLavoroOperaio(operaioId, lavori, squadreMap, lavoroId);
    const nome = [op.nome, op.cognome].filter(Boolean).join(' ') || op.email || operaioId;

    candidati.push({
      operaioId,
      nome,
      stelleMinime,
      stelleDisplay: formatStelleDisplay(stelleMinime),
      disponibilita: impegno ? DISPONIBILITA_IMPEGNATO : DISPONIBILITA_LIBERO,
      impegnoLavoroId: impegno?.id || null,
      impegnoLavoroNome: impegno?.nome || impegno?.tipoLavoro || null,
      motivo: impegno
        ? `Impegnato su: ${impegno.nome || impegno.tipoLavoro || impegno.id}`
        : 'Libero oggi',
      skillLabels: requiredSkillIds.map(getManodoperaSkillLabel)
    });
  }

  const shortlist = rankAndLimitShortlist(candidati);

  return {
    shortlist,
    tuttiQualificati: candidati.length,
    requiredSkillIds,
    equipaggioMinimo: req.equipaggioMinimo ?? null,
    assenteOperaioId,
    lavoroNome: lavoro.nome || lavoro.tipoLavoro || lavoroId,
    giornoKey: lavoro.standbyGiornoKey || toGiornoKey(new Date())
  };
}
