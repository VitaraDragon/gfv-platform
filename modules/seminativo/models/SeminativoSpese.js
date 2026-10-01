/**
 * Spese di una campagna seminativo: lavori completati e attività dirette del diario
 * sul terreno, nel periodo agricolo (1 settembre – 31 agosto), più il costo prodotti
 * di trattamenti e concimazioni della stessa campagna. Manodopera e macchine del
 * trattamento restano nel lavoro o nel diario, non si sommano due volte.
 *
 * @module modules/seminativo/models/SeminativoSpese
 */

import { dataIsoLavorazione } from './SeminativoLavorazione.js';

/**
 * @param {string} label es. "2025/2026"
 * @returns {{ inizio: string, fine: string }|null}
 */
export function intervalloCampagna(label) {
  const match = String(label || '').match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return { inizio: `${match[1]}-09-01`, fine: `${match[2]}-08-31` };
}

function euro(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function inRange(iso, range) {
  return !!(iso && range && iso >= range.inizio && iso <= range.fine);
}

/**
 * @param {Object} input
 * @param {string} input.terrenoId
 * @param {string} [input.campagna]
 * @param {{ inizio: string, fine: string }} [input.intervallo]
 * @param {Array} [input.lavori] completati, con costoManodopera e costoMacchine già calcolati
 * @param {Array} [input.attivita] dirette, con gli stessi costi
 */
export function dettaglioSpeseCampagna(input = {}) {
  const terrenoId = String(input.terrenoId || '');
  const range = input.intervallo || intervalloCampagna(input.campagna);
  const lavori = [];
  const chiaviLavoro = new Set();

  if (range && terrenoId) {
    (input.lavori || []).forEach((lavoro) => {
      if (!lavoro || lavoro.stato !== 'completato') return;
      if (String(lavoro.terrenoId || '') !== terrenoId) return;
      const data = dataIsoLavorazione(lavoro.dataInizio || lavoro.data);
      if (!inRange(data, range)) return;
      const tipo = String(lavoro.tipoLavoro || '').trim();
      chiaviLavoro.add(`${data}|${tipo.toLowerCase()}`);
      const costoManodopera = euro(lavoro.costoManodopera);
      const costoMacchine = euro(lavoro.costoMacchine);
      lavori.push({
        id: lavoro.id,
        data,
        nome: lavoro.nome || tipo || 'Lavoro',
        tipoLavoro: tipo,
        costoManodopera,
        costoMacchine,
        costoTotale: euro(costoManodopera + costoMacchine)
      });
    });
  }

  const attivita = [];
  if (range && terrenoId) {
    (input.attivita || []).forEach((att) => {
      if (!att || att.lavoroId || att.clienteId) return;
      if (String(att.terrenoId || '') !== terrenoId) return;
      const data = dataIsoLavorazione(att.data);
      if (!inRange(data, range)) return;
      const tipo = String(att.tipoLavoro || '').trim();
      if (chiaviLavoro.has(`${data}|${tipo.toLowerCase()}`)) return;
      const costoManodopera = euro(att.costoManodopera);
      const costoMacchine = euro(att.costoMacchine);
      attivita.push({
        id: att.id,
        data,
        tipoLavoro: tipo,
        oreNette: Number(att.oreNette) || 0,
        costoManodopera,
        costoMacchine,
        costoTotale: euro(costoManodopera + costoMacchine)
      });
    });
  }

  const prodotti = [];
  (input.prodotti || []).forEach((row) => {
    if (!row) return;
    if (input.campagnaId && String(row.campagnaId || '') !== String(input.campagnaId)) return;
    const costo = euro(row.costoProdotto);
    const nomi = Array.isArray(row.prodotti)
      ? row.prodotti.map((item) => String(item && item.prodotto || '').trim()).filter(Boolean)
      : [];
    const nome = nomi.join(', ') || String(row.prodotto || row.tipoLavoro || 'Prodotto').trim();
    prodotti.push({
      id: row.id,
      data: dataIsoLavorazione(row.data),
      tipoLavoro: String(row.tipoLavoro || '').trim(),
      nome,
      costo
    });
  });

  lavori.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  attivita.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  prodotti.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const costoManodopera = euro([...lavori, ...attivita].reduce((sum, row) => sum + row.costoManodopera, 0));
  const costoMacchine = euro([...lavori, ...attivita].reduce((sum, row) => sum + row.costoMacchine, 0));
  const costoProdotti = euro(prodotti.reduce((sum, row) => sum + row.costo, 0));
  return {
    intervallo: range,
    lavori,
    attivita,
    prodotti,
    costoManodopera,
    costoMacchine,
    costoProdotti,
    costoTotale: euro(costoManodopera + costoMacchine + costoProdotti)
  };
}
