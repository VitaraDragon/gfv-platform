/**
 * Shortlist sostituti per lavoro in standby (skill + impegni + assenze + policy).
 *
 * @module core/services/manodopera-sostituti-shortlist-service
 */

import { getCollectionData } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getAllLavori, getLavoro, updateLavoro } from './lavori-service.js';
import { getAllTerreni } from './terreni-service.js';
import {
  ensureRosterSlice,
  mergeEquipaggioGiornoPatch
} from './manodopera-roster-giorno-logic.js';
import { COLLECTION_NAME as PROFILI_COLLECTION } from './profilo-manodopera-service.js';
import { normalizeProfiloManodopera } from './profilo-manodopera-normalize.js';
import {
  resolveRequiredSkillsForLavoro,
  getManodoperaSkillLabel,
  formatStelleDisplay
} from '../config/manodopera-skills-config.js';
import { toGiornoKey } from '../config/manodopera-assenze-config.js';
import { getOperaioIdsAssentiConfermatiPerGiorno } from './manodopera-assenze-service.js';
import { isLavoroPrestabile } from '../config/manodopera-sostituzione-policy-config.js';
import { computeProximityMeta } from './geo-terreno-utils.js';
import {
  SHORTLIST_MAX_CANDIDATI,
  LAVORO_STATI_IMPEGNO,
  DISPONIBILITA_LIBERO,
  DISPONIBILITA_IMPEGNATO,
  DISPONIBILITA_SPOSTABILE,
  getMinStelleSuSkillRichieste,
  operaioQualificatoPerSkill,
  buildOperaioSquadreMap,
  findImpegnoLavoroOperaio,
  rankAndLimitShortlist,
  classifyDisponibilitaCandidato,
  buildMotivoDisponibilita,
  resolvePrevistiOperaioIds,
  evaluateEquipaggioMinimo,
  wouldOrigineFallBelowMin
} from './manodopera-sostituti-shortlist-logic.js';

export {
  SHORTLIST_MAX_CANDIDATI,
  LAVORO_STATI_IMPEGNO,
  DISPONIBILITA_LIBERO,
  DISPONIBILITA_IMPEGNATO,
  DISPONIBILITA_SPOSTABILE,
  getMinStelleSuSkillRichieste,
  operaioQualificatoPerSkill,
  buildOperaioSquadreMap,
  findImpegnoLavoroOperaio,
  rankAndLimitShortlist,
  classifyDisponibilitaCandidato,
  buildMotivoDisponibilita,
  resolvePrevistiOperaioIds,
  evaluateEquipaggioMinimo,
  wouldOrigineFallBelowMin
};

/**
 * @param {Object} lavoro
 * @param {Array<Object>} [attrezziList]
 * @returns {Object|null}
 */
function resolveAttrezzoForLavoro(lavoro, attrezziList = []) {
  if (lavoro?.attrezzo && typeof lavoro.attrezzo === 'object') return lavoro.attrezzo;
  if (!lavoro?.attrezzoId) return null;
  return (attrezziList || []).find((a) => a.id === lavoro.attrezzoId) || null;
}

/**
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {Array<Object>} [options.operaiList]
 * @param {Array<Object>} [options.squadreList]
 * @param {Array<Object>} [options.attrezziList]
 * @param {string} [options.tenantId]
 */
