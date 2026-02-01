/**
 * BaseColtura - Modello base condiviso per anagrafiche colture specializzate
 * (Vigneto, Frutteto, Oliveto). Contiene solo campi e logica comuni.
 * Le sottoclassi aggiungono campi e validazioni specifiche.
 *
 * @module shared/models/BaseColtura
 */

import { Base } from '../../core/models/Base.js';

/**
 * Campi comuni anagrafica (da PLAN_MODULI_COLTURA_SPECIALIZZATI):
 * terrenoId, varieta, annataImpianto, portainnesto, densita, formaAllevamento,
 * tipoImpianto, distanzaFile, distanzaUnita, orientamentoFilari, superficieEttari, note
 *
 * Campi comuni rese/produzione: produzioneTotaleAnno, produzioneTotaleAnnoPrecedente
 * Campi comuni spese/costi: speseManodoperaAnno, speseTrattamentiAnno, spesePotaturaAnno,
 * speseRaccoltaAnno, speseMacchineAnno, speseAltroAnno, costoTotaleAnno, costoPerEttaro,
 * ricavoAnno, margineAnno, marginePerEttaro, roiAnno
 *
 * Campi comuni tracciamento: dataUltimaPotatura, dataUltimoTrattamento, dataUltimaRaccolta, statoImpianto
 */
export class BaseColtura extends Base {
  constructor(data = {}) {
    super(data);

    // Anagrafica (comuni)
    this.terrenoId = data.terrenoId || null;
    // varietà: string per vigneto/frutteto, array per oliveto
    this.varieta = data.varieta !== undefined ? data.varieta : '';
    this.annataImpianto = data.annataImpianto || null;
    this.portainnesto = data.portainnesto || null;
    this.densita = data.densita !== undefined ? parseFloat(data.densita) : null;
    this.formaAllevamento = data.formaAllevamento || '';
    this.tipoImpianto = data.tipoImpianto || null;
    this.distanzaFile = data.distanzaFile !== undefined ? parseFloat(data.distanzaFile) : null;
    this.distanzaUnita = data.distanzaUnita !== undefined ? parseFloat(data.distanzaUnita) : null;
    this.orientamentoFilari = data.orientamentoFilari || null;
    this.superficieEttari = data.superficieEttari !== undefined ? parseFloat(data.superficieEttari) : null;
    this.note = data.note || '';

    // Stato e tracciamento
    this.statoImpianto = data.statoImpianto || 'attivo';
    this.dataUltimaPotatura = data.dataUltimaPotatura || null;
    this.dataUltimoTrattamento = data.dataUltimoTrattamento || null;
    this.dataUltimaRaccolta = data.dataUltimaRaccolta || null;

    // Rese / produzione (numeri generici; unità per sottoclasse)
    this.produzioneTotaleAnno = data.produzioneTotaleAnno !== undefined ? parseFloat(data.produzioneTotaleAnno) : 0;
    this.produzioneTotaleAnnoPrecedente = data.produzioneTotaleAnnoPrecedente !== undefined ? parseFloat(data.produzioneTotaleAnnoPrecedente) : null;

    // Spese e costi (comuni)
    this.speseManodoperaAnno = data.speseManodoperaAnno !== undefined ? parseFloat(data.speseManodoperaAnno) : 0;
    this.speseTrattamentiAnno = data.speseTrattamentiAnno !== undefined ? parseFloat(data.speseTrattamentiAnno) : 0;
    this.spesePotaturaAnno = data.spesePotaturaAnno !== undefined ? parseFloat(data.spesePotaturaAnno) : 0;
    this.speseRaccoltaAnno = data.speseRaccoltaAnno !== undefined ? parseFloat(data.speseRaccoltaAnno) : 0;
    this.speseMacchineAnno = data.speseMacchineAnno !== undefined ? parseFloat(data.speseMacchineAnno) : 0;
    this.speseAltroAnno = data.speseAltroAnno !== undefined ? parseFloat(data.speseAltroAnno) : 0;

    this.costoTotaleAnno = data.costoTotaleAnno !== undefined ? parseFloat(data.costoTotaleAnno) : 0;
    this.costoPerEttaro = data.costoPerEttaro !== undefined ? parseFloat(data.costoPerEttaro) : 0;
    this.ricavoAnno = data.ricavoAnno !== undefined ? parseFloat(data.ricavoAnno) : 0;
    this.margineAnno = data.margineAnno !== undefined ? parseFloat(data.margineAnno) : 0;
    this.marginePerEttaro = data.marginePerEttaro !== undefined ? parseFloat(data.marginePerEttaro) : 0;
    this.roiAnno = data.roiAnno !== undefined ? parseFloat(data.roiAnno) : 0;
  }

