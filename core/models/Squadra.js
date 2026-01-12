/**
 * Squadra Model - Modello dati squadra
 * Gestisce dati squadra con caposquadra e operai
 * 
 * @module core/models/Squadra
 */

import { Base } from './Base.js';

export class Squadra extends Base {
  /**
   * Costruttore Squadra
   * @param {Object} data - Dati squadra
   * @param {string} data.id - ID squadra
   * @param {string} data.nome - Nome squadra (obbligatorio)
   * @param {string} data.caposquadraId - ID caposquadra (obbligatorio)
   * @param {Array<string>} data.operai - Array di ID operai (opzionale)
   * @param {string} data.note - Note opzionali
   * @param {string} data.creatoDa - ID utente che ha creato la squadra
   * @param {Date|Timestamp} data.creatoIl - Data creazione (alias createdAt)
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento (alias updatedAt)
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.caposquadraId = data.caposquadraId || null;
    this.operai = Array.isArray(data.operai) ? data.operai : [];
    this.note = data.note || '';
    this.creatoDa = data.creatoDa || null;
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati squadra
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome squadra obbligatorio');
    }
    
    if (this.nome && this.nome.trim().length < 3) {
      errors.push('Nome squadra deve essere di almeno 3 caratteri');
    }
    
    if (this.nome && this.nome.trim().length > 50) {
      errors.push('Nome squadra non può superare 50 caratteri');
    }
    
    if (!this.caposquadraId) {
      errors.push('Caposquadra obbligatorio');
    }
    
    if (!Array.isArray(this.operai)) {
      errors.push('Operai deve essere un array');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Ottieni numero operai nella squadra
   * @returns {number} Numero operai
   */
  getNumeroOperai() {
    return this.operai ? this.operai.length : 0;
  }
  
  /**
   * Verifica se un operaio è nella squadra
   * @param {string} operaioId - ID operaio
   * @returns {boolean} true se operaio è nella squadra
   */
  hasOperaio(operaioId) {
    return this.operai && this.operai.includes(operaioId);
  }
  
  /**
   * Aggiungi operaio alla squadra
   * @param {string} operaioId - ID operaio
   */
  addOperaio(operaioId) {
    if (!this.operai) {
      this.operai = [];
    }
    if (!this.hasOperaio(operaioId)) {
      this.operai.push(operaioId);
    }
  }
  
  /**
   * Rimuovi operaio dalla squadra
   * @param {string} operaioId - ID operaio
   */
  removeOperaio(operaioId) {
    if (this.operai) {
      this.operai = this.operai.filter(id => id !== operaioId);
    }
  }
  
  /**
   * Converte modello in formato Firestore
   * @returns {Object} Oggetto pronto per Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    
    // Assicurati che operai sia sempre un array
    if (!Array.isArray(data.operai)) {
      data.operai = [];
    }
    
    return data;
  }
}

export default Squadra;

