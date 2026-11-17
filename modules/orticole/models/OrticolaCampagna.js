/**
 * Record di campagna orticola (pieno campo, non impianto permanente).
 * Un documento per terreno + campagna + ciclo (1|2).
 * Collezione: tenants/{tenantId}/orticole
 * settoreId reserved for Fase 2 (null in Fase 1).
 *
 * @module modules/orticole/models/OrticolaCampagna
 */

import { COLTURE_PREDEFINITE } from '../../../core/config/app-catalog-seed-data.js';

export const ORTICOLA_CAMPAGNA_STATI = [
  'pianificato',
  'seminato',
  'trapiantato',
  'in_ciclo',
  'raccolto',
  'chiuso'
];

export const ORTICOLA_CAMPAGNA_STATO_LABELS = {
  pianificato: 'Pianificato',
  seminato: 'Seminato',
  trapiantato: 'Trapiantato',
  in_ciclo: 'In ciclo',
  raccolto: 'Raccolto',
  chiuso: 'Chiuso'
};

export const ORTICOLA_TIPO_IMPIANTO = ['semina', 'trapianto'];

export const ORTICOLA_DESTINAZIONI = ['industria', 'mercato', 'stoccaggio', 'uso_aziendale'];

export const ORTICOLA_DESTINAZIONE_LABELS = {
  industria: 'Industria',
  mercato: 'Mercato',
  stoccaggio: 'Stoccaggio',
  uso_aziendale: 'Uso aziendale'
};

export const ORTICOLA_CICLI_FASE1 = [1, 2];

