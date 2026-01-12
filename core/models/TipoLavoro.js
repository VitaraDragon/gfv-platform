/**
 * Tipo Lavoro Model - Modello dati tipo lavoro specifico
 * Gestisce tipi lavoro organizzati per categoria
 * 
 * @module core/models/TipoLavoro
 */

import { Base } from './Base.js';

export class TipoLavoro extends Base {
  /**
   * Costruttore TipoLavoro
   * @param {Object} data - Dati tipo lavoro
   * @param {string} data.id - ID tipo lavoro
   * @param {string} data.nome - Nome tipo lavoro (es. "Aratura") - obbligatorio
   * @param {string} data.categoriaId - ID categoria lavoro (obbligatorio)
   * @param {string} data.sottocategoriaId - ID sottocategoria lavoro (opzionale)
   * @param {string} data.descrizione - Descrizione tipo lavoro - opzionale
   * @param {boolean} data.predefinito - Se true, tipo predefinito del sistema - default: false
   * @param {string} data.creatoDa - ID utente che ha creato il tipo
   * @param {Date|Timestamp} data.creatoIl - Data creazione
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.categoriaId = data.categoriaId || null;
    this.sottocategoriaId = data.sottocategoriaId || null;
    this.descrizione = data.descrizione || null;
    this.predefinito = data.predefinito !== undefined ? Boolean(data.predefinito) : false;
    this.creatoDa = data.creatoDa || null;
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati tipo lavoro
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome tipo lavoro obbligatorio');
    }
    
    if (this.nome && this.nome.trim().length < 2) {
      errors.push('Nome tipo lavoro deve essere di almeno 2 caratteri');
    }
    
    if (this.nome && this.nome.trim().length > 100) {
      errors.push('Nome tipo lavoro non può superare 100 caratteri');
    }
    
    if (!this.categoriaId || this.categoriaId.trim().length === 0) {
      errors.push('Categoria lavoro obbligatoria');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default TipoLavoro;

