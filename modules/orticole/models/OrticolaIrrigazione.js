/**
 * Irrigazione collegata a un lavoro o a un'attività di diario e a una campagna.
 * Collezione: tenants/{tenantId}/irrigazioniOrticole
 *
 * @module modules/orticole/models/OrticolaIrrigazione
 */

import { isLavorazioneDiFilare } from './OrticolaLavorazione.js';
import { nomiSeedCategoriaCampo, selezionaRigheTrattamento } from './OrticolaTrattamento.js';

export const IRRIGAZIONE_METODI = ['a_goccia', 'aspersione', 'scorrimento'];

export const IRRIGAZIONE_METODO_LABELS = {
  a_goccia: 'A goccia',
  aspersione: 'Aspersione',
  scorrimento: 'Scorrimento'
};

export const IRRIGAZIONE_UNITA_VOLUME = 'm3';

/** Tipi seed allineati al tendina metodi. */
export const IRRIGAZIONE_TIPI_SEED = [
  'Irrigazione a goccia',
  'Irrigazione a aspersione',
  'Irrigazione a scorrimento'
];

export function metodoDaTipoLavoro(nome) {
  const k = String(nome || '').toLowerCase();
  if (k.includes('goccia')) return 'a_goccia';
  if (k.includes('aspers')) return 'aspersione';
  if (k.includes('scorr')) return 'scorrimento';
  return null;
}

export function isTipoIrrigazione(nome) {
  const k = String(nome || '').toLowerCase();
  return k.includes('irrigazione') && !k.includes('manutenzione');
}

export function nomiSeedIrrigazioneCampo() {
  const fromCatalog = nomiSeedCategoriaCampo('trattamenti')
    .filter((nome) => isTipoIrrigazione(nome) && !isLavorazioneDiFilare(nome));
  if (fromCatalog.length > 0) return fromCatalog;
  return IRRIGAZIONE_TIPI_SEED.slice();
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export class OrticolaIrrigazione {
  constructor(data = {}) {
    this.id = data.id || null;
    this.campagnaId = data.campagnaId || null;
    this.terrenoId = data.terrenoId || null;
    this.lavoroId = data.lavoroId || null;
    this.attivitaId = data.attivitaId || null;
    this.data = data.data || null;
    this.tipoLavoro = data.tipoLavoro || '';
    this.metodo = data.metodo || metodoDaTipoLavoro(data.tipoLavoro) || null;
    this.volumeM3 = data.volumeM3 != null && data.volumeM3 !== ''
      ? parseFloat(data.volumeM3)
      : (data.volume != null && data.volume !== '' ? parseFloat(data.volume) : null);
    if (Number.isNaN(this.volumeM3)) this.volumeM3 = null;
    this.unitaVolume = data.unitaVolume || IRRIGAZIONE_UNITA_VOLUME;
    this.superficieEttari = data.superficieEttari != null && data.superficieEttari !== ''
      ? parseFloat(data.superficieEttari)
      : null;
    if (Number.isNaN(this.superficieEttari)) this.superficieEttari = null;
    this.costoManodopera = round2(data.costoManodopera);
    this.costoMacchina = round2(data.costoMacchina);
    this.note = data.note || '';
  }

  get costoTotale() {
    return round2(this.costoManodopera + this.costoMacchina);
  }

  validate() {
    const errors = [];
    if (!this.campagnaId) errors.push('Campagna obbligatoria');
    if (!this.lavoroId && !this.attivitaId) errors.push('Lavoro o attività obbligatori');
    if (!this.data) errors.push('Data irrigazione obbligatoria');
    if (!(this.volumeM3 > 0)) errors.push('Volume in m³ obbligatorio');
    if (this.unitaVolume !== IRRIGAZIONE_UNITA_VOLUME) errors.push('Unità volume deve essere m3');
    if (IRRIGAZIONE_METODI.indexOf(this.metodo) < 0) errors.push('Metodo irrigazione non valido');
    if (this.superficieEttari != null && !(this.superficieEttari > 0)) {
      errors.push('Superficie deve essere maggiore di zero');
    }
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
      metodo: this.metodo,
      volumeM3: this.volumeM3,
      unitaVolume: this.unitaVolume,
      superficieEttari: this.superficieEttari,
      costoManodopera: this.costoManodopera,
      costoMacchina: this.costoMacchina,
      costoTotale: this.costoTotale,
      note: this.note
    };
  }

  static fromData(data) {
    return new OrticolaIrrigazione(data || {});
  }
}

export function selezionaRigheIrrigazione(input) {
  return selezionaRigheTrattamento(input);
}
