/**
 * Tariffa Model - Modello dati tariffa (conto terzi)
 * Gestisce tariffe per calcolo preventivi automatici
 * 
 * @module modules/conto-terzi/models/Tariffa
 */

import { Base } from '../../../core/models/Base.js';

export class Tariffa extends Base {
  /**
   * Costruttore Tariffa
   * @param {Object} data - Dati tariffa
   * @param {string} data.id - ID tariffa
   * @param {string} data.tipoLavoro - Tipo lavoro (obbligatorio, es. "Aratura", "Semina")
   * @param {string} data.coltura - Coltura (opzionale, es. "Grano", "Mais"). Se vuota, si applica a tutta la categoria
   * @param {string} data.categoriaColturaId - ID categoria coltura (opzionale, usato quando coltura è vuota per identificare la categoria)
   * @param {string} data.tipoCampo - Tipo campo: "pianura" | "collina" | "montagna" (obbligatorio)
   * @param {number} data.tariffaBase - Tariffa base in €/ettaro (obbligatorio)
   * @param {number} data.coefficiente - Coefficiente moltiplicativo per tipo campo (default: 1.0)
   * @param {string} data.note - Note tariffa
   * @param {boolean} data.attiva - Se tariffa è attiva (default: true)
   */
  constructor(data = {}) {
    super(data);
    
    this.tipoLavoro = data.tipoLavoro || '';
    this.coltura = data.coltura || '';
    this.categoriaColturaId = data.categoriaColturaId || null;
    this.tipoCampo = data.tipoCampo || 'pianura';
    this.tariffaBase = data.tariffaBase !== undefined ? parseFloat(data.tariffaBase) : 0;
    this.coefficiente = data.coefficiente !== undefined ? parseFloat(data.coefficiente) : 1.0;
    this.note = data.note || '';
    this.attiva = data.attiva !== undefined ? data.attiva : true;
  }
  
  /**
   * Valida dati tariffa
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.tipoLavoro || this.tipoLavoro.trim().length === 0) {
      errors.push('Tipo lavoro obbligatorio');
    }
    
    // Coltura è opzionale: se vuota, si applica a tutte le colture della categoria
    
    const tipiCampoValidi = ['pianura', 'collina', 'montagna'];
    if (!tipiCampoValidi.includes(this.tipoCampo)) {
      errors.push(`Tipo campo non valido. Valori validi: ${tipiCampoValidi.join(', ')}`);
    }
    
    if (!this.tariffaBase || this.tariffaBase <= 0) {
      errors.push('Tariffa base obbligatoria e deve essere maggiore di 0');
    }
    
    if (this.coefficiente <= 0) {
      errors.push('Coefficiente deve essere maggiore di 0');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Calcola tariffa finale (tariffaBase * coefficiente)
   * @returns {number}
   */
  calcolaTariffaFinale() {
    return this.tariffaBase * this.coefficiente;
  }
  
  /**
   * Formatta tipo campo
   * @returns {string}
   */
  getTipoCampoFormattato() {
    const tipiFormattati = {
      'pianura': '🏞️ Pianura',
      'collina': '⛰️ Collina',
      'montagna': '🏔️ Montagna'
    };
    return tipiFormattati[this.tipoCampo] || this.tipoCampo;
  }
  
  /**
   * Converte modello in formato Firestore
   * @returns {Object} Oggetto pronto per Firestore
   */
  toFirestore() {
    return super.toFirestore();
  }
}

export default Tariffa;









