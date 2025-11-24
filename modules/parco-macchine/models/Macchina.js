/**
 * Macchina Model - Modello dati macchina/mezzo agricolo
 * Gestisce anagrafica macchine, manutenzioni, scadenze e assegnazioni
 * 
 * @module modules/parco-macchine/models/Macchina
 */

import { Base } from '../../../core/models/Base.js';
import { dateToTimestamp } from '../../../core/services/firebase-service.js';

export class Macchina extends Base {
  /**
   * Costruttore Macchina
   * @param {Object} data - Dati macchina
   * @param {string} data.id - ID macchina
   * @param {string} data.nome - Nome macchina (es. "Trattore John Deere 6120") - obbligatorio
   * @param {string} data.tipoMacchina - Tipo macchina: "trattore" | "attrezzo" - obbligatorio
   * @param {string} data.marca - Marca (es. "John Deere") - opzionale
   * @param {string} data.modello - Modello (es. "6120") - opzionale
   * @param {string} data.targa - Targa/numero identificativo - opzionale
   * @param {string} data.numeroTelaio - Numero telaio - opzionale
   * @param {Date|string} data.dataAcquisto - Data acquisto - opzionale
   * @param {number} data.oreIniziali - Ore iniziali al momento dell'inserimento - opzionale
   * @param {number} data.oreAttuali - Ore attuali (aggiornate manualmente o automaticamente) - opzionale
   * @param {string} data.stato - Stato: "disponibile" | "in_uso" | "in_manutenzione" | "guasto" | "dismesso" (default: "disponibile")
   * @param {string} data.operatoreAssegnatoId - ID utente assegnato (opzionale, solo se Manodopera attivo)
   * @param {string} data.note - Note opzionali
   * @param {Date|Timestamp} data.prossimaManutenzione - Data prossima manutenzione programmata - opzionale
   * @param {number} data.oreProssimaManutenzione - Ore alla prossima manutenzione - opzionale
   * @param {number} data.costoOra - Costo orario macchina in euro (opzionale, per calcolo costi nei compensi)
   * 
   * Campi specifici TRATTORE:
   * @param {number} data.cavalli - Potenza trattore in CV (obbligatorio se tipoMacchina = "trattore")
   * 
   * Campi specifici ATTREZZO:
   * @param {string} data.categoriaId - ID categoria unificata (obbligatorio se tipoMacchina = "attrezzo")
   * @param {string} data.categoriaFunzione - Categoria funzionale attrezzo (deprecato, usare categoriaId) - mantenuto per retrocompatibilità
   * @param {number} data.cavalliMinimiRichiesti - CV minimi richiesti per attrezzo (obbligatorio se tipoMacchina = "attrezzo")
   * 
   * @param {string} data.creatoDa - ID utente che ha creato la macchina
   * @param {Date|Timestamp} data.creatoIl - Data creazione
   * @param {Date|Timestamp} data.aggiornatoIl - Data ultimo aggiornamento
   */
  constructor(data = {}) {
    super(data);
    
    this.nome = data.nome || '';
    this.tipoMacchina = data.tipoMacchina || ''; // "trattore" | "attrezzo"
    // Manteniamo "tipo" per retrocompatibilità (deprecato, usare tipoMacchina)
    this.tipo = this.tipoMacchina || data.tipo || '';
    
    this.marca = data.marca || null;
    this.modello = data.modello || null;
    this.targa = data.targa || null;
    this.numeroTelaio = data.numeroTelaio || null;
    
    // Gestione dataAcquisto
    if (data.dataAcquisto) {
      this.dataAcquisto = data.dataAcquisto instanceof Date 
        ? data.dataAcquisto 
        : new Date(data.dataAcquisto);
    } else {
      this.dataAcquisto = null;
    }
    
    this.oreIniziali = data.oreIniziali !== undefined ? parseFloat(data.oreIniziali) : 0;
    this.oreAttuali = data.oreAttuali !== undefined ? parseFloat(data.oreAttuali) : this.oreIniziali;
    
    // Stato macchina: "disponibile" | "in_uso" | "in_manutenzione" | "guasto" | "dismesso"
    this.stato = data.stato || 'disponibile';
    
    // Assegnazione operatore (opzionale, solo se Manodopera attivo)
    this.operatoreAssegnatoId = data.operatoreAssegnatoId || null;
    
    this.note = data.note || '';
    
    // Gestione prossimaManutenzione
    if (data.prossimaManutenzione) {
      this.prossimaManutenzione = data.prossimaManutenzione instanceof Date 
        ? data.prossimaManutenzione 
        : new Date(data.prossimaManutenzione);
    } else {
      this.prossimaManutenzione = null;
    }
    
    this.oreProssimaManutenzione = data.oreProssimaManutenzione !== undefined 
      ? parseFloat(data.oreProssimaManutenzione) 
      : null;
    
    // Costo orario macchina (opzionale, per calcolo costi nei compensi)
    this.costoOra = data.costoOra !== undefined ? parseFloat(data.costoOra) : null;
    
    // Campi specifici TRATTORE
    this.cavalli = data.cavalli !== undefined ? parseFloat(data.cavalli) : null;
    
    // Campi specifici ATTREZZO
    // Usa categoriaId se disponibile, altrimenti categoriaFunzione (retrocompatibilità)
    this.categoriaId = data.categoriaId || data.categoriaFunzione || null;
    this.categoriaFunzione = data.categoriaFunzione || data.categoriaId || null; // Mantenuto per retrocompatibilità
    this.cavalliMinimiRichiesti = data.cavalliMinimiRichiesti !== undefined 
      ? parseFloat(data.cavalliMinimiRichiesti) 
      : null;
    
    this.creatoDa = data.creatoDa || null;
    
    // Alias per compatibilità
    this.creatoIl = this.createdAt;
    this.aggiornatoIl = this.updatedAt;
  }
  
