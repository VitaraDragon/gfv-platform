/**
 * Categoria Attrezzo Model - Modello dati categoria funzionale attrezzi
 * Gestisce categorie per organizzare attrezzi per funzione
 * 
 * @module modules/parco-macchine/models/CategoriaAttrezzo
 */

import { Base } from '../../../core/models/Base.js';

export class CategoriaAttrezzo extends Base {
  /**
   * Costruttore CategoriaAttrezzo
   * @param {Object} data - Dati categoria
   * @param {string} data.id - ID categoria
   * @param {string} data.nome - Nome categoria (es. "Lavorazione del Terreno") - obbligatorio
   * @param {string} data.codice - Codice univoco categoria (es. "lavorazione_terreno") - obbligatorio
   * @param {string} data.descrizione - Descrizione categoria - opzionale
   * @param {boolean} data.predefinita - Se true, categoria predefinita del sistema - default: false
   * @param {string} data.creatoDa - ID utente che ha creato la categoria
   * @param {Date|Timestamp} data.creatoIl - Data creazione
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.codice = data.codice || '';
    this.descrizione = data.descrizione || null;
    this.predefinita = data.predefinita !== undefined ? Boolean(data.predefinita) : false;
    this.creatoDa = data.creatoDa || null;
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati categoria
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome categoria obbligatorio');
    }
    
    if (this.nome && this.nome.trim().length < 3) {
      errors.push('Nome categoria deve essere di almeno 3 caratteri');
    }
    
    if (this.nome && this.nome.trim().length > 100) {
      errors.push('Nome categoria non può superare 100 caratteri');
    }
    
    if (!this.codice || this.codice.trim().length === 0) {
      errors.push('Codice categoria obbligatorio');
    }
    
    // Validazione formato codice (solo lettere, numeri, underscore)
    if (this.codice && !/^[a-z0-9_]+$/.test(this.codice.toLowerCase())) {
      errors.push('Codice categoria può contenere solo lettere minuscole, numeri e underscore');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Genera codice univoco dal nome (se non fornito)
   * @returns {string} Codice generato
   */
  generateCodice() {
    if (this.codice) {
      return this.codice;
    }
    
    return this.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Rimuovi accenti
      .replace(/[^a-z0-9]+/g, '_') // Sostituisci caratteri speciali con underscore
      .replace(/^_+|_+$/g, ''); // Rimuovi underscore iniziali/finali
  }
}

export default CategoriaAttrezzo;