/** Chiave campagna (trim, case-insensitive, spazi compressi). */
export function normalizeCampagnaKey(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeCiclo(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 1;
}

/**
 * Unicità Fase 1: terrenoId + campagna + ciclo.
 * settoreId resta null (Fase 2).
 */
export function sameCampagnaKey(a, b) {
  if (!a || !b) return false;
  const settoreA = a.settoreId == null ? '' : String(a.settoreId);
  const settoreB = b.settoreId == null ? '' : String(b.settoreId);
  return String(a.terrenoId || '') === String(b.terrenoId || '')
    && settoreA === settoreB
    && normalizeCampagnaKey(a.campagna) !== ''
    && normalizeCampagnaKey(a.campagna) === normalizeCampagnaKey(b.campagna)
    && normalizeCiclo(a.ciclo) === normalizeCiclo(b.ciclo);
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

/** Massimo due cicli sullo stesso terreno (e settore) nella stessa annata — Fase 1. */
export function countCicliSuTerrenoCampagna(list, terrenoId, campagna, settoreId = null, excludeId = null) {
  if (!Array.isArray(list) || !terrenoId || !campagna) return 0;
  const skip = excludeId != null ? String(excludeId) : '';
  const settore = settoreId == null ? '' : String(settoreId);
  const key = normalizeCampagnaKey(campagna);
  return list.filter((item) => {
    if (!item) return false;
    if (skip && String(item.id || '') === skip) return false;
    const itemSettore = item.settoreId == null ? '' : String(item.settoreId);
    return String(item.terrenoId || '') === String(terrenoId)
      && itemSettore === settore
      && normalizeCampagnaKey(item.campagna) === key;
  }).length;
}

/** Campagna agricola IT: da settembre è anno/anno+1. */
export function defaultCampagnaLabel(now = new Date()) {
  const y = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
}

const NOMI_COLTURE_ORTIVE = new Set(
  COLTURE_PREDEFINITE
    .filter((c) => String(c.categoriaCodice || '').toLowerCase() === 'ortive' && c.nome)
    .map((c) => String(c.nome).trim().toLowerCase())
);

export function nomiColtureOrtivePredefinite() {
  return Array.from(NOMI_COLTURE_ORTIVE);
}

function testoTerreno(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

/**
 * Terreno aziendale di ortive.
 * Prato, seminativo e vite restano fuori.
 *
 * @param {Object} terreno
 * @param {{ nomiColture?: Set<string>|string[], categoriaIds?: Set<string>|string[] }} [ctx]
 */
export function isTerrenoOrticole(terreno, ctx = {}) {
  if (!terreno) return false;
  const cat = String(terreno.colturaCategoria || '').trim();
  const catLower = testoTerreno(cat);
  if (catLower.includes('ortiv') || catLower === 'orto') return true;
  if (cat && ctx.categoriaIds) {
    const ids = ctx.categoriaIds instanceof Set ? ctx.categoriaIds : new Set(ctx.categoriaIds);
    if (ids.has(cat)) return true;
  }
  const nomi = new Set(NOMI_COLTURE_ORTIVE);
  if (ctx.nomiColture) {
    const extra = ctx.nomiColture instanceof Set ? ctx.nomiColture : ctx.nomiColture;
    for (const nome of extra) {
      const key = testoTerreno(nome);
      if (key) nomi.add(key);
    }
  }
  const testi = [terreno.coltura, terreno.colturaSottocategoria].map(testoTerreno).filter(Boolean);
  return testi.some((t) => t.includes('ortiv') || t === 'orto' || nomi.has(t));
}

export class OrticolaCampagna {
  /**
   * @param {Object} [data]
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.terrenoId = data.terrenoId || null;
    this.settoreId = data.settoreId != null ? data.settoreId : null;
    this.campagna = data.campagna != null ? String(data.campagna).trim() : '';
    this.ciclo = normalizeCiclo(data.ciclo == null ? 1 : data.ciclo);
    this.colturaId = data.colturaId || null;
    this.colturaNome = data.colturaNome || null;
    this.varieta = data.varieta || null;
    this.superficieEttari = data.superficieEttari !== undefined && data.superficieEttari !== null
      ? parseFloat(data.superficieEttari)
      : null;
    this.resaPrevistaQliHa = data.resaPrevistaQliHa !== undefined && data.resaPrevistaQliHa !== null
      ? parseFloat(data.resaPrevistaQliHa)
      : null;
    this.tipoImpianto = data.tipoImpianto || 'trapianto';
    this.dataImpiantoPrevista = data.dataImpiantoPrevista || data.dataSeminaPrevista || null;
    this.dataRaccoltaPrevista = data.dataRaccoltaPrevista || null;
    this.destinazionePrevista = data.destinazionePrevista || null;
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
    if (ORTICOLA_CICLI_FASE1.indexOf(this.ciclo) < 0) {
      errors.push('Ciclo deve essere 1 o 2');
    }
    if (this.stato && ORTICOLA_CAMPAGNA_STATI.indexOf(this.stato) < 0) {
      errors.push('Stato campagna non valido');
    }
    if (this.tipoImpianto && ORTICOLA_TIPO_IMPIANTO.indexOf(this.tipoImpianto) < 0) {
      errors.push('Tipo impianto non valido');
    }
    if (this.superficieEttari != null && !(this.superficieEttari > 0)) {
      errors.push('Superficie deve essere maggiore di zero');
    }
    if (this.destinazionePrevista != null
      && this.destinazionePrevista !== ''
      && ORTICOLA_DESTINAZIONI.indexOf(this.destinazionePrevista) < 0) {
      errors.push('Destinazione prevista non valida');
    }
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      terrenoId: this.terrenoId,
      settoreId: this.settoreId,
      campagna: this.campagna,
      ciclo: this.ciclo,
      colturaId: this.colturaId,
      colturaNome: this.colturaNome,
      varieta: this.varieta,
      superficieEttari: this.superficieEttari,
      resaPrevistaQliHa: this.resaPrevistaQliHa,
      tipoImpianto: this.tipoImpianto,
      dataImpiantoPrevista: this.dataImpiantoPrevista,
      dataRaccoltaPrevista: this.dataRaccoltaPrevista,
      destinazionePrevista: this.destinazionePrevista,
      stato: this.stato,
      note: this.note
    };
  }

  update(updates = {}) {
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) this[key] = updates[key];
    });
    if (updates.campagna != null) this.campagna = String(updates.campagna).trim();
    if (updates.ciclo !== undefined) this.ciclo = normalizeCiclo(updates.ciclo);
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
    if (updates.dataSeminaPrevista !== undefined && updates.dataImpiantoPrevista === undefined) {
      this.dataImpiantoPrevista = updates.dataSeminaPrevista;
    }
    return this;
  }

  static fromData(data = {}) {
    return new OrticolaCampagna(data);
  }
}
