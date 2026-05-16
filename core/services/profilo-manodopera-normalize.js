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
  const skillCalcolate = normalizeSkillCalcolateRows(
    Array.isArray(data.skillCalcolate) ? data.skillCalcolate : []
  );
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
 * @param {Array<unknown>} rows
 * @returns {Array<{ skillId: string, orePeriodo: number, oreTotali: number, stelle: number, periodoDa?: string, periodoA?: string, aggiornatoIl?: string }>}
 */
export function normalizeSkillCalcolateRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const skillId = typeof raw.skillId === 'string' ? raw.skillId.trim() : '';
    if (!skillId || !isValidManodoperaSkillId(skillId)) continue;
    const orePeriodo = Number(raw.orePeriodo);
    const oreTotali = Number(raw.oreTotali);
    const stelle = Math.min(5, Math.max(1, Math.round(Number(raw.stelle) || 1)));
    out.push({
      skillId,
      orePeriodo: Number.isFinite(orePeriodo) ? orePeriodo : 0,
      oreTotali: Number.isFinite(oreTotali) ? oreTotali : 0,
      stelle,
      periodoDa: raw.periodoDa || null,
      periodoA: raw.periodoA || null,
      aggiornatoIl: raw.aggiornatoIl || null
    });
  }
  return out;
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
