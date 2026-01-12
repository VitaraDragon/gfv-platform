/**
 * Lavoro Model - Modello dati lavoro
 * Gestisce dati lavoro con assegnazione flessibile (caposquadra O operaio diretto) e terreno
 * 
 * @module core/models/Lavoro
 */

import { Base } from './Base.js';
import { dateToTimestamp } from '../services/firebase-service.js';

export class Lavoro extends Base {
  /**
   * Costruttore Lavoro
   * @param {Object} data - Dati lavoro
   * @param {string} data.id - ID lavoro
   * @param {string} data.nome - Nome lavoro (obbligatorio)
   * @param {string} data.terrenoId - ID terreno (obbligatorio)
   * @param {string} data.caposquadraId - ID caposquadra (opzionale, per lavori di squadra)
   * @param {string} data.operaioId - ID operaio (opzionale, per lavori autonomi)
   * @param {string} data.tipoLavoro - Tipo lavoro (es. "Potatura", "Vendemmia", "Trattamento") - obbligatorio
   * @param {Date|string} data.dataInizio - Data inizio lavoro (obbligatorio)
   * @param {number} data.durataPrevista - Durata prevista in giorni (obbligatorio)
   * @param {string} data.stato - Stato lavoro: "assegnato" | "in_corso" | "completato" | "annullato" (default: "assegnato")
   * @param {string} data.note - Note opzionali
   * @param {string} data.creatoDa - ID utente che ha creato il lavoro
   * @param {Date|Timestamp} data.creatoIl - Data creazione (alias createdAt)
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento (alias updatedAt)
   * 
   * Campi Parco Macchine (opzionali, solo se modulo Parco Macchine attivo):
   * @param {string} data.macchinaId - ID macchina assegnata (opzionale)
   * @param {string} data.attrezzoId - ID attrezzo assegnato (opzionale)
   * @param {string} data.operatoreMacchinaId - ID operaio che usa la macchina (opzionale)
   * 
   * Dati derivati (calcolati automaticamente, non modificabili direttamente):
   * @param {number} data.superficieTotaleLavorata - Superficie totale lavorata (ha)
   * @param {number} data.superficieRimanente - Superficie rimanente (ha)
   * @param {number} data.percentualeCompletamento - Percentuale completamento (0-100)
   * @param {number} data.giorniEffettivi - Giorni passati dall'inizio
   * @param {string} data.statoProgresso - "in_anticipo" | "in_tempo" | "in_ritardo"
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.terrenoId = data.terrenoId || null;
    
    // ASSEGNAZIONE FLESSIBILE: O caposquadra O operaio diretto (mutualmente esclusivi)
    this.caposquadraId = data.caposquadraId || null;    // Per lavori di squadra
    this.operaioId = data.operaioId || null;            // Per lavori autonomi
    
    this.tipoLavoro = data.tipoLavoro || '';
    
    // Campi Conto Terzi (opzionali)
    this.clienteId = data.clienteId || null;        // Se presente → lavoro conto terzi
    this.preventivoId = data.preventivoId || null;  // Se creato da preventivo accettato
    
    // Campi Parco Macchine (opzionali)
    this.macchinaId = data.macchinaId || null;
    this.attrezzoId = data.attrezzoId || null;
    this.operatoreMacchinaId = data.operatoreMacchinaId || null;
    
    // Gestione dataInizio
    if (data.dataInizio) {
      this.dataInizio = data.dataInizio instanceof Date 
        ? data.dataInizio 
        : new Date(data.dataInizio);
    } else {
      this.dataInizio = null;
    }
    
    this.durataPrevista = data.durataPrevista !== undefined 
      ? parseInt(data.durataPrevista) 
      : null;
    
    // Stato lavoro: "da_pianificare" | "assegnato" | "in_corso" | "completato" | "annullato"
    this.stato = data.stato || 'assegnato';
    
    this.note = data.note || '';
    this.creatoDa = data.creatoDa || null;
    
    // Dati derivati (calcolati automaticamente, non modificabili direttamente)
    this.superficieTotaleLavorata = data.superficieTotaleLavorata !== undefined 
      ? parseFloat(data.superficieTotaleLavorata) 
      : 0;
    this.superficieRimanente = data.superficieRimanente !== undefined 
      ? parseFloat(data.superficieRimanente) 
      : null;
    this.percentualeCompletamento = data.percentualeCompletamento !== undefined 
      ? parseFloat(data.percentualeCompletamento) 
      : 0;
    this.giorniEffettivi = data.giorniEffettivi !== undefined 
      ? parseInt(data.giorniEffettivi) 
      : 0;
    this.statoProgresso = data.statoProgresso || null; // "in_anticipo" | "in_tempo" | "in_ritardo"
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati lavoro
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome lavoro obbligatorio');
    }
    
    if (this.nome && this.nome.trim().length < 3) {
      errors.push('Nome lavoro deve essere di almeno 3 caratteri');
    }
    
    if (this.nome && this.nome.trim().length > 100) {
      errors.push('Nome lavoro non può superare 100 caratteri');
    }
    
    if (!this.terrenoId) {
      errors.push('Terreno obbligatorio');
    }
    
    // VALIDAZIONE ASSEGNAZIONE FLESSIBILE: opzionale (richiesta solo se modulo Manodopera attivo)
    // Se almeno uno è presente, verifica che non siano entrambi presenti (mutualmente esclusivi)
    if (this.caposquadraId && this.operaioId) {
      errors.push('Un lavoro non può essere assegnato sia a un caposquadra che a un operaio diretto');
    }
    
    // Nota: L'assegnazione (caposquadraId o operaioId) è opzionale per supportare modalità semplificata
    // senza modulo Manodopera. La validazione dell'assegnazione obbligatoria viene fatta a livello UI
    // quando il modulo Manodopera è attivo.
    
    if (!this.tipoLavoro || this.tipoLavoro.trim().length === 0) {
      errors.push('Tipo lavoro obbligatorio');
    }
    
    if (!this.dataInizio) {
      errors.push('Data inizio obbligatoria');
    }
    
    if (this.dataInizio && this.dataInizio instanceof Date) {
      // Verifica che data non sia nel passato remoto (più di 1 anno fa)
      const unAnnoFa = new Date();
      unAnnoFa.setFullYear(unAnnoFa.getFullYear() - 1);
      if (this.dataInizio < unAnnoFa) {
        errors.push('Data inizio non può essere più di un anno fa');
      }
    }
    
    if (this.durataPrevista === null || this.durataPrevista === undefined) {
      errors.push('Durata prevista obbligatoria');
    }
    
    if (this.durataPrevista !== null && this.durataPrevista < 1) {
      errors.push('Durata prevista deve essere almeno 1 giorno');
    }
    
    if (this.durataPrevista !== null && this.durataPrevista > 365) {
      errors.push('Durata prevista non può superare 365 giorni');
    }
    
    const statiValidi = ['da_pianificare', 'assegnato', 'in_corso', 'completato', 'annullato'];
    if (this.stato && !statiValidi.includes(this.stato)) {
      errors.push(`Stato non valido. Stati validi: ${statiValidi.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calcola data fine prevista
   * @returns {Date|null} Data fine prevista o null se dataInizio non valida
   */
  getDataFinePrevista() {
    if (!this.dataInizio || !this.durataPrevista) {
      return null;
    }
    
    const dataFine = new Date(this.dataInizio);
    dataFine.setDate(dataFine.getDate() + this.durataPrevista - 1); // -1 perché il primo giorno conta
    return dataFine;
  }
  
