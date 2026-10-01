/**
 * Lavorazioni seminativo lette dal diario e, se c'è Manodopera, dai lavori.
 * Solo tipi di campo aperto (sottocategoria Generale). Niente registro a parte.
 *
 * @module modules/seminativo/models/SeminativoLavorazione
 */

import { TIPI_LAVORO_PREDEFINITI } from '../../../core/config/app-catalog-seed-data.js';
import { defaultCampagnaLabel } from './SeminativoCampagna.js';

export const SOTTOCATEGORIA_LAVORAZIONE_CAMPO_APERTO = 'lavorazione_terreno_generale';

export const TIPI_LAVORAZIONE_CAMPO_APERTO = TIPI_LAVORO_PREDEFINITI
  .filter((tipo) => tipo.sottocategoriaCodice === SOTTOCATEGORIA_LAVORAZIONE_CAMPO_APERTO && tipo.nome)
  .map((tipo) => tipo.nome);

const NOMI_CAMPO_APERTO = new Set(TIPI_LAVORAZIONE_CAMPO_APERTO.map((nome) => nome.toLowerCase()));

export function isLavorazioneDiFilare(nome) {
  const text = String(nome || '').toLowerCase();
  return text.includes('tra le file') || text.includes('sulla fila');
}

/**
 * @param {{ nome?: string, sottocategoriaId?: string }|string} tipo
 * @param {{ generaleIds?: Set<string>|string[], nomiConsentiti?: Set<string>|string[] }} [ctx]
 */
export function isTipoLavorazioneCampoAperto(tipo, ctx = {}) {
  const nome = String(tipo && typeof tipo === 'object' ? tipo.nome : tipo || '').trim();
  if (!nome || isLavorazioneDiFilare(nome)) return false;
  const subId = tipo && typeof tipo === 'object' && tipo.sottocategoriaId
    ? String(tipo.sottocategoriaId)
    : '';
  if (subId && ctx.generaleIds) {
    const ids = ctx.generaleIds instanceof Set ? ctx.generaleIds : new Set(ctx.generaleIds);
    if (ids.has(subId)) return true;
  }
  const key = nome.toLowerCase();
  if (NOMI_CAMPO_APERTO.has(key)) return true;
  if (ctx.nomiConsentiti) {
    const extra = ctx.nomiConsentiti instanceof Set
      ? ctx.nomiConsentiti
      : new Set(ctx.nomiConsentiti);
    if (extra.has(key)) return true;
  }
  return false;
}

export function dataIsoLavorazione(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value && typeof value.toDate === 'function'
    ? value.toDate()
    : (value instanceof Date ? value : new Date(value));
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function nomiSet(nomiConsentiti) {
  const set = new Set(NOMI_CAMPO_APERTO);
  (nomiConsentiti || []).forEach((nome) => {
    const key = String(nome || '').trim().toLowerCase();
    if (key) set.add(key);
  });
  return set;
}

function campagnaPer(terrenoId, dataIso, campagne) {
  if (!dataIso) return '';
  const label = defaultCampagnaLabel(new Date(`${dataIso}T12:00:00`));
  const found = (campagne || []).find((row) => (
    String(row.terrenoId || '') === String(terrenoId || '')
    && String(row.campagna || '').replace(/\s+/g, '') === label
  ));
  return found ? String(found.campagna) : label;
}

/**
 * Unisce attività di diario e lavori sui terreni seminativo, solo tipi di campo aperto.
 * Un'attività già legata a un lavoro, o con la stessa data e lo stesso tipo, non si ripete.
 *
 * @param {Object} input
 * @param {Array} input.terreni
 * @param {string[]} [input.nomiConsentiti]
 * @param {Array} [input.attivita]
 * @param {Array} [input.lavori]
 * @param {boolean} [input.includeLavori]
 * @param {Array} [input.campagne]
 */
export function selezionaLavorazioniCollegate(input = {}) {
  const terrenoIds = new Set((input.terreni || []).map((t) => String(t.id || '')).filter(Boolean));
  const nomi = nomiSet(input.nomiConsentiti);
  const includeLavori = input.includeLavori !== false;
  const campagne = input.campagne || [];
  const righe = [];
  const chiaviLavoro = new Set();

  if (includeLavori) {
    (input.lavori || []).forEach((lavoro) => {
      if (!lavoro || lavoro.stato === 'annullato') return;
      const terrenoId = String(lavoro.terrenoId || '');
      if (!terrenoIds.has(terrenoId)) return;
      const tipo = String(lavoro.tipoLavoro || '').trim();
      if (!isTipoLavorazioneCampoAperto(tipo, { nomiConsentiti: nomi })) return;
      const data = dataIsoLavorazione(lavoro.dataInizio || lavoro.data);
      if (!data) return;
      chiaviLavoro.add(`${terrenoId}|${data}|${tipo.toLowerCase()}`);
      righe.push({
        id: lavoro.id,
        source: 'lavoro',
        terrenoId,
        tipoLavoro: tipo,
        data,
        stato: lavoro.stato || '',
        campagna: campagnaPer(terrenoId, data, campagne)
      });
    });
  }

  (input.attivita || []).forEach((att) => {
    if (!att) return;
    if (att.lavoroId) return;
    if (att.clienteId) return;
    const terrenoId = String(att.terrenoId || '');
    if (!terrenoIds.has(terrenoId)) return;
    const tipo = String(att.tipoLavoro || '').trim();
    if (!isTipoLavorazioneCampoAperto(tipo, { nomiConsentiti: nomi })) return;
    const data = dataIsoLavorazione(att.data);
    if (!data) return;
    if (chiaviLavoro.has(`${terrenoId}|${data}|${tipo.toLowerCase()}`)) return;
    righe.push({
      id: att.id,
      source: 'diario',
      terrenoId,
      tipoLavoro: tipo,
      data,
      stato: 'completato',
      campagna: campagnaPer(terrenoId, data, campagne)
    });
  });

  righe.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return righe;
}
