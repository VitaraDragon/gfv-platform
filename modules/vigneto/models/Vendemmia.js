/**
 * Vendemmia Model - Modello dati vendemmia
 * Gestisce registrazione vendemmia con qualità uva e calcolo compensi
 * 
 * @module modules/vigneto/models/Vendemmia
 */

import { Base } from '../../../core/models/Base.js';

export class Vendemmia extends Base {
  /**
   * Costruttore Vendemmia
   * @param {Object} data - Dati vendemmia
   * @param {string} data.id - ID vendemmia
   * @param {string} data.vignetoId - Riferimento vigneto (obbligatorio)
   * @param {string} data.lavoroId - Riferimento lavoro (opzionale, se vendemmia creata da lavoro)
   * @param {Date|Timestamp} data.data - Data raccolta (obbligatorio)
   * @param {string} data.varieta - Varietà uva raccolta (obbligatorio)
   * @param {number} data.quantitaQli - Quantità raccolta in quintali con 2 decimali (obbligatorio)
   * @param {number} data.quantitaEttari - Superficie vendemmiata in ettari (obbligatorio)
   * @param {number} data.resaQliHa - Resa in quintali/ettaro (calcolato automaticamente)
   * @param {string} data.tipoPalo - Tipo palo (ereditato da vigneto, può essere sovrascritto)
   * @param {number} data.gradazione - Gradazione zuccherina (°Brix) (opzionale)
   * @param {number} data.acidita - Acidità (g/L) (opzionale)
   * @param {number} data.ph - pH (opzionale)
   * @param {string} data.destinazione - Destinazione uva: "vino" | "vendita_uva" (obbligatorio)
   * @param {Array<string>} data.operai - Array ID operai coinvolti (obbligatorio)
   * @param {Array<string>} data.macchine - Array ID macchine utilizzate (opzionale)
   * @param {number} data.oreImpiegate - Ore totali impiegate (opzionale)
   * @param {number} data.costoManodopera - Costo manodopera in € (calcolato)
   * @param {number} data.costoMacchine - Costo macchine in € (calcolato)
   * @param {number} data.costoTotale - Costo totale in € (calcolato)
   * @param {string} data.parcella - Parcella/blocco vendemmiato (opzionale)
   * @param {Array<Object>} data.poligonoVendemmiato - Coordinate poligono area vendemmiata (opzionale)
   *   Array di oggetti {lat: number, lng: number} per tracciare l'area vendemmiata sulla mappa
   * @param {string} data.note - Note (opzionale)
   */
  constructor(data = {}) {
    super(data);
    
    // Dati base (obbligatori)
    this.vignetoId = data.vignetoId || null;
    this.lavoroId = data.lavoroId || null; // Collegamento al lavoro (se vendemmia creata da lavoro)
    this.attivitaId = data.attivitaId || null; // Collegamento all'attività (se vendemmia creata da attività senza lavoro)
    this.data = data.data || null;
    this.varieta = data.varieta || '';
    this.quantitaQli = data.quantitaQli !== undefined ? parseFloat(data.quantitaQli) : null;
    this.quantitaEttari = data.quantitaEttari !== undefined ? parseFloat(data.quantitaEttari) : null;
    this.resaQliHa = data.resaQliHa !== undefined ? parseFloat(data.resaQliHa) : null;
    
    // Tipo palo (ereditato da vigneto, può essere sovrascritto)
    this.tipoPalo = data.tipoPalo || null;
    
    // Qualità uva (opzionale)
    this.gradazione = data.gradazione !== undefined ? parseFloat(data.gradazione) : null;
    this.acidita = data.acidita !== undefined ? parseFloat(data.acidita) : null;
    this.ph = data.ph !== undefined ? parseFloat(data.ph) : null;
    
    // Destinazione
    this.destinazione = data.destinazione || null;
    
    // Operazioni
    // operai può essere:
    // - Array di ID (quando modulo manodopera attivo o vendemmia collegata a lavoro)
    // - Array di oggetti {data, nome, ore} (quando modulo manodopera non attivo e vendemmia non collegata a lavoro)
    this.operai = Array.isArray(data.operai) ? data.operai : [];
    this.macchine = Array.isArray(data.macchine) ? data.macchine : [];
    this.oreImpiegate = data.oreImpiegate !== undefined ? parseFloat(data.oreImpiegate) : null;
    
    // Costi (calcolati)
    this.costoManodopera = data.costoManodopera !== undefined ? parseFloat(data.costoManodopera) : 0;
    this.costoMacchine = data.costoMacchine !== undefined ? parseFloat(data.costoMacchine) : 0;
    this.costoTotale = data.costoTotale !== undefined ? parseFloat(data.costoTotale) : 0;
    
    // Note
    this.parcella = data.parcella || null;
    this.note = data.note || '';
    
    // Poligono area vendemmiata (opzionale)
    // Array di coordinate {lat, lng} per tracciare l'area vendemmiata sulla mappa
    this.poligonoVendemmiato = Array.isArray(data.poligonoVendemmiato) ? data.poligonoVendemmiato : null;
  }
  
