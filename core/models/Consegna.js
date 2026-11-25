/**
 * Consegna / bolla verso un acquirente (legata a un conferimento).
 * Collection: tenants/{tenantId}/consegne
 *
 * @module core/models/Consegna
 */

export const CONSEGNA_UNITA = ['kg', 'q'];

export const CONSEGNA_MODULI_RACCOLTA = ['vendemmia', 'frutta', 'seminativo', 'orticole'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class Consegna {
  constructor(data = {}) {
    this.id = data.id || null;
    this.data = data.data || '';
    this.numeroBolla = data.numeroBolla != null ? String(data.numeroBolla).trim() : '';
    this.acquirenteId = data.acquirenteId || null;
    this.conferimentoId = data.conferimentoId || null;
    this.quantitaNetta =
      data.quantitaNetta != null && data.quantitaNetta !== '' ? Number(data.quantitaNetta) : null;
    this.unita = data.unita || 'q';
    this.prodotto = data.prodotto != null ? String(data.prodotto).trim() : '';
    this.raccoltaId = data.raccoltaId || null;
    this.raccoltaModulo = data.raccoltaModulo || null;
    this.terrenoId = data.terrenoId || null;
    this.fruttetoId = data.fruttetoId || null;
    this.vignetoId = data.vignetoId || null;
    this.parametri =
      data.parametri && typeof data.parametri === 'object' && !Array.isArray(data.parametri)
        ? { ...data.parametri }
        : {};
    this.note = data.note != null ? String(data.note) : '';
    this.createdAt = data.createdAt || null;
    this.createdBy = data.createdBy || null;
  }

  static fromData(data = {}) {
    return new Consegna(data);
  }

  validate() {
    const errors = [];
    if (!this.data || !DATE_RE.test(String(this.data).slice(0, 10))) {
      errors.push('Data obbligatoria (formato AAAA-MM-GG)');
    }
    if (!this.acquirenteId) errors.push('Acquirente obbligatorio');
    if (!this.conferimentoId) errors.push('Conferimento obbligatorio');
    const q = Number(this.quantitaNetta);
    if (!Number.isFinite(q) || q <= 0) errors.push('Quantità netta deve essere maggiore di zero');
    if (!CONSEGNA_UNITA.includes(this.unita)) errors.push('Unità non valida (kg o q)');
    if (this.raccoltaModulo && !CONSEGNA_MODULI_RACCOLTA.includes(this.raccoltaModulo)) {
      errors.push('Modulo raccolta non valido');
    }
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      data: String(this.data || '').slice(0, 10),
      numeroBolla: this.numeroBolla || null,
      acquirenteId: this.acquirenteId,
      conferimentoId: this.conferimentoId,
      quantitaNetta: Number(this.quantitaNetta),
      unita: this.unita,
      prodotto: this.prodotto || null,
      raccoltaId: this.raccoltaId || null,
      raccoltaModulo: this.raccoltaModulo || null,
      terrenoId: this.terrenoId || null,
      fruttetoId: this.fruttetoId || null,
      vignetoId: this.vignetoId || null,
      parametri: this.parametri && typeof this.parametri === 'object' ? this.parametri : {},
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

export default Consegna;
