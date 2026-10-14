const { testo, normalizza } = require("./etichetta-util");
const { dataUtileOpenData, celleHtml } = require("./registro-opendata");

const ATTESA_RIPROVA_MS = 6 * 60 * 60 * 1000;
const SETTIMANA_CONTROLLO_MS = 7 * 24 * 60 * 60 * 1000;
const MESE_CONTROLLO_MS = 30 * 24 * 60 * 60 * 1000;
const URL_IODL = "https://www.dati.gov.it/iodl/2.0/";
const BASE_ETICHETTA = "https://www.fitosanitari.salute.gov.it/fitosanitariws_new/EtichettaServlet?id=";

function normalizzaNomeProdotto(value) {
  return testo(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function eFitofarmaco(data) {
  return normalizza(data && data.categoria) === "fitofarmaci";
}

function eAutorizzato(row) {
  return normalizza(row && row.stato).startsWith("autorizz");
}

/**
 * Un nome, un numero. «Folpan» non prende «Folpan Gold».
 * Se ne resta più di una, non si sceglie.
 */
function trovaRegistrazioneUnica(righe, nome, numero) {
  const lista = righe || [];
  const num = testo(numero);
  if (num) {
    const perNumero = lista.filter((row) => testo(row.numeroRegistrazione) === num);
    if (perNumero.length === 1) return { esito: "unica", prodotto: perNumero[0] };
    if (perNumero.length > 1) {
      const aut = perNumero.filter(eAutorizzato);
      if (aut.length === 1) return { esito: "unica", prodotto: aut[0] };
      return { esito: "nome_non_univoco", prodotto: null };
    }
  }
  const q = normalizzaNomeProdotto(nome);
  if (!q) return { esito: "non_trovato", prodotto: null };
  const esatti = lista.filter((row) => normalizzaNomeProdotto(row.denominazione) === q);
  if (esatti.length === 1) return { esito: "unica", prodotto: esatti[0] };
  if (esatti.length > 1) {
    const aut = esatti.filter(eAutorizzato);
    if (aut.length === 1) return { esito: "unica", prodotto: aut[0] };
    return { esito: "nome_non_univoco", prodotto: null };
  }
  const prefisso = lista.filter((row) => normalizzaNomeProdotto(row.denominazione).startsWith(q + " "));
  if (prefisso.length === 1) return { esito: "unica", prodotto: prefisso[0] };
  if (prefisso.length > 1) return { esito: "nome_non_univoco", prodotto: null };
  return { esito: "non_trovato", prodotto: null };
}

function numeroCanonico(value) {
  const cifre = String(value == null ? "" : value).replace(/\D/g, "");
  if (!cifre) return "";
  return cifre.replace(/^0+/, "") || "0";
}

function esitoRispostaMinistero(status, testoHtml) {
  if (Number(status) === 403) return "bloccato";
  if (Number(status) !== 200 || /verificato un errore/i.test(String(testoHtml || ""))) return "errore";
  return "ok";
}

function idDocumentoEtichetta(value) {
  const n = numeroCanonico(value);
  return n ? n.padStart(6, "0") : "";
}

function dataIsoDaItaliana(value) {
  const m = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  return m[3] + "-" + m[2] + "-" + m[1];
}

function dataPassata(value, oraMs) {
  const iso = dataIsoDaItaliana(value);
  if (!iso) return false;
  return Date.parse(iso + "T00:00:00.000Z") <= Number(oraMs);
}

function avvisoRevocaOScadenza(row, oraMs) {
  if (!row) return { si: false, data: "", testo: "" };
  const stato = normalizza(row.stato || row.statoAmministrativoScheda);
  const decorrenza = dataUtileOpenData(row.dataDecorrenzaRevoca);
  const decreto = dataUtileOpenData(row.dataDecretoRevoca);
  const scadenza = dataUtileOpenData(row.dataScadenzaAutorizzazione);
  const ora = oraMs == null ? Date.now() : oraMs;
  let data = "";
  let si = false;
  if (/revoc/.test(stato) || (decorrenza && dataPassata(decorrenza, ora))) {
    si = true;
    data = decorrenza || decreto || "";
  } else if (/scadut/.test(stato) || (scadenza && dataPassata(scadenza, ora))) {
    si = true;
    data = scadenza || "";
  }
  if (!si) return { si: false, data: "", testo: "" };
  return {
    si: true,
    data,
    testo: "Prodotto revocato/scaduto" + (data ? " il " + data : "") + ": verifica i termini di vendita e di utilizzo nel decreto di revoca"
  };
}

function parsaElencoEtichetteMinistero(html) {
  const testoHtml = String(html || "");
  const out = [];
  const pezzi = testoHtml.split(/<tr\b/i).slice(1);
  pezzi.forEach((pezzo) => {
    const id = (pezzo.match(/EtichettaServlet\?id=(\d+)/i) || [])[1];
    const celle = celleHtml("<tr>" + pezzo);
    const numeroRegistrazione = (celle[0] || "").match(/\d{5,6}/);
    if (!id || !numeroRegistrazione) return;
    const dataEtichetta = (pezzo.match(/Etichetta\s+del\s+(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || "";
    const stato = celle.find((cella) => /autorizz|revoc|scadut|sospes/i.test(cella)) || "";
    out.push({
      numeroRegistrazione: numeroRegistrazione[0],
      denominazione: testo(celle[1] || ""),
      stato,
      dataEtichetta,
      idEtichetta: id,
      urlEtichetta: BASE_ETICHETTA + id
    });
  });
  return out;
}

function rigaEtichettaPerNumero(righe, numero) {
  const voluto = numeroCanonico(numero);
  if (!voluto) return null;
  return (righe || []).find((riga) => numeroCanonico(riga.numeroRegistrazione) === voluto) || null;
}

module.exports = {
  ATTESA_RIPROVA_MS,
  SETTIMANA_CONTROLLO_MS,
  MESE_CONTROLLO_MS,
  URL_IODL,
  normalizzaNomeProdotto,
  eFitofarmaco,
  trovaRegistrazioneUnica,
  numeroCanonico,
  idDocumentoEtichetta,
  avvisoRevocaOScadenza,
  esitoRispostaMinistero,
  parsaElencoEtichetteMinistero,
  rigaEtichettaPerNumero
};
