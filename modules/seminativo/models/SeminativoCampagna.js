/**
 * Record di campagna seminativo (non è un impianto permanente).
 * Un documento per terreno + campagna: coltura e varietà cambiano ogni ciclo.
 * Collezione: tenants/{tenantId}/seminativi
 *
 * @module modules/seminativo/models/SeminativoCampagna
 */

import { COLTURE_PREDEFINITE } from '../../../core/config/app-catalog-seed-data.js';

export const SEMINATIVO_CAMPAGNA_STATI = [
  'pianificato',
  'seminato',
  'in_ciclo',
  'raccolto',
  'chiuso'
];

export const SEMINATIVO_CAMPAGNA_STATO_LABELS = {
  pianificato: 'Pianificato',
  seminato: 'Seminato',
  in_ciclo: 'In ciclo',
  raccolto: 'Raccolto',
  chiuso: 'Chiuso'
};

/** Chiave unica terreno + campagna (trim, case-insensitive, spazi compressi). */
export function normalizeCampagnaKey(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, '');
}

export function sameCampagnaKey(a, b) {
  if (!a || !b) return false;
  return String(a.terrenoId || '') === String(b.terrenoId || '')
    && normalizeCampagnaKey(a.campagna) !== ''
    && normalizeCampagnaKey(a.campagna) === normalizeCampagnaKey(b.campagna);
}

export function findDuplicateCampagna(list, candidato, excludeId) {
  if (!Array.isArray(list) || !candidato) return null;
  const skip = excludeId != null ? String(excludeId) : '';
  return list.find((item) => {
    if (!item) return false;
    if (skip && String(item.id || '') === skip) return false;
    return sameCampagnaKey(item, candidato);
  }) || null;
}

/** Campagna agricola IT: da settembre è anno/anno+1. */
export function defaultCampagnaLabel(now = new Date()) {
  const y = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
}

const NOMI_COLTURE_SEMINATIVO = new Set(
  COLTURE_PREDEFINITE
    .filter((c) => String(c.categoriaCodice || '').toLowerCase() === 'seminativo' && c.nome)
    .map((c) => String(c.nome).trim().toLowerCase())
);

function testoTerreno(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

/**
 * Terreno aziendale di seminativo.
 * L'anagrafica terreni salva il nome coltura in `coltura` (come il filtro Vite del vigneto),
 * non sempre `colturaCategoria`. Si accetta anche l'id categoria del catalogo.
 * Prato, ortive e vite restano fuori.
 *
 * @param {Object} terreno
 * @param {{ nomiColture?: Set<string>|string[], categoriaIds?: Set<string>|string[] }} [ctx]
 */
export function isTerrenoSeminativo(terreno, ctx = {}) {
  if (!terreno) return false;
  const cat = String(terreno.colturaCategoria || '').trim();
  if (testoTerreno(cat).includes('seminativ')) return true;
  if (cat && ctx.categoriaIds) {
    const ids = ctx.categoriaIds instanceof Set ? ctx.categoriaIds : new Set(ctx.categoriaIds);
    if (ids.has(cat)) return true;
  }
  const nomi = new Set(NOMI_COLTURE_SEMINATIVO);
  if (ctx.nomiColture) {
    const extra = ctx.nomiColture instanceof Set ? ctx.nomiColture : ctx.nomiColture;
    for (const nome of extra) {
      const key = testoTerreno(nome);
      if (key) nomi.add(key);
    }
  }
  const testi = [terreno.coltura, terreno.colturaSottocategoria].map(testoTerreno).filter(Boolean);
  return testi.some((t) => t.includes('seminativ') || nomi.has(t));
}

export class SeminativoCampagna {
  /**
   * @param {Object} [data]
   * @param {string} [data.id]
   * @param {string} [data.terrenoId]
   * @param {string|number} [data.campagna] es. "2025/2026" o 2026
   * @param {string} [data.colturaId]
   * @param {string} [data.colturaNome]
   * @param {string} [data.varieta]
   * @param {number} [data.superficieEttari]
   * @param {number} [data.resaPrevistaQliHa]
   * @param {Date|string|null} [data.dataSeminaPrevista]
   * @param {Date|string|null} [data.dataRaccoltaPrevista]
   * @param {string} [data.stato]
   * @param {string} [data.note]
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.terrenoId = data.terrenoId || null;
    this.campagna = data.campagna != null ? String(data.campagna).trim() : '';
    this.colturaId = data.colturaId || null;
    this.colturaNome = data.colturaNome || null;
    this.varieta = data.varieta || null;
    this.superficieEttari = data.superficieEttari !== undefined && data.superficieEttari !== null
      ? parseFloat(data.superficieEttari)
      : null;
    this.resaPrevistaQliHa = data.resaPrevistaQliHa !== undefined && data.resaPrevistaQliHa !== null
      ? parseFloat(data.resaPrevistaQliHa)
      : null;
    this.dataSeminaPrevista = data.dataSeminaPrevista || null;
    this.dataRaccoltaPrevista = data.dataRaccoltaPrevista || null;
    this.stato = data.stato || 'pianificato';
    this.note = data.note || '';
  }

  /**
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];
    if (!this.terrenoId) errors.push('Terreno obbligatorio');
    if (!this.campagna) errors.push('Campagna obbligatoria');
    if (!this.colturaId && !this.colturaNome) errors.push('Coltura obbligatoria');
    if (this.stato && SEMINATIVO_CAMPAGNA_STATI.indexOf(this.stato) < 0) {
      errors.push('Stato campagna non valido');
    }
    if (this.superficieEttari != null && !(this.superficieEttari > 0)) {
      errors.push('Superficie deve essere maggiore di zero');
    }
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      terrenoId: this.terrenoId,
      campagna: this.campagna,
      colturaId: this.colturaId,
      colturaNome: this.colturaNome,
      varieta: this.varieta,
      superficieEttari: this.superficieEttari,
      resaPrevistaQliHa: this.resaPrevistaQliHa,
      dataSeminaPrevista: this.dataSeminaPrevista,
      dataRaccoltaPrevista: this.dataRaccoltaPrevista,
      stato: this.stato,
      note: this.note
    };
  }

  update(updates = {}) {
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) this[key] = updates[key];
    });
    if (updates.campagna != null) this.campagna = String(updates.campagna).trim();
    if (updates.superficieEttari !== undefined) {
      this.superficieEttari = updates.superficieEttari !== null
        ? parseFloat(updates.superficieEttari)
        : null;
    }
    if (updates.resaPrevistaQliHa !== undefined) {
      this.resaPrevistaQliHa = updates.resaPrevistaQliHa !== null
        ? parseFloat(updates.resaPrevistaQliHa)
        : null;
    }
    return this;
  }

  static fromData(data = {}) {
    return new SeminativoCampagna(data);
  }
}
