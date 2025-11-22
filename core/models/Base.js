/**
 * Base Model - Classe base per tutti i modelli dati
 * Fornisce funzionalità comuni: conversione Firestore, validazione, timestamp
 * 
 * @module core/models/Base
 */

import { timestampToDate, dateToTimestamp } from '../services/firebase-service.js';

export class Base {
  /**
   * Costruttore base
   * @param {Object} data - Dati del modello
   * @param {string} data.id - ID del documento
   * @param {Date|Timestamp} data.createdAt - Data creazione
   * @param {Date|Timestamp} data.updatedAt - Data ultimo aggiornamento
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.createdAt = data.createdAt ? timestampToDate(data.createdAt) : null;
    this.updatedAt = data.updatedAt ? timestampToDate(data.updatedAt) : null;
  }
  
  /**
   * Crea istanza da documento Firestore
   * @param {DocumentSnapshot} doc - Documento Firestore
   * @returns {Base} Istanza del modello
   */
  static fromFirestore(doc) {
    if (!doc.exists()) {
      return null;
    }
    
    return new this({
      id: doc.id,
      ...doc.data()
    });
  }
  
  /**
   * Crea istanza da oggetto dati
   * @param {Object} data - Dati del modello
   * @returns {Base} Istanza del modello
   */
  static fromData(data) {
    return new this(data);
  }
  
  /**
   * Converte modello in formato Firestore
   * @returns {Object} Oggetto pronto per Firestore
   */
  toFirestore() {
    const data = { ...this };
    
    // Rimuovi id (non va nel documento)
    delete data.id;
    
    // Converti Date in Timestamp
    if (data.createdAt instanceof Date) {
      data.createdAt = dateToTimestamp(data.createdAt);
    }
    if (data.updatedAt instanceof Date) {
      data.updatedAt = dateToTimestamp(data.updatedAt);
    }
    
    // Rimuovi campi undefined
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    
    return data;
  }
  
  /**
   * Valida i dati del modello
   * Da implementare nelle classi derivate
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    // Validazione base: nessuna per ora
    // Le classi derivate possono aggiungere validazioni specifiche
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Converte modello in JSON
   * @returns {Object} Oggetto JSON
   */
  toJSON() {
    const data = { ...this };
    
    // Converti Date in stringhe ISO
    if (data.createdAt instanceof Date) {
      data.createdAt = data.createdAt.toISOString();
    }
    if (data.updatedAt instanceof Date) {
      data.updatedAt = data.updatedAt.toISOString();
    }
    
    return data;
  }
  
  /**
   * Clona il modello
   * @returns {Base} Nuova istanza clonata
   */
  clone() {
    return new this.constructor(this.toJSON());
  }
  
  /**
   * Aggiorna il modello con nuovi dati
   * @param {Object} updates - Dati da aggiornare
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
      if (this.hasOwnProperty(key) || key === 'id') {
        this[key] = updates[key];
      }
    });
    this.updatedAt = new Date();
  }
}

export default Base;






