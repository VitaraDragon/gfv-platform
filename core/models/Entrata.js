/**
 * Entrata — vendita prodotto, PAC/contributo o altra entrata (senza IVA).
 * Collection: tenants/{tenantId}/entrate
 *
 * @module core/models/Entrata
 */

export const ENTRATA_TIPI = ['vendita_prodotto', 'pac_contributo', 'altro'];

export const ENTRATA_TIPO_LABELS = {
  vendita_prodotto: 'Vendita prodotto',
  pac_contributo: 'PAC / contributo',
  altro: 'Altro'
};

export const ENTRATA_UNITA = ['kg', 'q', 't', 'hl', 'l', 'pezzi'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Importo calcolato da quantità × prezzo unitario (2 decimali).
 * @param {number|string|null|undefined} quantita
 * @param {number|string|null|undefined} prezzoUnitario
 * @returns {number|null}
 */
export function calcolaImportoVendita(quantita, prezzoUnitario) {
  const q = Number(quantita);
  const p = Number(prezzoUnitario);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
  return Math.round(q * p * 100) / 100;
}

/**
 * @param {Array<object>} items
 * @returns {{ registrate: number, incassate: number, daIncassare: number }}
 */
export function totaliEntrate(items) {
  let registrate = 0;
  let incassate = 0;
  let daIncassare = 0;
  for (const item of items || []) {
    const importo = Number(item && item.importo);
    if (!Number.isFinite(importo) || importo <= 0) continue;
    registrate += importo;
    if (item.incassato) incassate += importo;
    else daIncassare += importo;
  }
  return {
    registrate: Math.round(registrate * 100) / 100,
    incassate: Math.round(incassate * 100) / 100,
    daIncassare: Math.round(daIncassare * 100) / 100
  };
}

/**
 * Filtro periodo su campo `data` (YYYY-MM-DD), inclusivo.
 * @param {Array<object>} items
 * @param {string|null|undefined} startIso
 * @param {string|null|undefined} endIso
 */
export function filtraEntratePerPeriodo(items, startIso, endIso) {
  const start = startIso ? String(startIso).slice(0, 10) : null;
  const end = endIso ? String(endIso).slice(0, 10) : null;
  return (items || []).filter((item) => {
    const d = item && item.data ? String(item.data).slice(0, 10) : '';
    if (!DATE_RE.test(d)) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

/**
 * @param {Array<object>} items
 * @param {{ start?: string|null, end?: string|null, tipo?: string|null, coltura?: string|null }} [filters]
 */
export function filtraEntrate(items, filters = {}) {
  let list = filtraEntratePerPeriodo(items, filters.start, filters.end);
  const tipo = filters.tipo ? String(filters.tipo) : '';
  const coltura = filters.coltura ? String(filters.coltura).trim().toLowerCase() : '';
  if (tipo) list = list.filter((i) => i && String(i.tipo || '') === tipo);
  if (coltura) {
    list = list.filter((i) => {
      const c = String((i && i.coltura) || '').trim().toLowerCase();
      return c.indexOf(coltura) >= 0;
    });
  }
  return list;
}

export class Entrata {
  /**
   * @param {Object} data
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.data = data.data || '';
    this.tipo = data.tipo || 'vendita_prodotto';
    this.descrizione = data.descrizione != null ? String(data.descrizione) : '';
    this.coltura = data.coltura != null ? String(data.coltura) : '';
    this.quantita = data.quantita != null && data.quantita !== '' ? Number(data.quantita) : null;
    this.unita = data.unita || null;
    this.prezzoUnitario =
      data.prezzoUnitario != null && data.prezzoUnitario !== '' ? Number(data.prezzoUnitario) : null;
    this.importo = data.importo != null && data.importo !== '' ? Number(data.importo) : null;
    this.acquirente = data.acquirente != null ? String(data.acquirente) : '';
    this.terrenoId = data.terrenoId || null;
    this.fruttetoId = data.fruttetoId || null;
    this.vignetoId = data.vignetoId || null;
    this.raccoltaId = data.raccoltaId || null;
    this.incassato = data.incassato === true || data.incassato === 'true' || data.incassato === 1;
    this.dataIncasso = data.dataIncasso || null;
    this.note = data.note != null ? String(data.note) : '';
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || null;
  }

  static fromData(data = {}) {
    return new Entrata(data);
  }

  /**
   * Se tipo vendita e importo non impostato a mano, calcola da quantità × prezzo.
   */
  syncImportoCalcolatoSeManca() {
    if (this.tipo !== 'vendita_prodotto') return;
    if (this.importo != null && Number.isFinite(Number(this.importo))) return;
    const calc = calcolaImportoVendita(this.quantita, this.prezzoUnitario);
    if (calc != null) this.importo = calc;
  }

  /**
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];

    if (!this.data || !DATE_RE.test(String(this.data).slice(0, 10))) {
      errors.push('Data obbligatoria (formato AAAA-MM-GG)');
    }

    if (!ENTRATA_TIPI.includes(this.tipo)) {
      errors.push(`Tipo non valido. Valori ammessi: ${ENTRATA_TIPI.join(', ')}`);
    }

    this.syncImportoCalcolatoSeManca();

    const importo = Number(this.importo);
    if (!Number.isFinite(importo) || importo <= 0) {
      errors.push('Importo deve essere maggiore di zero');
    }

    if (this.tipo === 'vendita_prodotto') {
      if (this.unita && !ENTRATA_UNITA.includes(this.unita)) {
        errors.push(`Unità non valida. Valori ammessi: ${ENTRATA_UNITA.join(', ')}`);
      }
    }

    if (this.dataIncasso && !DATE_RE.test(String(this.dataIncasso).slice(0, 10))) {
      errors.push('Data incasso non valida (formato AAAA-MM-GG)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * @returns {Object}
   */
  toFirestore() {
    this.syncImportoCalcolatoSeManca();
    const data = {
      data: String(this.data || '').slice(0, 10),
      tipo: this.tipo,
      descrizione: (this.descrizione || '').trim(),
      importo: Number(this.importo),
      incassato: !!this.incassato,
      note: (this.note || '').trim(),
      acquirente: (this.acquirente || '').trim() || null,
      terrenoId: this.terrenoId || null,
      fruttetoId: this.fruttetoId || null,
      vignetoId: this.vignetoId || null,
      raccoltaId: this.raccoltaId || null,
      dataIncasso: this.incassato && this.dataIncasso
        ? String(this.dataIncasso).slice(0, 10)
        : null,
      createdBy: this.createdBy || null
    };

    if (this.tipo === 'vendita_prodotto') {
      data.coltura = (this.coltura || '').trim() || null;
      data.quantita = this.quantita != null && Number.isFinite(Number(this.quantita))
        ? Number(this.quantita)
        : null;
      data.unita = this.unita || null;
      data.prezzoUnitario =
        this.prezzoUnitario != null && Number.isFinite(Number(this.prezzoUnitario))
          ? Number(this.prezzoUnitario)
          : null;
    } else {
      data.coltura = null;
      data.quantita = null;
      data.unita = null;
      data.prezzoUnitario = null;
    }

    return data;
  }

  /**
   * @param {Object} updates
   */
  update(updates = {}) {
    Object.keys(updates).forEach((key) => {
      if (key === 'id' || key === 'createdAt') return;
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        this[key] = updates[key];
      }
    });
    if (updates.incassato !== undefined) {
      this.incassato =
        updates.incassato === true || updates.incassato === 'true' || updates.incassato === 1;
    }
  }
}

export default Entrata;
