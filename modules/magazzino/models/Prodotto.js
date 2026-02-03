/**
 * Prodotto Model - Modello dati prodotto (Prodotti e Magazzino)
 * Anagrafica prodotti con giacenza; si disattivano (non si eliminano) per mantenere lo storico.
 *
 * @module modules/magazzino/models/Prodotto
 */

import { Base } from '../../../core/models/Base.js';

export class Prodotto extends Base {
  /**
   * Costruttore Prodotto
   * @param {Object} data - Dati prodotto
   * @param {string} data.id - ID prodotto
   * @param {string} data.codice - Codice interno (opzionale)
   * @param {string} data.nome - Nome prodotto (obbligatorio)
   * @param {string} data.categoria - Categoria: fitofarmaci, fertilizzanti, materiale_impianto, ricambi, sementi, altro
   * @param {string} data.unitaMisura - Unità di misura: kg, L, pezzi, m, m2, confezione, sacchi, altro
   * @param {number} data.scortaMinima - Scorta minima per alert (opzionale, default 0)
   * @param {number} data.prezzoUnitario - Prezzo unitario di riferimento (opzionale; €/unità, es. €/kg per trattamenti)
   * @param {number} data.giacenza - Giacenza corrente (aggiornata dai movimenti)
   * @param {number} data.dosaggioMin - Dosaggio minimo per ha (opzionale; unità = unitaMisura, es. kg/ha o L/ha)
   * @param {number} data.dosaggioMax - Dosaggio massimo per ha (opzionale; deve essere >= dosaggioMin)
   * @param {number} data.giorniCarenza - Giorni di carenza pre-raccolta (opzionale; es. 30)
   */
  constructor(data = {}) {
    super(data);

    this.codice = data.codice || '';
    this.nome = data.nome || '';
    this.categoria = data.categoria || 'altro';
    this.unitaMisura = data.unitaMisura || 'pezzi';
    this.scortaMinima = data.scortaMinima !== undefined ? parseFloat(data.scortaMinima) : 0;
    this.prezzoUnitario = data.prezzoUnitario !== undefined ? parseFloat(data.prezzoUnitario) : null;
    this.giacenza = data.giacenza !== undefined ? parseFloat(data.giacenza) : 0;
    // Range dosaggio: min e max per ha (es. 0,5–1 L/ha, 2–5 kg/ha). Retrocompatibilità: se esiste solo dosaggioConsigliato, usalo per entrambi.
    const dMin = data.dosaggioMin !== undefined && data.dosaggioMin !== '' ? parseFloat(data.dosaggioMin) : null;
    const dMax = data.dosaggioMax !== undefined && data.dosaggioMax !== '' ? parseFloat(data.dosaggioMax) : null;
    const dCons = data.dosaggioConsigliato !== undefined && data.dosaggioConsigliato !== '' ? parseFloat(data.dosaggioConsigliato) : null;
    this.dosaggioMin = dMin ?? (dCons != null ? dCons : null);
    this.dosaggioMax = dMax ?? (dCons != null ? dCons : null);
    this.giorniCarenza = data.giorniCarenza !== undefined && data.giorniCarenza !== '' ? parseInt(data.giorniCarenza, 10) : null;
    this.note = data.note || '';
    this.attivo = data.attivo !== undefined ? !!data.attivo : true;
  }

  /**
   * Valida dati prodotto
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];

    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome prodotto obbligatorio');
    }

    if (this.nome && this.nome.trim().length > 200) {
      errors.push('Nome prodotto non può superare 200 caratteri');
    }

    if (this.scortaMinima < 0) {
      errors.push('Scorta minima non può essere negativa');
    }

    if (this.prezzoUnitario !== null && this.prezzoUnitario < 0) {
      errors.push('Prezzo unitario non può essere negativo');
    }

    if (this.dosaggioMin !== null && this.dosaggioMin < 0) {
      errors.push('Dosaggio minimo non può essere negativo');
    }
    if (this.dosaggioMax !== null && this.dosaggioMax < 0) {
      errors.push('Dosaggio massimo non può essere negativo');
    }
    if (this.dosaggioMin != null && this.dosaggioMax != null && this.dosaggioMin > this.dosaggioMax) {
      errors.push('Dosaggio massimo deve essere >= dosaggio minimo');
    }

    if (this.giorniCarenza !== null && this.giorniCarenza < 0) {
      errors.push('Giorni di carenza non possono essere negativi');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Converte modello in formato Firestore
   * @returns {Object} Oggetto pronto per Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    return data;
  }

  /**
   * Verifica se prodotto è sotto scorta minima
   * @returns {boolean}
   */
  isSottoScortaMinima() {
    if (this.scortaMinima == null || this.scortaMinima <= 0) return false;
    return this.giacenza < this.scortaMinima;
  }

  /**
   * Verifica se prodotto è attivo
   * @returns {boolean}
   */
  isAttivo() {
    return this.attivo === true;
  }
}

export default Prodotto;