  /**
   * Valida dati vendemmia
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.vignetoId || this.vignetoId.trim().length === 0) {
      errors.push('Vigneto obbligatorio');
    }
    
    if (!this.data) {
      errors.push('Data vendemmia obbligatoria');
    }
    
    if (!this.varieta || this.varieta.trim().length === 0) {
      errors.push('Varietà uva obbligatoria');
    }
    
    if (this.quantitaQli === null || this.quantitaQli <= 0) {
      errors.push('Quantità raccolta obbligatoria e maggiore di zero');
    }
    
    if (this.quantitaEttari === null || this.quantitaEttari <= 0) {
      errors.push('Superficie vendemmiata obbligatoria e maggiore di zero');
    }
    
    if (!this.destinazione) {
      errors.push('Destinazione uva obbligatoria');
    } else {
      const destinazioniValide = ['vino', 'vendita_uva'];
      if (!destinazioniValide.includes(this.destinazione)) {
        errors.push(`Destinazione uva deve essere uno tra: ${destinazioniValide.join(', ')}`);
      }
    }
    
    // Validazione operai: obbligatori solo se vendemmia non collegata a lavoro o attività
    // (se collegata a lavoro/attività, operai vengono da lì)
    // Nota: operai può essere array di ID o array di oggetti {data, nome, ore}
    if (!this.lavoroId && !this.attivitaId && (!this.operai || this.operai.length === 0)) {
      errors.push('Almeno un operaio coinvolto obbligatorio (o vendemmia deve essere collegata a un lavoro/attività)');
    }
    
    // Se operai è array di oggetti (tabella editabile), valida che ogni oggetto abbia nome
    if (Array.isArray(this.operai) && this.operai.length > 0 && typeof this.operai[0] === 'object' && this.operai[0].nome !== undefined) {
      this.operai.forEach((op, index) => {
        if (!op.nome || op.nome.trim().length === 0) {
          errors.push(`Operaio ${index + 1}: nome obbligatorio`);
        }
        if (op.ore !== undefined && (isNaN(op.ore) || op.ore < 0)) {
          errors.push(`Operaio ${index + 1}: ore deve essere un numero positivo`);
        }
      });
    }
    
    // Validazione tipo palo (se presente)
    if (this.tipoPalo) {
      const tipiValidi = ['cemento', 'ferro', 'legno', 'plastica', 'fibra_vetro'];
      if (!tipiValidi.includes(this.tipoPalo)) {
        errors.push(`Tipo palo deve essere uno tra: ${tipiValidi.join(', ')}`);
      }
    }
    
    // Validazione qualità uva (se presente)
    if (this.gradazione !== null && (this.gradazione < 0 || this.gradazione > 30)) {
      errors.push('Gradazione deve essere tra 0 e 30 °Brix');
    }
    
    if (this.acidita !== null && (this.acidita < 0 || this.acidita > 20)) {
      errors.push('Acidità deve essere tra 0 e 20 g/L');
    }
    
    if (this.ph !== null && (this.ph < 0 || this.ph > 14)) {
      errors.push('pH deve essere tra 0 e 14');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calcola resa in quintali/ettaro
   * @returns {number} Resa in quintali/ettaro (2 decimali)
   */
  calcolaResaQliHa() {
    if (!this.quantitaQli || !this.quantitaEttari || this.quantitaEttari <= 0) {
      return 0;
    }
    return parseFloat((this.quantitaQli / this.quantitaEttari).toFixed(2));
  }
  
  /**
   * Calcola costo totale
   * @returns {number} Costo totale in €
   */
  calcolaCostoTotale() {
    return this.costoManodopera + this.costoMacchine;
  }
  
  /**
   * Aggiorna calcoli automatici
   */
  aggiornaCalcoli() {
    this.resaQliHa = this.calcolaResaQliHa();
    this.costoTotale = this.calcolaCostoTotale();
  }
  
  /**
   * Verifica se la vendemmia è completa
   * Una vendemmia è completa se ha: quantitaQli, quantitaEttari, destinazione
   * @returns {boolean} true se completa, false altrimenti
   */
  isCompleta() {
    return this.quantitaQli !== null && 
           this.quantitaQli > 0 && 
           this.quantitaEttari !== null && 
           this.quantitaEttari > 0 && 
           this.destinazione !== null && 
           this.destinazione.trim().length > 0;
  }
}

export default Vendemmia;
