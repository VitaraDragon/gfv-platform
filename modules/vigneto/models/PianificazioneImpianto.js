/**
 * PianificazioneImpianto Model - Modello dati pianificazione nuovo impianto
 * Gestisce pianificazione impianti con reticolato, calcoli materiali e costi
 * 
 * @module modules/vigneto/models/PianificazioneImpianto
 */

import { Base } from '../../../core/models/Base.js';

export class PianificazioneImpianto extends Base {
  /**
   * Costruttore PianificazioneImpianto
   * @param {Object} data - Dati pianificazione
   * @param {string} data.terrenoId - Riferimento terreno (obbligatorio)
   * @param {string} data.tipoColtura - Tipo coltura: "vigneto" | "frutteto" | "oliveto" (obbligatorio)
   * @param {string} data.formaAllevamento - Forma di allevamento (chiave tecnica, es. "guyot", "cordone_speronato") (opzionale)
   * @param {number} data.distanzaFile - Distanza tra file in metri (obbligatorio)
   * @param {number} data.distanzaUnita - Distanza tra unità nella fila in metri (obbligatorio)
   * @param {number} data.angoloRotazione - Angolo rotazione reticolato in gradi (default: 0)
   * @param {number} data.distanzaPali - Distanza tra pali in metri (opzionale)
   * @param {number} data.larghezzaCarraie - Larghezza carraie in metri (default: 3.0)
   * @param {number} data.numeroFile - Numero file (calcolato automaticamente)
   * @param {number} data.numeroUnitaTotale - Numero totale unità (calcolato automaticamente)
   * @param {number} data.numeroPali - Numero pali necessari (calcolato automaticamente)
   * @param {number} data.lunghezzaFiliPortanti - Lunghezza fili portanti in metri (calcolato)
   * @param {number} data.lunghezzaFiliLegatura - Lunghezza fili legatura in metri (calcolato)
   * @param {number} data.lunghezzaFilariTotale - Lunghezza totale filari in metri (calcolato)
   * @param {number} data.superficieCarraie - Superficie carraie in ettari (calcolato)
   * @param {number} data.superficieNettaImpianto - Superficie netta impianto in ettari (calcolato)
   * @param {number} data.superficieLorda - Superficie lorda terreno in ettari (calcolato)
   * @param {number} data.densitaEffettiva - Densità effettiva unità/ha (calcolato)
   * @param {Array} data.reticolatoCoords - Coordinate reticolato per visualizzazione
   * @param {string} data.stato - Stato: "bozza" | "confermato" | "impiantato" (default: "bozza")
   * @param {Date|Timestamp} data.dataConferma - Data conferma pianificazione
   * @param {string} data.creatoDa - ID utente che ha creato la pianificazione
   * @param {string} data.note - Note generali (opzionale)
   */
  constructor(data = {}) {
    super(data);
    
    // Dati base (obbligatori)
    this.terrenoId = data.terrenoId || null;
    this.tipoColtura = data.tipoColtura || null;
    this.formaAllevamento = data.formaAllevamento || null; // Chiave tecnica (es. "guyot", "cordone_speronato")
    
    // Parametri reticolato
    this.distanzaFile = data.distanzaFile !== undefined ? parseFloat(data.distanzaFile) : null;
    this.distanzaUnita = data.distanzaUnita !== undefined ? parseFloat(data.distanzaUnita) : null;
    this.angoloRotazione = data.angoloRotazione !== undefined ? parseFloat(data.angoloRotazione) : 0;
    this.distanzaPali = data.distanzaPali !== undefined ? parseFloat(data.distanzaPali) : null;
    this.larghezzaCarraie = data.larghezzaCarraie !== undefined ? parseFloat(data.larghezzaCarraie) : 3.0;
    
    // Calcoli automatici
    this.numeroFile = data.numeroFile !== undefined ? parseInt(data.numeroFile) : 0;
    this.numeroUnitaTotale = data.numeroUnitaTotale !== undefined ? parseInt(data.numeroUnitaTotale) : 0;
    this.numeroPali = data.numeroPali !== undefined ? parseInt(data.numeroPali) : 0;
    this.lunghezzaFiliPortanti = data.lunghezzaFiliPortanti !== undefined ? parseFloat(data.lunghezzaFiliPortanti) : 0;
    this.lunghezzaFiliLegatura = data.lunghezzaFiliLegatura !== undefined ? parseFloat(data.lunghezzaFiliLegatura) : 0;
    this.lunghezzaFilariTotale = data.lunghezzaFilariTotale !== undefined ? parseFloat(data.lunghezzaFilariTotale) : 0;
    this.superficieCarraie = data.superficieCarraie !== undefined ? parseFloat(data.superficieCarraie) : 0;
    this.superficieNettaImpianto = data.superficieNettaImpianto !== undefined ? parseFloat(data.superficieNettaImpianto) : 0;
    this.superficieLorda = data.superficieLorda !== undefined ? parseFloat(data.superficieLorda) : 0;
    this.densitaEffettiva = data.densitaEffettiva !== undefined ? parseFloat(data.densitaEffettiva) : 0;
    
    // Coordinate reticolato (per visualizzazione)
    this.reticolatoCoords = data.reticolatoCoords || [];
    
    // Materiali aggiuntivi (opzionale)
    this.numeroSupporti = data.numeroSupporti !== undefined ? parseInt(data.numeroSupporti) : 0;
    this.numeroLegacci = data.numeroLegacci !== undefined ? parseInt(data.numeroLegacci) : 0;
    this.numeroGanci = data.numeroGanci !== undefined ? parseInt(data.numeroGanci) : 0;
    
    // Stato
    this.stato = data.stato || 'bozza';
    this.dataConferma = data.dataConferma ? (data.dataConferma instanceof Date ? data.dataConferma : new Date(data.dataConferma)) : null;
    this.creatoDa = data.creatoDa || null;
    this.note = data.note || '';
  }
  
