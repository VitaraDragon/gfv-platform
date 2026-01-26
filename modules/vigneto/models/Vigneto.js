/**
 * Vigneto Model - Modello dati vigneto
 * Gestisce anagrafica vigneti con dati tecnici e tracciamento rese/costi
 * 
 * @module modules/vigneto/models/Vigneto
 */

import { Base } from '../../../core/models/Base.js';

export class Vigneto extends Base {
  /**
   * Costruttore Vigneto
   * @param {Object} data - Dati vigneto
   * @param {string} data.id - ID vigneto
   * @param {string} data.terrenoId - Riferimento terreno (obbligatorio)
   * @param {string} data.varieta - Varietà uva (obbligatorio)
   * @param {number} data.annataImpianto - Anno impianto (obbligatorio)
   * @param {string} data.portainnesto - Tipo portainnesto (opzionale)
   * @param {number} data.densita - Densità ceppi/ha (obbligatorio)
   * @param {string} data.formaAllevamento - Sistema allevamento (obbligatorio)
   * @param {string} data.tipoImpianto - Tipo impianto (opzionale)
   * @param {number} data.distanzaFile - Distanza tra file in metri (obbligatorio)
   * @param {number} data.distanzaUnita - Distanza tra ceppi in metri (obbligatorio)
   * @param {string} data.orientamentoFilari - Orientamento filari (opzionale)
   * @param {number} data.superficieEttari - Superficie dedicata in ettari (obbligatorio)
   * @param {string} data.tipoPalo - Tipo palo utilizzato (obbligatorio)
   * @param {string} data.destinazioneUva - Destinazione uva: "vino" | "vendita_uva" | "misto" (obbligatorio)
   * @param {string} data.cantina - Nome cantina (opzionale)
   * @param {string} data.note - Note generali (opzionale)
   * @param {string} data.statoImpianto - Stato: "attivo" | "in_riposo" | "da_rimuovere" (default: "attivo")
   * @param {Date|Timestamp} data.dataUltimaPotatura - Data ultima potatura (calcolato automaticamente)
   * @param {Date|Timestamp} data.dataUltimoTrattamento - Data ultimo trattamento (calcolato automaticamente)
   * @param {Date|Timestamp} data.dataUltimaVendemmia - Data ultima vendemmia (calcolato automaticamente)
   * @param {number} data.resaMediaQliHa - Resa media storica in quintali/ettaro (calcolato)
   * @param {number} data.resaAnnoPrecedente - Resa anno precedente in quintali/ettaro
   * @param {number} data.produzioneTotaleAnno - Produzione totale anno corrente in quintali (calcolato)
   * @param {number} data.produzioneTotaleAnnoPrecedente - Produzione totale anno precedente in quintali
   * @param {number} data.speseManodoperaAnno - Spese manodopera anno in € (calcolato)
   * @param {number} data.speseTrattamentiAnno - Spese trattamenti anno in € (calcolato)
   * @param {number} data.spesePotaturaAnno - Spese potatura anno in € (calcolato)
   * @param {number} data.speseVendemmiaAnno - Spese vendemmia anno in € (calcolato)
   * @param {number} data.speseCantinaAnno - Spese cantina anno in €
   * @param {number} data.speseMacchineAnno - Spese macchine anno in € (calcolato)
   * @param {number} data.speseAltroAnno - Altre spese anno in €
   * @param {number} data.costoTotaleAnno - Costo totale anno in € (calcolato)
   * @param {number} data.costoPerEttaro - Costo per ettaro in €/ha (calcolato)
   * @param {number} data.ricavoAnno - Ricavo totale anno in €
   * @param {number} data.margineAnno - Margine anno in € (calcolato)
   * @param {number} data.marginePerEttaro - Margine per ettaro in €/ha (calcolato)
   * @param {number} data.roiAnno - ROI anno in % (calcolato)
   */
  constructor(data = {}) {
    super(data);
    
    // Dati base (obbligatori)
    this.terrenoId = data.terrenoId || null;
    this.varieta = data.varieta || '';
    this.annataImpianto = data.annataImpianto || null;
    this.portainnesto = data.portainnesto || null;
    this.densita = data.densita !== undefined ? parseFloat(data.densita) : null;
    this.formaAllevamento = data.formaAllevamento || '';
    this.tipoImpianto = data.tipoImpianto || null;
    this.distanzaFile = data.distanzaFile !== undefined ? parseFloat(data.distanzaFile) : null;
    this.distanzaUnita = data.distanzaUnita !== undefined ? parseFloat(data.distanzaUnita) : null;
    this.orientamentoFilari = data.orientamentoFilari || null;
    this.superficieEttari = data.superficieEttari !== undefined ? parseFloat(data.superficieEttari) : null;
    
    // Campi specifici vigneto
    this.tipoPalo = data.tipoPalo || null;
    this.destinazioneUva = data.destinazioneUva || null;
    this.cantina = data.cantina || null;
    
    // Alias per compatibilità terminologia viticola
    this.densitaCepi = this.densita;
    this.distanzaCepi = this.distanzaUnita;
    this.sistemaAllevamento = this.formaAllevamento;
    
    // Campi calcolabili (opzionali)
    this.numeroFilari = data.numeroFilari !== undefined ? parseInt(data.numeroFilari) : null;
    this.ceppiTotali = data.ceppiTotali !== undefined ? parseInt(data.ceppiTotali) : null;
    
    // Note
    this.note = data.note || '';
    this.statoImpianto = data.statoImpianto || 'attivo';
    
    // Tracciamento (calcolato automaticamente)
    this.dataUltimaPotatura = data.dataUltimaPotatura || null;
    this.dataUltimoTrattamento = data.dataUltimoTrattamento || null;
    this.dataUltimaVendemmia = data.dataUltimaVendemmia || null;
    
    // Rese e produzione (calcolato automaticamente)
    this.resaMediaQliHa = data.resaMediaQliHa !== undefined ? parseFloat(data.resaMediaQliHa) : null;
    this.resaAnnoPrecedente = data.resaAnnoPrecedente !== undefined ? parseFloat(data.resaAnnoPrecedente) : null;
    this.produzioneTotaleAnno = data.produzioneTotaleAnno !== undefined ? parseFloat(data.produzioneTotaleAnno) : 0;
    this.produzioneTotaleAnnoPrecedente = data.produzioneTotaleAnnoPrecedente !== undefined ? parseFloat(data.produzioneTotaleAnnoPrecedente) : null;
    this.resaPerVarieta = data.resaPerVarieta || {};
    this.trendRese = data.trendRese || [];
    
    // Spese e costi (calcolato automaticamente)
    this.speseManodoperaAnno = data.speseManodoperaAnno !== undefined ? parseFloat(data.speseManodoperaAnno) : 0;
    this.speseTrattamentiAnno = data.speseTrattamentiAnno !== undefined ? parseFloat(data.speseTrattamentiAnno) : 0;
    this.spesePotaturaAnno = data.spesePotaturaAnno !== undefined ? parseFloat(data.spesePotaturaAnno) : 0;
    this.speseVendemmiaAnno = data.speseVendemmiaAnno !== undefined ? parseFloat(data.speseVendemmiaAnno) : 0;
    this.speseCantinaAnno = data.speseCantinaAnno !== undefined ? parseFloat(data.speseCantinaAnno) : 0;
    this.speseMacchineAnno = data.speseMacchineAnno !== undefined ? parseFloat(data.speseMacchineAnno) : 0;
    this.speseProdottiAnno = data.speseProdottiAnno !== undefined ? parseFloat(data.speseProdottiAnno) : 0;
    this.speseAltroAnno = data.speseAltroAnno !== undefined ? parseFloat(data.speseAltroAnno) : 0;
    
    // Costi calcolati
    this.costoTotaleAnno = data.costoTotaleAnno !== undefined ? parseFloat(data.costoTotaleAnno) : 0;
    this.costoPerEttaro = data.costoPerEttaro !== undefined ? parseFloat(data.costoPerEttaro) : 0;
    this.ricavoAnno = data.ricavoAnno !== undefined ? parseFloat(data.ricavoAnno) : 0;
    this.margineAnno = data.margineAnno !== undefined ? parseFloat(data.margineAnno) : 0;
    this.marginePerEttaro = data.marginePerEttaro !== undefined ? parseFloat(data.marginePerEttaro) : 0;
    this.roiAnno = data.roiAnno !== undefined ? parseFloat(data.roiAnno) : 0;
  }
  
