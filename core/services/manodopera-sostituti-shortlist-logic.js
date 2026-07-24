/**
 * Logica pura shortlist sostituti (testabile senza Firebase).
 * @module core/services/manodopera-sostituti-shortlist-logic
 */

import { SHORTLIST_MIN_STELLE_DEFAULT } from '../config/manodopera-skills-config.js';
import {
  ALLOW_IMPEGNATO_IN_SHORTLIST,
  computeShortlistScore,
  isLavoroPrestabile
} from '../config/manodopera-sostituzione-policy-config.js';

export const SHORTLIST_MAX_CANDIDATI = 4;

export const LAVORO_STATI_IMPEGNO = Object.freeze(['assegnato', 'in_corso']);

export const DISPONIBILITA_LIBERO = 'libero';
export const DISPONIBILITA_IMPEGNATO = 'impegnato';
export const DISPONIBILITA_SPOSTABILE = 'spostabile';

export function getMinStelleSuSkillRichieste(profilo, requiredSkillIds) {
  if (!requiredSkillIds.length) return SHORTLIST_MIN_STELLE_DEFAULT;
  const dichiarate = new Set(profilo?.skillDichiarate || []);
  const calcolate = new Map(
    (profilo?.skillCalcolate || []).map((r) => [r.skillId, r.stelle])
  );
  let min = 5;
  for (const skillId of requiredSkillIds) {
    let stelle = calcolate.has(skillId) ? calcolate.get(skillId) : 0;
    if (!stelle && dichiarate.has(skillId)) stelle = 2;
    min = Math.min(min, stelle);
  }
  return min;
}

export function operaioQualificatoPerSkill(profilo, requiredSkillIds) {
  if (!requiredSkillIds.length) return true;
  return getMinStelleSuSkillRichieste(profilo, requiredSkillIds) >= SHORTLIST_MIN_STELLE_DEFAULT;
}

export function buildOperaioSquadreMap(squadre) {
  const map = new Map();
  for (const s of squadre || []) {
    const capo = s.caposquadraId;
    if (!capo) continue;
    for (const oid of s.operai || []) {
      if (!oid) continue;
      if (!map.has(oid)) map.set(oid, new Set());
      map.get(oid).add(capo);
    }
  }
  return map;
}

export function findImpegnoLavoroOperaio(operaioId, lavori, squadreMap, excludeLavoroId) {
  for (const lav of lavori || []) {
    const id = lav.id;
    const stato = lav.stato;
    if (id === excludeLavoroId) continue;
    if (!LAVORO_STATI_IMPEGNO.includes(stato)) continue;
    if (lav.operaioId === operaioId) return lav;
    const capi = squadreMap.get(operaioId);
    if (capi && lav.caposquadraId && capi.has(lav.caposquadraId)) return lav;
  }
  return null;
}

/**
 * Operai previsti sul lavoro (anagrafica: autonomo o membri squadra del capo).
 * Non sostituisce un roster giornaliero dedicato.
 *
 * @param {Object} lavoro
 * @param {Array<Object>} [squadreList]
 * @returns {string[]}
 */
export function resolvePrevistiOperaioIds(lavoro, squadreList = []) {
  if (!lavoro) return [];
  if (lavoro.operaioId) return [lavoro.operaioId];
  if (lavoro.caposquadraId) {
    const squadra = (squadreList || []).find(
      (s) => s.caposquadraId === lavoro.caposquadraId
    );
    return [...(squadra?.operai || [])].filter(Boolean);
  }
  return [];
}

/**
 * @param {Object} options
 * @param {Object|null} options.impegno
 * @param {Object|null} options.lavoroDestinazione
 * @param {(origine: Object, dest: Object) => boolean} [options.isPrestabile]
 * @returns {{ disponibilita: string, richiedeConfermaSpostamento: boolean }}
 */
export function classifyDisponibilitaCandidato(options = {}) {
  const { impegno, lavoroDestinazione, isPrestabile = isLavoroPrestabile } = options;
  if (!impegno) {
    return {
      disponibilita: DISPONIBILITA_LIBERO,
      richiedeConfermaSpostamento: false
    };
  }
  if (isPrestabile(impegno, lavoroDestinazione)) {
    return {
      disponibilita: DISPONIBILITA_SPOSTABILE,
      richiedeConfermaSpostamento: true
    };
  }
  return {
    disponibilita: DISPONIBILITA_IMPEGNATO,
    richiedeConfermaSpostamento: true
  };
}