  /**
   * Verifica se lavoro è completato
   * @returns {boolean} true se lavoro è completato
   */
  isCompletato() {
    return this.stato === 'completato';
  }
  
  /**
   * Verifica se lavoro è annullato
   * @returns {boolean} true se lavoro è annullato
   */
  isAnnullato() {
    return this.stato === 'annullato';
  }
  
  /**
   * Verifica se lavoro è attivo (non completato e non annullato)
   * @returns {boolean} true se lavoro è attivo
   */
  isAttivo() {
    return !this.isCompletato() && !this.isAnnullato();
  }
  
  /**
   * Verifica se lavoro è assegnato a una squadra (tramite caposquadra)
   * @returns {boolean} true se è lavoro di squadra
   */
  isLavoroSquadra() {
    return !!this.caposquadraId && !this.operaioId;
  }
  
  /**
   * Verifica se lavoro è assegnato direttamente a un operaio (lavoro autonomo)
   * @returns {boolean} true se è lavoro autonomo
   */
  isLavoroAutonomo() {
    return !!this.operaioId && !this.caposquadraId;
  }
  
  /**
   * Ottieni tipo assegnazione formattato per visualizzazione
   * @returns {string} "Squadra" | "Autonomo"
   */
  getTipoAssegnazione() {
    if (this.isLavoroSquadra()) {
      return 'Squadra';
    } else if (this.isLavoroAutonomo()) {
      return 'Autonomo';
    }
    return 'Non assegnato';
  }
  
  /**
   * Ottieni stato formattato per visualizzazione
   * @returns {string} Stato formattato
   */
  getStatoFormattato() {
    const statiFormattati = {
      'da_pianificare': '📝 Da pianificare',
      'assegnato': '📋 Assegnato',
      'in_corso': '🔄 In corso',
      'completato': '✅ Completato',
      'annullato': '❌ Annullato'
    };
    return statiFormattati[this.stato] || this.stato;
  }
  
  /**
   * Verifica se lavoro è conto terzi
   * @returns {boolean} true se lavoro è conto terzi
   */
  isContoTerzi() {
    return !!this.clienteId;
  }
  
  /**
   * Ottieni stato progresso formattato per visualizzazione
   * @returns {string} Stato progresso formattato
   */
  getStatoProgressoFormattato() {
    if (!this.statoProgresso) {
      return '⏳ Non disponibile';
    }
    
    const statiFormattati = {
      'in_anticipo': '🟢 In anticipo',
      'in_tempo': '🟡 In tempo',
      'in_ritardo': '🔴 In ritardo'
    };
    return statiFormattati[this.statoProgresso] || this.statoProgresso;
  }
  
  /**
   * Converte modello in formato Firestore
   * @returns {Object} Oggetto pronto per Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    
    // Converti dataInizio in Timestamp se è Date
    if (this.dataInizio instanceof Date) {
      data.dataInizio = dateToTimestamp(this.dataInizio);
    }
    
    // Rimuovi dati derivati se sono null o 0 (verranno ricalcolati)
    // Mantieni solo quelli già calcolati se presenti
    if (data.superficieTotaleLavorata === 0) {
      delete data.superficieTotaleLavorata;
    }
    if (data.superficieRimanente === null) {
      delete data.superficieRimanente;
    }
    if (data.percentualeCompletamento === 0) {
      delete data.percentualeCompletamento;
    }
    if (data.giorniEffettivi === 0) {
      delete data.giorniEffettivi;
    }
    if (!data.statoProgresso) {
      delete data.statoProgresso;
    }
    
    return data;
  }
}

export default Lavoro;

