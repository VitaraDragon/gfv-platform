/**
 * Aggregazione ore validate → skillCalcolate (logica pura, testabile senza Firebase).
 *
 * @module core/services/profilo-manodopera-batch
 */

import {
  oreToStelle,
  resolveSkillIdsForOreAggregation,
  STAR_THRESHOLDS_HOURS_DEFAULT
} from '../config/manodopera-skills-config.js';

/** Periodo default per stelline (orePeriodo). */
export const MANODOPERA_SKILL_BATCH_PERIOD_MONTHS = 12;

/**
 * @param {Date} [referenceDate]
 * @returns {{ periodoDa: Date, periodoA: Date }}
 */
export function getDefaultSkillBatchPeriod(referenceDate = new Date()) {
  const periodoA = new Date(referenceDate);
  periodoA.setHours(23, 59, 59, 999);
  const periodoDa = new Date(periodoA);
  periodoDa.setMonth(periodoDa.getMonth() - MANODOPERA_SKILL_BATCH_PERIOD_MONTHS);
  periodoDa.setHours(0, 0, 0, 0);
  return { periodoDa, periodoA };
}

/**
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseOreRecordDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && typeof value.toDate === 'function') {
    return value.toDate();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date|null} date
 * @param {Date} periodoDa
 * @param {Date} periodoA
 * @returns {boolean}
 */
export function isOreDateInPeriod(date, periodoDa, periodoA) {
  if (!date) return false;
  const t = date.getTime();
  return t >= periodoDa.getTime() && t <= periodoA.getTime();
}

/**
 * @param {Array<{ id?: string, codice?: string, parentId?: string|null }>} categorie
 * @returns {Map<string, string>}
 */
export function buildCategoriaCodiceById(categorie = []) {
  const byId = new Map();
  for (const c of categorie) {
    if (c?.id && c.codice) {
      byId.set(c.id, String(c.codice).toLowerCase());
    }
  }
  return byId;
}

/**
 * @param {Array<{ nome?: string, sottocategoriaCodice?: string, categoriaCodice?: string }>} predefiniti
 * @returns {Map<string, string>}
 */
export function buildNomeToSottocategoriaCodiceMap(predefiniti = []) {
  const map = new Map();
  for (const row of predefiniti) {
    const nome = (row.nome || '').trim().toLowerCase();
    if (!nome) continue;
    if (row.sottocategoriaCodice) {
      map.set(nome, String(row.sottocategoriaCodice).toLowerCase());
    }
  }
  return map;
}

/**
 * @param {Array<Record<string, unknown>>} tipiLavoro
 * @param {Map<string, string>} categoriaCodiceById
 * @param {Map<string, string>} nomeToSottocategoria
 * @returns {{ byId: Map<string, object>, byNome: Map<string, object>, nomeToSottocategoria: Map<string, string> }}
 */
export function buildTipoLavoroResolver(
  tipiLavoro = [],
  categoriaCodiceById = new Map(),
  nomeToSottocategoria = new Map()
) {
  const byId = new Map();
  const byNome = new Map();

  for (const tipo of tipiLavoro) {
    const nome = String(tipo.nome || '').trim();
    const nomeKey = nome.toLowerCase();
    let sottocategoriaCodice =
      tipo.sottocategoriaCodice != null
        ? String(tipo.sottocategoriaCodice).toLowerCase()
        : null;
    let categoriaCodice =
      tipo.categoriaCodice != null ? String(tipo.categoriaCodice).toLowerCase() : null;

    if (!sottocategoriaCodice && tipo.sottocategoriaId) {
      sottocategoriaCodice = categoriaCodiceById.get(tipo.sottocategoriaId) || null;
    }
    if (!categoriaCodice && tipo.categoriaId && !tipo.sottocategoriaId) {
      categoriaCodice = categoriaCodiceById.get(tipo.categoriaId) || null;
    }
    if (!sottocategoriaCodice && nomeKey && nomeToSottocategoria.has(nomeKey)) {
      sottocategoriaCodice = nomeToSottocategoria.get(nomeKey);
    }

    const resolved = { nome, sottocategoriaCodice, categoriaCodice };
    if (tipo.id) byId.set(tipo.id, resolved);
    if (nomeKey) byNome.set(nomeKey, resolved);
  }

  return { byId, byNome, nomeToSottocategoria };
}

/**
 * @param {Record<string, unknown>} lavoro
 * @param {ReturnType<typeof buildTipoLavoroResolver>} resolver
 * @param {Map<string, Record<string, unknown>>} macchineById
 * @returns {import('../config/manodopera-skills-config.js').resolveSkillIdsForOreAggregation extends Function ? Parameters<typeof resolveSkillIdsForOreAggregation>[0] : object}
 */