/**
 * @param {string} disponibilita
 * @param {Object|null} impegno
 * @returns {string}
 */
export function buildMotivoDisponibilita(disponibilita, impegno) {
  const nomeLav = impegno?.nome || impegno?.tipoLavoro || impegno?.id || '';
  if (disponibilita === DISPONIBILITA_LIBERO) return 'Libero oggi';
  if (disponibilita === DISPONIBILITA_SPOSTABILE) {
    return nomeLav
      ? `Spostabile con conferma da: ${nomeLav}`
      : 'Spostabile con conferma';
  }
  return nomeLav
    ? `Impegnato su: ${nomeLav} (override manager)`
    : 'Impegnato (override manager)';
}

/**
 * Verifica equipaggio minimo dopo assenza/sostituzioni.
 *
 * @param {Object} options
 * @param {number|null} options.minPersone
 * @param {string[]} [options.previstiIds]
 * @param {string[]} [options.assentiIds]
 * @param {string[]} [options.sostitutiIds]
 * @returns {{ applicabile: boolean, attivi: number, minPersone: number|null, incompleto: boolean, mancanti: number }}
 */
export function evaluateEquipaggioMinimo(options = {}) {
  const minPersone =
    typeof options.minPersone === 'number' && options.minPersone > 0
      ? options.minPersone
      : null;
  const previstiIds = [...(options.previstiIds || [])].filter(Boolean);
  const assenti = new Set((options.assentiIds || []).filter(Boolean));
  const sostitutiIds = [...(options.sostitutiIds || []).filter(Boolean)];

  const assentiInPrevisti = previstiIds.filter((id) => assenti.has(id)).length;
  const attivi = Math.max(0, previstiIds.length - assentiInPrevisti + sostitutiIds.length);

  if (minPersone == null) {
    return {
      applicabile: false,
      attivi,
      minPersone: null,
      incompleto: false,
      mancanti: 0
    };
  }

  const mancanti = Math.max(0, minPersone - attivi);
  return {
    applicabile: true,
    attivi,
    minPersone,
    incompleto: attivi < minPersone,
    mancanti
  };
}

/**
 * True se dopo prestito l'equipaggio origine scende sotto soglia.
 *
 * @param {Object} options
 * @param {Object|null} options.lavoroOrigine
 * @param {Array<Object>} [options.squadreList]
 * @param {number|null} [options.minPersoneOrigine]
 * @param {string} options.operaioDaPrestareId
 * @returns {boolean}
 */
export function wouldOrigineFallBelowMin(options = {}) {
  const {
    lavoroOrigine,
    squadreList = [],
    minPersoneOrigine = null,
    operaioDaPrestareId
  } = options;
  if (!lavoroOrigine || !operaioDaPrestareId || minPersoneOrigine == null) {
    return false;
  }
  const previsti = resolvePrevistiOperaioIds(lavoroOrigine, squadreList);
  const evalRes = evaluateEquipaggioMinimo({
    minPersone: minPersoneOrigine,
    previstiIds: previsti,
    assentiIds: [operaioDaPrestareId],
    sostitutiIds: []
  });
  return evalRes.incompleto;
}

/**
 * @param {Array<Object>} candidati
 * @returns {Array<Object>}
 */
export function rankAndLimitShortlist(candidati) {
  const orderDisp = {
    [DISPONIBILITA_LIBERO]: 0,
    [DISPONIBILITA_SPOSTABILE]: 1,
    [DISPONIBILITA_IMPEGNATO]: 2
  };
  return [...(candidati || [])]
    .map((c) => ({
      ...c,
      score: c.score != null ? c.score : computeShortlistScore(c)
    }))
    .filter((c) => {
      if (c.disponibilita === DISPONIBILITA_IMPEGNATO && !ALLOW_IMPEGNATO_IN_SHORTLIST) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Piano: prima liberi, poi spostabili, poi impegnati; score/stelle come tie-break
      const da = orderDisp[a.disponibilita] ?? 3;
      const db = orderDisp[b.disponibilita] ?? 3;
      if (da !== db) return da - db;
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return (b.stelleMinime || 0) - (a.stelleMinime || 0);
    })
    .slice(0, SHORTLIST_MAX_CANDIDATI);
}
