/**
 * Legge open data del Ministero e, se la pagina risponde, la tabella impieghi.
 * Non scrive l'archivio su Firestore. In memoria di istanza tiene solo il CSV
 * già scaricato, e lo butta quando l'istanza si spegne.
 */
const { HttpsError } = require("firebase-functions/v2/https");
const {
  estraiUrlCsv,
  componiRispostaScheda
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
    throw new HttpsError("unauthenticated", "Accedi per leggere la scheda.");
  }
  const data = request.data || {};
  const nome = testo(data.nome || data.nomeProdotto);
  const specie = testo(data.specie);
  if (!nome) throw new HttpsError("invalid-argument", "Manca il nome del prodotto.");
  if (!specie) {
    return {
      ok: false,
      motivo: "specie_mancante",
      prodotti: [],
      righe: [],
      schedaImpieghi: "non_letta"
    };
  }
  const scaricato = await csvCorrente();
  if (!scaricato) {
    return {
      ok: false,
      motivo: "scheda_non_letta",
      fonte: null,
      dataLettura: null,
      specie,
      prodotti: [],
      righe: [],
      schedaImpieghi: "non_letta"
    };
  }
  const htmlScheda = testo(data.htmlScheda);
  const risposta = componiRispostaScheda({
    csv: scaricato.csv,
    htmlScheda,
    nome,
    specie,
    alias: Array.isArray(data.alias) ? data.alias : [],
    urlCsv: scaricato.url
  });
  return risposta;
}

module.exports = {
  handleLeggiSchedaRegistroTrattamento,
  csvFitosanitariCorrente: csvCorrente
};
