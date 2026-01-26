/**
 * TrattamentoVigneto Model - Modello dati trattamento vigneto
 * Gestisce registrazione trattamenti fitosanitari con calcolo costi e giorni di carenza
 * 
 * @module modules/vigneto/models/TrattamentoVigneto
 */

import { Base } from '../../../core/models/Base.js';

export class TrattamentoVigneto extends Base {
  /**
   * Costruttore TrattamentoVigneto
   * @param {Object} data - Dati trattamento
   * @param {string} data.id - ID trattamento
   * @param {string} data.vignetoId - Riferimento vigneto (obbligatorio)
   * @param {Date|Timestamp} data.data - Data trattamento (obbligatorio)
   * @param {string} data.prodotto - Nome prodotto (obbligatorio)
   * @param {string} data.dosaggio - Dosaggio applicato (obbligatorio)
   * @param {string} data.tipoTrattamento - Tipo: "antifungino" | "insetticida" | "acaricida" | "fertilizzante" | "altro" (obbligatorio)
   * @param {string} data.condizioniMeteo - Condizioni meteo (opzionale)
   * @param {number} data.temperatura - Temperatura in °C (opzionale)
   * @param {number} data.umidita - Umidità relativa in % (opzionale)
   * @param {number} data.velocitaVento - Velocità vento in km/h (opzionale)
   * @param {string} data.operatore - ID operatore che ha eseguito (obbligatorio)
   * @param {string} data.macchinaId - ID macchina utilizzata (opzionale)
   * @param {number} data.superficieTrattata - Superficie trattata in ettari (obbligatorio)
   * @param {number} data.costoProdotto - Costo prodotto in € (obbligatorio)
   * @param {number} data.costoManodopera - Costo manodopera in € (calcolato)
   * @param {number} data.costoMacchina - Costo macchina in € (calcolato)
   * @param {number} data.costoTotale - Costo totale in € (calcolato)
   * @param {number} data.giorniCarenza - Giorni di carenza prodotto (opzionale)
   * @param {Date|Timestamp} data.dataRaccoltaMinima - Data minima raccolta (calcolata da giorniCarenza)
   * @param {string} data.parcella - Parcella/blocco trattato (opzionale)
   * @param {string} data.note - Note (opzionale)
   */
  constructor(data = {}) {
    super(data);
    
    // Dati base (obbligatori)
    this.vignetoId = data.vignetoId || null;
    this.data = data.data || null;
    this.prodotto = data.prodotto || '';
    this.dosaggio = data.dosaggio || '';
    this.tipoTrattamento = data.tipoTrattamento || '';
    
    // Condizioni meteo (opzionale)
    this.condizioniMeteo = data.condizioniMeteo || null;
    this.temperatura = data.temperatura !== undefined ? parseFloat(data.temperatura) : null;
    this.umidita = data.umidita !== undefined ? parseFloat(data.umidita) : null;
    this.velocitaVento = data.velocitaVento !== undefined ? parseFloat(data.velocitaVento) : null;
    
    // Operazioni
    this.operatore = data.operatore || null;
    this.macchinaId = data.macchinaId || null;
    this.superficieTrattata = data.superficieTrattata !== undefined ? parseFloat(data.superficieTrattata) : null;
    
    // Costi
    this.costoProdotto = data.costoProdotto !== undefined ? parseFloat(data.costoProdotto) : null;
    this.costoManodopera = data.costoManodopera !== undefined ? parseFloat(data.costoManodopera) : 0;
    this.costoMacchina = data.costoMacchina !== undefined ? parseFloat(data.costoMacchina) : 0;
    this.costoTotale = data.costoTotale !== undefined ? parseFloat(data.costoTotale) : 0;
    
    // Giorni di carenza
    this.giorniCarenza = data.giorniCarenza !== undefined ? parseInt(data.giorniCarenza) : null;
    this.dataRaccoltaMinima = data.dataRaccoltaMinima || null;
    
    // Note
    this.parcella = data.parcella || null;
    this.note = data.note || '';
  }
  
