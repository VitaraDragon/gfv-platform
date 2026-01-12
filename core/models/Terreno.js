/**
 * Terreno Model - Modello dati terreno
 * Gestisce dati terreno con coordinate e poligono mappa opzionale
 * 
 * @module core/models/Terreno
 */

import { Base } from './Base.js';

export class Terreno extends Base {
  /**
   * Costruttore Terreno
   * @param {Object} data - Dati terreno
   * @param {string} data.id - ID terreno
   * @param {string} data.nome - Nome terreno (obbligatorio)
   * @param {number} data.superficie - Superficie in ettari (opzionale)
   * @param {Object} data.coordinate - Coordinate punto centrale {lat, lng} (opzionale)
   * @param {Array} data.polygonCoords - Coordinate poligono mappa (opzionale)
   * @param {string} data.note - Note opzionali
   * @param {string} data.podere - Nome del podere (opzionale)
   * @param {string} data.coltura - Nome della coltura (opzionale)
   * @param {string} data.tipoPossesso - Tipo possesso: "proprieta" | "affitto" (default: "proprieta")
   * @param {Date|Timestamp} data.dataScadenzaAffitto - Data scadenza affitto (opzionale, solo se tipoPossesso === "affitto")
   * @param {number} data.canoneAffitto - Canone mensile affitto in euro (opzionale)
   * @param {string} data.tipoCampo - Morfologia terreno: "pianura" | "collina" | "montagna" (opzionale, per conto terzi)
   * @param {Date|Timestamp} data.creatoIl - Data creazione (alias createdAt)
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento (alias updatedAt)
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.superficie = data.superficie !== undefined ? parseFloat(data.superficie) : null;
    this.coordinate = data.coordinate || null;
    this.polygonCoords = data.polygonCoords || null;
    this.note = data.note || '';
    this.podere = data.podere || null;
    this.coltura = data.coltura || null;
    this.tipoPossesso = data.tipoPossesso || 'proprieta';
    this.dataScadenzaAffitto = data.dataScadenzaAffitto || null;
    this.canoneAffitto = data.canoneAffitto !== undefined ? parseFloat(data.canoneAffitto) : null;
    
    // Campo Conto Terzi (opzionale)
    this.clienteId = data.clienteId || null;  // Se presente → terreno cliente
    this.tipoCampo = data.tipoCampo || null;  // Morfologia: pianura, collina, montagna
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati terreno
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome terreno obbligatorio');
    }
    
    if (this.superficie !== null && this.superficie < 0) {
      errors.push('Superficie non può essere negativa');
    }
    
    if (this.coordinate) {
      if (typeof this.coordinate.lat !== 'number' || typeof this.coordinate.lng !== 'number') {
        errors.push('Coordinate devono essere oggetti con lat e lng numerici');
      }
    }
    
    // Validazione tipo possesso
    if (this.tipoPossesso !== 'proprieta' && this.tipoPossesso !== 'affitto') {
      errors.push('Tipo possesso deve essere "proprieta" o "affitto"');
    }
    
    // Se è in affitto, data scadenza è obbligatoria
    if (this.tipoPossesso === 'affitto' && !this.dataScadenzaAffitto) {
      errors.push('Data scadenza affitto obbligatoria per terreni in affitto');
    }
    
    // Validazione canone affitto
    if (this.canoneAffitto !== null && this.canoneAffitto < 0) {
      errors.push('Canone affitto non può essere negativo');
    }
    
    // Validazione tipoCampo (se presente)
    if (this.tipoCampo !== null && this.tipoCampo !== undefined) {
      const tipiValidi = ['pianura', 'collina', 'montagna'];
      if (!tipiValidi.includes(this.tipoCampo)) {
        errors.push('Tipo campo deve essere uno tra: pianura, collina, montagna');
      }
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
    
    // Rimuovi alias se presenti
    delete data.creatoIl;
    delete data.aggiornatoIl;
    
    return data;
  }
  
  /**
   * Aggiorna superficie da calcolo poligono
   * @param {number} superficieEttari - Superficie calcolata in ettari
   */
  setSuperficieDaMappa(superficieEttari) {
    if (superficieEttari > 0) {
      this.superficie = superficieEttari;
    }
  }
  
  /**
   * Imposta coordinate poligono
   * @param {Array} coords - Array di coordinate [{lat, lng}, ...]
   */
  setPolygonCoords(coords) {
    if (Array.isArray(coords) && coords.length > 0) {
      this.polygonCoords = coords;
    }
  }
  
  /**
   * Imposta coordinate punto centrale
   * @param {number} lat - Latitudine
   * @param {number} lng - Longitudine
   */
  setCoordinate(lat, lng) {
    this.coordinate = { lat, lng };
  }
  
  /**
   * Verifica se terreno ha mappa tracciata
   * @returns {boolean} true se ha poligono tracciato
   */
  hasMappa() {
    if (!this.polygonCoords || !Array.isArray(this.polygonCoords)) {
      return false;
    }
    return this.polygonCoords.length > 0;
  }
  
  /**
   * Verifica se terreno è di un cliente (conto terzi)
   * @returns {boolean} true se terreno è di un cliente
   */
  isContoTerzi() {
    return !!this.clienteId;
  }
}

export default Terreno;