  /**
   * Validazione campi comuni. Le sottoclassi chiamano super.validate() e aggiungono errori propri.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];

    if (!this.terrenoId || String(this.terrenoId).trim().length === 0) {
      errors.push('Terreno obbligatorio');
    }
    if (!this.annataImpianto || this.annataImpianto < 1900 || this.annataImpianto > new Date().getFullYear()) {
      errors.push('Anno impianto obbligatorio e valido');
    }
    if (this.densita === null || this.densita <= 0) {
      errors.push('Densità obbligatoria e maggiore di zero');
    }
    if (!this.formaAllevamento || String(this.formaAllevamento).trim().length === 0) {
      errors.push('Forma di allevamento obbligatoria');
    }
    if (this.distanzaFile === null || this.distanzaFile <= 0) {
      errors.push('Distanza tra file obbligatoria e maggiore di zero');
    }
    if (this.distanzaUnita === null || this.distanzaUnita <= 0) {
      errors.push('Distanza tra unità obbligatoria e maggiore di zero');
    }
    if (this.superficieEttari === null || this.superficieEttari <= 0) {
      errors.push('Superficie ettari obbligatoria e maggiore di zero');
    }
    const statiValidi = ['attivo', 'in_riposo', 'da_rimuovere'];
    if (this.statoImpianto && !statiValidi.includes(this.statoImpianto)) {
      errors.push(`Stato impianto deve essere uno tra: ${statiValidi.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Calcolo costo totale anno con sole spese comuni.
   * Le sottoclassi possono sovrascrivere per includere spese specifiche.
   * @returns {number}
   */
  calcolaCostoTotaleAnno() {
    return (
      (this.speseManodoperaAnno || 0) +
      (this.speseTrattamentiAnno || 0) +
      (this.spesePotaturaAnno || 0) +
      (this.speseRaccoltaAnno || 0) +
      (this.speseMacchineAnno || 0) +
      (this.speseAltroAnno || 0)
    );
  }

  /**
   * @returns {number} Costo per ettaro in €/ha
   */
  calcolaCostoPerEttaro() {
    if (!this.superficieEttari || this.superficieEttari <= 0) return 0;
    return this.calcolaCostoTotaleAnno() / this.superficieEttari;
  }

  /**
   * @returns {number} Margine anno in €
   */
  calcolaMargineAnno() {
    return (this.ricavoAnno || 0) - this.calcolaCostoTotaleAnno();
  }

  /**
   * @returns {number} Margine per ettaro in €/ha
   */
  calcolaMarginePerEttaro() {
    if (!this.superficieEttari || this.superficieEttari <= 0) return 0;
    return this.calcolaMargineAnno() / this.superficieEttari;
  }

  /**
   * @returns {number} ROI anno in %
   */
  calcolaRoiAnno() {
    const ct = this.calcolaCostoTotaleAnno();
    if (!ct || ct <= 0) return 0;
    return (this.calcolaMargineAnno() / ct) * 100;
  }

  /**
   * Aggiorna i campi calcolati (costo totale, costo/ha, margine, ROI).
   * Le sottoclassi possono estendere per altre metriche.
   */
  aggiornaCostiCalcolati() {
    this.costoTotaleAnno = this.calcolaCostoTotaleAnno();
    this.costoPerEttaro = this.calcolaCostoPerEttaro();
    this.margineAnno = this.calcolaMargineAnno();
    this.marginePerEttaro = this.calcolaMarginePerEttaro();
    this.roiAnno = this.calcolaRoiAnno();
  }

  /**
   * @returns {boolean} true se impianto è attivo
   */
  isAttivo() {
    return this.statoImpianto === 'attivo';
  }

  /**
   * @returns {string} Stato formattato per UI
   */
  getStatoFormattato() {
    const m = {
      attivo: '✅ Attivo',
      in_riposo: '⏸️ In riposo',
      da_rimuovere: '🗑️ Da rimuovere',
    };
    return m[this.statoImpianto] || this.statoImpianto;
  }
}

export default BaseColtura;
