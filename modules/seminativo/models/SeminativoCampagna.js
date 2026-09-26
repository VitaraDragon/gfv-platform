/**
 * Record di campagna seminativo (non è un impianto permanente).
 * Un documento per terreno + campagna: coltura e varietà cambiano ogni ciclo.
 * Collezione: tenants/{tenantId}/seminativi
 *
 * @module modules/seminativo/models/SeminativoCampagna
 */

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

export function isTerrenoSeminativo(terreno) {
  if (!terreno) return false;
  const cat = String(terreno.colturaCategoria || '').toLowerCase().trim();
  return cat.includes('seminativ');
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
