/**
 * Legge il CSV open data del Ministero della Salute.
 * Non apre altre banche e non scrive l'archivio su Firestore.
 * In memoria di istanza tiene solo il CSV già scaricato, e lo butta quando l'istanza si spegne.
 */
const { HttpsError } = require("firebase-functions/v2/https");
const {
  estraiUrlCsv,
  componiRispostaScheda,
  chiaveRicercaScheda
} = require("./lib/registro-trattamenti-scheda-core");

const PAGINA_DATASET = "https://www.dati.salute.gov.it/it/dataset/fitosanitari/";
const ORIGINE = "https://www.dati.salute.gov.it";
const CACHE_MS = 6 * 60 * 60 * 1000;

let cacheCsv = null;

function testo(value) {
  return String(value == null ? "" : value).trim();
}

async function leggiTesto(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "GFV-Platform registro trattamenti", Accept: "text/csv,text/html,*/*" }
    });
    if (!res.ok) return "";
    return await res.text();
  } catch (err) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function csvCorrente() {
  const ora = Date.now();
  if (cacheCsv && ora - cacheCsv.quando < CACHE_MS) return cacheCsv;
  const pagina = await leggiTesto(PAGINA_DATASET, 20000);
  const path = estraiUrlCsv(pagina);
  if (!path) return null;
  const url = path.startsWith("http") ? path : ORIGINE + path;
  const csv = await leggiTesto(url, 45000);
  if (!csv || csv.length < 40) return null;
  cacheCsv = { url, csv, quando: ora };
  return cacheCsv;
}

async function handleLeggiSchedaRegistroTrattamento(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Accedi per cercare il prodotto negli open data.");
  }
  const data = request.data || {};
  const chiave = chiaveRicercaScheda(data);
  if (!chiave.ok) throw new HttpsError("invalid-argument", "Manca il nome o il numero del prodotto.");
  const scaricato = await csvCorrente();
  if (!scaricato) {
    return {
      ok: false,
      motivo: "open_data_non_letti",
      fonte: null,
      dataLettura: null,
      specie: testo(data.specie) || null,
      prodotti: [],
      proposto: null,
      righe: []
    };
  }
  return componiRispostaScheda({
    csv: scaricato.csv,
    nome: chiave.nome,
    numero: chiave.numero,
    specie: testo(data.specie),
    urlCsv: scaricato.url
  });
}

module.exports = {
  handleLeggiSchedaRegistroTrattamento,
  csvFitosanitariCorrente: csvCorrente
};
