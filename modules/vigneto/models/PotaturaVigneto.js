/**
 * PotaturaVigneto Model - Modello dati potatura vigneto
 * Gestisce registrazione potature con calcolo costi
 * 
 * @module modules/vigneto/models/PotaturaVigneto
 */

import { Base } from '../../../core/models/Base.js';

export class PotaturaVigneto extends Base {
  /**
   * Costruttore PotaturaVigneto
   * @param {Object} data - Dati potatura
   * @param {string} data.id - ID potatura
   * @param {string} data.vignetoId - Riferimento vigneto (obbligatorio)
   * @param {Date|Timestamp} data.data - Data potatura (obbligatorio)
   * @param {string} data.tipo - Tipo potatura: "invernale" | "verde" | "rinnovo" | "spollonatura" (obbligatorio)
   * @param {string} data.parcella - Parcella/blocco potato (opzionale)
   * @param {number} data.ceppiPotati - Numero ceppi potati (obbligatorio)
   * @param {Array<string>} data.operai - Array ID operai coinvolti (obbligatorio)
   * @param {number} data.oreImpiegate - Ore totali impiegate (obbligatorio)
   * @param {number} data.costoManodopera - Costo manodopera in € (calcolato)
   * @param {string} data.macchinaId - ID macchina utilizzata (opzionale)
   * @param {number} data.costoMacchina - Costo macchina in € (calcolato)
   * @param {number} data.costoTotale - Costo totale in € (calcolato)
   * @param {string} data.note - Note (opzionale)
   */
  constructor(data = {}) {
    super(data);
    
    // Dati base (obbligatori)
    this.vignetoId = data.vignetoId || null;
    this.data = data.data || null;
    this.tipo = data.tipo || '';
    this.parcella = data.parcella || null;
    this.ceppiPotati = data.ceppiPotati !== undefined ? parseInt(data.ceppiPotati) : null;
    
    // Operazioni
    this.operai = Array.isArray(data.operai) ? data.operai : [];
    this.oreImpiegate = data.oreImpiegate !== undefined ? parseFloat(data.oreImpiegate) : null;
    
    // Costi (calcolati)
    this.costoManodopera = data.costoManodopera !== undefined ? parseFloat(data.costoManodopera) : 0;
    this.macchinaId = data.macchinaId || null;
    this.costoMacchina = data.costoMacchina !== undefined ? parseFloat(data.costoMacchina) : 0;
    this.costoTotale = data.costoTotale !== undefined ? parseFloat(data.costoTotale) : 0;
    
    // Note
    this.note = data.note || '';
  }
  
  /**
   * Valida dati potatura
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.vignetoId || this.vignetoId.trim().length === 0) {
      errors.push('Vigneto obbligatorio');
    }
    
    if (!this.data) {
      errors.push('Data potatura obbligatoria');
    }
    
    if (!this.tipo || this.tipo.trim().length === 0) {
      errors.push('Tipo potatura obbligatorio');
    } else {
      const tipiValidi = ['invernale', 'verde', 'rinnovo', 'spollonatura'];
      if (!tipiValidi.includes(this.tipo)) {
        errors.push(`Tipo potatura deve essere uno tra: ${tipiValidi.join(', ')}`);
      }
    }
    
    if (this.ceppiPotati === null || this.ceppiPotati <= 0) {
      errors.push('Numero ceppi potati obbligatorio e maggiore di zero');
    }
    
    if (!this.operai || this.operai.length === 0) {
      errors.push('Almeno un operaio coinvolto obbligatorio');
    }
    
    if (this.oreImpiegate === null || this.oreImpiegate <= 0) {
      errors.push('Ore impiegate obbligatorie e maggiori di zero');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calcola costo totale
   * @returns {number} Costo totale in €
   */
  calcolaCostoTotale() {
    return this.costoManodopera + this.costoMacchina;
  }
  
  /**
   * Aggiorna calcoli automatici
   */
  aggiornaCalcoli() {
    this.costoTotale = this.calcolaCostoTotale();
  }
  
  /**
   * Ottieni tipo potatura formattato
   * @returns {string} Tipo formattato
   */
  getTipoFormattato() {
    const tipiFormattati = {
      'invernale': '❄️ Potatura Invernale',
      'verde': '🌿 Potatura Verde',
      'rinnovo': '🔄 Potatura di Rinnovo',
      'spollonatura': '✂️ Spollonatura'
    };
    return tipiFormattati[this.tipo] || this.tipo;
  }
}

export default PotaturaVigneto;