  /**
   * Valida dati vigneto
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    // Validazione campi obbligatori
    if (!this.terrenoId || this.terrenoId.trim().length === 0) {
      errors.push('Terreno obbligatorio');
    }
    
    if (!this.varieta || this.varieta.trim().length === 0) {
      errors.push('Varietà uva obbligatoria');
    }
    
    if (!this.annataImpianto || this.annataImpianto < 1900 || this.annataImpianto > new Date().getFullYear()) {
      errors.push('Anno impianto obbligatorio e valido');
    }
    
    if (this.densita === null || this.densita <= 0) {
      errors.push('Densità ceppi/ha obbligatoria e maggiore di zero');
    }
    
    if (!this.formaAllevamento || this.formaAllevamento.trim().length === 0) {
      errors.push('Forma di allevamento obbligatoria');
    }
    
    if (this.distanzaFile === null || this.distanzaFile <= 0) {
      errors.push('Distanza tra file obbligatoria e maggiore di zero');
    }
    
    if (this.distanzaUnita === null || this.distanzaUnita <= 0) {
      errors.push('Distanza tra ceppi obbligatoria e maggiore di zero');
    }
    
    if (this.superficieEttari === null || this.superficieEttari <= 0) {
      errors.push('Superficie ettari obbligatoria e maggiore di zero');
    }
    
    if (!this.tipoPalo || this.tipoPalo.trim().length === 0) {
      errors.push('Tipo palo obbligatorio');
    }
    
    if (!this.destinazioneUva) {
      errors.push('Destinazione uva obbligatoria');
    } else {
      const destinazioniValide = ['vino', 'vendita_uva', 'misto'];
      if (!destinazioniValide.includes(this.destinazioneUva)) {
        errors.push(`Destinazione uva deve essere uno tra: ${destinazioniValide.join(', ')}`);
      }
    }
    
    // Validazione stato impianto
    const statiValidi = ['attivo', 'in_riposo', 'da_rimuovere'];
    if (this.statoImpianto && !statiValidi.includes(this.statoImpianto)) {
      errors.push(`Stato impianto deve essere uno tra: ${statiValidi.join(', ')}`);
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
    
    // Rimuovi alias (vengono ricalcolati al caricamento)
    delete data.densitaCepi;
    delete data.distanzaCepi;
    delete data.sistemaAllevamento;
    
    return data;
  }
  
  /**
   * Calcola costi totali anno
   * NOTA: speseManodoperaAnno include già tutte le sotto-categorie (Potatura, Trattamenti, Vendemmia, ecc.)
   * quindi NON bisogna sommare anche spesePotaturaAnno, speseTrattamentiAnno, speseVendemmiaAnno
   * @returns {number} Costo totale anno in €
   */
  calcolaCostoTotaleAnno() {
    return (this.speseManodoperaAnno || 0) + 
           (this.speseMacchineAnno || 0) + 
           (this.speseProdottiAnno || 0) +
           (this.speseCantinaAnno || 0) + 
           (this.speseAltroAnno || 0);
  }
  
