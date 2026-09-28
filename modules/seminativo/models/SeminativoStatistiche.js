/**
 * Statistiche di campagna seminativo, calcolate sui dati già salvati.
 * La resa prevista dell'anagrafica resta un numero a parte rispetto alla resa effettiva.
 *
 * @module modules/seminativo/models/SeminativoStatistiche
 */

function euro(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function numero(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Object} input
 * @param {Array} input.campagne
 * @param {Array} [input.raccolte]
 * @param {Array} [input.trattamenti] trattamenti e concimazioni, stesso archivio
 * @param {Record<string, { costoManodopera?: number, costoMacchine?: number, costoTotale?: number }>} [input.spese]
 */
export function riepilogoCampagne(input = {}) {
  const raccolte = input.raccolte || [];
  const trattamenti = input.trattamenti || [];
  const spese = input.spese || {};

  return (input.campagne || []).map((campagna) => {
    const id = campagna.id;
    const mie = raccolte.filter((row) => row && row.campagnaId === id);
    const produzioneQli = euro(mie.reduce((sum, row) => sum + (Number(row.quantitaQli) || 0), 0));
    const superficie = numero(campagna.superficieEttari);
    const resaEffettivaQliHa = superficie > 0 && produzioneQli > 0
      ? euro(produzioneQli / superficie)
      : null;
    const spesa = spese[id] || {};
    const costoManodopera = euro(spesa.costoManodopera);
    const costoMacchine = euro(spesa.costoMacchine);
    const costoProdotti = spesa.costoProdotti != null
      ? euro(spesa.costoProdotti)
      : euro(
        trattamenti
          .filter((row) => row && row.campagnaId === id)
          .reduce((sum, row) => sum + (Number(row.costoProdotto) || 0), 0)
      );
    const costoLavori = euro(costoManodopera + costoMacchine);

    return {
      id,
      terrenoId: campagna.terrenoId || null,
      campagna: campagna.campagna || '',
      colturaNome: campagna.colturaNome || '',
      varieta: campagna.varieta || '',
      superficieEttari: superficie,
      resaPrevistaQliHa: numero(campagna.resaPrevistaQliHa),
      produzioneQli,
      resaEffettivaQliHa,
      numeroRaccolte: mie.length,
      costoManodopera,
      costoMacchine,
      costoProdotti,
      costoTotale: euro(costoLavori + costoProdotti)
    };
  });
}

/** Totali sulle righe già filtrate. La resa media divide i quintali per gli ettari di campagna. */
export function totaliStatistiche(righe) {
  const rows = righe || [];
  const produzioneQli = euro(rows.reduce((sum, row) => sum + (Number(row.produzioneQli) || 0), 0));
  const superficie = euro(rows.reduce((sum, row) => sum + (Number(row.superficieEttari) || 0), 0));
  const costoManodopera = euro(rows.reduce((sum, row) => sum + (Number(row.costoManodopera) || 0), 0));
  const costoMacchine = euro(rows.reduce((sum, row) => sum + (Number(row.costoMacchine) || 0), 0));
  const costoProdotti = euro(rows.reduce((sum, row) => sum + (Number(row.costoProdotti) || 0), 0));
  const costoTotale = euro(rows.reduce((sum, row) => sum + (Number(row.costoTotale) || 0), 0));
  const conPrevista = rows.filter((row) => row.resaPrevistaQliHa != null && Number(row.superficieEttari) > 0);
  const haPrevista = conPrevista.reduce((sum, row) => sum + Number(row.superficieEttari), 0);
  const resaPrevistaMedia = haPrevista > 0
    ? euro(conPrevista.reduce((sum, row) => sum + (row.resaPrevistaQliHa * Number(row.superficieEttari)), 0) / haPrevista)
    : null;
  return {
    campagne: rows.length,
    produzioneQli,
    superficieEttari: superficie,
    resaEffettivaQliHa: superficie > 0 && produzioneQli > 0 ? euro(produzioneQli / superficie) : null,
    resaPrevistaMediaQliHa: resaPrevistaMedia,
    costoManodopera,
    costoMacchine,
    costoProdotti,
    costoTotale
  };
}
