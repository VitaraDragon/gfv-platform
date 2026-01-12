/**
 * Coltura Model - Modello dati coltura
 * Gestisce colture organizzate per categoria (struttura gerarchica)
 * 
 * @module core/models/Coltura
 */

import { Base } from './Base.js';

export class Coltura extends Base {
  /**
   * Costruttore Coltura
   * @param {Object} data - Dati coltura
   * @param {string} data.id - ID coltura
   * @param {string} data.nome - Nome coltura (es. "Pesco") - obbligatorio
   * @param {string} data.categoriaId - ID categoria coltura (es. categoria "Frutteto") - obbligatorio
   * @param {string} data.descrizione - Descrizione coltura - opzionale
   * @param {boolean} data.predefinito - Se true, coltura predefinita del sistema - default: false
   * @param {string} data.creatoDa - ID utente che ha creato la coltura
   * @param {Date|Timestamp} data.creatoIl - Data creazione
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.categoriaId = data.categoriaId || null;
    this.descrizione = data.descrizione || null;
    this.predefinito = data.predefinito !== undefined ? Boolean(data.predefinito) : false;
    this.creatoDa = data.creatoDa || null;
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati coltura
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome coltura obbligatorio');
    }
    
    if (this.nome && this.nome.trim().length < 2) {
      errors.push('Nome coltura deve essere di almeno 2 caratteri');
    }
    
    if (this.nome && this.nome.trim().length > 100) {
      errors.push('Nome coltura non può superare 100 caratteri');
    }
    
    if (!this.categoriaId || this.categoriaId.trim().length === 0) {
      errors.push('Categoria coltura obbligatoria');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default Coltura;