  /**
   * Calcola costo per ettaro
   * @returns {number} Costo per ettaro in €/ha
   */
  calcolaCostoPerEttaro() {
    if (!this.superficieEttari || this.superficieEttari <= 0) {
      return 0;
    }
    return this.costoTotaleAnno / this.superficieEttari;
  }
  
  /**
   * Calcola margine anno
   * @returns {number} Margine anno in €
   */
  calcolaMargineAnno() {
    return this.ricavoAnno - this.costoTotaleAnno;
  }
  
  /**
   * Calcola margine per ettaro
   * @returns {number} Margine per ettaro in €/ha
   */
  calcolaMarginePerEttaro() {
    if (!this.superficieEttari || this.superficieEttari <= 0) {
      return 0;
    }
    return this.margineAnno / this.superficieEttari;
  }
  
  /**
   * Calcola ROI anno
   * @returns {number} ROI anno in %
   */
  calcolaRoiAnno() {
    if (!this.costoTotaleAnno || this.costoTotaleAnno <= 0) {
      return 0;
    }
    return (this.margineAnno / this.costoTotaleAnno) * 100;
  }
  
  /**
   * Aggiorna tutti i costi calcolati
   */
  aggiornaCostiCalcolati() {
    this.costoTotaleAnno = this.calcolaCostoTotaleAnno();
    this.costoPerEttaro = this.calcolaCostoPerEttaro();
    this.margineAnno = this.calcolaMargineAnno();
    this.marginePerEttaro = this.calcolaMarginePerEttaro();
    this.roiAnno = this.calcolaRoiAnno();
  }
  
  /**
   * Verifica se vigneto è attivo
   * @returns {boolean} true se vigneto è attivo
   */
  isAttivo() {
    return this.statoImpianto === 'attivo';
  }
  
  /**
   * Ottieni stato formattato per visualizzazione
   * @returns {string} Stato formattato
   */
  getStatoFormattato() {
    const statiFormattati = {
      'attivo': '✅ Attivo',
      'in_riposo': '⏸️ In riposo',
      'da_rimuovere': '🗑️ Da rimuovere'
    };
    return statiFormattati[this.statoImpianto] || this.statoImpianto;
  }
  
  /**
   * Ottieni destinazione uva formattata
   * @returns {string} Destinazione formattata
   */
  getDestinazioneFormattata() {
    const destinazioniFormattate = {
      'vino': '🍷 Vino',
      'vendita_uva': '🍇 Vendita uva',
      'misto': '🍷🍇 Misto'
    };
    return destinazioniFormattate[this.destinazioneUva] || this.destinazioneUva;
  }
}

export default Vigneto;
