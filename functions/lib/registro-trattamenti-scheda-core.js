/**
 * Lettura della scheda pubblica: parser puro, senza rete e senza Firestore.
 * Il file ministeriale non si salva. Si restituiscono solo le righe della specie chiesta.
 */

const FONTE = "Ministero della Salute, open data Fitosanitari, licenza Italian Open Data License 2.0";

function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function numero(value) {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
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

function parsaCsvFitosanitari(csv) {
  const lines = String(csv || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = splitCsv(lines[0]).map((h) => normalizza(h));
  const idx = (nomi) => header.findIndex((h) => nomi.some((n) => h === n || h.includes(n)));
  const iNum = idx(["num_registrazione", "numero_registrazione"]);
  const iNome = idx(["denominazione_prodotto", "denominazione"]);
  const iSost = idx(["sostanze_attive", "principio"]);
  const iStato = idx(["stato_amministrativo"]);
  return lines.slice(1).map((line) => {
    const cells = splitCsv(line);
    return {
      numeroRegistrazione: iNum >= 0 ? testo(cells[iNum]) : "",
      denominazione: iNome >= 0 ? testo(cells[iNome]) : "",
      principioAttivo: iSost >= 0 ? testo(cells[iSost]) : "",
      stato: iStato >= 0 ? testo(cells[iStato]) : ""
    };
  }).filter((row) => row.denominazione || row.numeroRegistrazione);
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
  return chiavi.some((k) => nome === k || nome.includes(k));
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
  estraiUrlCsv,
  dataLetturaDaNomeFile,
  parsaCsvFitosanitari,
  cercaProdotti,
  parsaTabellaImpieghi,
  filtraRigheSpecie,
  componiRispostaScheda
};
