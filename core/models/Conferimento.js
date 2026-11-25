/**
 * Conferimento — acquirente + categoria + annata (raggruppa consegne e acconti/saldi).
 * Collection: tenants/{tenantId}/conferimenti
 *
 * @module core/models/Conferimento
 */

import { CATEGORIE_PRODOTTO } from './Acquirente.js';

export const CONFERIMENTO_STATI = ['aperto', 'liquidato'];

export class Conferimento {
  constructor(data = {}) {
    this.id = data.id || null;
    this.acquirenteId = data.acquirenteId || null;
    this.categoriaProdotto = data.categoriaProdotto || '';
    this.prodotto = data.prodotto != null ? String(data.prodotto).trim() : '';
    this.annata = data.annata != null ? String(data.annata).trim() : '';
    this.stato = data.stato || 'aperto';
    this.totalePrevisto =
      data.totalePrevisto != null && data.totalePrevisto !== ''
        ? Number(data.totalePrevisto)
        : null;
    this.note = data.note != null ? String(data.note) : '';
    this.createdAt = data.createdAt || null;
    this.createdBy = data.createdBy || null;
  }

  static fromData(data = {}) {
    return new Conferimento(data);
  }

  /** Etichetta breve per UI / Tony. */
  labelBreve(acquirenteNome) {
    const cat = this.categoriaProdotto
      ? this.categoriaProdotto.charAt(0).toUpperCase() + this.categoriaProdotto.slice(1)
      : 'Prodotto';
    const nome = acquirenteNome || 'Acquirente';
    return `${cat}${this.prodotto ? ' ' + this.prodotto : ''} ${this.annata}, ${nome}`.replace(/\s+/g, ' ').trim();
  }

  validate() {
    const errors = [];
    if (!this.acquirenteId) errors.push('Acquirente obbligatorio');
    if (!CATEGORIE_PRODOTTO.includes(this.categoriaProdotto)) {
      errors.push('Categoria prodotto obbligatoria');
    }
    if (!this.annata) errors.push('Annata obbligatoria');
    if (!CONFERIMENTO_STATI.includes(this.stato)) errors.push('Stato conferimento non valido');
    if (this.totalePrevisto != null && !(Number(this.totalePrevisto) >= 0)) {
      errors.push('Totale previsto non valido');
    }
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      acquirenteId: this.acquirenteId,
      categoriaProdotto: this.categoriaProdotto,
      prodotto: this.prodotto || null,
      annata: this.annata,
      stato: this.stato,
      totalePrevisto:
        this.totalePrevisto != null && Number.isFinite(Number(this.totalePrevisto))
          ? Number(this.totalePrevisto)
          : null,
      note: (this.note || '').trim(),
      createdBy: this.createdBy || null
    };
  }

  update(updates = {}) {
    Object.keys(updates).forEach((key) => {
      if (key === 'id' || key === 'createdAt') return;
      if (Object.prototype.hasOwnProperty.call(this, key)) this[key] = updates[key];
    });
  }
}

export default Conferimento;
