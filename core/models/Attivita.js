/**
 * Attivita Model - Modello dati attività
 * Gestisce dati attività lavorativa con calcolo ore automatico
 * 
 * @module core/models/Attivita
 */

import { Base } from './Base.js';

export class Attivita extends Base {
  /**
   * Costruttore Attivita
   * @param {Object} data - Dati attività
   * @param {string} data.id - ID attività
   * @param {string} data.data - Data attività (formato YYYY-MM-DD, solo presente/passate)
   * @param {string} data.terrenoId - ID terreno (obbligatorio)
   * @param {string} data.terrenoNome - Nome terreno (denormalizzato, obbligatorio)
   * @param {string} data.tipoLavoro - Tipo lavoro (obbligatorio)
   * @param {string} data.coltura - Coltura (obbligatorio)
   * @param {string} data.orarioInizio - Orario inizio (formato HH:MM, obbligatorio)
   * @param {string} data.orarioFine - Orario fine (formato HH:MM, obbligatorio)
   * @param {number} data.pauseMinuti - Minuti di pausa (obbligatorio)
   * @param {number} data.oreNette - Ore nette lavorate (calcolato automaticamente)
   * @param {string} data.note - Note opzionali
   * @param {Date|Timestamp} data.creatoIl - Data creazione (alias createdAt)
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento (alias updatedAt)
   */
  constructor(data = {}) {
    super(data);
    
    this.data = data.data || '';
    this.terrenoId = data.terrenoId || '';
    this.terrenoNome = data.terrenoNome || '';
    this.tipoLavoro = data.tipoLavoro || '';
    this.coltura = data.coltura || '';
    this.orarioInizio = data.orarioInizio || '';
    this.orarioFine = data.orarioFine || '';
    this.pauseMinuti = data.pauseMinuti !== undefined ? parseInt(data.pauseMinuti) : 0;
    this.oreNette = data.oreNette !== undefined ? parseFloat(data.oreNette) : 0;
    this.note = data.note || '';
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
    
    // Calcola ore nette se non presente o se orari sono stati modificati
    if (this.orarioInizio && this.orarioFine) {
      this.oreNette = this.calculateOreNette();
    }
  }
  
  /**
   * Calcola ore nette lavorate
   * Formula: (orarioFine - orarioInizio) - pauseMinuti
   * @returns {number} Ore nette (in ore decimali, es. 8.5 = 8h30min)
   */
  calculateOreNette() {
    if (!this.orarioInizio || !this.orarioFine) {
      return 0;
    }
    
    try {
      // Converti HH:MM in minuti totali dalla mezzanotte
      const [inizioOre, inizioMinuti] = this.orarioInizio.split(':').map(Number);
      const [fineOre, fineMinuti] = this.orarioFine.split(':').map(Number);
      
      const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
      const fineMinutiTotali = fineOre * 60 + fineMinuti;
      
      // Calcola differenza in minuti
      let minutiTotali = fineMinutiTotali - inizioMinutiTotali;
      
      // Se fine < inizio, potrebbe essere il giorno dopo (non gestito per ora)
      if (minutiTotali < 0) {
        return 0;
      }
      
      // Sottrai pause
      minutiTotali -= this.pauseMinuti;
      
      // Se risultato negativo, restituisci 0
      if (minutiTotali < 0) {
        return 0;
      }
      
      // Converti in ore decimali (es. 510 minuti = 8.5 ore)
      return parseFloat((minutiTotali / 60).toFixed(2));
    } catch (error) {
      console.error('Errore calcolo ore nette:', error);
      return 0;
    }
  }
  
  /**
   * Valida dati attività
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    // Validazione data
    if (!this.data || this.data.trim().length === 0) {
      errors.push('Data attività obbligatoria');
    } else {
      // Verifica che data non sia futura
      const dataAttivita = new Date(this.data);
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      
      if (dataAttivita > oggi) {
        errors.push('Data attività non può essere futura');
      }
    }
    
    // Validazione terreno
    if (!this.terrenoId || this.terrenoId.trim().length === 0) {
      errors.push('Terreno obbligatorio');
    }
    if (!this.terrenoNome || this.terrenoNome.trim().length === 0) {
      errors.push('Nome terreno obbligatorio');
    }
    
    // Validazione tipo lavoro
    if (!this.tipoLavoro || this.tipoLavoro.trim().length === 0) {
      errors.push('Tipo lavoro obbligatorio');
    }
    
    // Validazione coltura
    if (!this.coltura || this.coltura.trim().length === 0) {
      errors.push('Coltura obbligatoria');
    }
    
    // Validazione orari
    if (!this.orarioInizio || this.orarioInizio.trim().length === 0) {
      errors.push('Orario inizio obbligatorio');
    }
    if (!this.orarioFine || this.orarioFine.trim().length === 0) {
      errors.push('Orario fine obbligatorio');
    }
    
    // Validazione formato orari (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (this.orarioInizio && !timeRegex.test(this.orarioInizio)) {
      errors.push('Orario inizio formato non valido (usa HH:MM)');
    }
    if (this.orarioFine && !timeRegex.test(this.orarioFine)) {
      errors.push('Orario fine formato non valido (usa HH:MM)');
    }
    
    // Validazione logica orari
    if (this.orarioInizio && this.orarioFine && timeRegex.test(this.orarioInizio) && timeRegex.test(this.orarioFine)) {
      const [inizioOre, inizioMinuti] = this.orarioInizio.split(':').map(Number);
      const [fineOre, fineMinuti] = this.orarioFine.split(':').map(Number);
      
      const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
      const fineMinutiTotali = fineOre * 60 + fineMinuti;
      
      if (fineMinutiTotali <= inizioMinutiTotali) {
        errors.push('Orario fine deve essere maggiore di orario inizio');
      }
      
      // Validazione pause
      const minutiLavoro = fineMinutiTotali - inizioMinutiTotali;
      if (this.pauseMinuti < 0) {
        errors.push('Pause non possono essere negative');
      }
      if (this.pauseMinuti >= minutiLavoro) {
        errors.push('Pause non possono essere maggiori o uguali al tempo di lavoro');
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
    
    // Ricalcola ore nette prima di salvare
    this.oreNette = this.calculateOreNette();
    data.oreNette = this.oreNette;
    
    // Rimuovi alias se presenti
    delete data.creatoIl;
    delete data.aggiornatoIl;
    
    return data;
  }
  
  /**
   * Aggiorna orari e ricalcola ore nette
   * @param {string} orarioInizio - Orario inizio (HH:MM)
   * @param {string} orarioFine - Orario fine (HH:MM)
   * @param {number} pauseMinuti - Minuti di pausa
   */
  updateOrari(orarioInizio, orarioFine, pauseMinuti) {
    this.orarioInizio = orarioInizio;
    this.orarioFine = orarioFine;
    this.pauseMinuti = pauseMinuti || 0;
    this.oreNette = this.calculateOreNette();
  }
}

export default Attivita;


