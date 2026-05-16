/**
 * Funzioni pure profilo manodopera (testabili senza Firebase).
 * @module core/services/profilo-manodopera-normalize
 */

import { isValidManodoperaSkillId } from '../config/manodopera-skills-config.js';

/**
 * @param {string[]} skillIds
 * @returns {string[]}
 */
export function normalizeSkillDichiarateIds(skillIds) {
  if (!Array.isArray(skillIds)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of skillIds) {
    const id = typeof raw === 'string' ? raw.trim() : raw?.skillId;
    if (!id || !isValidManodoperaSkillId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @param {Object|null} data
 * @returns {Object}
 */
export function normalizeProfiloManodopera(data) {
  if (!data) {
    return {
      userId: null,
      skillDichiarate: [],
      skillCalcolate: [],
      notaProfilo: '',
      aggiornatoIl: null,
      aggiornatoDa: null
    };
  }
  const skillDichiarate = Array.isArray(data.skillDichiarate)
    ? normalizeSkillDichiarateIds(
        data.skillDichiarate.map((s) => (typeof s === 'string' ? s : s?.skillId))
      )
    : [];
  const skillCalcolate = Array.isArray(data.skillCalcolate) ? data.skillCalcolate : [];
  return {
    userId: data.userId || data.id || null,
    skillDichiarate,
    skillCalcolate,
    notaProfilo: data.notaProfilo || '',
    aggiornatoIl: data.aggiornatoIl || null,
    aggiornatoDa: data.aggiornatoDa || null
  };
}

/**
 * @param {Object|null} profilo
 * @returns {{ dichiarateCount: number, topCalcolata: { skillId: string, stelle: number, orePeriodo?: number }|null }}
 */
export function summarizeProfiloForList(profilo) {
  const p = normalizeProfiloManodopera(profilo);
  let topCalcolata = null;
  for (const row of p.skillCalcolate) {
    if (!row?.skillId) continue;
    if (!topCalcolata || (row.stelle || 0) > (topCalcolata.stelle || 0)) {
      topCalcolata = {
        skillId: row.skillId,
        stelle: row.stelle || 0,
        orePeriodo: row.orePeriodo
      };
    }
  }
  return {
    dichiarateCount: p.skillDichiarate.length,
    topCalcolata
  };
}
