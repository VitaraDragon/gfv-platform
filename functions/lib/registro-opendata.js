const { testo, numero, normalizza } = require("./etichetta-util");

const FONTE = "Ministero della Salute, open data Fitosanitari, licenza Italian Open Data License 2.0";

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

function parsaCsvFitosanitari(csv) {
  const lines = String(csv || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = splitCsv(lines[0]).map((h) => normalizza(h));
  const idx = (nomi) => header.findIndex((h) => nomi.some((n) => h === n || h.includes(n)));
  const iNum = idx(["num_registrazione", "numero_registrazione"]);
  const iNome = idx(["denominazione_prodotto", "denominazione"]);
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

function schedaOltreSeiMesi(iso, oraMs) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return true;
  const limite = new Date(t);
  limite.setUTCMonth(limite.getUTCMonth() + 6);
  return Number(oraMs) >= limite.getTime();
}

const SETTIMANA_CONTROLLO_MS = 7 * 24 * 60 * 60 * 1000;

function controlloSettimanaleDovuto(iso, oraMs) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return true;
  return Number(oraMs) - t >= SETTIMANA_CONTROLLO_MS;
}

/**
 * Controllo leggero: numero, stato, data di revoca o scadenza.
 * Senza una lettura precedente da confrontare, non tratta il silenzio come un cambiamento.
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

function cercaProdotti(righe, nome, limite = 8) {
  const q = normalizza(nome);
  if (!q) return [];
  const scored = (righe || []).map((row) => {
    const den = normalizza(row.denominazione);
    let punti = 0;
    if (den === q) punti = 3;
    else if (den.startsWith(q) || q.startsWith(den)) punti = 2;
    else if (den.includes(q)) punti = 1;
    if (!punti) return null;
    const autorizzato = normalizza(row.stato).startsWith("autorizz") ? 1 : 0;
    return { row, punti, autorizzato };
  }).filter(Boolean);
  scored.sort((a, b) => (b.punti - a.punti) || (b.autorizzato - a.autorizzato) || a.row.denominazione.localeCompare(b.row.denominazione, "it"));
  return scored.slice(0, limite).map((item) => item.row);
}

function celleHtml(tr) {
  return Array.from(String(tr).matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) =>
    testo(m[1].replace(/<[^>]+>/g, " "))
  );
}

function parsaTabellaImpieghi(html) {
  const testoHtml = String(html || "");
  const righe = Array.from(testoHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((m) => celleHtml(m[0])).filter((c) => c.length);
  if (righe.length < 2) return [];
  const header = righe[0].map(normalizza);
  const col = (nomi) => header.findIndex((h) => nomi.some((n) => h.includes(n)));
  const iColtura = col(["coltura", "impiego", "specie"]);
  const iAvv = col(["avvers"]);
  const iCar = col(["carenza"]);
  const iMax = col(["massimo", "max", "n. tratt", "numero"]);
  const iInt = col(["intervallo", "giorni min"]);
  const iHa = col(["ettaro", "/ha", "dose ha"]);
  const iHl = col(["ettolitro", "/hl", "dose hl", "100"]);
  if (iColtura < 0) return [];
  return righe.slice(1).map((cells) => ({
    colturaScheda: cells[iColtura] || "",
    avversita: iAvv >= 0 ? cells[iAvv] || "" : "",
    giorniCarenza: iCar >= 0 ? numero(cells[iCar]) : null,
    impieghiMassimiAnno: iMax >= 0 ? numero(cells[iMax]) : null,
    giorniMinimiTraPassaggi: iInt >= 0 ? numero(cells[iInt]) : null,
    dosePerEttaro: iHa >= 0 ? numero(cells[iHa]) : null,
    dosePerEttolitro: iHl >= 0 ? numero(cells[iHl]) : null
  })).filter((row) => row.colturaScheda);
}

function rigaDiSerra(row) {
  return /serra/.test(normalizza(row.colturaScheda) + " " + normalizza(row.avversita));
}

function colturaCoincide(richiesta, alias, colturaRiga) {
  const nome = normalizza(colturaRiga);
  if (!nome) return false;
  const chiavi = [normalizza(richiesta), ...(alias || []).map(normalizza)].filter(Boolean);
  return chiavi.some((k) => nome === k);
}

function filtraRigheSpecie(righe, specie, alias) {
  const chiedeSerra = /serra/.test(normalizza(specie));
  return (righe || []).filter((row) => {
    if (!chiedeSerra && rigaDiSerra(row)) return false;
    return colturaCoincide(specie, alias, row.colturaScheda);
  });
}

/**
 * @param {{ csv?: string, htmlScheda?: string, nome?: string, specie?: string, alias?: string[], urlCsv?: string }} input
 */
function componiRispostaScheda(input = {}) {
  const prodotti = cercaProdotti(parsaCsvFitosanitari(input.csv), input.nome);
  const specie = testo(input.specie);
  const tutte = parsaTabellaImpieghi(input.htmlScheda);
  const righeLette = tutte.length > 0;
  const righe = specie ? filtraRigheSpecie(tutte, specie, input.alias) : [];
  return {
    ok: true,
    fonte: FONTE,
    dataLettura: dataLetturaDaNomeFile(input.urlCsv),
    specie: specie || null,
    prodotti,
    righe,
    schedaImpieghi: righeLette ? "letta" : "non_letta"
  };
}

module.exports = {
  FONTE,
  testo,
  estraiUrlCsv,
  dataLetturaDaNomeFile,
  parsaCsvFitosanitari,
  dataUtileOpenData,
  dataVariazioneOpenData,
  schedaOltreSeiMesi,
  controlloSettimanaleDovuto,
  controlloLeggeroScheda,
  cercaProdotti,
  celleHtml,
  parsaTabellaImpieghi,
  filtraRigheSpecie,
  componiRispostaScheda
};
