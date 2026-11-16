/**
 * Open data del Ministero della Salute, prodotti fitosanitari.
 * Parser puro, senza rete e senza Firestore. Il CSV non si salva.
 * Coltura, avversità, dose e carenza non si leggono da qui: le conferma l'azienda.
 */

const fs = require("fs");
const path = require("path");

function caricaFonte() {
  const nelRepo = path.join(__dirname, "../../shared/js/registro-trattamenti-fonte.js");
  const inDeploy = path.join(__dirname, "registro-trattamenti-fonte.mjs");
  const file = fs.existsSync(nelRepo) ? nelRepo : inDeploy;
  if (!fs.existsSync(file)) {
    throw new Error("Manca la costante open data del registro trattamenti");
  }
  return require(file);
}

const fonteCondivisa = caricaFonte();
const FONTE = fonteCondivisa.FONTE_OPEN_DATA_FITOSANITARI;
const classificaStatoAmministrativo = fonteCondivisa.classificaStatoAmministrativo;

function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function normalizza(value) {
  return testo(value).toLowerCase();
}

function splitCsv(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ";" && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function estraiUrlCsv(html) {
  const re = /\/sites\/default\/files\/opendata\/PROD_FTS_[^"'<>\s]+\.csv/gi;
  const trovati = [];
  let match = re.exec(String(html || ""));
  while (match) {
    trovati.push(match[0]);
    match = re.exec(String(html || ""));
  }
  return trovati.length ? trovati[trovati.length - 1] : null;
}

function dataLetturaDaNomeFile(url) {
  const m = String(url || "").match(/(20\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return m[1] + "-" + m[2] + "-" + m[3];
}

/**
 * Header verificato su PROD_FTS_6_20261116.csv (16/11/2026, 17.743 righe).
 * Il titolare è la colonna ragione_sociale.
 */
function parsaCsvFitosanitari(csv) {
  const lines = String(csv || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = splitCsv(lines[0]).map((h) => normalizza(h));
  const idx = (nomi) => header.findIndex((h) => nomi.some((n) => h === n || h.includes(n)));
  const iNum = idx(["num_registrazione", "numero_registrazione"]);
  const iNome = idx(["denominazione_prodotto", "denominazione"]);
  const iTitolare = header.findIndex((h) => h === "ragione_sociale");
  const iSost = idx(["sostanze_attive", "principio"]);
  const iStato = idx(["stato_amministrativo"]);
  const iScad = idx(["data_scadenza_autorizzazione"]);
  const iDecRev = idx(["data_decorrenza_revoca"]);
  const iDecr = idx(["data_decreto_revoca"]);
  return lines.slice(1).map((line) => {
    const cells = splitCsv(line);
    return {
      numeroRegistrazione: iNum >= 0 ? testo(cells[iNum]) : "",
      denominazione: iNome >= 0 ? testo(cells[iNome]) : "",
      titolare: iTitolare >= 0 ? testo(cells[iTitolare]) : "",
      principioAttivo: iSost >= 0 ? testo(cells[iSost]) : "",
      stato: iStato >= 0 ? testo(cells[iStato]) : "",
      dataScadenzaAutorizzazione: iScad >= 0 ? testo(cells[iScad]) : "",
      dataDecorrenzaRevoca: iDecRev >= 0 ? testo(cells[iDecRev]) : "",
      dataDecretoRevoca: iDecr >= 0 ? testo(cells[iDecr]) : ""
    };
  }).filter((row) => row.denominazione || row.numeroRegistrazione);
}

function dataUtileOpenData(value) {
  const t = testo(value);
  if (!t || t === "-" || t === "—") return "";
  return t;
}

/** Nel CSV non c'è «data di variazione». Conta la revoca, altrimenti la scadenza. */
function dataVariazioneOpenData(row) {
  if (!row) return "";
  return dataUtileOpenData(row.dataDecorrenzaRevoca)
    || dataUtileOpenData(row.dataDecretoRevoca)
    || dataUtileOpenData(row.dataScadenzaAutorizzazione);
}

/**
 * Controllo su numero, stato e data. Senza una lettura precedente, il silenzio non è un cambiamento.
 * Non avvia più una coda.
 */
function controlloLeggeroScheda(prodotto, riga) {
  if (!riga) return { esito: "non_trovato", impronta: null };
  const impronta = {
    numeroRegistrazione: testo(riga.numeroRegistrazione),
    statoAmministrativoScheda: testo(riga.stato),
    dataVariazioneScheda: dataVariazioneOpenData(riga)
  };
  const numeroSalvato = testo(prodotto && prodotto.numeroRegistrazione);
  const statoSalvato = testo(prodotto && prodotto.statoAmministrativoScheda);
  const dataSalvata = testo(prodotto && prodotto.dataVariazioneScheda);
  const numeroDiverso = numeroSalvato && numeroSalvato !== impronta.numeroRegistrazione;
  const statoDiverso = statoSalvato && statoSalvato !== impronta.statoAmministrativoScheda;
  const dataDiversa = statoSalvato && dataSalvata !== impronta.dataVariazioneScheda;
  const cambiato = numeroDiverso || statoDiverso || dataDiversa;
  return { esito: cambiato ? "cambiato" : "invariato", impronta };
}

function normalizzaNomeProdotto(value) {
  return testo(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Confronto prudente: th→t, ph→f, y→i, k→c, doppie consonanti → singola.
 * Spazi, trattini e punti non contano nella chiave compatta.
 */
function chiaveGrafia(value) {
  let s = testo(value).toLowerCase();
  s = s.replace(/th/g, "t").replace(/ph/g, "f").replace(/y/g, "i").replace(/k/g, "c");
  s = s.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/([b-df-hj-np-tv-z])\1+/g, "$1");
  return s;
}

function chiaveCompatta(value) {
  return chiaveGrafia(value).replace(/ /g, "");
}

function nomeBase(value) {
  return (chiaveGrafia(value).split(" ")[0]) || "";
}

/** Ancora in commercio: Autorizzato*, Ri-registrato*, Rinnovato*. Non il solo «Autorizzato» letterale. */
function eAutorizzato(row) {
  return classificaStatoAmministrativo(row && row.stato) === "autorizzato";
}

function cercaProdotti(righe, nome, limite = 20) {
  const qGrafia = chiaveGrafia(nome);
  const qCompatta = chiaveCompatta(nome);
  const qBase = nomeBase(nome);
  if (!qGrafia) return [];
  const scored = (righe || []).map((row) => {
    const g = chiaveGrafia(row.denominazione);
    const c = chiaveCompatta(row.denominazione);
    if (!g) return null;
    let punti = 0;
    let tipo = "";
    if (g === qGrafia || c === qCompatta) {
      punti = 3;
      tipo = "esatto";
    } else if (g.startsWith(qGrafia + " ")) {
      punti = 2;
      tipo = "prefisso";
    } else if (qGrafia.startsWith(g + " ")) {
      punti = 2;
      tipo = "piu_corto";
    } else if (qGrafia.length >= 4 && g.includes(qGrafia)) {
      punti = 1;
      tipo = "contiene";
    }
    if (!punti) return null;
    return {
      row,
      punti,
      tipo,
      valido: eAutorizzato(row) ? 1 : 0,
      stessoBase: nomeBase(row.denominazione) === qBase ? 1 : 0
    };
  }).filter(Boolean);
  const haEsatto = scored.some((item) => item.tipo === "esatto");
  const tenuti = haEsatto ? scored.filter((item) => item.tipo !== "piu_corto") : scored;
  tenuti.sort((a, b) =>
    (b.stessoBase - a.stessoBase)
    || (b.valido - a.valido)
    || (b.punti - a.punti)
    || a.row.denominazione.localeCompare(b.row.denominazione, "it")
  );
  return tenuti.slice(0, limite).map((item) => item.row);
}

/**
 * Non sceglie in silenzio se restano più candidati.
 * Se l'unico nome esatto è revocato e c'è un prodotto ancora in commercio con lo stesso nome base,
 * quello in commercio è la proposta e il revocato resta nell'elenco.
 */
function trovaRegistrazioneUnica(righe, nome, numero) {
  const lista = righe || [];
  const num = testo(numero);
  if (num) {
    const perNumero = lista.filter((row) => testo(row.numeroRegistrazione) === num);
    if (perNumero.length === 1) return { esito: "unica", prodotto: perNumero[0], prodotti: perNumero };
    if (perNumero.length > 1) {
      const aut = perNumero.filter(eAutorizzato);
      if (aut.length === 1 && perNumero.length === 1) {
        return { esito: "unica", prodotto: aut[0], prodotti: perNumero };
      }
      return { esito: "nome_non_univoco", prodotto: null, prodotti: perNumero };
    }
  }
  const candidati = cercaProdotti(lista, nome, 50);
  if (!candidati.length) return { esito: "non_trovato", prodotto: null, prodotti: [] };
  const validi = candidati.filter(eAutorizzato);
  if (candidati.length === 1) return { esito: "unica", prodotto: candidati[0], prodotti: candidati };
  if (validi.length === 1) return { esito: "proposta", prodotto: validi[0], prodotti: candidati };
  return { esito: "nome_non_univoco", prodotto: null, prodotti: candidati };
}

/** Non legge tabelle impieghi e non restituisce righe di dose o avversità. */
function componiRispostaScheda(input = {}) {
  const trovata = trovaRegistrazioneUnica(parsaCsvFitosanitari(input.csv), input.nome, input.numero);
  return {
    ok: trovata.esito !== "non_trovato",
    fonte: FONTE,
    dataLettura: dataLetturaDaNomeFile(input.urlCsv),
    specie: testo(input.specie) || null,
    esitoRicerca: trovata.esito,
    proposto: trovata.prodotto || null,
    prodotti: trovata.prodotti || [],
    righe: []
  };
}

module.exports = {
  FONTE,
  dataVariazioneOpenData,
  controlloLeggeroScheda,
  estraiUrlCsv,
  dataLetturaDaNomeFile,
  parsaCsvFitosanitari,
  cercaProdotti,
  componiRispostaScheda,
  normalizzaNomeProdotto,
  chiaveGrafia,
  chiaveCompatta,
  eAutorizzato,
  classificaStatoAmministrativo,
  trovaRegistrazioneUnica
};
