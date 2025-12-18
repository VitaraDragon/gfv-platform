/**
 * Cliente Model - Modello dati cliente (conto terzi)
 * Gestisce anagrafica clienti per lavori conto terzi
 * 
 * @module modules/conto-terzi/models/Cliente
 */

import { Base } from '../../../core/models/Base.js';

export class Cliente extends Base {
  /**
   * Costruttore Cliente
   * @param {Object} data - Dati cliente
   * @param {string} data.id - ID cliente
   * @param {string} data.ragioneSociale - Ragione sociale (obbligatorio)
   * @param {string} data.partitaIva - Partita IVA (opzionale)
   * @param {string} data.codiceFiscale - Codice fiscale (opzionale)
   * @param {string} data.indirizzo - Indirizzo (opzionale)
   * @param {string} data.citta - Città (opzionale)
   * @param {string} data.cap - CAP (opzionale)
   * @param {string} data.provincia - Provincia (opzionale)
   * @param {string} data.telefono - Telefono (opzionale)
   * @param {string} data.email - Email (opzionale)
   * @param {string} data.note - Note cliente (opzionale)
   * @param {string} data.stato - Stato: "attivo" | "sospeso" | "archiviato" (default: "attivo")
   * @param {Date|Timestamp} data.dataPrimoLavoro - Data primo lavoro (calcolato automaticamente)
   * @param {Date|Timestamp} data.dataUltimoLavoro - Data ultimo lavoro (calcolato automaticamente)
   * @param {number} data.totaleLavori - Totale lavori (calcolato automaticamente, default: 0)
   * @param {Date|Timestamp} data.creatoIl - Data creazione (alias createdAt)
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento (alias updatedAt)
   */
  constructor(data = {}) {
    super(data);
    
    this.ragioneSociale = data.ragioneSociale || '';
    this.partitaIva = data.partitaIva || null;
    this.codiceFiscale = data.codiceFiscale || null;
    this.indirizzo = data.indirizzo || null;
    this.citta = data.citta || null;
    this.cap = data.cap || null;
    this.provincia = data.provincia || null;
    this.telefono = data.telefono || null;
    this.email = data.email || null;
    this.note = data.note || '';
    this.stato = data.stato || 'attivo';
    
    // Statistiche (calcolate automaticamente)
    this.dataPrimoLavoro = data.dataPrimoLavoro || null;
    this.dataUltimoLavoro = data.dataUltimoLavoro || null;
    this.totaleLavori = data.totaleLavori !== undefined ? parseInt(data.totaleLavori) : 0;
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati cliente
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.ragioneSociale || this.ragioneSociale.trim().length === 0) {
      errors.push('Ragione sociale obbligatoria');
    }
    
    if (this.ragioneSociale && this.ragioneSociale.trim().length < 2) {
      errors.push('Ragione sociale deve essere di almeno 2 caratteri');
    }
    
    if (this.ragioneSociale && this.ragioneSociale.trim().length > 200) {
      errors.push('Ragione sociale non può superare 200 caratteri');
    }
    
    // Validazione Partita IVA (formato italiano: 11 cifre)
    if (this.partitaIva && this.partitaIva.trim().length > 0) {
      const pivaRegex = /^[0-9]{11}$/;
      if (!pivaRegex.test(this.partitaIva.replace(/\s/g, ''))) {
        errors.push('Partita IVA non valida (deve essere di 11 cifre)');
      }
    }
    
    // Validazione Codice Fiscale (formato italiano: 16 caratteri alfanumerici)
    if (this.codiceFiscale && this.codiceFiscale.trim().length > 0) {
      const cfRegex = /^[A-Z0-9]{16}$/i;
      if (!cfRegex.test(this.codiceFiscale.replace(/\s/g, '').toUpperCase())) {
        errors.push('Codice fiscale non valido (deve essere di 16 caratteri alfanumerici)');
      }
    }
    
    // Validazione email
    if (this.email && this.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        errors.push('Email non valida');
      }
    }
    
    // Validazione stato
    const statiValidi = ['attivo', 'sospeso', 'archiviato'];
    if (this.stato && !statiValidi.includes(this.stato)) {
      errors.push(`Stato non valido. Stati validi: ${statiValidi.join(', ')}`);
    }
    
    // Validazione CAP (formato italiano: 5 cifre)
    if (this.cap && this.cap.trim().length > 0) {
      const capRegex = /^[0-9]{5}$/;
      if (!capRegex.test(this.cap.replace(/\s/g, ''))) {
        errors.push('CAP non valido (deve essere di 5 cifre)');
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
    
    // Normalizza Partita IVA e Codice Fiscale (rimuovi spazi)
    if (data.partitaIva) {
      data.partitaIva = data.partitaIva.replace(/\s/g, '');
    }
    if (data.codiceFiscale) {
      data.codiceFiscale = data.codiceFiscale.replace(/\s/g, '').toUpperCase();
    }
    
    // Rimuovi alias se presenti
    delete data.creatoIl;
    delete data.aggiornatoIl;
    
    return data;
  }
  
  /**
   * Verifica se cliente è attivo
   * @returns {boolean} true se cliente è attivo
   */
  isAttivo() {
    return this.stato === 'attivo';
  }
  
  /**
   * Verifica se cliente è sospeso
   * @returns {boolean} true se cliente è sospeso
   */
  isSospeso() {
    return this.stato === 'sospeso';
  }
  
  /**
   * Verifica se cliente è archiviato
   * @returns {boolean} true se cliente è archiviato
   */
  isArchiviato() {
    return this.stato === 'archiviato';
  }
  
  /**
   * Ottieni stato formattato per visualizzazione
   * @returns {string} Stato formattato
   */
  getStatoFormattato() {
    const statiFormattati = {
      'attivo': '✅ Attivo',
      'sospeso': '⏸️ Sospeso',
      'archiviato': '📦 Archiviato'
    };
    return statiFormattati[this.stato] || this.stato;
  }
  
  /**
   * Ottieni indirizzo completo formattato
   * @returns {string} Indirizzo completo
   */
  getIndirizzoCompleto() {
    const parti = [];
    if (this.indirizzo) parti.push(this.indirizzo);
    if (this.cap) parti.push(this.cap);
    if (this.citta) parti.push(this.citta);
    if (this.provincia) parti.push(`(${this.provincia})`);
    return parti.join(' ') || 'Non specificato';
  }
}

export default Cliente;








