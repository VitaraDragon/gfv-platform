/**
 * Mietitura collegata a un lavoro o a un'attività di diario e a una campagna.
 * Stessi numeri della vendemmia (quintali, ettari, resa, costi). Senza filari,
 * senza gradazione e senza poligono: il seminativo non è un impianto.
 *
 * @module modules/seminativo/models/SeminativoRaccolta
 */

import { isLavorazioneDiFilare } from './SeminativoLavorazione.js';
import { nomiSeedCategoriaCampo, selezionaRigheTrattamento } from './SeminativoTrattamento.js';

export const RACCOLTA_DESTINAZIONI = ['vendita', 'stoccaggio', 'uso_aziendale'];

export const RACCOLTA_DESTINAZIONE_LABELS = {
  vendita: 'Vendita',
  stoccaggio: 'Stoccaggio',
  uso_aziendale: 'Uso aziendale'
};

export function isRaccoltaDiVigneto(nome) {
  return String(nome || '').toLowerCase().includes('vendemmia');
}

/** Catalogo Raccolta a pieno campo: niente vendemmia e niente fila. */
export function nomiSeedRaccoltaCampo() {
  return nomiSeedCategoriaCampo('raccolta').filter((nome) => !isRaccoltaDiVigneto(nome) && !isLavorazioneDiFilare(nome));
}

export function resaQliHa(quantitaQli, quantitaEttari) {
  const qli = Number(quantitaQli);
  const ha = Number(quantitaEttari);
  if (!(qli > 0) || !(ha > 0)) return null;
  return Math.round((qli / ha) * 100) / 100;
}

/** Prima mietitura salvata: la campagna diventa raccolta. Chiuso resta chiuso. */
export function statoDopoRaccolta(stato) {
  if (stato === 'chiuso') return 'chiuso';
  return 'raccolto';
}

/** Nessuna mietitura rimasta: solo lo stato raccolto torna a seminato. */
export function statoDopoRimozioneRaccolta(stato) {
  if (stato === 'raccolto') return 'seminato';
  return stato || 'pianificato';
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export class SeminativoRaccolta {
  constructor(data = {}) {
    this.id = data.id || null;
    this.campagnaId = data.campagnaId || null;
    this.terrenoId = data.terrenoId || null;
    this.lavoroId = data.lavoroId || null;
    this.attivitaId = data.attivitaId || null;
    this.data = data.data || null;
    this.tipoLavoro = data.tipoLavoro || '';
    this.varieta = data.varieta ? String(data.varieta).trim() : '';
    this.quantitaQli = data.quantitaQli != null && data.quantitaQli !== '' ? parseFloat(data.quantitaQli) : null;
    if (Number.isNaN(this.quantitaQli)) this.quantitaQli = null;
    this.quantitaEttari = data.quantitaEttari != null && data.quantitaEttari !== '' ? parseFloat(data.quantitaEttari) : null;
    if (Number.isNaN(this.quantitaEttari)) this.quantitaEttari = null;
    this.destinazione = data.destinazione || null;
    this.costoManodopera = round2(data.costoManodopera);
    this.costoMacchina = round2(data.costoMacchina);
    this.note = data.note || '';
  }

  get resaQliHa() {
    return resaQliHa(this.quantitaQli, this.quantitaEttari);
  }

  get costoTotale() {
    return round2(this.costoManodopera + this.costoMacchina);
  }

  validate() {
    const errors = [];
    if (!this.campagnaId) errors.push('Campagna obbligatoria');
    if (!this.lavoroId && !this.attivitaId) errors.push('Lavoro o attività obbligatori');
    if (!this.data) errors.push('Data raccolta obbligatoria');
    if (!(this.quantitaQli > 0)) errors.push('Quantità in quintali obbligatoria');
    if (!(this.quantitaEttari > 0)) errors.push('Superficie raccolta obbligatoria');
    if (RACCOLTA_DESTINAZIONI.indexOf(this.destinazione) < 0) errors.push('Destinazione non valida');
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    return {
      campagnaId: this.campagnaId,
      terrenoId: this.terrenoId,
      lavoroId: this.lavoroId,
      attivitaId: this.attivitaId,
      data: this.data,
      tipoLavoro: this.tipoLavoro,
      varieta: this.varieta || null,
      quantitaQli: this.quantitaQli,
      quantitaEttari: this.quantitaEttari,
      resaQliHa: this.resaQliHa,
      destinazione: this.destinazione,
      costoManodopera: this.costoManodopera,
      costoMacchina: this.costoMacchina,
      costoTotale: this.costoTotale,
      note: this.note
    };
  }

  static fromData(data) {
    return new SeminativoRaccolta(data || {});
  }
}

/**
 * Stessa selezione dei trattamenti, con i tipi Raccolta a pieno campo.
 * Il documento salvato resta nel campo `trattamento` della riga condivisa:
 * la pagina lo legge come raccolta.
 */
export function selezionaRigheRaccolta(input) {
  return selezionaRigheTrattamento(input);
}
