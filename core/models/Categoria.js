/**
 * Categoria Model - Modello dati categoria unificata
 * Gestisce categorie gerarchiche per organizzare attrezzi e lavori
 * 
 * @module core/models/Categoria
 */

import { Base } from './Base.js';

export class Categoria extends Base {
  /**
   * Costruttore Categoria
   * @param {Object} data - Dati categoria
   * @param {string} data.id - ID categoria
   * @param {string} data.nome - Nome categoria (es. "Lavorazione del Terreno") - obbligatorio
   * @param {string} data.codice - Codice univoco categoria (es. "lavorazione_terreno") - obbligatorio
   * @param {string} data.descrizione - Descrizione categoria - opzionale
   * @param {string} data.parentId - ID categoria padre (null per categorie principali) - opzionale
   * @param {string} data.applicabileA - Applicabile a: 'attrezzi' | 'lavori' | 'entrambi' - default: 'entrambi'
   * @param {boolean} data.predefinita - Se true, categoria predefinita del sistema - default: false
   * @param {number} data.ordine - Ordine di visualizzazione - opzionale
   * @param {string} data.creatoDa - ID utente che ha creato la categoria
   * @param {Date|Timestamp} data.creatoIl - Data creazione
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.codice = data.codice || '';
    this.descrizione = data.descrizione || null;
    this.parentId = data.parentId || null;
    this.applicabileA = data.applicabileA || 'entrambi'; // 'attrezzi' | 'lavori' | 'entrambi'
    this.predefinita = data.predefinita !== undefined ? Boolean(data.predefinita) : false;
    this.ordine = data.ordine !== undefined ? Number(data.ordine) : null;
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
    
    // Validazione applicabileA
    const applicabiliValidi = ['attrezzi', 'lavori', 'entrambi'];
    if (this.applicabileA && !applicabiliValidi.includes(this.applicabileA)) {
      errors.push(`applicabileA deve essere uno di: ${applicabiliValidi.join(', ')}`);
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
  
  /**
   * Verifica se categoria è applicabile a attrezzi
   * @returns {boolean}
   */
  isApplicabileAdAttrezzi() {
    return this.applicabileA === 'attrezzi' || this.applicabileA === 'entrambi';
  }
  
  /**
   * Verifica se categoria è applicabile a lavori
   * @returns {boolean}
   */
  isApplicabileALavori() {
    return this.applicabileA === 'lavori' || this.applicabileA === 'entrambi';
  }
  
  /**
   * Verifica se categoria è principale (non ha parent)
   * @returns {boolean}
   */
  isPrincipale() {
    return !this.parentId;
  }
  
  /**
   * Verifica se categoria è sottocategoria
   * @returns {boolean}
   */
  isSottocategoria() {
    return !!this.parentId;
  }
}

export default Categoria;

