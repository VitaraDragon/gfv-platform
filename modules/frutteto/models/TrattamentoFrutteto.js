/**
 * TrattamentoFrutteto Model - Modello dati trattamento frutteto
 * Gestisce registrazione trattamenti fitosanitari con calcolo costi e giorni di carenza (allineato a TrattamentoVigneto)
 *
 * @module modules/frutteto/models/TrattamentoFrutteto
 */

import { Base } from '../../../core/models/Base.js';

export class TrattamentoFrutteto extends Base {
  /**
   * Costruttore TrattamentoFrutteto
   * @param {Object} data - Dati trattamento
   */
  constructor(data = {}) {
    super(data);

    this.fruttetoId = data.fruttetoId || null;
    this.lavoroId = data.lavoroId || null;
    this.attivitaId = data.attivitaId || null;
    this.data = data.data || null;
    this.prodotto = data.prodotto || '';
    this.dosaggio = data.dosaggio || '';
    this.tipoTrattamento = data.tipoTrattamento || '';

    this.condizioniMeteo = data.condizioniMeteo || null;
    this.temperatura = data.temperatura !== undefined ? parseFloat(data.temperatura) : null;
    this.umidita = data.umidita !== undefined ? parseFloat(data.umidita) : null;
    this.velocitaVento = data.velocitaVento !== undefined ? parseFloat(data.velocitaVento) : null;

    this.operatore = data.operatore || null;
    this.macchinaId = data.macchinaId || null;
    this.superficieTrattata = data.superficieTrattata !== undefined ? parseFloat(data.superficieTrattata) : null;

    this.costoProdotto = data.costoProdotto !== undefined ? parseFloat(data.costoProdotto) : null;
    this.costoManodopera = data.costoManodopera !== undefined ? parseFloat(data.costoManodopera) : 0;
    this.costoMacchina = data.costoMacchina !== undefined ? parseFloat(data.costoMacchina) : 0;
    this.costoTotale = data.costoTotale !== undefined ? parseFloat(data.costoTotale) : 0;

    this.giorniCarenza = data.giorniCarenza !== undefined ? parseInt(data.giorniCarenza) : null;
    this.dataRaccoltaMinima = data.dataRaccoltaMinima || null;

    this.parcella = data.parcella || null;
    this.note = data.note || '';
  }

  validate() {
    const errors = [];
    const fromLavoroAttivita = this.lavoroId || this.attivitaId;
    if (!this.fruttetoId || String(this.fruttetoId).trim().length === 0) errors.push('Frutteto obbligatorio');
    if (!this.data) errors.push('Data trattamento obbligatoria');
    if (!fromLavoroAttivita) {
      if (!this.prodotto || this.prodotto.trim().length === 0) errors.push('Prodotto obbligatorio');
      if (!this.dosaggio || this.dosaggio.trim().length === 0) errors.push('Dosaggio obbligatorio');
    }
    if (!this.tipoTrattamento || this.tipoTrattamento.trim().length === 0) {
      if (!fromLavoroAttivita) errors.push('Tipo trattamento obbligatorio');
    } else {
      const tipiValidi = ['antifungino', 'insetticida', 'acaricida', 'fertilizzante', 'altro'];
      if (!tipiValidi.includes(this.tipoTrattamento)) errors.push(`Tipo trattamento deve essere uno tra: ${tipiValidi.join(', ')}`);
    }
    if (!fromLavoroAttivita && (!this.operatore || String(this.operatore).trim().length === 0)) errors.push('Operatore obbligatorio');
    if (!fromLavoroAttivita && (this.superficieTrattata === null || this.superficieTrattata <= 0)) errors.push('Superficie trattata obbligatoria e maggiore di zero');
    if (!fromLavoroAttivita && (this.costoProdotto === null || this.costoProdotto < 0)) errors.push('Costo prodotto obbligatorio e non negativo');
    if (this.temperatura !== null && (this.temperatura < -50 || this.temperatura > 50)) errors.push('Temperatura deve essere tra -50 e 50 °C');
    if (this.umidita !== null && (this.umidita < 0 || this.umidita > 100)) errors.push('Umidità relativa deve essere tra 0 e 100%');
    if (this.velocitaVento !== null && this.velocitaVento < 0) errors.push('Velocità vento non può essere negativa');
    return { valid: errors.length === 0, errors };
  }

  calcolaCostoTotale() {
    return this.costoProdotto + this.costoManodopera + this.costoMacchina;
  }

  calcolaDataRaccoltaMinima() {
    if (!this.data || !this.giorniCarenza || this.giorniCarenza <= 0) return null;
    const dataTrattamento = this.data instanceof Date ? this.data : new Date(this.data.toDate ? this.data.toDate() : this.data);
    const dataMinima = new Date(dataTrattamento);
    dataMinima.setDate(dataMinima.getDate() + this.giorniCarenza);
    return dataMinima;
  }

  aggiornaCalcoli() {
    this.costoTotale = this.calcolaCostoTotale();
    this.dataRaccoltaMinima = this.calcolaDataRaccoltaMinima();
  }

  getTipoFormattato() {
    const tipiFormattati = {
      antifungino: '🦠 Antifungino',
      insetticida: '🐛 Insetticida',
      acaricida: '🕷️ Acaricida',
      fertilizzante: '🌱 Fertilizzante',
      altro: '📦 Altro'
    };
    return tipiFormattati[this.tipoTrattamento] || this.tipoTrattamento;
  }
}

export default TrattamentoFrutteto;
