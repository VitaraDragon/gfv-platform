/**
 * MovimentoMagazzino Model - Modello dati movimento di magazzino (entrata/uscita)
 *
 * @module modules/magazzino/models/MovimentoMagazzino
 */

import { Base } from '../../../core/models/Base.js';
import { timestampToDate } from '../../../core/services/firebase-service.js';
import { dateToTimestamp } from '../../../core/services/firebase-service.js';

export class MovimentoMagazzino extends Base {
  /**
   * Costruttore MovimentoMagazzino
   * @param {Object} data - Dati movimento
   * @param {string} data.id - ID movimento
   * @param {string} data.prodottoId - ID prodotto (obbligatorio)
   * @param {Date|Timestamp} data.data - Data movimento (obbligatorio)
   * @param {string} data.tipo - 'entrata' | 'uscita'
   * @param {number} data.quantita - Quantità (obbligatorio, > 0)
   * @param {number} data.prezzoUnitario - Prezzo unitario (per entrata; opzionale)
   * @param {string} data.lavoroId - Riferimento lavoro (opzionale)
   * @param {string} data.attivitaId - Riferimento attività (opzionale)
   * @param {string} data.note - Note (opzionale)
   * @param {string} data.userId - ID utente che ha registrato (opzionale)
   * @param {string} data.confezione - Descrizione confezione (opzionale, es. "1 bidone 5 L")
   */
  constructor(data = {}) {
    super(data);

    this.prodottoId = data.prodottoId || null;
    this.data = data.data ? timestampToDate(data.data) : null;
    this.tipo = data.tipo || 'entrata';
    this.quantita = data.quantita !== undefined ? parseFloat(data.quantita) : 0;
    this.prezzoUnitario = data.prezzoUnitario !== undefined ? parseFloat(data.prezzoUnitario) : null;
    this.lavoroId = data.lavoroId || null;
    this.attivitaId = data.attivitaId || null;
    this.note = data.note || '';
    this.userId = data.userId || null;
    this.confezione = data.confezione || '';
  }

  /**
   * Valida dati movimento
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];

    if (!this.prodottoId || this.prodottoId.trim().length === 0) {
      errors.push('Prodotto obbligatorio');
    }

    if (!this.data) {
      errors.push('Data movimento obbligatoria');
    }

    const tipiValidi = ['entrata', 'uscita'];
    if (!tipiValidi.includes(this.tipo)) {
      errors.push(`Tipo movimento deve essere: ${tipiValidi.join(', ')}`);
    }

    if (this.quantita === null || this.quantita === undefined || this.quantita <= 0) {
      errors.push('Quantità obbligatoria e maggiore di zero');
    }

    if (this.tipo === 'entrata' && this.prezzoUnitario !== null && this.prezzoUnitario < 0) {
      errors.push('Prezzo unitario non può essere negativo');
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
    if (this.data instanceof Date) {
      data.data = dateToTimestamp(this.data);
    }
    return data;
  }

  /**
   * Verifica se è un'entrata
   * @returns {boolean}
   */
  isEntrata() {
    return this.tipo === 'entrata';
  }

  /**
   * Verifica se è un'uscita
   * @returns {boolean}
   */
  isUscita() {
    return this.tipo === 'uscita';
  }
}

export default MovimentoMagazzino;
