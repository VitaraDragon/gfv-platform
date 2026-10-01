/**
 * Trattamento fitosanitario collegato a un lavoro o a un'attività di diario
 * e a una campagna seminativo. Stesso flusso del vigneto: la riga nasce dal lavoro,
 * qui si completano prodotto, dose e costo.
 *
 * @module modules/seminativo/models/SeminativoTrattamento
 */

import { dataIsoLavorazione, isLavorazioneDiFilare } from './SeminativoLavorazione.js';
import { intervalloCampagna } from './SeminativoSpese.js';
import { TIPI_LAVORO_PREDEFINITI } from '../../../core/config/app-catalog-seed-data.js';

export const TRATTAMENTO_UNITA = ['kg/ha', 'l/ha', 'kg', 'l'];

export function nomiSeedCategoriaCampo(codice) {
  const root = String(codice || '').toLowerCase();
  return TIPI_LAVORO_PREDEFINITI
    .filter((tipo) => String(tipo.sottocategoriaCodice || '').startsWith(root))
    .map((tipo) => String(tipo.nome || '').trim())
    .filter((nome) => nome && !isLavorazioneDiFilare(nome))
    .map((nome) => nome.toLowerCase());
}

export class SeminativoTrattamento {
  constructor(data = {}) {
    this.id = data.id || null;
    this.campagnaId = data.campagnaId || null;
    this.terrenoId = data.terrenoId || null;
    this.lavoroId = data.lavoroId || null;
    this.attivitaId = data.attivitaId || null;
    this.data = data.data || null;
    this.tipoLavoro = data.tipoLavoro ? String(data.tipoLavoro).trim() : '';
    this.tipoTrattamento = data.tipoTrattamento || '';
    if (Array.isArray(data.prodotti) && data.prodotti.length > 0) {
      this.prodotti = data.prodotti.map((row) => ({
        prodottoId: row.prodottoId || null,
        prodotto: row.prodotto != null ? String(row.prodotto) : '',
        dosaggio: row.dosaggio !== undefined && row.dosaggio !== '' ? parseFloat(row.dosaggio) : null,
        unitaDosaggio: row.unitaDosaggio || null,
        quantita: row.quantita !== undefined && row.quantita !== '' ? parseFloat(row.quantita) : null,
        costo: row.costo !== undefined && row.costo !== '' ? parseFloat(row.costo) : 0
      }));
    } else if (data.prodotto) {
      this.prodotti = [{
        prodottoId: null,
        prodotto: String(data.prodotto),
        dosaggio: data.dosaggio !== undefined && data.dosaggio !== '' ? parseFloat(data.dosaggio) : null,
        unitaDosaggio: data.unitaDosaggio || null,
        quantita: null,
        costo: Number(data.costoProdotto) || 0
      }];
    } else {
      this.prodotti = [];
    }
    this.prodotto = this.prodotti.map((row) => row.prodotto).filter(Boolean).join(', ');
    this.superficieTrattata = data.superficieTrattata !== undefined && data.superficieTrattata !== null && data.superficieTrattata !== ''
      ? parseFloat(data.superficieTrattata)
      : null;
    this.superficieDaAnagrafeTerreno = data.superficieDaAnagrafeTerreno === true;
    this.giorniCarenza = data.giorniCarenza !== undefined && data.giorniCarenza !== null && data.giorniCarenza !== ''
      ? parseInt(data.giorniCarenza, 10)
      : null;
    this.costoProdotto = this.prodotti.reduce((sum, row) => sum + (Number(row.costo) || 0), 0);
    this.costoManodopera = Number(data.costoManodopera) || 0;
    this.costoMacchina = Number(data.costoMacchina) || 0;
    this.note = data.note || '';
    this.condizioniMeteo = data.condizioniMeteo || null;
    const copertura = data.coperturaTerreno;
    this.coperturaTerreno = copertura === 'completa' || copertura === 'parziale' || copertura === 'non_dichiarata'
      ? copertura
      : 'non_dichiarata';
    this.magazzinoMovimentoIds = Array.isArray(data.magazzinoMovimentoIds)
      ? data.magazzinoMovimentoIds.filter(Boolean)
      : [];
    this.operatore = data.operatore || '';
  }

  get costoTotale() {
    return Math.round((this.costoProdotto + this.costoManodopera + this.costoMacchina) * 100) / 100;
  }

  validate() {
    const errors = [];
    if (!this.campagnaId) errors.push('Campagna obbligatoria');
    if (!this.lavoroId && !this.attivitaId) errors.push('Serve un lavoro o un\'attività di diario');
    if (!this.data) errors.push('Data obbligatoria');
    const conNome = (this.prodotti || []).filter((row) => String(row.prodotto || '').trim());
    if (!conNome.length) errors.push('Aggiungi almeno una riga prodotto');
    return { valid: errors.length === 0, errors };
  }

  toFirestore() {
    const prima = (this.prodotti || []).find((row) => String(row.prodotto || '').trim());
    return {
      campagnaId: this.campagnaId,
      terrenoId: this.terrenoId,
      lavoroId: this.lavoroId,
      attivitaId: this.attivitaId,
      data: this.data,
      tipoLavoro: this.tipoLavoro,
      tipoTrattamento: this.tipoTrattamento,
      prodotto: prima ? prima.prodotto : '',
      dosaggio: prima ? prima.dosaggio : null,
      unitaDosaggio: prima ? prima.unitaDosaggio : null,
      prodotti: this.prodotti,
      superficieTrattata: this.superficieTrattata,
      superficieDaAnagrafeTerreno: this.superficieDaAnagrafeTerreno,
      giorniCarenza: this.giorniCarenza,
      costoProdotto: this.costoProdotto,
      costoManodopera: this.costoManodopera,
      costoMacchina: this.costoMacchina,
      costoTotale: this.costoTotale,
      note: this.note,
      condizioniMeteo: this.condizioniMeteo,
      coperturaTerreno: this.coperturaTerreno,
      operatore: this.operatore,
      magazzinoMovimentoIds: this.magazzinoMovimentoIds
    };
  }

