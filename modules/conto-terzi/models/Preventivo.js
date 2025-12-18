/**
 * Preventivo Model - Modello dati preventivo (conto terzi)
 * Gestisce preventivi per lavori conto terzi
 * 
 * @module modules/conto-terzi/models/Preventivo
 */

import { Base } from '../../../core/models/Base.js';
import { dateToTimestamp, timestampToDate } from '../../../core/services/firebase-service.js';

export class Preventivo extends Base {
  /**
   * Costruttore Preventivo
   * @param {Object} data - Dati preventivo
   * @param {string} data.id - ID preventivo
   * @param {string} data.numero - Numero preventivo (es. PREV-2025-001)
   * @param {string} data.clienteId - ID cliente (obbligatorio)
   * @param {string} data.terrenoId - ID terreno (opzionale, può essere nuovo)
   * @param {string} data.tipoLavoro - Tipo lavoro (obbligatorio)
   * @param {string} data.coltura - Coltura (obbligatorio)
   * @param {string} data.tipoCampo - Tipo campo: "pianura" | "collina" | "montagna" (obbligatorio)
   * @param {number} data.superficie - Superficie in ettari (obbligatorio)
   * @param {string} data.macchinaId - ID macchina (opzionale)
   * @param {Date|Timestamp} data.dataPrevista - Data prevista lavoro (opzionale)
   * @param {string} data.stato - Stato: "bozza" | "inviato" | "accettato_email" | "accettato_manager" | "rifiutato" | "scaduto" | "pianificato" | "annullato"
   * @param {number} data.totale - Totale preventivo (calcolato automaticamente)
   * @param {number} data.iva - IVA in percentuale (configurabile, default: 22)
   * @param {number} data.totaleConIva - Totale con IVA (calcolato automaticamente)
   * @param {string} data.note - Note preventivo
   * @param {string} data.tokenAccettazione - Token per link accettazione email
   * @param {Date|Timestamp} data.dataInvio - Data invio email
   * @param {Date|Timestamp} data.dataScadenza - Data scadenza preventivo (default: +30 giorni)
   * @param {Date|Timestamp} data.dataAccettazione - Data accettazione
   * @param {number} data.giorniScadenza - Giorni scadenza (default: 30, configurabile)
   * @param {string} data.lavoroId - ID lavoro creato da questo preventivo (se pianificato)
   */
  constructor(data = {}) {
    super(data);
    
    this.numero = data.numero || null;
    this.clienteId = data.clienteId || null;
    this.terrenoId = data.terrenoId || null;
    this.tipoLavoro = data.tipoLavoro || '';
    this.coltura = data.coltura || '';
    this.tipoCampo = data.tipoCampo || 'pianura';
    this.superficie = data.superficie !== undefined ? parseFloat(data.superficie) : 0;
    this.macchinaId = data.macchinaId || null;
    this.dataPrevista = data.dataPrevista ? timestampToDate(data.dataPrevista) : null;
    this.stato = data.stato || 'bozza';
    this.totale = data.totale !== undefined ? parseFloat(data.totale) : 0;
    this.iva = data.iva !== undefined ? parseFloat(data.iva) : 22; // Default 22%
    this.totaleConIva = data.totaleConIva !== undefined ? parseFloat(data.totaleConIva) : 0;
    this.note = data.note || '';
    this.tokenAccettazione = data.tokenAccettazione || null;
    this.dataInvio = data.dataInvio ? timestampToDate(data.dataInvio) : null;
    this.dataScadenza = data.dataScadenza ? timestampToDate(data.dataScadenza) : null;
    this.dataAccettazione = data.dataAccettazione ? timestampToDate(data.dataAccettazione) : null;
    this.giorniScadenza = data.giorniScadenza !== undefined ? parseInt(data.giorniScadenza) : 30;
    this.lavoroId = data.lavoroId || null;
  }
  
  /**
   * Valida dati preventivo
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.clienteId) {
      errors.push('Cliente obbligatorio');
    }
    
    if (!this.tipoLavoro || this.tipoLavoro.trim().length === 0) {
      errors.push('Tipo lavoro obbligatorio');
    }
    
    if (!this.coltura || this.coltura.trim().length === 0) {
      errors.push('Coltura obbligatoria');
    }
    
    const tipiCampoValidi = ['pianura', 'collina', 'montagna'];
    if (!tipiCampoValidi.includes(this.tipoCampo)) {
      errors.push(`Tipo campo non valido. Valori validi: ${tipiCampoValidi.join(', ')}`);
    }
    
    if (!this.superficie || this.superficie <= 0) {
      errors.push('Superficie obbligatoria e deve essere maggiore di 0');
    }
    
    const statiValidi = ['bozza', 'inviato', 'accettato_email', 'accettato_manager', 'rifiutato', 'scaduto', 'pianificato', 'annullato'];
    if (this.stato && !statiValidi.includes(this.stato)) {
      errors.push(`Stato non valido. Stati validi: ${statiValidi.join(', ')}`);
    }
    
    if (this.iva < 0 || this.iva > 100) {
      errors.push('IVA deve essere tra 0 e 100');
    }
    
    if (this.giorniScadenza < 1) {
      errors.push('Giorni scadenza deve essere almeno 1');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Calcola totale con IVA
   */
  calcolaTotaleConIva() {
    this.totaleConIva = this.totale * (1 + this.iva / 100);
    return this.totaleConIva;
  }
  
  /**
   * Verifica se preventivo è scaduto
   * @returns {boolean}
   */
  isScaduto() {
    if (!this.dataScadenza) return false;
    return new Date() > this.dataScadenza;
  }
  
  /**
   * Verifica se preventivo può essere accettato
   * @returns {boolean}
   */
  canBeAccepted() {
    return ['inviato', 'bozza'].includes(this.stato) && !this.isScaduto();
  }
  
  /**
   * Verifica se preventivo può essere pianificato
   * @returns {boolean}
   */
  canBePlanned() {
    return ['accettato_email', 'accettato_manager'].includes(this.stato);
  }
  
  /**
   * Formatta stato preventivo
   * @returns {string}
   */
  getStatoFormattato() {
    const statiFormattati = {
      'bozza': '📝 Bozza',
      'inviato': '📧 Inviato',
      'accettato_email': '✅ Accettato (Email)',
      'accettato_manager': '✅ Accettato (Manager)',
      'rifiutato': '❌ Rifiutato',
      'scaduto': '⏰ Scaduto',
      'pianificato': '📋 Pianificato',
      'annullato': '🚫 Annullato'
    };
    return statiFormattati[this.stato] || this.stato;
  }
  
  /**
   * Genera token accettazione (casuale)
   * @returns {string}
   */
  static generateToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           Date.now().toString(36);
  }
  
  /**
   * Converte modello in formato Firestore
   * @returns {Object} Oggetto pronto per Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    
    // Converti Date in Timestamp
    if (this.dataPrevista instanceof Date) {
      data.dataPrevista = dateToTimestamp(this.dataPrevista);
    }
    if (this.dataInvio instanceof Date) {
      data.dataInvio = dateToTimestamp(this.dataInvio);
    }
    if (this.dataScadenza instanceof Date) {
      data.dataScadenza = dateToTimestamp(this.dataScadenza);
    }
    if (this.dataAccettazione instanceof Date) {
      data.dataAccettazione = dateToTimestamp(this.dataAccettazione);
    }
    
    // Ricalcola totale con IVA
    this.calcolaTotaleConIva();
    data.totaleConIva = this.totaleConIva;
    
    return data;
  }
}

export default Preventivo;








