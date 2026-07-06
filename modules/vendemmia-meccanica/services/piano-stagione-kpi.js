/**
 * KPI piano stagione (puro, senza Firestore)
 * @module modules/vendemmia-meccanica/services/piano-stagione-kpi
 */

export function summarizePianoStagione(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const inPiano = list.filter((r) => r.inPiano);
  const vendemmiati = list.filter((r) => r.vendemmiato);
  const residui = list.filter((r) => r.inPiano && !r.vendemmiato);
  const ettariPiano = inPiano.reduce((s, r) => s + (Number(r.ettariEffettivi) || 0), 0);
  const ettariDone = vendemmiati.reduce((s, r) => s + (Number(r.ettariEffettivi) || 0), 0);
  const ettariResidui = residui.reduce((s, r) => s + (Number(r.ettariEffettivi) || 0), 0);
  /** Cliente «in piano» = almeno un terreno vigneto con inPiano (v. piano-stagione-utils). */
  const clientiInPiano = new Set(inPiano.map((r) => r.clienteId).filter(Boolean)).size;
  const pct = inPiano.length ? Math.round((vendemmiati.length / inPiano.length) * 100) : 0;

  return {
    terreniTotali: list.length,
    inPiano: inPiano.length,
    vendemmiati: vendemmiati.length,
    terreniResidui: residui.length,
    clientiInPiano,
    percentualeCompletata: pct,
    ettariInPiano: Math.round(ettariPiano * 100) / 100,
    ettariVendemmiati: Math.round(ettariDone * 100) / 100,
    ettariResidui: Math.round(ettariResidui * 100) / 100
  };
}

/**
 * Summary + aggregati per Tony (currentTableData.pianoAggregates).
 * Residui = solo vigneti con inPiano && !vendemmiato (fuori piano esclusi).
 * @param {Array<Object>} rows
 * @returns {{ summary: string, pianoAggregates: Object }}
 */
export function buildPianoStagioneTonyContext(rows) {
  const kpi = summarizePianoStagione(rows);
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    return {
      summary: 'Nessun vigneto in elenco.',
      pianoAggregates: { ...kpi }
    };
  }

  const summary = list.length + ' vigneti in elenco — '
    + kpi.inPiano + ' in piano, ' + kpi.vendemmiati + ' vendemmiati, '
    + kpi.terreniResidui + ' residui da vendemmiare in piano (' + kpi.ettariResidui + ' ha effettivi). '
    + 'Ha in piano: ' + kpi.ettariInPiano + '; già vendemmiati: ' + kpi.ettariVendemmiati + ' ha. '
    + 'Completamento: ' + kpi.percentualeCompletata + '%.';

  return {
    summary,
    pianoAggregates: { ...kpi }
  };
}

export default { summarizePianoStagione, buildPianoStagioneTonyContext };