  static fromData(data) {
    return new SeminativoTrattamento(data);
  }
}

function campagnaPer(terrenoId, dataIso, campagne) {
  return (campagne || []).find((campagna) => {
    if (String(campagna.terrenoId || '') !== String(terrenoId || '')) return false;
    const range = intervalloCampagna(campagna.campagna);
    return range && dataIso >= range.inizio && dataIso <= range.fine;
  }) || null;
}

/**
 * Righe di lista: lavori e diario di categoria Trattamenti, sul terreno di una campagna.
 * @param {Object} input
 */
export function selezionaRigheTrattamento(input = {}) {
  const terrenoIds = new Set((input.terreni || []).map((t) => String(t.id || '')).filter(Boolean));
  const nomi = new Set((input.nomiTipi || []).map((nome) => String(nome || '').trim().toLowerCase()).filter(Boolean));
  const includeLavori = input.includeLavori !== false;
  const campagne = input.campagne || [];
  const byLavoro = new Map();
  const byAttivita = new Map();
  (input.trattamenti || []).forEach((trattamento) => {
    if (trattamento && trattamento.lavoroId) byLavoro.set(String(trattamento.lavoroId), trattamento);
    if (trattamento && trattamento.attivitaId) byAttivita.set(String(trattamento.attivitaId), trattamento);
  });

  const tipoOk = (nome) => nomi.has(String(nome || '').trim().toLowerCase());
  const righe = [];
  const chiaviLavoro = new Set();

  if (includeLavori) {
    (input.lavori || []).forEach((lavoro) => {
      if (!lavoro || lavoro.stato === 'annullato') return;
      const terrenoId = String(lavoro.terrenoId || '');
      if (!terrenoIds.has(terrenoId)) return;
      const tipo = String(lavoro.tipoLavoro || '').trim();
      if (!tipoOk(tipo)) return;
      const data = dataIsoLavorazione(lavoro.dataInizio || lavoro.data);
      const campagna = campagnaPer(terrenoId, data, campagne);
      if (!data || !campagna) return;
      chiaviLavoro.add(`${terrenoId}|${data}|${tipo.toLowerCase()}`);
      righe.push({
        source: 'lavoro',
        lavoroId: lavoro.id,
        attivitaId: null,
        data,
        tipoLavoro: tipo,
        terrenoId,
        campagnaId: campagna.id,
        campagna: campagna.campagna,
        colturaNome: campagna.colturaNome || '',
        superficieEttari: campagna.superficieEttari != null ? campagna.superficieEttari : null,
        trattamento: byLavoro.get(String(lavoro.id)) || null
      });
    });
  }

  (input.attivita || []).forEach((att) => {
    if (!att || att.lavoroId || att.clienteId) return;
    const terrenoId = String(att.terrenoId || '');
    if (!terrenoIds.has(terrenoId)) return;
    const tipo = String(att.tipoLavoro || '').trim();
    if (!tipoOk(tipo)) return;
    const data = dataIsoLavorazione(att.data);
    if (chiaviLavoro.has(`${terrenoId}|${data}|${tipo.toLowerCase()}`)) return;
    const campagna = campagnaPer(terrenoId, data, campagne);
    if (!data || !campagna) return;
    righe.push({
      source: 'diario',
      lavoroId: null,
      attivitaId: att.id,
      data,
      tipoLavoro: tipo,
      terrenoId,
      campagnaId: campagna.id,
      campagna: campagna.campagna,
      colturaNome: campagna.colturaNome || '',
      superficieEttari: campagna.superficieEttari != null ? campagna.superficieEttari : null,
      trattamento: byAttivita.get(String(att.id)) || null
    });
  });

  righe.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return righe;
}

/**
 * Stesso controllo del vigneto: dose fuori dal range in anagrafica prodotto.
 * @param {Array} prodotti
 * @param {Array} anagrafica
 * @returns {{ hasWarning: boolean, tooltip: string }}
 */
export function avvisoDosaggioProdotti(prodotti, anagrafica) {
  const catalogo = Array.isArray(anagrafica) ? anagrafica : [];
  const messaggi = [];
  (prodotti || []).forEach((row) => {
    if (!row || !row.prodottoId || row.dosaggio == null || Number.isNaN(Number(row.dosaggio))) return;
    const prod = catalogo.find((item) => item.id === row.prodottoId);
    if (!prod) return;
    const nome = String(row.prodotto || prod.nome || prod.codice || 'Prodotto').trim();
    const dose = Number(row.dosaggio);
    if (prod.dosaggioMax != null && dose > Number(prod.dosaggioMax)) {
      messaggi.push('Dosaggio superiore al consigliato per ' + nome);
    }
    if (prod.dosaggioMin != null && dose < Number(prod.dosaggioMin)) {
      messaggi.push('Dosaggio inferiore al consigliato per ' + nome);
    }
  });
  return { hasWarning: messaggi.length > 0, tooltip: messaggi.join('; ') };
}
