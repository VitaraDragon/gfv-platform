/**
 * Frutteto Model - Modello dati frutteto
 * Estende BaseColtura con campi e logica specifici della frutticoltura.
 *
 * @module modules/frutteto/models/Frutteto
 */

import { BaseColtura } from '../../../shared/models/BaseColtura.js';

export class Frutteto extends BaseColtura {
  /**
   * Costruttore Frutteto
   * @param {Object} data - Dati frutteto (campi comuni gestiti da BaseColtura + specifici sotto)
   * @param {string} data.specie - Specie fruttifera (obbligatorio): "Melo", "Pesco", "Pero", ecc.
   * @param {number} data.pianteTotali - Numero totale piante (opzionale, calcolabile)
   * @param {string} data.calibroMedio - Calibro medio frutta (opzionale)
   * @param {string} data.gradoMaturazione - Grado maturazione tipico (opzionale)
   * @param {number} data.speseProdottiAnno - Spese prodotti anno € (opzionale, da aggregazione lavori)
   */
  constructor(data = {}) {
    super(data);

    // Campi specifici frutteto
    this.specie = data.specie || null;

    // Spese specifiche frutteto (oltre BaseColtura; allineato a vigneto)
    this.speseProdottiAnno = data.speseProdottiAnno !== undefined ? parseFloat(data.speseProdottiAnno) : 0;

    // Alias terminologia frutticola (non persistiti, ricalcolati al load)
    this.densitaPiante = this.densita;
    this.distanzaPiante = this.distanzaUnita;
    this.sistemaAllevamento = this.formaAllevamento;

    // Calcolabili (opzionali)
    this.pianteTotali = data.pianteTotali !== undefined ? parseInt(data.pianteTotali) : null;

    // Qualità frutta (opzionali)
    this.calibroMedio = data.calibroMedio || null;
    this.gradoMaturazione = data.gradoMaturazione || null;
  }

  /**
   * Valida dati frutteto (validazione base + campi specifici)
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const result = super.validate();
    if (!result.valid) return result;

    const errors = [...result.errors];

    if (!this.varieta || String(this.varieta).trim().length === 0) {
      errors.push('Varietà obbligatoria');
    }
    if (!this.specie || String(this.specie).trim().length === 0) {
      errors.push('Specie fruttifera obbligatoria');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Calcolo costi anno frutteto (include spese prodotti, come da logica vigneto)
   * @returns {number} Costo totale anno in €
   */
  calcolaCostoTotaleAnno() {
    return (
      (this.speseManodoperaAnno || 0) +
      (this.speseMacchineAnno || 0) +
      (this.speseProdottiAnno || 0) +
      (this.speseTrattamentiAnno || 0) +
      (this.spesePotaturaAnno || 0) +
      (this.speseRaccoltaAnno || 0) +
      (this.speseAltroAnno || 0)
    );
  }

  /**
   * Converte modello in formato Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    // Rimuovi alias (vengono ricalcolati al caricamento)
    delete data.densitaPiante;
    delete data.distanzaPiante;
    delete data.sistemaAllevamento;
    return data;
  }
}

export default Frutteto;