export async function buildShortlistSostitutiPerLavoroStandby(options) {
  const {
    lavoroId,
    operaiList = [],
    squadreList = [],
    attrezziList = [],
    tenantId: tidIn
  } = options;
  const tenantId = tidIn || getCurrentTenantId();
  if (!tenantId || !lavoroId) {
    throw new Error('tenantId e lavoroId obbligatori');
  }

  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) throw new Error('Lavoro non trovato');
  if (lavoro.stato !== 'in_standby') {
    throw new Error('Il lavoro non è in standby per assenza');
  }

  const giornoKey = lavoro.standbyGiornoKey || toGiornoKey(new Date());
  const assenteOperaioId = lavoro.standbyOperaioId || lavoro.operaioId || null;
  const attrezzo = resolveAttrezzoForLavoro(lavoro, attrezziList);

  const req = resolveRequiredSkillsForLavoro({
    tipoLavoroNome: lavoro.tipoLavoro,
    sottocategoriaCodice: lavoro.sottocategoriaCodice,
    categoriaCodice: lavoro.categoriaCodice,
    attrezzo,
    macchinaId: lavoro.macchinaId,
    operatoreMacchinaId: lavoro.operatoreMacchinaId
  });
  const requiredSkillIds = req.skillIds || [];
  const equipaggioMinimo = req.equipaggioMinimo ?? null;

  const [profiliRaw, lavori, assentiSet, terreniList] = await Promise.all([
    getCollectionData(PROFILI_COLLECTION, { tenantId }),
    getAllLavori(),
    getOperaioIdsAssentiConfermatiPerGiorno(giornoKey, tenantId),
    getAllTerreni({ includeTerreniClienti: true }).catch(() => [])
  ]);

  const terreniById = new Map();
  for (const t of terreniList || []) {
    if (t?.id) terreniById.set(t.id, t);
  }
  const terrenoDest = lavoro.terrenoId ? terreniById.get(lavoro.terrenoId) || null : null;

  const profiliByUser = new Map();
  for (const row of profiliRaw || []) {
    const uid = row.id || row.userId;
    if (uid) profiliByUser.set(uid, normalizeProfiloManodopera({ ...row, userId: uid }));
  }

  const squadreMap = buildOperaioSquadreMap(squadreList);
  const previstiIds = resolvePrevistiOperaioIds(lavoro, squadreList, giornoKey);
  const assentiIds = [
    ...new Set(
      [
        assenteOperaioId,
        ...(lavoro.equipaggioGiorno?.[giornoKey]?.assenti || [])
      ].filter(Boolean)
    )
  ];
  const sostitutiGia = (lavoro.equipaggioGiorno?.[giornoKey]?.sostituzioni || [])
    .map((s) => s.sostitutoOperaioId)
    .filter(Boolean);
  if (lavoro.assenzaSostitutoOperaioId) {
    sostitutiGia.push(lavoro.assenzaSostitutoOperaioId);
  }

  const equipaggioCheck = evaluateEquipaggioMinimo({
    minPersone: equipaggioMinimo,
    previstiIds,
    assentiIds,
    sostitutiIds: [...new Set(sostitutiGia)]
  });

  const candidati = [];
  for (const op of operaiList) {
    const operaioId = op.id || op.uid;
    if (!operaioId || operaioId === assenteOperaioId) continue;
    // Esclusione dura: assenza confermata sul giorno del lavoro
    if (assentiSet.has(operaioId)) continue;

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
    const { disponibilita, richiedeConfermaSpostamento } = classifyDisponibilitaCandidato({
      impegno,
      lavoroDestinazione: lavoro,
      isPrestabile: isLavoroPrestabile
    });

    const impegnoAttrezzo = impegno
      ? resolveAttrezzoForLavoro(impegno, attrezziList)
      : null;
    const minOrigine = impegno
      ? resolveRequiredSkillsForLavoro({
          tipoLavoroNome: impegno.tipoLavoro,
          sottocategoriaCodice: impegno.sottocategoriaCodice,
          categoriaCodice: impegno.categoriaCodice,
          attrezzo: impegnoAttrezzo,
          macchinaId: impegno.macchinaId,
          operatoreMacchinaId: impegno.operatoreMacchinaId
        }).equipaggioMinimo
      : null;

    const origineSottoSogliaDopoPrestito = impegno
      ? wouldOrigineFallBelowMin({
          lavoroOrigine: impegno,
          squadreList,
          minPersoneOrigine: minOrigine,
          operaioDaPrestareId: operaioId
        })
      : false;

    const nome = [op.nome, op.cognome].filter(Boolean).join(' ') || op.email || operaioId;

    const terrenoOrigId = impegno?.terrenoId || null;
    const terrenoOrig = terrenoOrigId ? terreniById.get(terrenoOrigId) || null : null;
    const prox = computeProximityMeta(
      terrenoDest,
      terrenoOrig,
      lavoro.terrenoId || null,
      terrenoOrigId
    );

    candidati.push({
      operaioId,
      nome,
      stelleMinime,
      stelleDisplay: formatStelleDisplay(stelleMinime),
      disponibilita,
      richiedeConfermaSpostamento,
      impegnoLavoroId: impegno?.id || null,
      impegnoLavoroNome: impegno?.nome || impegno?.tipoLavoro || null,
      origineSottoSogliaDopoPrestito,
      motivo: buildMotivoDisponibilita(disponibilita, impegno),
      skillLabels: requiredSkillIds.map(getManodoperaSkillLabel),
      stessoTerreno: prox.stessoTerreno,
      stessoPodere: prox.stessoPodere,
      distanzaKm: prox.distanzaKm,
      prossimitaLabel: prox.prossimitaLabel
    });
  }

  const shortlist = rankAndLimitShortlist(candidati);

  // Materializza shortlist su equipaggioGiorno per Context Builder / Tony (occhi, no ricalcolo)
  try {
    const { slice } = ensureRosterSlice({
      lavoro,
      giornoKey,
      squadreList,
      materializzatoDa: 'auto'
    });
    slice.shortlistCandidati = shortlist.map((c) => ({
      operaioId: c.operaioId,
      nome: c.nome,
      disponibilita: c.disponibilita,
      motivo: c.motivo,
      stelleDisplay: c.stelleDisplay,
      stelleMinime: c.stelleMinime,
      richiedeConfermaSpostamento: !!c.richiedeConfermaSpostamento,
      impegnoLavoroId: c.impegnoLavoroId || null,
      impegnoLavoroNome: c.impegnoLavoroNome || null,
      stessoTerreno: !!c.stessoTerreno,
      stessoPodere: !!c.stessoPodere,
      distanzaKm: c.distanzaKm != null ? c.distanzaKm : null,
      prossimitaLabel: c.prossimitaLabel || null,
      aggiornatoIl: new Date().toISOString()
    }));
    slice.shortlistAggiornataIl = new Date().toISOString();
    await updateLavoro(lavoroId, {
      equipaggioGiorno: mergeEquipaggioGiornoPatch(lavoro, giornoKey, slice)
    });
  } catch (e) {
    console.warn('[shortlist] persist shortlistCandidati:', e?.message || e);
  }

  return {
    shortlist,
    tuttiQualificati: candidati.length,
    requiredSkillIds,
    equipaggioMinimo,
    equipaggioCheck,
    assenteOperaioId,
    previstiIds,
    lavoroNome: lavoro.nome || lavoro.tipoLavoro || lavoroId,
    giornoKey,
    isLavoroSquadra: Boolean(lavoro.caposquadraId && !lavoro.operaioId)
  };
}
