/**
 * ListePersonalizzate Model - Modello dati liste personalizzate
 * Gestisce liste predefinite e custom per tipi lavoro e colture
 * 
 * @module core/models/ListePersonalizzate
 */

import { Base } from './Base.js';

// Liste predefinite (non eliminabili)
const TIPI_LAVORO_PREDEFINITI = [
  'Potatura',
  'Raccolta',
  'Trattamento',
  'Semina',
  'Aratura',
  'Irrigazione',
  'Concimazione',
  'Diserbo',
  'Raccolta frutta',
  'Raccolta verdura'
];

const COLTURE_PREDEFINITE = [
  'Vite',
  'Frutteto',
  'Seminativo',
  'Orto',
  'Prato',
  'Olivo',
  'Agrumeto',
  'Bosco'
];

export class ListePersonalizzate extends Base {
  /**
   * Costruttore ListePersonalizzate
   * @param {Object} data - Dati liste
   * @param {string} data.id - ID documento (sempre 'personalizzate' per tenant)
   * @param {Array<string>} data.tipiLavoro - Array tipi lavoro (predefiniti + custom)
   * @param {Array<string>} data.colture - Array colture (predefinite + custom)
   */
  constructor(data = {}) {
    super(data);
    
    // Inizializza con predefiniti se non presenti
    this.tipiLavoro = data.tipiLavoro || [...TIPI_LAVORO_PREDEFINITI];
    this.colture = data.colture || [...COLTURE_PREDEFINITE];
    
    // Assicura che predefiniti siano sempre presenti
    this.ensurePredefiniti();
  }
  
  /**
   * Assicura che tutti i predefiniti siano presenti nelle liste
   */
  ensurePredefiniti() {
    // Aggiungi predefiniti mancanti per tipi lavoro
    TIPI_LAVORO_PREDEFINITI.forEach(predefinito => {
      if (!this.tipiLavoro.some(item => item.toLowerCase() === predefinito.toLowerCase())) {
        this.tipiLavoro.push(predefinito);
      }
    });
    
    // Aggiungi predefiniti mancanti per colture
    COLTURE_PREDEFINITE.forEach(predefinito => {
      if (!this.colture.some(item => item.toLowerCase() === predefinito.toLowerCase())) {
        this.colture.push(predefinito);
      }
    });
    
    // Ordina: prima predefiniti, poi custom
    this.tipiLavoro.sort((a, b) => {
      const aIsPredefinito = this.isPredefinitoTipoLavoro(a);
      const bIsPredefinito = this.isPredefinitoTipoLavoro(b);
      if (aIsPredefinito && !bIsPredefinito) return -1;
      if (!aIsPredefinito && bIsPredefinito) return 1;
      return a.localeCompare(b);
    });
    
    this.colture.sort((a, b) => {
      const aIsPredefinito = this.isPredefinitaColtura(a);
      const bIsPredefinito = this.isPredefinitaColtura(b);
      if (aIsPredefinito && !bIsPredefinito) return -1;
      if (!aIsPredefinito && bIsPredefinito) return 1;
      return a.localeCompare(b);
    });
  }
  
  /**
   * Verifica se un tipo lavoro è predefinito
   * @param {string} tipoLavoro - Nome tipo lavoro
   * @returns {boolean} true se è predefinito
   */
  isPredefinitoTipoLavoro(tipoLavoro) {
    return TIPI_LAVORO_PREDEFINITI.some(
      predefinito => predefinito.toLowerCase() === tipoLavoro.toLowerCase()
    );
  }
  
  /**
   * Verifica se una coltura è predefinita
   * @param {string} coltura - Nome coltura
   * @returns {boolean} true se è predefinita
   */
  isPredefinitaColtura(coltura) {
    return COLTURE_PREDEFINITE.some(
      predefinita => predefinita.toLowerCase() === coltura.toLowerCase()
    );
  }
  
