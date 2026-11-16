/**
 * Evento di semina o trapianto collegato a una campagna orticola.
 * Collezione: tenants/{tenantId}/semineOrticole
 *
 * @module modules/orticole/models/OrticolaImpianto
 */

export const IMPIANTO_TIPI = ['semina', 'trapianto'];
export const SEMINA_UNITA_DOSE = ['kg/ha', 'kg'];

/** Prima semina: pianificato → seminato. Prima trapianto: pianificato → trapiantato. */
export function statoDopoImpianto(stato, tipoImpianto) {
  if (stato && stato !== 'pianificato') return stato;
  return tipoImpianto === 'trapianto' ? 'trapiantato' : 'seminato';
}

/** Nessun impianto rimasto: solo seminato/trapiantato tornano a pianificato. */
export function statoDopoRimozioneImpianto(stato) {
  if (stato === 'seminato' || stato === 'trapiantato') return 'pianificato';
  return stato || 'pianificato';
}

/** Alias retrocompatibile con pattern semina. */
export function statoDopoSemina(stato) {
  return statoDopoImpianto(stato, 'semina');
}

export function statoDopoRimozioneSemina(stato) {
  return statoDopoRimozioneImpianto(stato);
}

export class OrticolaImpianto {
  /**
   * @param {Object} [data]
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.campagnaId = data.campagnaId || null;
    this.dataImpianto = data.dataImpianto || data.dataSemina || null;
    this.tipoImpianto = data.tipoImpianto || 'trapianto';
    this.varieta = data.varieta ? String(data.varieta).trim() : null;
    this.doseSeme = data.doseSeme !== undefined && data.doseSeme !== null && data.doseSeme !== ''
      ? parseFloat(data.doseSeme)
      : null;
    this.unitaDose = data.unitaDose || 'kg/ha';
    this.densitaPianteHa = data.densitaPianteHa !== undefined && data.densitaPianteHa !== null && data.densitaPianteHa !== ''
      ? parseFloat(data.densitaPianteHa)
      : null;
    this.note = data.note || '';
    this.terrenoId = data.terrenoId || null;
    this.campagna = data.campagna != null ? String(data.campagna).trim() : '';
    this.colturaId = data.colturaId || null;
    this.colturaNome = data.colturaNome || null;
  }

  /** Alias per template che leggono dataSemina. */
  get dataSemina() {
    return this.dataImpianto;
  }

  validate() {
    const errors = [];
    if (!this.campagnaId) errors.push('Campagna obbligatoria');
    if (!this.dataImpianto) errors.push('Data impianto obbligatoria');
    if (IMPIANTO_TIPI.indexOf(this.tipoImpianto) < 0) {
      errors.push('Tipo impianto non valido');
    }
    if (this.tipoImpianto === 'semina') {
      if (this.doseSeme != null && !(this.doseSeme > 0)) {
        errors.push('Dose seme deve essere maggiore di zero');
      }
      if (SEMINA_UNITA_DOSE.indexOf(this.unitaDose) < 0) {
        errors.push('Unità dose non valida');
      }
    }
    if (this.tipoImpianto === 'trapianto') {
      if (this.densitaPianteHa != null && !(this.densitaPianteHa > 0)) {
        errors.push('Densità piante/ha deve essere maggiore di zero');
      }
    }
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      campagnaId: this.campagnaId,
      dataImpianto: this.dataImpianto,
      dataSemina: this.dataImpianto,
      tipoImpianto: this.tipoImpianto,
      varieta: this.varieta,
      doseSeme: this.tipoImpianto === 'semina' ? this.doseSeme : null,
      unitaDose: this.tipoImpianto === 'semina' ? this.unitaDose : null,
      densitaPianteHa: this.tipoImpianto === 'trapianto' ? this.densitaPianteHa : null,
      note: this.note,
      terrenoId: this.terrenoId,
      campagna: this.campagna,
      colturaId: this.colturaId,
      colturaNome: this.colturaNome
    };
  }

  update(updates = {}) {
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) this[key] = updates[key];
    });
    if (updates.dataSemina !== undefined && updates.dataImpianto === undefined) {
      this.dataImpianto = updates.dataSemina;
    }
    if (updates.varieta !== undefined) {
      this.varieta = updates.varieta ? String(updates.varieta).trim() : null;
    }
    if (updates.doseSeme !== undefined) {
      this.doseSeme = updates.doseSeme !== null && updates.doseSeme !== ''
        ? parseFloat(updates.doseSeme)
        : null;
    }
    if (updates.densitaPianteHa !== undefined) {
      this.densitaPianteHa = updates.densitaPianteHa !== null && updates.densitaPianteHa !== ''
        ? parseFloat(updates.densitaPianteHa)
        : null;
    }
    if (updates.campagna != null) this.campagna = String(updates.campagna).trim();
    return this;
  }

  static fromData(data = {}) {
    return new OrticolaImpianto(data);
  }
}
