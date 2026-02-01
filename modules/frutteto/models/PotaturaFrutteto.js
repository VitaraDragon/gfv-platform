/**
 * PotaturaFrutteto Model - Modello dati potatura frutteto
 * Gestisce registrazione potature con calcolo costi (allineato a PotaturaVigneto)
 *
 * @module modules/frutteto/models/PotaturaFrutteto
 */

import { Base } from '../../../core/models/Base.js';

export class PotaturaFrutteto extends Base {
  /**
   * Costruttore PotaturaFrutteto
   * @param {Object} data - Dati potatura
   * @param {string} data.id - ID potatura
   * @param {string} data.fruttetoId - Riferimento frutteto (obbligatorio)
   * @param {string} data.lavoroId - Riferimento lavoro (opzionale, se creata da lavoro)
   * @param {string} data.attivitaId - Riferimento attività (opzionale, se creata da attività)
   * @param {Date|Timestamp} data.data - Data potatura (obbligatorio)
   * @param {string} data.tipo - Tipo potatura: "invernale" | "verde" | "formazione" | "rinnovo" | "diradamento" (obbligatorio)
   * @param {string} data.parcella - Parcella/blocco potato (opzionale)
   * @param {number} data.piantePotate - Numero piante potate (obbligatorio)
   * @param {Array<string>} data.operai - Array ID operai coinvolti (obbligatorio)
   * @param {number} data.oreImpiegate - Ore totali impiegate (obbligatorio)
   * @param {number} data.costoManodopera - Costo manodopera in € (calcolato)
   * @param {string} data.macchinaId - ID macchina utilizzata (opzionale)
   * @param {number} data.costoMacchina - Costo macchina in € (calcolato)
   * @param {number} data.costoTotale - Costo totale in € (calcolato)
   * @param {Array<{lat: number, lng: number}>} data.poligonoPotatura - Coordinate area potata (zone lavorate, come raccolta)
   * @param {string} data.note - Note (opzionale)
   */
  constructor(data = {}) {
    super(data);

    this.fruttetoId = data.fruttetoId || null;
    this.lavoroId = data.lavoroId || null;
    this.attivitaId = data.attivitaId || null;
    this.data = data.data || null;
    this.tipo = data.tipo || '';
    this.parcella = data.parcella || null;
    this.piantePotate = data.piantePotate !== undefined ? parseInt(data.piantePotate) : null;

    this.operai = Array.isArray(data.operai) ? data.operai : [];
    this.oreImpiegate = data.oreImpiegate !== undefined ? parseFloat(data.oreImpiegate) : null;

    this.costoManodopera = data.costoManodopera !== undefined ? parseFloat(data.costoManodopera) : 0;
    this.macchinaId = data.macchinaId || null;
    this.costoMacchina = data.costoMacchina !== undefined ? parseFloat(data.costoMacchina) : 0;
    this.costoTotale = data.costoTotale !== undefined ? parseFloat(data.costoTotale) : 0;

    // Zone lavorate: poligono area potata (come vendemmia/raccolta)
    this.poligonoPotatura = Array.isArray(data.poligonoPotatura) ? data.poligonoPotatura : null;

    this.note = data.note || '';
  }

  validate() {
    const errors = [];
    if (!this.fruttetoId || String(this.fruttetoId).trim().length === 0) errors.push('Frutteto obbligatorio');
    if (!this.data) errors.push('Data potatura obbligatoria');
    const fromLavoroAttivita = this.lavoroId || this.attivitaId;
    if (!this.tipo || this.tipo.trim().length === 0) {
      if (!fromLavoroAttivita) errors.push('Tipo potatura obbligatorio');
    } else {
      const tipiValidi = ['invernale', 'verde', 'formazione', 'rinnovo', 'diradamento'];
      if (!tipiValidi.includes(this.tipo)) errors.push(`Tipo potatura deve essere uno tra: ${tipiValidi.join(', ')}`);
    }
    if (!fromLavoroAttivita && (this.piantePotate === null || this.piantePotate <= 0)) errors.push('Numero piante potate obbligatorio e maggiore di zero');
    if (!fromLavoroAttivita && (!this.operai || this.operai.length === 0)) errors.push('Almeno un operaio coinvolto obbligatorio');
    if (!fromLavoroAttivita && (this.oreImpiegate === null || this.oreImpiegate <= 0)) errors.push('Ore impiegate obbligatorie e maggiori di zero');
    return { valid: errors.length === 0, errors };
  }

  calcolaCostoTotale() {
    return this.costoManodopera + this.costoMacchina;
  }

  aggiornaCalcoli() {
    this.costoTotale = this.calcolaCostoTotale();
  }

  getTipoFormattato() {
    const tipiFormattati = {
      invernale: '❄️ Potatura Invernale',
      verde: '🌿 Potatura Verde',
      formazione: '🌱 Potatura di Formazione',
      rinnovo: '🔄 Potatura di Rinnovo',
      diradamento: '✂️ Diradamento'
    };
    return tipiFormattati[this.tipo] || this.tipo;
  }
}

export default PotaturaFrutteto;
