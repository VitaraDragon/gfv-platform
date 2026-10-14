/**
 * Lettura della scheda pubblica. I pezzi stanno nei file vicini:
 * open data, anagrafica, colture, lettura a regole, archivio.
 */
const opendata = require("./registro-opendata");
const anagrafica = require("./etichetta-anagrafica");
const colture = require("./etichetta-colture");
const regex = require("./etichetta-regex");
const archivio = require("./etichetta-archivio");

module.exports = {
  FONTE: opendata.FONTE,
  URL_IODL: anagrafica.URL_IODL,
  ATTESA_RIPROVA_MS: anagrafica.ATTESA_RIPROVA_MS,
  SETTIMANA_CONTROLLO_MS: anagrafica.SETTIMANA_CONTROLLO_MS,
  MESE_CONTROLLO_MS: anagrafica.MESE_CONTROLLO_MS,
  dataVariazioneOpenData: opendata.dataVariazioneOpenData,
  schedaOltreSeiMesi: opendata.schedaOltreSeiMesi,
  controlloSettimanaleDovuto: opendata.controlloSettimanaleDovuto,
  controlloMensileDovuto: archivio.controlloMensileDovuto,
  controlloLeggeroScheda: opendata.controlloLeggeroScheda,
  estraiUrlCsv: opendata.estraiUrlCsv,
  dataLetturaDaNomeFile: opendata.dataLetturaDaNomeFile,
  parsaCsvFitosanitari: opendata.parsaCsvFitosanitari,
  cercaProdotti: opendata.cercaProdotti,
  parsaTabellaImpieghi: opendata.parsaTabellaImpieghi,
  filtraRigheSpecie: opendata.filtraRigheSpecie,
  componiRispostaScheda: opendata.componiRispostaScheda,
  normalizzaNomeProdotto: anagrafica.normalizzaNomeProdotto,
  eFitofarmaco: anagrafica.eFitofarmaco,
  trovaRegistrazioneUnica: anagrafica.trovaRegistrazioneUnica,
  numeroCanonico: anagrafica.numeroCanonico,
  idDocumentoEtichetta: anagrafica.idDocumentoEtichetta,
  avvisoRevocaOScadenza: anagrafica.avvisoRevocaOScadenza,
  esitoRispostaMinistero: anagrafica.esitoRispostaMinistero,
  parsaElencoEtichetteMinistero: anagrafica.parsaElencoEtichetteMinistero,
  rigaEtichettaPerNumero: anagrafica.rigaEtichettaPerNumero,
  estraiRigheAffidabili: regex.estraiRigheAffidabili,
  coltureIn: colture.coltureIn,
  parsaTestoEtichetta: regex.parsaTestoEtichetta,
  componiRigheScheda: regex.componiRigheScheda,
  componiArchivioProdotto: archivio.componiArchivioProdotto,
  idRigaScheda: regex.idRigaScheda,
  richiedeLetturaScheda: archivio.richiedeLetturaScheda,
  scegliProdottoInPagina: archivio.scegliProdottoInPagina
};