  /**
   * Valida dati macchina
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome macchina obbligatorio');
    }
    
    if (this.nome && this.nome.trim().length < 3) {
      errors.push('Nome macchina deve essere di almeno 3 caratteri');
    }
    
    if (this.nome && this.nome.trim().length > 100) {
      errors.push('Nome macchina non può superare 100 caratteri');
    }
    
    if (!this.tipoMacchina || this.tipoMacchina.trim().length === 0) {
      errors.push('Tipo macchina obbligatorio (trattore o attrezzo)');
    }
    
    const tipiValidi = ['trattore', 'attrezzo'];
    if (this.tipoMacchina && !tipiValidi.includes(this.tipoMacchina)) {
      errors.push(`Tipo macchina non valido. Tipi validi: ${tipiValidi.join(', ')}`);
    }
    
    // Validazioni specifiche TRATTORE
    if (this.tipoMacchina === 'trattore') {
      if (this.cavalli === null || this.cavalli === undefined) {
        errors.push('Cavalli obbligatori per trattore');
      } else if (this.cavalli <= 0) {
        errors.push('I cavalli devono essere maggiori di 0');
      } else if (this.cavalli > 1000) {
        errors.push('I cavalli non possono superare 1000 CV');
      }
    }
    
    // Validazioni specifiche ATTREZZO
    if (this.tipoMacchina === 'attrezzo') {
      if (!this.categoriaId || this.categoriaId.trim().length === 0) {
        errors.push('Categoria obbligatoria per attrezzo');
      }
      if (this.cavalliMinimiRichiesti === null || this.cavalliMinimiRichiesti === undefined) {
        errors.push('Cavalli minimi richiesti obbligatori per attrezzo');
      } else if (this.cavalliMinimiRichiesti <= 0) {
        errors.push('I cavalli minimi richiesti devono essere maggiori di 0');
      } else if (this.cavalliMinimiRichiesti > 1000) {
        errors.push('I cavalli minimi richiesti non possono superare 1000 CV');
      }
    }
    
    const statiValidi = ['disponibile', 'in_uso', 'in_manutenzione', 'guasto', 'dismesso'];
    if (this.stato && !statiValidi.includes(this.stato)) {
      errors.push(`Stato non valido. Stati validi: ${statiValidi.join(', ')}`);
    }
    
    if (this.oreIniziali !== null && this.oreIniziali < 0) {
      errors.push('Ore iniziali non possono essere negative');
    }
    
    if (this.oreAttuali !== null && this.oreAttuali < 0) {
      errors.push('Ore attuali non possono essere negative');
    }
    
    if (this.oreAttuali !== null && this.oreIniziali !== null && this.oreAttuali < this.oreIniziali) {
      errors.push('Ore attuali non possono essere inferiori alle ore iniziali');
    }
    
    if (this.oreProssimaManutenzione !== null && this.oreProssimaManutenzione < 0) {
      errors.push('Ore prossima manutenzione non possono essere negative');
    }
    
    if (this.costoOra !== null && this.costoOra < 0) {
      errors.push('Costo orario non può essere negativo');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Verifica se macchina è disponibile
   * @returns {boolean} true se disponibile
   */
  isDisponibile() {
    return this.stato === 'disponibile';
  }
  
  /**
   * Verifica se macchina è in uso
   * @returns {boolean} true se in uso
   */
  isInUso() {
    return this.stato === 'in_uso';
  }
  
  /**
   * Verifica se macchina è in manutenzione
   * @returns {boolean} true se in manutenzione
   */
  isInManutenzione() {
    return this.stato === 'in_manutenzione';
  }
  
  /**
   * Verifica se macchina è guasta
   * @returns {boolean} true se guasta
   */
  isGuasta() {
    return this.stato === 'guasto';
  }
  
