/**
 * Logica pura shortlist sostituti (testabile senza Firebase).
 * @module core/services/manodopera-sostituti-shortlist-logic
 */

import { SHORTLIST_MIN_STELLE_DEFAULT } from '../config/manodopera-skills-config.js';

export const SHORTLIST_MAX_CANDIDATI = 4;

export const LAVORO_STATI_IMPEGNO = Object.freeze(['assegnato', 'in_corso']);

export const DISPONIBILITA_LIBERO = 'libero';
export const DISPONIBILITA_IMPEGNATO = 'impegnato';

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

export function rankAndLimitShortlist(candidati) {
  const orderDisp = { [DISPONIBILITA_LIBERO]: 0, [DISPONIBILITA_IMPEGNATO]: 1 };
  return [...(candidati || [])]
    .sort((a, b) => {
      const da = orderDisp[a.disponibilita] ?? 2;
      const db = orderDisp[b.disponibilita] ?? 2;
      if (da !== db) return da - db;
      return (b.stelleMinime || 0) - (a.stelleMinime || 0);
    })
    .slice(0, SHORTLIST_MAX_CANDIDATI);
}