  /**
   * Valida dati trattamento
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.vignetoId || this.vignetoId.trim().length === 0) {
      errors.push('Vigneto obbligatorio');
    }
    
    if (!this.data) {
      errors.push('Data trattamento obbligatoria');
    }
    
    if (!this.prodotto || this.prodotto.trim().length === 0) {
      errors.push('Prodotto obbligatorio');
    }
    
    if (!this.dosaggio || this.dosaggio.trim().length === 0) {
      errors.push('Dosaggio obbligatorio');
    }
    
    if (!this.tipoTrattamento || this.tipoTrattamento.trim().length === 0) {
      errors.push('Tipo trattamento obbligatorio');
    } else {
      const tipiValidi = ['antifungino', 'insetticida', 'acaricida', 'fertilizzante', 'altro'];
      if (!tipiValidi.includes(this.tipoTrattamento)) {
        errors.push(`Tipo trattamento deve essere uno tra: ${tipiValidi.join(', ')}`);
      }
    }
    
    if (!this.operatore || this.operatore.trim().length === 0) {
      errors.push('Operatore obbligatorio');
    }
    
    if (this.superficieTrattata === null || this.superficieTrattata <= 0) {
      errors.push('Superficie trattata obbligatoria e maggiore di zero');
    }
    
    if (this.costoProdotto === null || this.costoProdotto < 0) {
      errors.push('Costo prodotto obbligatorio e non negativo');
    }
    
    // Validazione condizioni meteo (se presenti)
    if (this.temperatura !== null && (this.temperatura < -50 || this.temperatura > 50)) {
      errors.push('Temperatura deve essere tra -50 e 50 °C');
    }
    
    if (this.umidita !== null && (this.umidita < 0 || this.umidita > 100)) {
      errors.push('Umidità relativa deve essere tra 0 e 100%');
    }
    
    if (this.velocitaVento !== null && this.velocitaVento < 0) {
      errors.push('Velocità vento non può essere negativa');
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
    return this.costoProdotto + this.costoManodopera + this.costoMacchina;
  }
  
  /**
   * Calcola data raccolta minima basata su giorni di carenza
   * @returns {Date|null} Data minima raccolta o null se giorniCarenza non specificato
   */
  calcolaDataRaccoltaMinima() {
    if (!this.data || !this.giorniCarenza || this.giorniCarenza <= 0) {
      return null;
    }
    
    const dataTrattamento = this.data instanceof Date ? this.data : new Date(this.data.toDate ? this.data.toDate() : this.data);
    const dataMinima = new Date(dataTrattamento);
    dataMinima.setDate(dataMinima.getDate() + this.giorniCarenza);
    
    return dataMinima;
  }
  
  /**
   * Aggiorna calcoli automatici
   */
  aggiornaCalcoli() {
    this.costoTotale = this.calcolaCostoTotale();
    this.dataRaccoltaMinima = this.calcolaDataRaccoltaMinima();
  }
  
  /**
   * Verifica se trattamento è troppo vicino a vendemmia prevista
   * @param {Date} dataVendemmiaPrevista - Data vendemmia prevista
   * @returns {boolean} true se trattamento è troppo vicino (rispetto giorni carenza)
   */
  isTroppoVicinoAVendemmia(dataVendemmiaPrevista) {
    if (!this.dataRaccoltaMinima || !dataVendemmiaPrevista) {
      return false;
    }
    
    const dataMinima = this.dataRaccoltaMinima instanceof Date ? this.dataRaccoltaMinima : new Date(this.dataRaccoltaMinima.toDate ? this.dataRaccoltaMinima.toDate() : this.dataRaccoltaMinima);
    const dataVendemmia = dataVendemmiaPrevista instanceof Date ? dataVendemmiaPrevista : new Date(dataVendemmiaPrevista.toDate ? dataVendemmiaPrevista.toDate() : dataVendemmiaPrevista);
    
    return dataVendemmia < dataMinima;
  }
  
  /**
   * Ottieni tipo trattamento formattato
   * @returns {string} Tipo formattato
   */
  getTipoFormattato() {
    const tipiFormattati = {
      'antifungino': '🦠 Antifungino',
      'insetticida': '🐛 Insetticida',
      'acaricida': '🕷️ Acaricida',
      'fertilizzante': '🌱 Fertilizzante',
      'altro': '📦 Altro'
    };
    return tipiFormattati[this.tipoTrattamento] || this.tipoTrattamento;
  }
}

export default TrattamentoVigneto;