  /**
   * Verifica se macchina è dismessa
   * @returns {boolean} true se dismessa
   */
  isDismessa() {
    return this.stato === 'dismesso';
  }
  
  /**
   * Verifica se macchina è attiva (non dismessa)
   * @returns {boolean} true se attiva
   */
  isAttiva() {
    return this.stato !== 'dismesso';
  }
  
  /**
   * Calcola ore totali utilizzate (oreAttuali - oreIniziali)
   * @returns {number} Ore totali utilizzate
   */
  getOreUtilizzate() {
    if (this.oreAttuali === null || this.oreIniziali === null) {
      return 0;
    }
    return Math.max(0, this.oreAttuali - this.oreIniziali);
  }
  
  /**
   * Verifica se manutenzione è in scadenza (entro 30 giorni o 50 ore)
   * @returns {boolean} true se manutenzione in scadenza
   */
  isManutenzioneInScadenza() {
    if (!this.prossimaManutenzione && this.oreProssimaManutenzione === null) {
      return false;
    }
    
    // Verifica per data
    if (this.prossimaManutenzione) {
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      const scadenza = new Date(this.prossimaManutenzione);
      scadenza.setHours(0, 0, 0, 0);
      const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
      
      if (giorniRimanenti <= 30 && giorniRimanenti >= 0) {
        return true;
      }
    }
    
    // Verifica per ore
    if (this.oreProssimaManutenzione !== null && this.oreAttuali !== null) {
      const oreRimanenti = this.oreProssimaManutenzione - this.oreAttuali;
      if (oreRimanenti <= 50 && oreRimanenti >= 0) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Verifica se manutenzione è scaduta
   * @returns {boolean} true se manutenzione scaduta
   */
  isManutenzioneScaduta() {
    if (!this.prossimaManutenzione && this.oreProssimaManutenzione === null) {
      return false;
    }
    
    // Verifica per data
    if (this.prossimaManutenzione) {
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      const scadenza = new Date(this.prossimaManutenzione);
      scadenza.setHours(0, 0, 0, 0);
      
      if (scadenza < oggi) {
        return true;
      }
    }
    
    // Verifica per ore
    if (this.oreProssimaManutenzione !== null && this.oreAttuali !== null) {
      if (this.oreAttuali >= this.oreProssimaManutenzione) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Ottieni stato formattato per visualizzazione
   * @returns {string} Stato formattato
   */
  getStatoFormattato() {
    const statiFormattati = {
      'disponibile': '✅ Disponibile',
      'in_uso': '🔄 In uso',
      'in_manutenzione': '🔧 In manutenzione',
      'guasto': '❌ Guasto',
      'dismesso': '🗑️ Dismesso'
    };
    return statiFormattati[this.stato] || this.stato;
  }
  
  /**
   * Ottieni tipo formattato per visualizzazione
   * @returns {string} Tipo formattato
   */
  getTipoFormattato() {
    const tipiFormattati = {
      'trattore': '🚜 Trattore',
      'attrezzo': '⚙️ Attrezzo'
    };
    return tipiFormattati[this.tipoMacchina] || tipiFormattati[this.tipo] || this.tipoMacchina || this.tipo;
  }
  
  /**
   * Verifica se è un trattore
   * @returns {boolean} true se è trattore
   */
  isTrattore() {
    return this.tipoMacchina === 'trattore' || this.tipo === 'trattore';
  }
  
  /**
   * Verifica se è un attrezzo
   * @returns {boolean} true se è attrezzo
   */
  isAttrezzo() {
    return this.tipoMacchina === 'attrezzo' || this.tipo === 'attrezzo';
  }
  
  /**
   * Verifica compatibilità con un trattore (solo per attrezzi)
   * @param {Macchina} trattore - Trattore da verificare
   * @returns {boolean} true se compatibile
   */
  isCompatibleWith(trattore) {
    if (!this.isAttrezzo() || !trattore || !trattore.isTrattore()) {
      return false;
    }
    
    if (this.cavalliMinimiRichiesti === null || trattore.cavalli === null) {
      return false;
    }
    
    return trattore.cavalli >= this.cavalliMinimiRichiesti;
  }
  
  /**
   * Converte modello in formato Firestore
   * @returns {Object} Oggetto pronto per Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    
    // Converti dataAcquisto in Timestamp se è Date
    if (this.dataAcquisto instanceof Date) {
      data.dataAcquisto = dateToTimestamp(this.dataAcquisto);
    }
    
    // Converti prossimaManutenzione in Timestamp se è Date
    if (this.prossimaManutenzione instanceof Date) {
      data.prossimaManutenzione = dateToTimestamp(this.prossimaManutenzione);
    }
    
    return data;
  }
}

export default Macchina;