export function resolveLavoroOreContext(lavoro, resolver, macchineById = new Map()) {
  const lav = lavoro || {};
  let tipo = null;

  if (lav.tipoLavoroId && resolver.byId.has(lav.tipoLavoroId)) {
    tipo = resolver.byId.get(lav.tipoLavoroId);
  } else {
    const nomeKey = String(lav.tipoLavoro || lav.tipoLavoroNome || '')
      .trim()
      .toLowerCase();
    if (nomeKey && resolver.byNome.has(nomeKey)) {
      tipo = resolver.byNome.get(nomeKey);
    } else if (nomeKey && resolver.nomeToSottocategoria.has(nomeKey)) {
      tipo = {
        nome: lav.tipoLavoro || lav.tipoLavoroNome,
        sottocategoriaCodice: resolver.nomeToSottocategoria.get(nomeKey),
        categoriaCodice: null
      };
    }
  }

  const tipoLavoroNome = tipo?.nome || lav.tipoLavoro || lav.tipoLavoroNome || '';
  let attrezzo = null;
  const attId = lav.attrezzoId || null;
  if (attId && macchineById.has(attId)) {
    const mac = macchineById.get(attId);
    attrezzo = {
      nome: mac.nome,
      skillTags: mac.skillTags || mac.manodoperaTags,
      minPersoneEquipaggio: mac.minPersoneEquipaggio
    };
  }

  return {
    tipoLavoroNome: String(tipoLavoroNome),
    sottocategoriaCodice: tipo?.sottocategoriaCodice || null,
    categoriaCodice: tipo?.categoriaCodice || null,
    attrezzo,
    macchinaId: lav.macchinaId || null,
    operatoreMacchinaId: lav.operatoreMacchinaId || null,
    ruoloOre: lav.ruoloOre || null
  };
}

/**
 * @typedef {Map<string, Map<string, { orePeriodo: number, oreTotali: number }>>} OreSkillAccumulator
 */

/**
 * @param {OreSkillAccumulator} accumulator
 * @param {{ operaioId: string, oreNette: number, oreDate: Date|null, oreContext: object, ruoloOre?: string|null }} entry
 * @param {{ periodoDa: Date, periodoA: Date }} period
 */
export function accumulateValidatedOreForSkills(accumulator, entry, period) {
  const operaioId = entry.operaioId;
  if (!operaioId) return;

  const ore = Number(entry.oreNette);
  if (!Number.isFinite(ore) || ore <= 0) return;

  const skillIds = resolveSkillIdsForOreAggregation({
    ...entry.oreContext,
    ruoloOre: entry.ruoloOre || entry.oreContext?.ruoloOre || null
  });
  if (!skillIds.length) return;

  const inPeriod = isOreDateInPeriod(entry.oreDate, period.periodoDa, period.periodoA);

  if (!accumulator.has(operaioId)) {
    accumulator.set(operaioId, new Map());
  }
  const bySkill = accumulator.get(operaioId);

  for (const skillId of skillIds) {
    if (!bySkill.has(skillId)) {
      bySkill.set(skillId, { orePeriodo: 0, oreTotali: 0 });
    }
    const row = bySkill.get(skillId);
    row.oreTotali += ore;
    if (inPeriod) {
      row.orePeriodo += ore;
    }
  }
}

/**
 * @param {Map<string, { orePeriodo: number, oreTotali: number }>} skillHours
 * @param {{ periodoDa: Date, periodoA: Date, aggiornatoIl?: string, thresholds?: typeof STAR_THRESHOLDS_HOURS_DEFAULT }} opts
 * @returns {Array<{ skillId: string, orePeriodo: number, oreTotali: number, stelle: number, periodoDa: string, periodoA: string, aggiornatoIl: string }>}
 */
export function buildSkillCalcolateRows(skillHours, opts) {
  const { periodoDa, periodoA } = opts;
  const aggiornatoIl = opts.aggiornatoIl || new Date().toISOString();
  const thresholds = opts.thresholds || STAR_THRESHOLDS_HOURS_DEFAULT;
  const periodoDaIso = periodoDa.toISOString();
  const periodoAIso = periodoA.toISOString();

  const rows = [];
  for (const [skillId, hours] of skillHours.entries()) {
    const orePeriodo = Math.round((hours.orePeriodo || 0) * 100) / 100;
    const oreTotali = Math.round((hours.oreTotali || 0) * 100) / 100;
    if (orePeriodo <= 0 && oreTotali <= 0) continue;
    rows.push({
      skillId,
      orePeriodo,
      oreTotali,
      stelle: oreToStelle(orePeriodo, thresholds),
      periodoDa: periodoDaIso,
      periodoA: periodoAIso,
      aggiornatoIl
    });
  }

  rows.sort((a, b) => (b.stelle || 0) - (a.stelle || 0) || (b.orePeriodo || 0) - (a.orePeriodo || 0));
  return rows;
}

/**
 * @param {OreSkillAccumulator} accumulator
 * @param {{ periodoDa: Date, periodoA: Date, aggiornatoIl?: string, thresholds?: typeof STAR_THRESHOLDS_HOURS_DEFAULT }} opts
 * @returns {Map<string, Array<object>>}
 */
export function buildSkillCalcolateByOperaioFromAccumulator(accumulator, opts) {
  const out = new Map();
  for (const [operaioId, skillHours] of accumulator.entries()) {
    out.set(operaioId, buildSkillCalcolateRows(skillHours, opts));
  }
  return out;
}
