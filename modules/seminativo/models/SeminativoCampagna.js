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
}