  /**
   * Valida dati pianificazione
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    // Validazione campi obbligatori
    if (!this.terrenoId || this.terrenoId.trim().length === 0) {
      errors.push('Terreno obbligatorio');
    }
    
    if (!this.tipoColtura) {
      errors.push('Tipo coltura obbligatorio');
    } else {
      const tipiValidi = ['vigneto', 'frutteto', 'oliveto'];
      if (!tipiValidi.includes(this.tipoColtura)) {
        errors.push(`Tipo coltura deve essere uno tra: ${tipiValidi.join(', ')}`);
      }
    }
    
    if (this.distanzaFile === null || this.distanzaFile <= 0) {
      errors.push('Distanza tra file obbligatoria e maggiore di zero');
    }
    
    if (this.distanzaUnita === null || this.distanzaUnita <= 0) {
      errors.push('Distanza tra unità obbligatoria e maggiore di zero');
    }
    
    if (this.larghezzaCarraie < 0) {
      errors.push('Larghezza carraie non può essere negativa');
    }
    
    // Validazione stato
    const statiValidi = ['bozza', 'confermato', 'impiantato'];
    if (this.stato && !statiValidi.includes(this.stato)) {
      errors.push(`Stato deve essere uno tra: ${statiValidi.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Verifica se pianificazione è in bozza
   * @returns {boolean} true se in bozza
   */
  isBozza() {
    return this.stato === 'bozza';
  }
  
  /**
   * Verifica se pianificazione è confermata
   * @returns {boolean} true se confermata
   */
  isConfermata() {
    return this.stato === 'confermato';
  }
  
  /**
   * Verifica se impianto è stato realizzato
   * @returns {boolean} true se impiantato
   */
  isImpiantato() {
    return this.stato === 'impiantato';
  }
  
  /**
   * Ottieni stato formattato per visualizzazione
   * @returns {string} Stato formattato
   */
  getStatoFormattato() {
    const statiFormattati = {
      'bozza': '📝 Bozza',
      'confermato': '✅ Confermato',
      'impiantato': '🌱 Impiantato'
    };
    return statiFormattati[this.stato] || this.stato;
  }
  
  /**
   * Ottieni tipo coltura formattato per visualizzazione
   * @returns {string} Tipo coltura formattato
   */
  getTipoColturaFormattato() {
    const tipiFormattati = {
      'vigneto': '🍇 Vigneto',
      'frutteto': '🍎 Frutteto',
      'oliveto': '🫒 Oliveto'
    };
    return tipiFormattati[this.tipoColtura] || this.tipoColtura;
  }
}

export default PianificazioneImpianto;
