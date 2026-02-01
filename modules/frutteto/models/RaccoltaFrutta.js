/**
 * RaccoltaFrutta Model - Modello dati raccolta frutta
 * Gestisce registrazione raccolta frutta con qualità e calcolo costi
 * 
 * @module modules/frutteto/models/RaccoltaFrutta
 */

import { Base } from '../../../core/models/Base.js';

export class RaccoltaFrutta extends Base {
  /**
   * Costruttore RaccoltaFrutta
   * @param {Object} data - Dati raccolta
   * @param {string} data.id - ID raccolta
   * @param {string} data.fruttetoId - Riferimento frutteto (obbligatorio)
   * @param {string} data.lavoroId - Riferimento lavoro (opzionale, se raccolta creata da lavoro)
   * @param {Date|Timestamp} data.data - Data raccolta (obbligatorio)
   * @param {string} data.specie - Specie fruttifera (obbligatorio)
   * @param {string} data.varieta - Varietà raccolta (obbligatorio)
   * @param {number} data.quantitaKg - Quantità raccolta in kg con 2 decimali (obbligatorio)
   * @param {number} data.quantitaEttari - Superficie raccolta in ettari (obbligatorio)
   * @param {number} data.resaKgHa - Resa in kg/ettaro (calcolato automaticamente)
   * @param {string} data.calibro - Calibro frutta (opzionale)
   * @param {string} data.gradoMaturazione - Grado maturazione (opzionale)
   * @param {string} data.colore - Colore frutta (opzionale)
   * @param {number} data.scartoTotaleKg - Scarto totale kg (opzionale)
   * @param {Object} data.scartoPerCategoria - Scarto per categoria kg, es. { dannoFisico, calibroFuoriNorma, marciume, maturazioneNonIdonea, altro } (opzionale)
   * @param {Array<string>|Array<Object>} data.operai - Array ID operai o oggetti {data, nome, ore} (obbligatorio)
   * @param {Array<string>} data.macchine - Array ID macchine utilizzate (opzionale)
   * @param {number} data.oreImpiegate - Ore totali impiegate (opzionale)
   * @param {number} data.costoManodopera - Costo manodopera in € (calcolato)
   * @param {number} data.costoMacchine - Costo macchine in € (calcolato)
   * @param {number} data.costoTotale - Costo totale in € (calcolato)
   * @param {number} data.prezzoVendita - Prezzo vendita €/kg (opzionale, non mostrato in UI)
   * @param {number} data.ricavo - Ricavo totale in € (calcolato, non mostrato in UI)
   * @param {Array<Object>} data.poligonoRaccolta - Coordinate poligono area raccolta (opzionale), come Vendemmia
   * @param {string} data.note - Note (opzionale)
   */
  constructor(data = {}) {
    super(data);
    
    // Dati base (obbligatori)
    this.fruttetoId = data.fruttetoId || null;
    this.lavoroId = data.lavoroId || null;
    this.attivitaId = data.attivitaId || null;
    this.data = data.data || null;
    this.specie = data.specie || '';
    this.varieta = data.varieta || '';
    this.quantitaKg = data.quantitaKg !== undefined ? parseFloat(data.quantitaKg) : null;
    this.quantitaEttari = data.quantitaEttari !== undefined ? parseFloat(data.quantitaEttari) : null;
    this.resaKgHa = data.resaKgHa !== undefined ? parseFloat(data.resaKgHa) : null;
    
    // Qualità frutta (opzionale)
    this.calibro = data.calibro || null;
    this.gradoMaturazione = data.gradoMaturazione || null;
    this.colore = data.colore || null;

    // Scarto (opzionale): totale e per categoria (kg)
    this.scartoTotaleKg = data.scartoTotaleKg !== undefined ? parseFloat(data.scartoTotaleKg) : null;
    this.scartoPerCategoria = data.scartoPerCategoria && typeof data.scartoPerCategoria === 'object'
      ? { ...data.scartoPerCategoria }
      : null;

    // Operazioni
    // operai può essere:
    // - Array di ID (quando modulo manodopera attivo o raccolta collegata a lavoro)
    // - Array di oggetti {data, nome, ore} (quando modulo manodopera non attivo e raccolta non collegata a lavoro)
    this.operai = Array.isArray(data.operai) ? data.operai : [];
    this.macchine = Array.isArray(data.macchine) ? data.macchine : [];
    this.oreImpiegate = data.oreImpiegate !== undefined ? parseFloat(data.oreImpiegate) : null;
    
    // Costi (calcolati)
    this.costoManodopera = data.costoManodopera !== undefined ? parseFloat(data.costoManodopera) : 0;
    this.costoMacchine = data.costoMacchine !== undefined ? parseFloat(data.costoMacchine) : 0;
    this.costoTotale = data.costoTotale !== undefined ? parseFloat(data.costoTotale) : 0;
    
    // Ricavi
    this.prezzoVendita = data.prezzoVendita !== undefined ? parseFloat(data.prezzoVendita) : null;
    this.ricavo = data.ricavo !== undefined ? parseFloat(data.ricavo) : 0;
    
    // Note
    this.note = data.note || '';

    // Poligono area raccolta (opzionale), come poligonoVendemmiato in Vendemmia
    this.poligonoRaccolta = Array.isArray(data.poligonoRaccolta) ? data.poligonoRaccolta : null;
  }
  