  /**
   * Aggiunge un nuovo tipo lavoro (custom)
   * @param {string} tipoLavoro - Nome tipo lavoro
   * @returns {Object} { success: boolean, error: string|null }
   */
  addTipoLavoro(tipoLavoro) {
    if (!tipoLavoro || tipoLavoro.trim().length === 0) {
      return { success: false, error: 'Nome tipo lavoro obbligatorio' };
    }
    
    const nomeNormalizzato = tipoLavoro.trim();
    
    // Verifica duplicati (case-insensitive)
    if (this.tipiLavoro.some(item => item.toLowerCase() === nomeNormalizzato.toLowerCase())) {
      return { success: false, error: 'Tipo lavoro già presente' };
    }
    
    this.tipiLavoro.push(nomeNormalizzato);
    this.ensurePredefiniti(); // Riordina
    
    return { success: true, error: null };
  }
  
  /**
   * Rimuove un tipo lavoro (solo custom)
   * @param {string} tipoLavoro - Nome tipo lavoro
   * @returns {Object} { success: boolean, error: string|null }
   */
  removeTipoLavoro(tipoLavoro) {
    if (this.isPredefinitoTipoLavoro(tipoLavoro)) {
      return { success: false, error: 'Non è possibile eliminare un tipo lavoro predefinito' };
    }
    
    const index = this.tipiLavoro.findIndex(
      item => item.toLowerCase() === tipoLavoro.toLowerCase()
    );
    
    if (index === -1) {
      return { success: false, error: 'Tipo lavoro non trovato' };
    }
    
    this.tipiLavoro.splice(index, 1);
    
    return { success: true, error: null };
  }
  
  /**
   * Aggiunge una nuova coltura (custom)
   * @param {string} coltura - Nome coltura
   * @returns {Object} { success: boolean, error: string|null }
   */
  addColtura(coltura) {
    if (!coltura || coltura.trim().length === 0) {
      return { success: false, error: 'Nome coltura obbligatorio' };
    }
    
    const nomeNormalizzato = coltura.trim();
    
    // Verifica duplicati (case-insensitive)
    if (this.colture.some(item => item.toLowerCase() === nomeNormalizzato.toLowerCase())) {
      return { success: false, error: 'Coltura già presente' };
    }
    
    this.colture.push(nomeNormalizzato);
    this.ensurePredefiniti(); // Riordina
    
    return { success: true, error: null };
  }
  
  /**
   * Rimuove una coltura (solo custom)
   * @param {string} coltura - Nome coltura
   * @returns {Object} { success: boolean, error: string|null }
   */
  removeColtura(coltura) {
    if (this.isPredefinitaColtura(coltura)) {
      return { success: false, error: 'Non è possibile eliminare una coltura predefinita' };
    }
    
    const index = this.colture.findIndex(
      item => item.toLowerCase() === coltura.toLowerCase()
    );
    
    if (index === -1) {
      return { success: false, error: 'Coltura non trovata' };
    }
    
    this.colture.splice(index, 1);
    
    return { success: true, error: null };
  }
  
  /**
   * Valida dati liste
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!Array.isArray(this.tipiLavoro)) {
      errors.push('tipiLavoro deve essere un array');
    }
    
    if (!Array.isArray(this.colture)) {
      errors.push('colture deve essere un array');
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
    
    // Assicura predefiniti prima di salvare
    this.ensurePredefiniti();
    
    return data;
  }
  
  /**
   * Ottiene solo i tipi lavoro custom
   * @returns {Array<string>} Array tipi lavoro custom
   */
  getTipiLavoroCustom() {
    return this.tipiLavoro.filter(item => !this.isPredefinitoTipoLavoro(item));
  }
  
  /**
   * Ottiene solo le colture custom
   * @returns {Array<string>} Array colture custom
   */
  getColtureCustom() {
    return this.colture.filter(item => !this.isPredefinitaColtura(item));
  }
}

// Export costanti per uso esterno
export { TIPI_LAVORO_PREDEFINITI, COLTURE_PREDEFINITE };

export default ListePersonalizzate;

