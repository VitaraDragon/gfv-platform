/**
 * Evento di semina collegato a una campagna seminativo.
 * Collezione: tenants/{tenantId}/semineSeminativo
 *
 * @module modules/seminativo/models/SeminativoSemina
 */

export const SEMINA_UNITA_DOSE = ['kg/ha', 'kg'];

/** Prima semina: pianificato diventa seminato. Gli stati successivi restano. */
export function statoDopoSemina(stato) {
  if (!stato || stato === 'pianificato') return 'seminato';
  return stato;
}

/** Nessuna semina rimasta: solo lo stato seminato torna a pianificato. */
export function statoDopoRimozioneSemina(stato) {
  if (stato === 'seminato') return 'pianificato';
  return stato || 'pianificato';
}

export class SeminativoSemina {
  /**
   * @param {Object} [data]
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.campagnaId = data.campagnaId || null;
    this.dataSemina = data.dataSemina || null;
    this.varieta = data.varieta ? String(data.varieta).trim() : null;
    this.doseSeme = data.doseSeme !== undefined && data.doseSeme !== null && data.doseSeme !== ''
      ? parseFloat(data.doseSeme)
      : null;
    this.unitaDose = data.unitaDose || 'kg/ha';
    this.note = data.note || '';
    this.terrenoId = data.terrenoId || null;
    this.campagna = data.campagna != null ? String(data.campagna).trim() : '';
    this.colturaId = data.colturaId || null;
    this.colturaNome = data.colturaNome || null;
  }

  validate() {
    const errors = [];
    if (!this.campagnaId) errors.push('Campagna obbligatoria');
    if (!this.dataSemina) errors.push('Data semina obbligatoria');
    if (this.doseSeme != null && !(this.doseSeme > 0)) {
      errors.push('Dose seme deve essere maggiore di zero');
    }
    if (SEMINA_UNITA_DOSE.indexOf(this.unitaDose) < 0) {
      errors.push('Unità dose non valida');
    }
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      campagnaId: this.campagnaId,
      dataSemina: this.dataSemina,
      varieta: this.varieta,
      doseSeme: this.doseSeme,
      unitaDose: this.unitaDose,
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
    if (updates.varieta !== undefined) {
      this.varieta = updates.varieta ? String(updates.varieta).trim() : null;
    }
    if (updates.doseSeme !== undefined) {
      this.doseSeme = updates.doseSeme !== null && updates.doseSeme !== ''
        ? parseFloat(updates.doseSeme)
        : null;
    }
    if (updates.campagna != null) this.campagna = String(updates.campagna).trim();
    return this;
  }

  static fromData(data = {}) {
    return new SeminativoSemina(data);
  }
}
