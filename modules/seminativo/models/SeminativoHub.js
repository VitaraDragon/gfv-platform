/**
 * Panoramica dell'hub Seminativo sulla campagna agricola corrente.
 * Le campagne chiuse non entrano nel conteggio né negli ettari.
 * Semine e raccolte della stessa campagna restano, anche se la campagna è poi chiusa.
 *
 * @module modules/seminativo/models/SeminativoHub
 */

import { defaultCampagnaLabel, normalizeCampagnaKey } from './SeminativoCampagna.js';
import { dataIsoLavorazione, isLavorazioneDiFilare } from './SeminativoLavorazione.js';
import { isRaccoltaDiVigneto, resaQliHa } from './SeminativoRaccolta.js';
import { intervalloCampagna } from './SeminativoSpese.js';

export const HUB_LIST_LIMIT = 10;

function stessaCampagna(a, label) {
  return normalizeCampagnaKey(a) !== '' && normalizeCampagnaKey(a) === normalizeCampagnaKey(label);
}

function ettari(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function contaEventi(rows, campagna, ids) {
  return (rows || []).filter((row) => {
    if (!row) return false;
    if (row.campagnaId && ids.has(String(row.campagnaId))) return true;
    return stessaCampagna(row.campagna, campagna);
  }).length;
}

/**
 * @param {Object} [input]
 * @param {Array} [input.campagne]
 * @param {Array} [input.semine]
 * @param {Array} [input.raccolte]
 * @param {string} [input.campagna] etichetta, es. "2026/2027"
 * @param {Date} [input.now]
 */
export function panoramicaHubSeminativo(input = {}) {
  const campagna = input.campagna || defaultCampagnaLabel(input.now || new Date());
  const dellaCampagna = (input.campagne || []).filter((row) => row && stessaCampagna(row.campagna, campagna));
  const aperte = dellaCampagna.filter((row) => row.stato !== 'chiuso');
  const ids = new Set(dellaCampagna.map((row) => String(row.id || '')).filter(Boolean));

  return {
    campagna,
    campagneAperte: aperte.length,
    ettari: ettari(aperte.reduce((sum, row) => sum + (Number(row.superficieEttari) || 0), 0)),
    semine: contaEventi(input.semine, campagna, ids),
    raccolte: contaEventi(input.raccolte, campagna, ids)
  };
}

function etichettaTerreno(terreno) {
  if (!terreno) return '';
  const nome = String(terreno.nome || '').trim();
  const podere = String(terreno.podere || '').trim();
  if (nome && podere) return `${nome} – ${podere}`;
  return nome || podere || '';
}

function euro(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function tipoAperto(nome) {
  const tipo = String(nome || '').trim();
  if (!tipo) return false;
  if (isLavorazioneDiFilare(tipo)) return false;
  if (isRaccoltaDiVigneto(tipo)) return false;
  return true;
}

function inIntervallo(data, range) {
  return !!(data && range && data >= range.inizio && data <= range.fine);
}

/**
 * Mietiture salvate della campagna, le più recenti prima. Come le vendemmie recenti del vigneto.
 * @param {Object} [input]
 */
export function raccolteRecentiHub(input = {}) {
  const campagna = input.campagna || defaultCampagnaLabel(input.now || new Date());
  const dellaCampagna = (input.campagne || []).filter((row) => row && stessaCampagna(row.campagna, campagna));
  const ids = new Set(dellaCampagna.map((row) => String(row.id || '')).filter(Boolean));
  const terreni = new Map((input.terreni || []).filter((row) => row && row.id).map((row) => [String(row.id), row]));
  const campagneById = new Map(dellaCampagna.filter((row) => row.id).map((row) => [String(row.id), row]));
  const limit = input.limit || HUB_LIST_LIMIT;

  return (input.raccolte || [])
    .filter((row) => {
      if (!row) return false;
      if (row.campagnaId && ids.has(String(row.campagnaId))) return true;
      return stessaCampagna(row.campagna, campagna);
    })
    .map((row) => {
      const campagnaRow = campagneById.get(String(row.campagnaId || ''));
      const qli = row.quantitaQli != null && row.quantitaQli !== '' ? Number(row.quantitaQli) : null;
      const ha = row.quantitaEttari != null && row.quantitaEttari !== '' ? Number(row.quantitaEttari) : null;
      const resa = row.resaQliHa != null && row.resaQliHa !== ''
        ? Number(row.resaQliHa)
        : resaQliHa(qli, ha);
      const costo = row.costoTotale != null && row.costoTotale !== ''
        ? euro(row.costoTotale)
        : euro((Number(row.costoManodopera) || 0) + (Number(row.costoMacchina) || 0));
      return {
        id: row.id || null,
        data: dataIsoLavorazione(row.data),
        terrenoId: row.terrenoId || null,
        terrenoNome: etichettaTerreno(terreni.get(String(row.terrenoId || ''))),
        colturaNome: campagnaRow ? (campagnaRow.colturaNome || '') : (row.colturaNome || ''),
        quantitaQli: Number.isFinite(qli) ? qli : null,
        resaQliHa: Number.isFinite(resa) ? resa : null,
        costoTotale: costo
      };
    })
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .slice(0, limit);
}

/**
 * Lavori completati e attività di diario sui terreni seminativo, nel periodo della campagna.
 * A pieno campo: niente fila e niente vendemmia.
 * @param {Object} [input]
 */
export function lavoriRecentiHub(input = {}) {
  const campagna = input.campagna || defaultCampagnaLabel(input.now || new Date());
  const range = intervalloCampagna(campagna);
  const terrenoIds = new Set((input.terreni || []).map((row) => String(row && row.id || '')).filter(Boolean));
  const terreni = new Map((input.terreni || []).filter((row) => row && row.id).map((row) => [String(row.id), row]));
  const includeLavori = input.includeLavori !== false;
  const limit = input.limit || HUB_LIST_LIMIT;
  const righe = [];
  const chiavi = new Set();

  if (includeLavori) {
    (input.lavori || []).forEach((lavoro) => {
      if (!lavoro || lavoro.stato !== 'completato') return;
      const terrenoId = String(lavoro.terrenoId || '');
      if (!terrenoIds.has(terrenoId)) return;
      const tipo = String(lavoro.tipoLavoro || '').trim();
      if (!tipoAperto(tipo)) return;
      const data = dataIsoLavorazione(lavoro.dataInizio || lavoro.data);
      if (!inIntervallo(data, range)) return;
      chiavi.add(`${terrenoId}|${data}|${tipo.toLowerCase()}`);
      righe.push({
        id: lavoro.id || null,
        source: 'lavoro',
        data,
        terrenoId,
        terrenoNome: etichettaTerreno(terreni.get(terrenoId)),
        tipoLavoro: tipo,
        stato: 'completato'
      });
    });
  }

  (input.attivita || []).forEach((att) => {
    if (!att || att.lavoroId || att.clienteId) return;
    const terrenoId = String(att.terrenoId || '');
    if (!terrenoIds.has(terrenoId)) return;
    const tipo = String(att.tipoLavoro || '').trim();
    if (!tipoAperto(tipo)) return;
    const data = dataIsoLavorazione(att.data);
    if (!inIntervallo(data, range)) return;
    if (chiavi.has(`${terrenoId}|${data}|${tipo.toLowerCase()}`)) return;
    righe.push({
      id: att.id || null,
      source: 'diario',
      data,
      terrenoId,
      terrenoNome: etichettaTerreno(terreni.get(terrenoId)),
      tipoLavoro: tipo,
      stato: 'completato'
    });
  });

  righe.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return righe.slice(0, limit);
}

export function testoPanoramicaHub(panoramica) {
  const p = panoramica || {};
  const campagne = p.campagneAperte === 1
    ? '1 campagna aperta'
    : `${p.campagneAperte || 0} campagne aperte`;
  const semine = p.semine === 1 ? '1 semina' : `${p.semine || 0} semine`;
  const raccolte = p.raccolte === 1 ? '1 raccolta' : `${p.raccolte || 0} raccolte`;
  const ha = Number(p.ettari || 0).toFixed(2);
  return `Hub Seminativo, campagna ${p.campagna || ''}: ${campagne}, ${ha} ha, ${semine}, ${raccolte}. Il piano colturale propone la coltura successiva.`;
}