  /**
   * Valida dati raccolta frutta
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.fruttetoId || String(this.fruttetoId).trim().length === 0) {
      errors.push('Frutteto obbligatorio');
    }
    
    if (!this.data) {
      errors.push('Data raccolta obbligatoria');
    }
    
    if (!this.specie || String(this.specie).trim().length === 0) {
      errors.push('Specie fruttifera obbligatoria');
    }
    
    if (!this.varieta || String(this.varieta).trim().length === 0) {
      errors.push('Varietà obbligatoria');
    }
    
    // Quantità e superficie obbligatorie solo se raccolta non collegata ad attività/lavoro (da completare in Gestione Raccolta)
    const daCompletare = this.attivitaId || this.lavoroId;
    if (!daCompletare) {
      if (this.quantitaKg === null || this.quantitaKg <= 0) {
        errors.push('Quantità raccolta obbligatoria e maggiore di zero');
      }
      if (this.quantitaEttari === null || this.quantitaEttari <= 0) {
        errors.push('Superficie raccolta obbligatoria e maggiore di zero');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Verifica se la raccolta è completa (quantità, superficie, specie e varietà valorizzate)
   * @returns {boolean} true se completa
   */
  isCompleta() {
    return (
      this.quantitaKg != null &&
      this.quantitaKg > 0 &&
      this.quantitaEttari != null &&
      this.quantitaEttari > 0 &&
      this.specie != null &&
      String(this.specie).trim().length > 0 &&
      this.varieta != null &&
      String(this.varieta).trim().length > 0
    );
  }

  /**
   * Calcola resa in kg/ettaro
   */
  calcolaResaKgHa() {
    if (!this.quantitaEttari || this.quantitaEttari <= 0) {
      return 0;
    }
    return this.quantitaKg / this.quantitaEttari;
  }
  
  /**
   * Calcola ricavo totale
   */
  calcolaRicavo() {
    if (!this.prezzoVendita || !this.quantitaKg) {
      return 0;
    }
    return this.prezzoVendita * this.quantitaKg;
  }
  
  /**
   * Aggiorna campi calcolati
   */
  aggiornaCalcoli() {
    this.resaKgHa = this.calcolaResaKgHa();
    this.ricavo = this.calcolaRicavo();
    this.costoTotale = (this.costoManodopera || 0) + (this.costoMacchine || 0);
  }
}

export default RaccoltaFrutta;
