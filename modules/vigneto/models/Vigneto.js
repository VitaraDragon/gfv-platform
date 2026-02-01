/**
 * Vigneto Model - Modello dati vigneto
 * Estende BaseColtura con campi e logica specifici della viticoltura.
 *
 * @module modules/vigneto/models/Vigneto
 */

import { BaseColtura } from '../../../shared/models/BaseColtura.js';

export class Vigneto extends BaseColtura {
  /**
   * Costruttore Vigneto
   * @param {Object} data - Dati vigneto (campi comuni gestiti da BaseColtura + specifici sotto)
   * @param {string} data.tipoPalo - Tipo palo utilizzato (obbligatorio)
   * @param {string} data.destinazioneUva - "vino" | "vendita_uva" | "misto" (obbligatorio)
   * @param {string} data.cantina - Nome cantina (opzionale)
   * @param {Date|Timestamp} data.dataUltimaVendemmia - Data ultima vendemmia (compat Firestore)
   * @param {number} data.resaMediaQliHa - Resa media storica qli/ettaro
   * @param {number} data.resaAnnoPrecedente - Resa anno precedente qli/ettaro
   * @param {number} data.numeroFilari - Numero filari (opzionale)
   * @param {number} data.ceppiTotali - Ceppi totali (opzionale)
   * @param {number} data.speseVendemmiaAnno - Spese vendemmia anno €
   * @param {number} data.speseCantinaAnno - Spese cantina anno €
   * @param {number} data.speseProdottiAnno - Spese prodotti anno €
   */
  constructor(data = {}) {
    // Compatibilità Firestore: i documenti vigneto usano dataUltimaVendemmia
    const dataForBase = {
      ...data,
      dataUltimaRaccolta: data.dataUltimaRaccolta ?? data.dataUltimaVendemmia ?? null,
    };
    super(dataForBase);

    // Campi specifici vigneto
    this.tipoPalo = data.tipoPalo || null;
    this.destinazioneUva = data.destinazioneUva || null;
    this.cantina = data.cantina || null;
    this.dataUltimaVendemmia = data.dataUltimaVendemmia ?? data.dataUltimaRaccolta ?? null;

    // Alias terminologia viticola (non persistiti, ricalcolati al load)
    this.densitaCepi = this.densita;
    this.distanzaCepi = this.distanzaUnita;
    this.sistemaAllevamento = this.formaAllevamento;

    // Calcolabili (opzionali)
    this.numeroFilari = data.numeroFilari !== undefined ? parseInt(data.numeroFilari) : null;
    this.ceppiTotali = data.ceppiTotali !== undefined ? parseInt(data.ceppiTotali) : null;

    // Rese specifiche vigneto (qli/ha)
    this.resaMediaQliHa = data.resaMediaQliHa !== undefined ? parseFloat(data.resaMediaQliHa) : null;
    this.resaAnnoPrecedente = data.resaAnnoPrecedente !== undefined ? parseFloat(data.resaAnnoPrecedente) : null;
    this.resaPerVarieta = data.resaPerVarieta || {};
    this.trendRese = data.trendRese || [];

    // Spese specifiche vigneto (oltre quelle in BaseColtura)
    this.speseVendemmiaAnno = data.speseVendemmiaAnno !== undefined ? parseFloat(data.speseVendemmiaAnno) : 0;
    this.speseCantinaAnno = data.speseCantinaAnno !== undefined ? parseFloat(data.speseCantinaAnno) : 0;
    this.speseProdottiAnno = data.speseProdottiAnno !== undefined ? parseFloat(data.speseProdottiAnno) : 0;
  }

  /**
   * Valida dati vigneto (validazione base + campi specifici)
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const result = super.validate();
    if (!result.valid) return result;

    const errors = [...result.errors];

    if (!this.varieta || String(this.varieta).trim().length === 0) {
      errors.push('Varietà uva obbligatoria');
    }
    if (!this.tipoPalo || String(this.tipoPalo).trim().length === 0) {
      errors.push('Tipo palo obbligatorio');
    }
    if (!this.destinazioneUva) {
      errors.push('Destinazione uva obbligatoria');
    } else {
      const ok = ['vino', 'vendita_uva', 'misto'];
      if (!ok.includes(this.destinazioneUva)) {
        errors.push(`Destinazione uva deve essere uno tra: ${ok.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Converte modello in formato Firestore (compatibile con documenti esistenti)
   */
  toFirestore() {
    const data = super.toFirestore();
    delete data.densitaCepi;
    delete data.distanzaCepi;
    delete data.sistemaAllevamento;
    // Firestore vigneti usa dataUltimaVendemmia; non scrivere dataUltimaRaccolta per evitare duplicati
    if (data.dataUltimaRaccolta !== undefined) {
      data.dataUltimaVendemmia = data.dataUltimaRaccolta;
      delete data.dataUltimaRaccolta;
    }
    return data;
  }

  /**
   * Calcolo costi anno vigneto (include cantina e prodotti, come da logica esistente)
   * @returns {number} Costo totale anno in €
   */
  calcolaCostoTotaleAnno() {
    return (
      (this.speseManodoperaAnno || 0) +
      (this.speseMacchineAnno || 0) +
      (this.speseProdottiAnno || 0) +
      (this.speseCantinaAnno || 0) +
      (this.speseAltroAnno || 0)
    );
  }

  /**
   * Ottieni destinazione uva formattata per UI
   * @returns {string}
   */
  getDestinazioneFormattata() {
    const m = {
      vino: '🍷 Vino',
      vendita_uva: '🍇 Vendita uva',
      misto: '🍷🍇 Misto',
    };
    return m[this.destinazioneUva] || this.destinazioneUva;
  }
}

export default Vigneto;
