/**
 * Acquirente — cantina, cooperativa, mulino, GDO… (non confondere con clienti conto terzi).
 * Collection: tenants/{tenantId}/acquirenti
 *
 * @module core/models/Acquirente
 */

export const ACQUIRENTE_TIPI = [
  'cantina_sociale',
  'cantina_privata',
  'cooperativa_op',
  'mulino_stoccatore',
  'asta',
  'gdo',
  'commerciante',
  'vendita_diretta',
  'altro'
];

export const ACQUIRENTE_TIPO_LABELS = {
  cantina_sociale: 'Cantina sociale',
  cantina_privata: 'Cantina privata',
  cooperativa_op: 'Cooperativa / OP',
  mulino_stoccatore: 'Mulino / stoccatore',
  asta: 'Asta',
  gdo: 'GDO',
  commerciante: 'Commerciante',
  vendita_diretta: 'Vendita diretta',
  altro: 'Altro'
};

export const CATEGORIE_PRODOTTO = ['uva', 'frutta', 'ortaggi', 'seminativo', 'altro'];

export const CATEGORIA_PRODOTTO_LABELS = {
  uva: 'Uva',
  frutta: 'Frutta',
  ortaggi: 'Ortaggi',
  seminativo: 'Seminativo',
  altro: 'Altro'
};

export class Acquirente {
  constructor(data = {}) {
    this.id = data.id || null;
    this.nome = data.nome != null ? String(data.nome).trim() : '';
    this.partitaIva = data.partitaIva != null ? String(data.partitaIva).replace(/\s/g, '') : '';
    this.tipo = data.tipo || 'altro';
    this.categorieProdotto = Array.isArray(data.categorieProdotto)
      ? data.categorieProdotto.map((c) => String(c || '').trim()).filter(Boolean)
      : [];
    this.note = data.note != null ? String(data.note) : '';
    this.createdAt = data.createdAt || null;
    this.createdBy = data.createdBy || null;
  }

  static fromData(data = {}) {
    return new Acquirente(data);
  }

  validate() {
    const errors = [];
    if (!this.nome || this.nome.length < 2) errors.push('Nome acquirente obbligatorio');
    if (!ACQUIRENTE_TIPI.includes(this.tipo)) {
      errors.push(`Tipo acquirente non valido`);
    }
    for (const c of this.categorieProdotto) {
      if (!CATEGORIE_PRODOTTO.includes(c)) {
        errors.push(`Categoria prodotto non valida: ${c}`);
      }
    }
    if (this.partitaIva && !/^[0-9]{11}$/.test(this.partitaIva)) {
      errors.push('Partita IVA non valida (11 cifre)');
    }
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      nome: this.nome,
      partitaIva: this.partitaIva || null,
      tipo: this.tipo,
      categorieProdotto: this.categorieProdotto.slice(),
      note: (this.note || '').trim(),
      createdBy: this.createdBy || null
    };
  }

  update(updates = {}) {
    Object.keys(updates).forEach((key) => {
      if (key === 'id' || key === 'createdAt') return;
      if (Object.prototype.hasOwnProperty.call(this, key)) this[key] = updates[key];
    });
    if (updates.categorieProdotto) {
      this.categorieProdotto = Array.isArray(updates.categorieProdotto)
        ? updates.categorieProdotto.map((c) => String(c || '').trim()).filter(Boolean)
        : [];
    }
  }
}

export default Acquirente;
