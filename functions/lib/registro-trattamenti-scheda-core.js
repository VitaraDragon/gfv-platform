/**
 * Lettura della scheda pubblica: parser puro, senza rete e senza Firestore.
 * Il file ministeriale non si salva. In archivio restano tutte le colture lette;
 * il lavoro tiene la riga della coltura del terreno.
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

const FORME_COLTURA = [
  ["vite da vino", ["vite da vino", "uva da vino"]],
  ["vite da tavola", ["vite da tavola", "uva da tavola"]],
  ["vite", ["vite"]],
  ["erba medica", ["erba medica"]],
  ["grano saraceno", ["grano saraceno"]],
  ["olivo", ["oliveti", "oliveto", "ulivi", "ulivo", "olive", "olivo"]],
  ["limone", ["limoneti", "limoneto", "limoni", "limone"]],
  ["agrumi", ["agrumi"]],
  ["frumento", ["frumento", "grano tenero", "grano duro", "grano"]],
  ["melo", ["mele", "melo"]],
  ["pesco", ["pesche", "pesco"]],
  ["pero", ["pere", "pero"]],
  ["albicocco", ["albicocco"]],
  ["ciliegio", ["ciliegie", "ciliegio"]],
  ["susino", ["susine", "susino"]],
  ["actinidia", ["actinidia", "kiwi"]],
  ["fico", ["fico"]],
  ["nocciolo", ["nocciolo"]],
  ["castagno", ["castagno"]],
  ["mandorlo", ["mandorle", "mandorlo"]],
  ["arancio", ["arance", "arancio"]],
  ["mandarino", ["mandarini", "mandarino"]],
  ["clementine", ["clementine", "clementino"]],
  ["kaki", ["kaki"]],
  ["noce", ["noci", "noce"]],
  ["pistacchio", ["pistacchio"]],
  ["nettarine", ["nettarine", "nettarina", "nettarino"]],
  ["fragola", ["fragola"]],
  ["cetriolo", ["cetrioli", "cetriolo"]],
  ["cetriolino", ["cetriolino"]],
  ["zucchino", ["zucchine", "zucchino", "zucchini"]],
  ["melone", ["meloni", "melone"]],
  ["cocomero", ["cocomeri", "cocomero", "anguria", "angurie"]],
  ["zucca", ["zucca"]],
  ["pomodoro", ["pomodoro"]],
  ["melanzana", ["melanzana"]],
  ["peperone", ["peperone"]],
  ["lauroceraso", ["lauroceraso"]],
  ["rosa", ["rosa"]],
  ["garofano", ["garofano"]],
  ["lattuga", ["lattughe", "lattuga"]],
  ["tabacco", ["tabacco"]],
  ["mora", ["mora"]],
  ["lampone", ["lampone"]],
  ["aglio", ["aglio"]],
  ["cipolla", ["cipolle", "cipolla"]],
  ["scalogno", ["scalogno"]],
  ["finocchio", ["finocchio"]],
  ["patata", ["patate", "patata"]],
  ["carota", ["carote", "carota"]],
  ["sedano", ["sedano"]],
  ["asparago", ["asparago"]],
  ["cavolfiore", ["cavolfiori", "cavolfiore"]],
  ["broccoli", ["broccoli"]],
  ["prezzemolo", ["prezzemolo"]],
  ["indivia", ["indivia"]],
  ["radicchio", ["radicchio"]],
  ["scarola", ["scarola"]],
  ["barbabietola", ["barbabietola da zucchero", "barbabietola"]],
  ["spinacio", ["spinaci", "spinacio"]],
  ["bietola", ["bietole", "bietola"]],
  ["carciofo", ["carciofo"]],
  ["porro", ["porro"]],
  ["fagiolo", ["fagioli", "fagiolo"]],
  ["pisello", ["piselli", "pisello"]],
  ["fagiolino", ["fagiolino"]],
  ["valerianella", ["valerianella"]],
  ["mais", ["mais"]],
  ["orzo", ["orzo"]],
  ["favino", ["favino"]],
  ["girasole", ["girasole"]],
  ["soia", ["soia"]],
  ["colza", ["colza"]],
  ["avena", ["avena"]],
  ["segale", ["segale"]],
  ["fava", ["fava"]],
  ["lenticchia", ["lenticchie", "lenticchia"]],
  ["cece", ["cece"]],
  ["lupino", ["lupino"]],
  ["cicerchia", ["cicerchia"]],
  ["riso", ["riso"]],
  ["amaranto", ["amaranto"]],
  ["quinoa", ["quinoa"]],
  ["canapa", ["canapa"]],
  ["lino", ["lino"]],
  ["carthamo", ["carthamo"]],
  ["trifoglio", ["trifoglio"]],
  ["veccia", ["veccia"]],
  ["lupinella", ["lupinella"]],
  ["sorgo", ["sorgo"]],
  ["miglio", ["miglio"]],
  ["panico", ["panico"]]
];

function posizioniColtura(frammento) {
  const basso = normalizza(frammento);
  const punti = [];
  FORME_COLTURA.forEach(([canon, forme]) => {
    forme.forEach((forma) => {
      const re = new RegExp("(^|[^a-zà-ÿ])(" + forma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![a-zà-ÿ])", "g");
      let match = re.exec(basso);
      while (match) {
        const at = match.index + match[1].length;
        if (forma === "ciliegio" && /^ dolce/.test(basso.slice(at + forma.length))) {
          match = re.exec(basso);
          continue;
        }
        const prima = basso.slice(Math.max(0, at - 12), at);
        if (/(?:del|della|dello|dei|degli|delle)\s+$/.test(prima)) {
          match = re.exec(basso);
          continue;
        }
        punti.push({ canon, at, fine: at + forma.length });
        match = re.exec(basso);
      }
    });
  });
  punti.sort((a, b) => a.at - b.at || b.fine - b.at - (a.fine - a.at));
  const tenuti = [];
  punti.forEach((p) => {
    if (tenuti.some((t) => p.at < t.fine && p.fine > t.at)) return;
    tenuti.push(p);
  });
  return tenuti;
}

function coltureIn(frammento) {
  const out = [];
  posizioniColtura(frammento).forEach((p) => {
    if (!out.includes(p.canon)) out.push(p.canon);
  });
  return out;
}

function dosiApplicazione(testoEtichetta) {
  const t = String(testoEtichetta || "");
  const out = [];
  const re = /([A-Za-zÀ-ÿ][^:]{0,48}:\s*)?(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*(?:(dispenser|erogatori|aerosol|diffusori|kg|g|l|ml)\s*)?\/\s*(ha|hl)/gi;
  let match = re.exec(t);
  while (match) {
    const intorno = t.slice(Math.max(0, match.index - 24), match.index + match[0].length + 40);
    const etichetta = testo(match[1] || "").replace(/:\s*$/, "");
    if (/s\.a\./i.test(intorno) || /consigliat/i.test(intorno)) {
      match = re.exec(t);
      continue;
    }
    let unita = (match[4] || "").toLowerCase();
    if (!unita && /diffusori per ettaro/i.test(etichetta)) unita = "diffusori";
    if (!unita && /^(kg|g|l|ml)$/i.test(etichetta)) unita = etichetta.toLowerCase();
    const colturaGreta = /numero|massimo|dose|diffusori per ettaro/i.test(etichetta)
      || !/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' ]{1,40}$/.test(etichetta);
    if (unita) {
      out.push({
        min: numero(match[2]),
        max: numero(match[3]),
        unita,
        per: match[5].toLowerCase(),
        coltura: colturaGreta ? "" : etichetta,
        at: match.index,
        lunghezza: match[0].length
      });
    }
    match = re.exec(t);
  }
  return out.filter((dose) => dose.min != null && dose.max != null);
}

function coltureDellaDose(t, dose, coltureDocumento) {
  const dalPrefisso = dose.coltura ? coltureIn(dose.coltura) : [];
  if (dalPrefisso.length === 1) return dalPrefisso;
  const prima = t.slice(Math.max(0, dose.at - 240), dose.at);
  const dopo = t.slice(dose.at, Math.min(t.length, dose.at + dose.lunghezza + 200));
  const frase = prima.split(/\.\s+(?=[A-ZÀ-Ÿ])/).pop() + " " + dopo.split(/\.\s+(?=[A-ZÀ-Ÿ])/)[0];
  const nellaFrase = coltureIn(frase);
  if (nellaFrase.length) return nellaFrase;
  if (coltureDocumento.length === 1) return coltureDocumento;
  return [];
}

function nomeAvversitaPulito(raw, accettaSingolo) {
  const t = testo(raw).replace(/[’ʼ′`]/g, "'");
  const composto = t.match(/([A-Za-zÀ-ÿ]+(?:\s+dell'\s*|\s+degli\s+|\s+delle\s+)[A-Za-zÀ-ÿ]+)/);
  if (composto) {
    const nome = testo(composto[1]);
    if (/^(ministero|titolare|norma|rispetto|senso|base|parte|zona|fine|corso|assenza|caso|uso|termini|prima|interno|irritazione|accoppiamenti|giudizio|responsabile|altezza|numero|dose|via|campo|registrazione|efficacia|conformita|conformità)\b/i.test(nome)) return "";
    return nome;
  }
  const delColtura = t.match(/([A-Za-zÀ-ÿ]+)\s+del\s+([A-Za-zÀ-ÿ]+)/);
  if (delColtura && coltureIn(delColtura[2]).length === 1) {
    if (/^(registrazione|ministero|via|altezza|interno|campo|giudizio|responsabilità|conformità|responsabile|improprio|efficacia|irritazione|prima|assenza)\b/i.test(delColtura[1])) return "";
    return testo(delColtura[1] + " del " + delColtura[2]);
  }
  if (!accettaSingolo) return "";
  const singolo = t.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]{3,24})$/);
  if (!singolo) return "";
  if (/^(Dose|Numero|Massimo|Carenza|Intervallo|Olivo|Melo|Pesco|Pero|Vite|Europe)$/i.test(singolo[1])) return "";
  return singolo[1];
}

function avversitaTrovate(testoEtichetta) {
  const t = String(testoEtichetta || "");
  const out = [];
  const viste = new Set();
  const aggiungi = (nome, at, accettaSingolo) => {
    const pulito = nomeAvversitaPulito(nome, accettaSingolo);
    if (!pulito) return;
    const secondo = pulito.split(/\s+/).pop();
    const secondoColtura = coltureIn(secondo).length === 1;
    const contesto = /lotta|controllo|contro|avversit|fitofag|parassit|prays/i.test(t.slice(Math.max(0, at - 90), at));
    if (!accettaSingolo && !contesto && !secondoColtura) return;
    const chiave = normalizza(pulito);
    if (viste.has(chiave)) return;
    viste.add(chiave);
    out.push({ nome: pulito, at });
  };
  const composto = /[A-Za-zÀ-ÿ]+(?:\s+dell['’ʼ′`]\s*|\s+degli\s+|\s+delle\s+)[A-Za-zÀ-ÿ]+/g;
  let match = composto.exec(t);
  while (match) {
    aggiungi(match[0], match.index, false);
    match = composto.exec(t);
  }
  const paren = /\(([A-Za-zÀ-ÿ][^)]{3,50})\)/g;
  match = paren.exec(t);
  while (match) {
    if (!/\d/.test(match[1])) aggiungi(match[1], match.index, false);
    match = paren.exec(t);
  }
  frasiDi(t).forEach((frase) => {
    const dopo = frase.match(/:\s*([A-ZÀ-Ÿ][a-zà-ÿ]{3,24})\s*,/);
    if (dopo) aggiungi(dopo[1], t.indexOf(dopo[1], Math.max(0, t.indexOf(frase))), true);
  });
  out.sort((a, b) => a.at - b.at);
  return out;
}

function frasiDi(t) {
  return String(t || "").split(/\.\s+(?=[A-ZÀ-Ÿ])/);
}

function fraseAttorno(t, at) {
  const prima = String(t || "").slice(0, at);
  const dopo = String(t || "").slice(at);
  const inizio = prima.split(/\.\s+(?=[A-ZÀ-Ÿ])/).pop();
  const fine = dopo.split(/\.\s+(?=[A-ZÀ-Ÿ])/)[0];
  return inizio + fine;
}

function assegnaAvversita(t, avversita, coltureDocumento) {
  avversita.forEach((avv) => {
    const nelNome = coltureIn(avv.nome);
    if (nelNome.length === 1) {
      avv.coltura = nelNome[0];
      return;
    }
    const frase = fraseAttorno(t, avv.at);
    const nellaFrase = coltureIn(frase);
    const altre = avversita.filter((altra) => normalizza(frase).includes(normalizza(altra.nome)));
    if (nellaFrase.length === 1 && altre.length === 1) {
      avv.coltura = nellaFrase[0];
      return;
    }
    avv.coltura = coltureDocumento.length === 1 ? coltureDocumento[0] : null;
  });
  frasiDi(t).forEach((frase) => {
    if (!/rispettivamente/i.test(frase)) return;
    const pezzi = frase.split(/rispettivamente/i);
    const prima = pezzi[0];
    const dopo = pezzi.slice(1).join(" ");
    const nomi = avversita.filter((avv) => normalizza(prima).includes(normalizza(avv.nome)));
    const colture = coltureIn(dopo);
    if (!nomi.length || nomi.length !== colture.length) return;
    nomi.forEach((avv, i) => {
      avv.coltura = colture[i];
    });
  });
}

function epocaNelTesto(testoEtichetta) {
  const match = String(testoEtichetta || "").match(/epoca\s+d['’]?\s*applicazione:\s*([^.]{8,160})/i);
  if (!match) return null;
  const pezzo = testo(match[1].split(",")[0]);
  if (pezzo.length <= 90) return pezzo;
  return pezzo.slice(0, 90).replace(/\s+\S*$/, "");
}

function valoreNellaFrase(frammento, regex, nonNecessario) {
  const t = String(frammento || "");
  if (nonNecessario && /tempo di carenza:\s*non necessario/i.test(t)) return 0;
  const match = t.match(regex);
  return match ? numero(match[1]) : null;
}

function limitiPerColtura(t, coltura, epoca) {
  const frasi = frasiDi(t);
  const leggi = (regex, nonNecessario) => {
    const sue = [];
    const generali = [];
    frasi.forEach((frase) => {
      const val = valoreNellaFrase(frase, regex, nonNecessario);
      if (val == null) return;
      const colture = coltureIn(frase);
      if (colture.includes(coltura)) sue.push(val);
      else if (!colture.length) generali.push(val);
    });
    if (sue.length === 1) return sue[0];
    if (!sue.length && generali.length === 1) return generali[0];
    return null;
  };
  return {
    impieghiMassimiAnno: leggi(/numero massimo di trattamenti:\s*(\d+)/i)
      ?? leggi(/max\.?\s*(\d+)\s+applicazion/i),
    giorniMinimiTraPassaggi: leggi(/intervallo minimo(?:\s+tra i trattamenti)?\s*(?:di\s*)?(\d+)\s*giorn/i),
    giorniCarenza: leggi(/(?:tempo di carenza|carenza)\s*(?:di\s*)?(\d+)\s*giorn/i, true),
    epoca
  };
}

function rigaDaCoppia(coltura, dose, avversita, limiti) {
  const perHa = dose.per === "ha";
  return {
    colturaScheda: coltura,
    epoca: limiti.epoca,
    avversita,
    pienoCampo: true,
    giorniCarenza: limiti.giorniCarenza,
    giorniCarenzaSerra: null,
    doseMinHa: perHa ? dose.min : null,
    doseMaxHa: perHa ? dose.max : null,
    doseMinHl: perHa ? null : dose.min,
    doseMaxHl: perHa ? null : dose.max,
    unitaDose: dose.unita,
    impieghiMassimiAnno: limiti.impieghiMassimiAnno,
    giorniMinimiTraPassaggi: limiti.giorniMinimiTraPassaggi,
    affidabilita: "alta"
  };
}

function senzaEsclusioni(frammento) {
  return String(frammento || "").replace(/ad esclusione di [^),.;]+/gi, " ");
}

function coltureNelGruppo(frammento) {
  const grezzo = senzaEsclusioni(frammento);
  const base = [];
  const aggiungi = (lista) => {
    lista.forEach((coltura) => {
      if (!base.includes(coltura)) base.push(coltura);
    });
  };
  const paren = /\(([^)]*)\)/g;
  let match = paren.exec(grezzo);
  while (match) {
    const dentro = match[1];
    if (!/pieno campo|serra|eccetto|baby|olive da|dose max/i.test(dentro)) aggiungi(coltureIn(dentro));
    match = paren.exec(grezzo);
  }
  aggiungi(coltureIn(grezzo.replace(/\([^)]*\)/g, " ")));
  if (/vite da vino e da tavola|vite da tavola e da vino|\(\s*da vino e da tavola\s*\)|\(\s*da tavola e da vino\s*\)/i.test(grezzo)) {
    aggiungi(["vite da vino", "vite da tavola"]);
  }
  if (/\bagrumi\b/i.test(grezzo)) {
    aggiungi(["limone", "arancio", "mandarino", "clementine"]);
  }
  if (base.includes("vite da vino") || base.includes("vite da tavola")) {
    return base.filter((coltura) => coltura !== "vite" && coltura !== "agrumi");
  }
  return base.filter((coltura) => coltura !== "agrumi");
}

function doseMillilitriHl(frase) {
  const t = String(frase || "");
  const intervallo = t.match(/(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*mL\s*\/\s*hL/i);
  if (intervallo) return { min: numero(intervallo[1]), max: numero(intervallo[2]) };
  const aCapo = t.match(/(\d+(?:[.,]\d+)?)\s*-\s*mL\s*\/\s*hL/i);
  if (aCapo) return { min: numero(aCapo[1]), max: numero(aCapo[1]) };
  const fissa = t.match(/(\d+(?:[.,]\d+)?)\s*mL\s*\/\s*hL/i);
  if (fissa) return { min: numero(fissa[1]), max: numero(fissa[1]) };
  return null;
}

function avversitaDelContro(frase) {
  const match = String(frase || "").match(/contro\s+((?:[A-Z][a-z]+\s+[a-z]+)(?:\s+e\s+[A-Z][a-z]+\s+[a-z]+)?)/);
  if (!match) return [];
  return match[1].split(/\s+e\s+/).map((nome) => testo(nome)).filter((nome) => /^[A-Z][a-z]+\s+[a-z]+$/.test(nome));
}

function epocaDellaFrase(frase) {
  const t = String(frase || "");
  const stadio = t.match(/dallo stadio di\s+(.+?)\s+fino\s+(?:allo stadio di\s+|a\s+)([^,.]+)/i);
  if (stadio) return testo(stadio[1] + " – " + stadio[2]);
  const da = t.match(/\bda\s+((?:inizio\s+)?[a-zà-ÿ]+(?:\s+[a-zà-ÿ]+)?)\s+a\s+([^,.]+)/i);
  if (da && /germogli|fiorit|foglia|matur/i.test(da[1])) return testo(da[1] + " – " + da[2]);
  return null;
}

function intervalloOgni(frase) {
  const match = String(frase || "").match(/ogni\s+(\d+)(?:\s*[–—-]\s*(\d+))?\s*giorn/i);
  return match ? numero(match[1]) : null;
}

function paragrafiEpoca(testoEtichetta) {
  const sez = String(testoEtichetta || "").split(/EPOCHE DI APPLICAZIONE/i)[1];
  if (!sez) return [];
  const fino = sez.split(/DOSAGGI E MODALIT/i)[0];
  return frasiDi(fino).map((frase) => {
    const hl = doseMillilitriHl(frase);
    return {
      colture: coltureNelGruppo(frase),
      avversita: avversitaDelContro(frase),
      doseHl: hl,
      intervallo: intervalloOgni(frase),
      epoca: epocaDellaFrase(frase)
    };
  }).filter((blocco) => blocco.colture.length && blocco.avversita.length);
}

function righeTabellaDosi(testoEtichetta) {
  const match = String(testoEtichetta || "").match(/N[°ºo]?\s*massimo\s+Applicazioni\s+(.+?)\s+N\.B\./i);
  if (!match) return [];
  const re = /([A-ZÀ-Ÿ][^0-9]{1,120}?)\s+(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s+(?:Pieno campo:\s*(\d+)\s+Serra:\s*(\d+)|(\d+))/g;
  const out = [];
  let trovato = re.exec(match[1]);
  while (trovato) {
    const colture = coltureNelGruppo(trovato[1]);
    const min = numero(trovato[2]);
    const max = numero(trovato[3] || trovato[2]);
    if (colture.length && min != null && max != null) {
      out.push({
        colture,
        doseHa: { min, max },
        massimoCampo: numero(trovato[4] || trovato[6]),
        massimoSerra: trovato[5] ? numero(trovato[5]) : null
      });
    }
    trovato = re.exec(match[1]);
  }
  return out;
}

function carenzaDelleColture(testoEtichetta) {
  const match = String(testoEtichetta || "").match(/INTERVALLO TRA L'ULTIMO TRATTAMENTO E LA RACCOLTA:\s*([^.]*)/i);
  const mappa = new Map();
  if (!match) return mappa;
  const re = /(\d+)\s+giorn[oi]\s+per\s+([\s\S]*?)(?=(?:,\s*)?\d+\s+giorn|$)/gi;
  let trovato = re.exec(match[1]);
  while (trovato) {
    const giorni = numero(trovato[1]);
    coltureNelGruppo(trovato[2]).forEach((coltura) => {
      if (!mappa.has(coltura)) mappa.set(coltura, giorni);
    });
    trovato = re.exec(match[1]);
  }
  return mappa;
}

function rigaImpiego(coltura, avversita, dati, pienoCampo, massimo) {
  return {
    colturaScheda: coltura,
    epoca: dati.epoca || null,
    avversita,
    pienoCampo,
    giorniCarenza: dati.giorniCarenza == null ? null : dati.giorniCarenza,
    giorniCarenzaSerra: dati.giorniCarenzaSerra == null ? null : dati.giorniCarenzaSerra,
    doseMinHa: dati.doseHa ? dati.doseHa.min : null,
    doseMaxHa: dati.doseHa ? dati.doseHa.max : null,
    doseMinHl: dati.doseHl ? dati.doseHl.min : null,
    doseMaxHl: dati.doseHl ? dati.doseHl.max : null,
    unitaDose: null,
    unitaDoseHa: dati.unitaHa || (dati.doseHa ? "l" : null),
    unitaDoseHl: dati.unitaHl || (dati.doseHl ? "ml" : null),
    impieghiMassimiAnno: massimo == null ? null : massimo,
    giorniMinimiTraPassaggi: dati.intervallo == null ? null : dati.intervallo,
    affidabilita: "alta"
  };
}

function estraiImpieghiTabella(testoEtichetta) {
  const epoche = paragrafiEpoca(testoEtichetta);
  const tabella = righeTabellaDosi(testoEtichetta);
  if (!epoche.length || !tabella.length) return { righe: [], motivo: "estrazione_incerta" };
  const carenze = carenzaDelleColture(testoEtichetta);
  const perColtura = new Map();
  epoche.forEach((blocco) => {
    blocco.colture.forEach((coltura) => {
      const gia = perColtura.get(coltura) || { avversita: [], doseHl: null, intervallo: null, epoca: null };
      blocco.avversita.forEach((nome) => {
        if (!gia.avversita.includes(nome)) gia.avversita.push(nome);
      });
      if (!gia.doseHl && blocco.doseHl) gia.doseHl = blocco.doseHl;
      if (gia.intervallo == null && blocco.intervallo != null) gia.intervallo = blocco.intervallo;
      if (!gia.epoca && blocco.epoca) gia.epoca = blocco.epoca;
      perColtura.set(coltura, gia);
    });
  });
  const righe = [];
  const viste = new Set();
  tabella.forEach((riga) => {
    riga.colture.forEach((coltura) => {
      const epoca = perColtura.get(coltura);
      if (!epoca || !epoca.avversita.length) return;
      if (!riga.doseHa && !epoca.doseHl) return;
      epoca.avversita.forEach((nome) => {
        const dati = {
          epoca: epoca.epoca,
          doseHa: riga.doseHa,
          doseHl: epoca.doseHl,
          intervallo: epoca.intervallo,
          giorniCarenza: carenze.has(coltura) ? carenze.get(coltura) : null
        };
        const chiaveCampo = [coltura, nome, "campo"].join("|");
        if (!viste.has(chiaveCampo)) {
          viste.add(chiaveCampo);
          righe.push(rigaImpiego(coltura, nome, dati, true, riga.massimoCampo));
        }
        if (riga.massimoSerra != null && riga.massimoSerra !== riga.massimoCampo) {
          const chiaveSerra = [coltura, nome, "serra"].join("|");
          if (!viste.has(chiaveSerra)) {
            viste.add(chiaveSerra);
            righe.push(rigaImpiego(coltura, nome, dati, false, riga.massimoSerra));
          }
        }
      });
    });
  });
  return righe.length ? { motivo: null, righe } : { righe: [], motivo: "estrazione_incerta" };
}

function uniciNomi(lista) {
  const out = [];
  (lista || []).forEach((voce) => {
    const nome = testo(voce);
    if (!nome) return;
    if (!out.some((gia) => normalizza(gia) === normalizza(nome))) out.push(nome);
  });
  return out;
}

function nomePulitoAvversita(nome) {
  let t = testo(nome).replace(/^(e|ed|contro)\s+/i, "").replace(/^[,;\s]+/, "").replace(/[.,;:]+$/g, "");
  const chiave = t.match(/(muffa|marcium|oidio|botrit|ticchiol|peronosp|ruggin|sclerot|alternar|antracn|monili|cladosp|cancr|necrosi|lebbra|bolla|cercosp|ramular|septor|black|occhio|fersa|stemfil|glomerella|alternariosi|septoriosi|ramularia|nerume|maculat|coccinigl|afid|psill|aleurod|acar|eriofid|infestant|mosca|tignol|nottua)/i);
  if (chiave && chiave.index > 0) t = testo(t.slice(chiave.index));
  t = t.replace(/\s+(?:della|delle|degli|dello|del|di)$/i, "").trim();
  const elenchiLatini = t.match(/\b[A-Z][a-z]{2,}\s+spp\.?/g) || [];
  if (elenchiLatini.length < 2) {
    t = t.replace(/\s+[A-Z][a-z]{2,}(?:\s+(?:spp\.?|[a-z]{3,}))+\b.*$/, "").trim();
  }
  if (t.length < 3 || t.length > 60) return "";
  if (/^[A-Z][a-z]+\s+hum(?:\s+spp\.?)?$/i.test(t)) return "";
  if (!chiave && /^[A-Z][a-z]{2,}\s+[a-z]{1,3}$/.test(t) && !/\sspp\.?$/i.test(t)) return "";
  if (!chiave && t.split(/\s+/).length > 2) return "";
  if (/^(da|di|per|con|su|nel|nella|delle|degli|altra|piccola|frutti|piante|insalate|foglie|erbe|cavoli|cucurbitacee|colture|ornamentali|cipolline)\b/i.test(t)) return "";
  if (/[,()]|insalate|cipolline|cucurbitacee|juncea|arbustiv|ornamentali/i.test(t)) return "";
  if (/\//.test(t) || /^(dolci|amare|sanguigne|trifogliate|bergamotti|chinotti)$/i.test(t)) return "";
  if (t.split(/\s+/).length > 6) return "";
  if (/\d|dose|coltura|patogeno|malattia|massimo|intervallo|giorni|trattament|ettaro|ettolitro|pieno campo|serra|attenzione|decreto/i.test(t)) return "";
  if (coltureIn(t).length === 1 && normalizza(t) === coltureIn(t)[0]) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function spezzaNomiItaliani(raw) {
  const pezzi = testo(raw).split(/\s*,\s*|\s+ed\s+|\s+e\s+/).map((p) => testo(p)).filter(Boolean);
  if (pezzi.length <= 1) return uniciNomi([nomePulitoAvversita(raw)]);
  const out = [];
  let acc = "";
  const malattia = (pezzo) => /muffa|oidio|botrit|ticchiol|peronosp|ruggin|sclerot|alternar|antracn|monili|cladosp|cancr|necrosi|lebbra|bolla|marcium|cercosp|ramular|septor|black|occhio|fersa|stemfil|nerume|maculat|coccinigl|afid|psill|aleurod|acar|eriofid|infestant|mosca|tignol|nottua/i.test(pezzo);
  pezzi.forEach((pezzo, i) => {
    if (!acc) acc = pezzo;
    else if (malattia(pezzo)) {
      const nome = nomePulitoAvversita(acc);
      if (nome) out.push(nome);
      const taglio = pezzo.match(/(muffa|oidio|botrit|ticchiol|peronosp|ruggin|sclerot|alternar|antracn|monili|cladosp|cancr|necrosi|lebbra|bolla|marcium|cercosp|ramular|septor|black|occhio|fersa|stemfil)/i);
      acc = taglio ? pezzo.slice(taglio.index) : pezzo;
    } else acc += " e " + pezzo;
    if (i === pezzi.length - 1) {
      const nome = nomePulitoAvversita(acc);
      if (nome) out.push(nome);
    }
  });
  return uniciNomi(out);
}

function parenEMalattia(dentro) {
  const t = testo(dentro);
  if (/spp/i.test(t)) return true;
  const latini = t.match(/[A-Z][a-z]+\s+[a-z]+/g) || [];
  if (!latini.length) return false;
  if (/,/.test(t) && latini.length < 2) return false;
  return latini.every((nome) => !coltureIn(nome.split(/\s+/)[0]).length);
}

function nomiDalResto(resto) {
  const t = String(resto || "")
    .replace(/\([^)]*(?:pieno campo|serra|eccetto|baby|olive da|dose max|raccolta|stadio|foglie|buccia)[^)]*\)/gi, " ")
    .replace(/spp\s+\./gi, "spp.");
  const daParen = [];
  const re = /([A-Za-zÀ-ÿ][^()]{2,70}?)\s*\(([^)]+)\)/g;
  let match = re.exec(t);
  while (match) {
    if (parenEMalattia(match[2])) {
      const pezzo = testo(match[1]).split(/[,:]/).pop();
      spezzaNomiItaliani(pezzo).forEach((nome) => daParen.push(nome));
    }
    match = re.exec(t);
  }
  if (daParen.length && !/,/.test(t.slice(0, t.indexOf("(")))) return uniciNomi(daParen);
  const colon = t.match(/([^:]{3,90}):\s*[A-Z]/);
  if (colon) return spezzaNomiItaliani(colon[1]);
  const latini = [];
  const italiani = spezzaNomiItaliani(t);
  const incollati = italiani.some((nome) => /\se\s+[A-Z]|\sspp\.?\s+e\b/i.test(nome));
  if (italiani.length && !incollati) return uniciNomi(italiani).slice(0, 8);
  const reL = /\b([A-Z][a-z]{2,}\s+(?:[a-z]{4,}|spp\.?))\b/g;
  match = reL.exec(t);
  while (match) {
    latini.push(match[1].replace(/\s+spp\.?$/i, " spp."));
    match = reL.exec(t);
  }
  if (latini.length) return uniciNomi(latini.map((nome) => nomePulitoAvversita(nome)).filter(Boolean));
  return [];
}

function senzaColture(frammento) {
  let t = " " + String(frammento || "") + " ";
  const forme = [];
  FORME_COLTURA.forEach(([, lista]) => lista.forEach((forma) => forme.push(forma)));
  forme.sort((a, b) => b.length - a.length);
  forme.forEach((forma) => {
    const re = new RegExp("(^|[^A-Za-zÀ-ÿ])(" + forma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![A-Za-zÀ-ÿ])", "gi");
    t = t.replace(re, "$1 ");
  });
  return t;
}

function soloSerra(frammento) {
  const t = normalizza(frammento);
  return /\(\s*(?:in\s+)?serra\s*\)/.test(t) && !/pieno campo/.test(t);
}

function limitiIndicazione(frammento) {
  const t = String(frammento || "");
  let max = null;
  const esplicito = t.match(/(?:non superare i|fino ad un massimo di|un massimo di|massimo di|massimo)\s+(\d+)(?!\d)(?!\s*[.,]\d)(?!\s*(?:l|kg|ml|g)\s*\/)/i);
  if (esplicito) max = numero(esplicito[1]);
  else {
    const fascia = t.match(/(\d+)\s*[–—-]\s*(\d+)\s+trattament/i);
    if (fascia) max = numero(fascia[2]);
  }
  const iv = t.match(/(?:intervalli di|intervallo(?:\s+minimo)?(?:\s+tra i trattamenti)?(?:\s+di)?|a cadenza di|cadenza di|con un intervallo di|a distanza di)\s+(\d+)/i);
  return { max, intervallo: iv ? numero(iv[1]) : null };
}

function notaSerra(frammento) {
  const match = String(frammento || "").match(/([A-Za-zÀ-ÿ][^()]{0,40})\(\s*serra\s*\)[^.]{0,80}?massimo\s+(?:di\s+)?(\d+)/i);
  if (!match) return null;
  const colture = coltureIn(match[1]);
  return { colture, massimo: numero(match[2]) };
}

function coppiaDose(min, max) {
  const a = numero(min);
  const b = numero(max == null || max === "" ? min : max);
  if (a == null || b == null || a <= 0 || b <= 0 || b < a || b > 400) return null;
  return { min: a, max: b };
}

function spezzaIndicazioni(gap) {
  const t = String(gap || "");
  if (/^\s*(?:\d+\s*[–—-]?\s*\d*\s*)?(?:trattament|massimo|effettuare|iniziare|si raccomanda|utilizzare i dosaggi)/i.test(t)) {
    const colture = posizioniColtura(t);
    const malattia = t.search(/[A-ZÀ-Ÿ][a-zà-ÿ]{2,}(?:\s+[a-zà-ÿ]+){0,5}\s*:\s*[A-Z]|[A-Z][a-z]{2,}\s+spp/);
    let taglio = t.length;
    if (colture.length) taglio = Math.min(taglio, colture[0].at);
    if (malattia >= 0) taglio = Math.min(taglio, malattia);
    return { indicazioni: t.slice(0, taglio), corrente: t.slice(taglio) };
  }
  const frasi = t.split(/(?<=\.)\s+/);
  const indicazioni = [];
  const corrente = [];
  let passato = false;
  frasi.forEach((frase) => {
    const indica = /massimo|trattament|cadenza|intervall|iniziare|effettuare|si raccomanda/i.test(frase);
    const malato = /spp\.?|\([A-Za-z]/.test(frase) || coltureIn(frase).length > 0;
    if (!passato && indica && !malato) indicazioni.push(frase);
    else {
      passato = true;
      corrente.push(frase);
    }
  });
  return { indicazioni: indicazioni.join(" "), corrente: corrente.join(" ") };
}

function indiciMalattia(frammento) {
  const t = String(frammento || "");
  const out = [];
  const re = /\(([^)]{3,100})\)/g;
  let match = re.exec(t);
  while (match) {
    const dentro = testo(match[1]);
    if (/spp/i.test(dentro) || (/^[A-Z][a-z]+\s+[a-z]+$/.test(dentro) && !/,/.test(dentro))) out.push(match.index);
    match = re.exec(t);
  }
  return out;
}

function ultimoBlocco(corrente) {
  const t = String(corrente || "");
  const colture = posizioniColtura(t);
  const malattie = indiciMalattia(t);
  if (!colture.length) return { prima: "", blocco: t };
  let inizio = colture[0].at;
  colture.forEach((c) => {
    if (malattie.some((at) => at < c.at && at >= inizio)) inizio = c.at;
  });
  return { prima: t.slice(0, inizio), blocco: t.slice(inizio) };
}

function continuaColturaPrecedente(blocco, prefisso) {
  const intorno = String(blocco || "") + " " + String(prefisso || "");
  if (/\(\s*(?:in\s+)?(?:serra|pieno campo)/i.test(intorno)) return false;
  if (/[A-ZÀ-Ÿ][a-zà-ÿ]{3,}\s+\([^)]*(?:serra|pieno campo)/i.test(prefisso || "")) return false;
  return /:/.test(blocco || "") || indiciMalattia(blocco).length > 0;
}

function fineSezione(testo, da, extra) {
  const resto = String(testo || "").slice(da);
  const re = new RegExp("\\b(ATTENZIONE|COMPATIBILIT|FITOTOSSICIT|Si raccomanda l|Sospendere i trattamenti|PREPARAZIONE|GESTIONE DELLE RESISTENZE|Avvertenza|\\*\\s*L'indicazione della dose" + (extra || "") + ")\\b", "i");
  const stop = resto.search(re);
  return da + (stop < 0 ? resto.length : stop);
}

function tipoGriglia(header) {
  const t = normalizza(header).replace(/-\s+/g, "");
  if (/g\/hl/.test(t) && /kg\/ha/.test(t)) return "signum";
  if (/ml\/hl/.test(t) && /l\/ha/.test(t)) return "score";
  if (/grammi/.test(t) && /kg/.test(t)) return "switch";
  if (/kg\/ha/.test(t) && /inter/.test(t)) return "cabrio";
  if (/fitofag/.test(t) && /l\/hl/.test(t) && /l\/ha/.test(t)) return "fitofagi";
  if (/avversit/.test(t) && /dosi\/ha|volume/.test(t)) return "unita";
  if (/parassita/.test(t) && /l\/ha/.test(t)) return "parassita";
  if (/periodo/.test(t) && /dosaggio|applicaz/.test(t)) return "periodo";
  if (/l\/ha/.test(t) && /inter/.test(t)) return "litri";
  return "";
}

function dosiSignum(sezione) {
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s+(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s+(\d+)(?:\s*[–—-]\s*(\d+))?\s+(\d+)(?!\d)/g;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const hl = coppiaDose(match[1], match[2] || match[1]);
    const ha = coppiaDose(match[3], match[4] || match[3]);
    const intervallo = numero(match[5]);
    const max = numero(match[7]);
    if (hl && ha && hl.min >= 8 && ha.max < 20 && intervallo != null && intervallo < 60 && max != null && max < 20) {
      out.push({ at: match.index, fine: match.index + match[0].length, hl, ha, intervallo, max, unitaHl: "g", unitaHa: "kg" });
    }
    match = re.exec(sezione);
  }
  return out;
}

function dosiCabrio(sezione) {
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s+(?:(\d+)(?:\s*[–—-]\s*(\d+))?\s*gg|[-–—])\s+(\d+)/gi;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const ha = coppiaDose(match[1], match[2] || match[1]);
    const intervallo = match[3] ? numero(match[3]) : null;
    const max = numero(match[5]);
    if (ha && ha.max < 20 && max != null && max < 20 && (intervallo == null || intervallo < 60)) {
      out.push({ at: match.index, fine: match.index + match[0].length, hl: null, ha, intervallo, max, unitaHl: null, unitaHa: "kg" });
    }
    match = re.exec(sezione);
  }
  return out;
}

function dosiSwitch(sezione) {
  const re = /\b(\d{2,3})(?:\s*[–—-]\s*(\d{2,3}))?\s+(\d+(?:[.,]\d+)?)(?!\s*(?:giorni|applicaz|volte))/gi;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const hl = coppiaDose(match[1], match[2] || match[1]);
    const ha = coppiaDose(match[3], match[3]);
    if (hl && ha && hl.min >= 20 && hl.max <= 300 && ha.max <= 15) {
      out.push({ at: match.index, fine: match.index + match[0].length, hl, ha, intervallo: null, max: null, unitaHl: "g", unitaHa: "kg" });
    }
    match = re.exec(sezione);
  }
  const reHa = /[-–—]\s+(\d+(?:[.,]\d+)?)(?!\s*(?:giorni|applicaz|volte|trattament))/gi;
  match = reHa.exec(sezione);
  while (match) {
    const ha = coppiaDose(match[1], match[1]);
    const at = match.index;
    const fine = match.index + match[0].length;
    const gia = out.some((dose) => at < dose.fine && fine > dose.at);
    if (!gia && ha && ha.max < 8) {
      out.push({ at, fine, hl: null, ha, intervallo: null, max: null, unitaHl: null, unitaHa: "kg" });
    }
    match = reHa.exec(sezione);
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

function dosiScore(sezione) {
  const re = /\b(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s+(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?(?!\s*(?:giorni|trattament|applicaz))/gi;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const a = numero(match[1]);
    const b = match[2] ? numero(match[2]) : null;
    const c = numero(match[3]);
    const d = match[4] ? numero(match[4]) : null;
    const hl = a != null && a >= 8 && a <= 300 && (b == null || b >= 8) ? coppiaDose(a, b != null && b >= 8 ? b : a) : null;
    const ha = c != null && c < 8 ? coppiaDose(c, d != null && d < 8 ? d : c) : null;
    if (hl && ha) {
      const dopo = sezione.slice(match.index + match[0].length, match.index + match[0].length + 40);
      const extra = dopo.match(/^\s*\(\s*dose\s+max(?:ima)?\s+(\d+(?:[.,]\d+)?)\s*\)/i);
      if (extra) {
        const tetto = numero(extra[1]);
        if (tetto != null && tetto >= ha.min) ha.max = tetto;
      }
      out.push({
        at: match.index,
        fine: match.index + match[0].length + (extra ? extra[0].length : 0),
        hl,
        ha,
        intervallo: null,
        max: null,
        unitaHl: "ml",
        unitaHa: "l"
      });
    }
    match = re.exec(sezione);
  }
  return out;
}

function dosiLitri(sezione) {
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s+(\d+)(?:\s*[–—-]\s*(\d+))?\s+(\d+)(?!\d)/g;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const ha = coppiaDose(match[1], match[2] || match[1]);
    const intervallo = numero(match[3]);
    const max = numero(match[5]);
    if (ha && ha.max < 15 && intervallo != null && intervallo < 60 && max != null && max < 20) {
      out.push({ at: match.index, fine: match.index + match[0].length, hl: null, ha, intervallo, max, unitaHl: null, unitaHa: "l" });
    }
    match = re.exec(sezione);
  }
  return out;
}

function dosiParassita(sezione) {
  const re = /(\d+(?:[.,]\d+)?)\s+(\d+)\s+(\d+|[-–—])(?!\d)/g;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const ha = coppiaDose(match[1], match[1]);
    const max = numero(match[2]);
    const intervallo = /\d/.test(match[3]) ? numero(match[3]) : null;
    if (ha && ha.max < 20 && max != null && max <= 12 && (intervallo == null || intervallo < 60)) {
      out.push({ at: match.index, fine: match.index + match[0].length, hl: null, ha, intervallo, max, unitaHl: null, unitaHa: "l" });
    }
    match = re.exec(sezione);
  }
  return out;
}

function dosiUnita(sezione) {
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(l|kg)\s*\/\s*ha\s+\d{2,4}\s*[–—-]\s*\d{2,4}\s+(\d+)\s+\(?\s*(\d+)/gi;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const ha = coppiaDose(match[1], match[2] || match[1]);
    const max = numero(match[4]);
    const intervallo = numero(match[5]);
    if (ha && ha.max < 30 && max != null && max < 20 && intervallo != null && intervallo < 60) {
      out.push({ at: match.index, fine: match.index + match[0].length, hl: null, ha, intervallo, max, unitaHl: null, unitaHa: match[3].toLowerCase() });
    }
    match = re.exec(sezione);
  }
  return out;
}

function dosiFitofagi(sezione) {
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s+(\d+(?:[.,]\d+)?)\s+\d{2,4}\s*[–—-]\s*\d{2,4}\s+(\d+)\s*\(intervallo[^)]*?(\d+)/gi;
  const out = [];
  let match = re.exec(sezione);
  while (match) {
    const hl = coppiaDose(match[1], match[2] || match[1]);
    const ha = coppiaDose(match[3], match[3]);
    const max = numero(match[4]);
    const intervallo = numero(match[5]);
    if (hl && ha && hl.max < 20 && ha.max <= 80 && max != null && max < 20 && intervallo != null && intervallo < 60) {
      out.push({ at: match.index, fine: match.index + match[0].length, hl, ha, intervallo, max, unitaHl: "l", unitaHa: "l" });
    }
    match = re.exec(sezione);
  }
  return out;
}

function righeDaiBlocchi(sezione, dosi) {
  const bozze = [];
  dosi.forEach((dose, i) => {
    const da = i === 0 ? 0 : dosi[i - 1].fine;
    const spezzato = spezzaIndicazioni(sezione.slice(da, dose.at));
    const blocco = ultimoBlocco(spezzato.corrente);
    if (bozze.length) {
      const prima = bozze[bozze.length - 1];
      prima.indicazioni += " " + spezzato.indicazioni;
      if (blocco.prima && !coltureNelGruppo(blocco.prima).length) {
        nomiDalResto(blocco.prima).forEach((nome) => {
          if (!prima.avversita.some((gia) => normalizza(gia) === normalizza(nome))) prima.avversita.push(nome);
        });
      } else prima.indicazioni += " " + blocco.prima;
    }
    const colture = coltureNelGruppo(blocco.blocco);
    bozze.push({
      colture,
      eredita: !colture.length && continuaColturaPrecedente(blocco.blocco, spezzato.indicazioni + " " + blocco.prima),
      avversita: nomiDalResto(senzaColture(blocco.blocco)),
      dose,
      indicazioni: "",
      pienoCampo: !soloSerra(blocco.blocco)
    });
  });
  if (bozze.length && dosi.length) bozze[bozze.length - 1].indicazioni += " " + sezione.slice(dosi[dosi.length - 1].fine);
  let precedenti = [];
  const righe = [];
  bozze.forEach((bozza) => {
    const colture = bozza.eredita && precedenti.length ? precedenti : bozza.colture;
    if (bozza.colture.length) precedenti = bozza.colture;
    if (!colture.length || !bozza.avversita.length) return;
    const limiti = bozza.dose.max == null ? limitiIndicazione(bozza.indicazioni) : { max: bozza.dose.max, intervallo: bozza.dose.intervallo };
    const massimo = bozza.dose.max != null ? bozza.dose.max : limiti.max;
    const intervallo = bozza.dose.intervallo != null ? bozza.dose.intervallo : limiti.intervallo;
    const serra = notaSerra(bozza.indicazioni);
    colture.forEach((coltura) => {
      bozza.avversita.forEach((nome) => {
        const dati = {
          doseHa: bozza.dose.ha,
          doseHl: bozza.dose.hl,
          unitaHa: bozza.dose.unitaHa,
          unitaHl: bozza.dose.unitaHl,
          intervallo,
          giorniCarenza: null
        };
        righe.push(rigaImpiego(coltura, nome, dati, bozza.pienoCampo, massimo));
        if (serra && serra.massimo != null && serra.massimo !== massimo && bozza.pienoCampo && (!serra.colture.length || serra.colture.includes(coltura))) {
          righe.push(rigaImpiego(coltura, nome, dati, false, serra.massimo));
        }
      });
    });
  });
  return righe;
}

function estraiGrigliaImpiego(testoEtichetta) {
  const t = String(testoEtichetta || "");
  const headerRe = /Coltura\s+(?:Patogeno|Malattia|Avversit[aà]|Parassita|Fitofag[io]|Infestant[ei]|Periodo)(?![A-Za-zÀ-ÿ])/gi;
  const righe = [];
  let header = headerRe.exec(t);
  while (header) {
    const dopo = t.slice(header.index + header[0].length);
    const primaColtura = posizioniColtura(dopo)[0];
    const fineHeader = header.index + header[0].length + (primaColtura ? primaColtura.at : 180);
    const tipo = tipoGriglia(t.slice(header.index, fineHeader));
    const sezione = t.slice(fineHeader, fineSezione(t, fineHeader, "|PERICOLO|Etichetta autorizzata"));
    let dosi = [];
    if (tipo === "signum") dosi = dosiSignum(sezione);
    else if (tipo === "cabrio") dosi = dosiCabrio(sezione);
    else if (tipo === "switch") dosi = dosiSwitch(sezione);
    else if (tipo === "score") dosi = dosiScore(sezione);
    else if (tipo === "litri") dosi = dosiLitri(sezione);
    else if (tipo === "parassita") dosi = dosiParassita(sezione);
    else if (tipo === "unita") dosi = dosiUnita(sezione);
    else if (tipo === "fitofagi") dosi = dosiFitofagi(sezione);
    else if (tipo === "periodo") righe.push(...estraiTabellaPeriodo(sezione, t));
    if (dosi.length) righe.push(...righeDaiBlocchi(sezione, dosi));
    header = headerRe.exec(t);
  }
  return righe;
}

function estraiFrasiContro(testoEtichetta) {
  const t = String(testoEtichetta || "");
  const inizio = t.search(/DOSI D'IMPIEGO|DOSI D.IMPIEGO/i);
  if (inizio < 0) return [];
  const sezione = t.slice(inizio, fineSezione(t, inizio));
  const re = /([A-ZÀ-Ÿ][^:]{0,180}?)\s+-\s+Contro\s+([^:]{5,420}?):\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*kg\s*\/\s*ha(?:\s*\(\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*g\s*\/\s*hl\s*\))?/gi;
  const blocchi = [];
  let match = re.exec(sezione);
  while (match) {
    const colture = coltureNelGruppo(match[1]);
    const avversita = nomiDalResto(match[2]);
    const ha = coppiaDose(match[3], match[4] || match[3]);
    const hl = match[5] ? coppiaDose(match[5], match[6] || match[5]) : null;
    if (colture.length && avversita.length && ha) {
      blocchi.push({ colture, avversita, ha, hl, at: match.index, fine: match.index + match[0].length });
    }
    match = re.exec(sezione);
  }
  if (!blocchi.length) return [];
  const tagli = [0, sezione.length];
  const reH = /\b(Pomacee|Drupacee|Altri fruttiferi|Piccoli frutti|GESTIONE|COMPATIBIL|AVVERTENZE|FITOTOSS)\b/g;
  let titolo = reH.exec(sezione);
  while (titolo) {
    tagli.push(titolo.index);
    titolo = reH.exec(sezione);
  }
  tagli.sort((a, b) => a - b);
  return blocchi.flatMap((blocco) => {
    const fine = tagli.find((punto) => punto > blocco.fine) || sezione.length;
    const frasi = sezione.slice(blocco.fine, fine).split(/(?<=\.)\s+/);
    let max = null;
    let intervallo = null;
    const intervalli = [];
    frasi.forEach((frase) => {
      const nomi = coltureIn(frase);
      const sua = blocco.colture.some((coltura) => nomi.includes(coltura));
      const limiti = limitiIndicazione(frase);
      if (sua) {
        if (limiti.max != null) max = limiti.max;
        if (limiti.intervallo != null) intervallo = limiti.intervallo;
        return;
      }
      if (nomi.length) return;
      if (limiti.max != null && max == null) max = limiti.max;
      const trovati = frase.match(/(?:intervalli di|ad intervalli di)\s+(\d+)/gi) || [];
      trovati.forEach((pezzo) => {
        const n = pezzo.match(/(\d+)/);
        if (n) intervalli.push(numero(n[1]));
      });
    });
    if (intervallo == null && intervalli.length) intervallo = Math.min.apply(null, intervalli);
    return blocco.colture.flatMap((coltura) => blocco.avversita.map((nome) => rigaImpiego(coltura, nome, {
      doseHa: blocco.ha,
      doseHl: blocco.hl,
      unitaHa: "kg",
      unitaHl: blocco.hl ? "g" : null,
      intervallo,
      giorniCarenza: null
    }, true, max)));
  });
}

function mappaCarenza(testoEtichetta) {
  const frase = String(testoEtichetta || "").match(/Sospendere i trattamenti\s*:?([\s\S]{0,1500}?)(?=ATTENZIONE|Etichetta autorizzata|$)/i);
  const perColtura = new Map();
  if (!frase) return perColtura;
  const t = frase[1];
  const clausole = [];
  const re1 = /(\d+)\s+giorn[oi]\s+prima della raccolta\s+(?:per|di|su)\s+([^.;]+?)(?=\s*,\s*\d+\s+giorn|\s*[;.]|$)/gi;
  let match = re1.exec(t);
  while (match) {
    clausole.push({ giorni: numero(match[1]), lista: match[2] });
    match = re1.exec(t);
  }
  const re2 = /(\d+)\s+giorn[oi]\s+per\s+([^.;]+?)(?=\s*,\s*\d+\s+giorn|\s*[;.]|$)/gi;
  match = re2.exec(t);
  while (match) {
    if (!/prima della raccolta/i.test(t.slice(Math.max(0, match.index - 40), match.index))) {
      clausole.push({ giorni: numero(match[1]), lista: match[2] });
    }
    match = re2.exec(t);
  }
  const re3 = /([^:;]{3,180}?):\s*(\d+)\s+giorn[oi]/gi;
  match = re3.exec(t);
  while (match) {
    clausole.push({ giorni: numero(match[2]), lista: match[1] });
    match = re3.exec(t);
  }
  clausole.forEach((clausola) => {
    const ambito = /in serra/i.test(clausola.lista) ? "serra" : "campo";
    const colture = coltureNelGruppo(clausola.lista);
    if (/\bagrumi\b/i.test(clausola.lista)) {
      ["limone", "arancio", "mandarino", "clementine"].forEach((coltura) => {
        if (!colture.includes(coltura)) colture.push(coltura);
      });
    }
    colture.forEach((coltura) => {
      const gia = perColtura.get(coltura) || [];
      gia.push({ giorni: clausola.giorni, ambito });
      perColtura.set(coltura, gia);
    });
  });
  const mappa = new Map();
  perColtura.forEach((assegnazioni, coltura) => {
    const serra = assegnazioni.find((voce) => voce.ambito === "serra");
    const campo = assegnazioni.find((voce) => voce.ambito === "campo");
    if (serra && campo && serra.giorni !== campo.giorni) mappa.set(coltura, { campo: campo.giorni, serra: serra.giorni });
    else mappa.set(coltura, { campo: (campo || serra).giorni, serra: null });
  });
  return mappa;
}

function deduplicaRighe(righe) {
  const viste = new Set();
  return righe.filter((riga) => {
    const chiave = [riga.colturaScheda, normalizza(riga.avversita), riga.pienoCampo, riga.doseMinHa, riga.doseMaxHa, riga.doseMinHl, riga.doseMaxHl, riga.impieghiMassimiAnno].join("|");
    if (viste.has(chiave)) return false;
    viste.add(chiave);
    return true;
  });
}

function completaRighe(righe, testoEtichetta) {
  const mappa = mappaCarenza(testoEtichetta);
  let out = righe;
  if (mappa.has("vite da vino") && mappa.has("vite da tavola")) {
    out = [];
    righe.forEach((riga) => {
      if (riga.colturaScheda !== "vite") out.push(riga);
      else ["vite da vino", "vite da tavola"].forEach((coltura) => out.push(Object.assign({}, riga, { colturaScheda: coltura })));
    });
  }
  out = out.map((riga) => {
    const info = mappa.get(riga.colturaScheda);
    if (!info) return riga;
    if (riga.pienoCampo === false) return Object.assign({}, riga, { giorniCarenza: info.serra != null ? info.serra : info.campo });
    return Object.assign({}, riga, {
      giorniCarenza: riga.giorniCarenza != null ? riga.giorniCarenza : info.campo,
      giorniCarenzaSerra: info.serra
    });
  });
  return deduplicaRighe(out);
}

function classeInfestanti(frammento) {
  const t = String(frammento || "");
  const frase = t.match(/controllo delle\s+([^.]{0,90})/i);
  const base = frase ? frase[1] : t;
  const dicot = /dicotiledon/i.test(base);
  const gram = /graminace/i.test(base);
  if (dicot && gram) return "Infestanti graminacee e dicotiledoni";
  if (dicot) return "Infestanti dicotiledoni";
  if (gram) return "Infestanti graminacee";
  return "";
}

function estraiTabellaPeriodo(sezione, intero) {
  const nome = classeInfestanti(intero || sezione);
  if (!nome) return [];
  const re = /(pre-emergenza|post-emergenza)[\s\S]{0,90}?\s+(\d+)\s+(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*(l|kg)\s*\/\s*ha/gi;
  const righe = [];
  let coltura = "";
  let match = re.exec(sezione);
  while (match) {
    const prima = sezione.slice(Math.max(0, match.index - 40), match.index);
    const trovate = coltureNelGruppo(prima);
    if (trovate.length) coltura = trovate[trovate.length - 1];
    const ha = coppiaDose(match[3], match[4]);
    if (coltura && ha) {
      righe.push(rigaImpiego(coltura, nome, {
        doseHa: ha,
        doseHl: null,
        unitaHa: match[5].toLowerCase(),
        unitaHl: null,
        intervallo: null,
        giorniCarenza: null,
        epoca: match[1].toLowerCase()
      }, true, numero(match[2])));
    }
    match = re.exec(sezione);
  }
  return righe;
}

function codaImpiego(testo, from) {
  const resto = String(testo || "").slice(from, from + 650);
  const pezzi = resto.split(/(?<=\.)\s+(?=[A-ZÀ-Ÿ])/);
  let out = pezzi[0] || "";
  for (let i = 1; i < pezzi.length && i < 3; i += 1) {
    if (/massimo|intervall|applicaz/i.test(pezzi[i]) && !/:\s*(?:contro|per il controllo)/i.test(pezzi[i])) out += " " + pezzi[i];
    else break;
  }
  return out;
}

function rigaDaFrase(colture, avversita, ha, hl, coda) {
  const limiti = limitiIndicazione(coda);
  const tetto = String(coda || "").match(/fino ad un massimo di\s+(\d+(?:[.,]\d+)?)\s*(?:l|kg)\s*\/\s*ha/i);
  if (tetto && ha && ha.dose) {
    const n = numero(tetto[1]);
    if (n != null && n >= ha.dose.min) ha.dose.max = n;
  }
  if (!hl) {
    const hlTesto = String(coda || "").match(/(\d+(?:[.,]\d+)?)\s*(ml|g|l)\s*\/\s*hl/i);
    if (hlTesto) hl = { dose: coppiaDose(hlTesto[1], hlTesto[1]), unita: hlTesto[2].toLowerCase() === "g" ? "g" : hlTesto[2].toLowerCase() };
  }
  const altra = String(coda || "").match(/\(\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(kg|l|g|ml)\s*\/\s*ha\s*\)/i);
  if (!ha && altra) ha = { dose: coppiaDose(altra[1], altra[2] || altra[1]), unita: /kg|g/i.test(altra[3]) ? "kg" : "l" };
  if (ha && ha.dose) ha = { dose: ha.dose, unita: ha.unita };
  return colture.flatMap((coltura) => avversita.map((nome) => rigaImpiego(coltura, nome, {
    doseHa: ha && ha.dose ? ha.dose : ha,
    doseHl: hl && hl.dose ? hl.dose : null,
    unitaHa: ha && ha.unita ? ha.unita : null,
    unitaHl: hl && hl.unita ? hl.unita : null,
    intervallo: limiti.intervallo,
    giorniCarenza: null
  }, true, limiti.max)));
}

function estraiFrasiPerColtura(testoEtichetta) {
  const t = String(testoEtichetta || "");
  const righe = [];
  const reContro = /([A-ZÀ-Ÿ][^:]{0,110}?):\s*(?:contro|per il controllo di)\s+([^()]{3,70}?)(?:\s*\([^)]{0,90}\))?\s*(?::|,?\s*con dosi di|applicare|impiegare)?\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(g|ml|l|kg)\s*\/\s*(hl|ha)/gi;
  let match = reContro.exec(t);
  while (match) {
    const colture = coltureNelGruppo(match[1]);
    const avversita = nomiDalResto(match[2]);
    const unita = match[5].toLowerCase();
    const per = match[6].toLowerCase();
    const dose = coppiaDose(match[3], match[4] || match[3]);
    const pacchetto = per === "ha"
      ? { dose, unita: unita === "g" ? "kg" : unita === "ml" ? "l" : unita }
      : null;
    const hl = per === "hl"
      ? { dose, unita: unita === "kg" ? "g" : unita === "l" ? "ml" : unita }
      : null;
    const coda = codaImpiego(t, match.index + match[0].length);
    if (colture.length && avversita.length && dose) righe.push(...rigaDaFrase(colture, avversita, pacchetto, hl, coda));
    match = reContro.exec(t);
  }
  const reDose = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*ml\s*\/\s*hl\s*\(\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*l\s*\/\s*ha\s*\)/gi;
  match = reDose.exec(t);
  while (match) {
    const prima = t.slice(Math.max(0, match.index - 500), match.index);
    const pezzi = prima.split(":");
    let lista = pezzi[pezzi.length - 1] || "";
    let colturaTesto = pezzi[pezzi.length - 2] || "";
    if (!/[A-Za-zÀ-ÿ]{4}/.test(lista) && pezzi.length >= 3) {
      lista = pezzi[pezzi.length - 2];
      colturaTesto = pezzi[pezzi.length - 3];
    }
    const colture = coltureNelGruppo(String(colturaTesto).slice(-100));
    const avversita = nomiDalResto(String(lista).replace(/\([^)]*vettore[^)]*\)/gi, " "));
      const hl = coppiaDose(match[1], match[2] || match[1]);
      const ha = coppiaDose(match[3], match[4] || match[3]);
      const coda = codaImpiego(t, match.index + match[0].length);
      if (colture.length && avversita.length && hl && ha) {
        righe.push(...rigaDaFrase(colture, avversita, { dose: ha, unita: "l" }, { dose: hl, unita: "ml" }, coda));
      }
    match = reDose.exec(t);
  }
  return righe;
}

function estraiDiserbo(testoEtichetta) {
  const t = String(testoEtichetta || "");
  if (!/infestant|diserb|HRAC/i.test(t)) return [];
  const nome = classeInfestanti(t);
  if (!nome) return [];
  const righe = [];
  const reColtura = /([^:]{3,160}?):\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(kg|l)\s*\/\s*ha/gi;
  let match = reColtura.exec(t);
  while (match) {
    const colture = coltureNelGruppo(match[1]);
    const ha = coppiaDose(match[2], match[3] || match[2]);
    const max = /un solo intervento|solo un intervento|effettuare un solo/i.test(t) ? 1 : null;
    if (colture.length && ha && colture.length <= 8) {
      colture.forEach((coltura) => righe.push(rigaImpiego(coltura, nome, {
        doseHa: ha, doseHl: null, unitaHa: match[4].toLowerCase(), unitaHl: null, intervallo: null, giorniCarenza: null
      }, true, max)));
    }
    match = reColtura.exec(t);
  }
  const reSuolo = /(\d+(?:[.,]\d+)?)\s*l\s*\/\s*ha\s+su terreni\s+([^.;,]+)/gi;
  match = reSuolo.exec(t);
  while (match) {
    const prima = t.slice(Math.max(0, match.index - 500), match.index);
    const colture = coltureNelGruppo(prima);
    const ha = coppiaDose(match[1], match[1]);
    const epoca = testo(match[2]).slice(0, 80);
    if (colture.length === 1 && ha) {
      righe.push(rigaImpiego(colture[0], nome, {
        doseHa: ha, doseHl: null, unitaHa: "l", unitaHl: null, intervallo: null, giorniCarenza: null, epoca
      }, true, null));
    }
    match = reSuolo.exec(t);
  }
  const elenco = t.match(/diserbo delle seguenti colture:\s*([\s\S]{10,700}?)(?=DOSI|INFORMAZIONI|CARATTERISTICHE|\.)/i);
  const annuali = t.match(/graminacee annuali[\s\S]{0,220}?(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*litri\/ha[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*litri\/ha/i);
  const perenni = t.match(/graminacee perennanti[\s\S]{0,80}?(\d+(?:[.,]\d+)?)\s*litri\/ha/i);
  if (elenco && (annuali || perenni)) {
    const colture = coltureNelGruppo(elenco[1]).filter((coltura) => coltura !== "riso" || !/escluso riso/i.test(t));
    colture.forEach((coltura) => {
      if (annuali) {
        const fascia = coppiaDose(annuali[1], annuali[2]);
        const dopo = coppiaDose(annuali[3], annuali[3]);
        if (fascia) righe.push(rigaImpiego(coltura, "Graminacee annuali", {
          doseHa: fascia, doseHl: null, unitaHa: "l", unitaHl: null, intervallo: null, giorniCarenza: null, epoca: "fino a inizio accestimento"
        }, true, null));
        if (dopo) righe.push(rigaImpiego(coltura, "Graminacee annuali", {
          doseHa: dopo, doseHl: null, unitaHa: "l", unitaHl: null, intervallo: null, giorniCarenza: null, epoca: "da inizio a fine accestimento"
        }, true, null));
      }
      if (perenni) {
        const ha = coppiaDose(perenni[1], perenni[1]);
        if (ha) righe.push(rigaImpiego(coltura, "Graminacee perennanti", {
          doseHa: ha, doseHl: null, unitaHa: "l", unitaHl: null, intervallo: null, giorniCarenza: null
        }, true, null));
      }
    });
  }
  return righe;
}

function estraiRigheAffidabili(testoEtichetta) {
  const t = String(testoEtichetta || "")
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u00B4\u0060\u02BC]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 80) return { righe: [], motivo: "testo_non_leggibile" };
  const tabella = estraiImpieghiTabella(t);
  if (tabella.righe.length) return tabella;
  const griglia = completaRighe(estraiGrigliaImpiego(t), t);
  if (griglia.length) return { motivo: null, righe: griglia };
  const frasi = completaRighe(estraiFrasiContro(t), t);
  if (frasi.length) return { motivo: null, righe: frasi };
  const perColtura = completaRighe(estraiFrasiPerColtura(t), t);
  if (perColtura.length) return { motivo: null, righe: perColtura };
  const diserbo = completaRighe(estraiDiserbo(t), t);
  if (diserbo.length) return { motivo: null, righe: diserbo };
  const coltureDocumento = coltureIn(t);
  const dosi = dosiApplicazione(t);
  const avversita = avversitaTrovate(t);
  if (!coltureDocumento.length || !dosi.length || !avversita.length) {
    return { righe: [], motivo: "estrazione_incerta" };
  }
  assegnaAvversita(t, avversita, coltureDocumento);
  const dosiPerColtura = new Map();
  dosi.forEach((dose) => {
    coltureDellaDose(t, dose, coltureDocumento).forEach((coltura) => {
      const lista = dosiPerColtura.get(coltura) || [];
      const chiave = [dose.min, dose.max, dose.unita, dose.per].join("|");
      if (!lista.some((gia) => [gia.min, gia.max, gia.unita, gia.per].join("|") === chiave)) lista.push(dose);
      dosiPerColtura.set(coltura, lista);
    });
  });
  const epoca = coltureDocumento.length === 1 ? epocaNelTesto(t) : null;
  const righe = [];
  coltureDocumento.forEach((coltura) => {
    const sueDosi = dosiPerColtura.get(coltura) || [];
    const sueAvversita = avversita.filter((avv) => avv.coltura === coltura);
    if (sueDosi.length !== 1 || !sueAvversita.length) return;
    const suoiLimiti = limitiPerColtura(t, coltura, epoca);
    sueAvversita.forEach((avv) => righe.push(rigaDaCoppia(coltura, sueDosi[0], avv.nome, suoiLimiti)));
  });
  if (!righe.length) return { righe: [], motivo: "estrazione_incerta" };
  return { motivo: null, righe };
}

function epocheNelTesto(frammento) {
  const t = testo(frammento).toLowerCase();
  const trovate = [];
  if (/dopo la fioritura/.test(t)) trovate.push("dopo la fioritura");
  else if (/pre[\s-]*fioritura/.test(t)) trovate.push("pre-fioritura");
  else if (/fioritura/.test(t)) trovate.push("fioritura");
  if (/vegetazione piena/.test(t)) trovate.push("vegetazione piena");
  if (/tardiv/.test(t)) trovate.push("trattamento tardivo");
  if (/precoc/.test(t)) trovate.push("trattamento precoce");
  return trovate.length === 1 ? trovate[0] : null;
}

function estraiDoseFrammento(frammento) {
  const conUnita = String(frammento).match(/(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(kg|g|l)\s*\/\s*(ha|hl)/i);
  if (conUnita) {
    const min = numero(conUnita[1]);
    const max = numero(conUnita[2] || conUnita[1]);
    if (min == null) return null;
    return { min, max: max == null ? min : max, unita: conUnita[3].toLowerCase(), per: conUnita[4].toLowerCase() };
  }
  if (!epocheNelTesto(frammento)) return null;
  const nudo = String(frammento).match(/(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?/);
  if (!nudo) return null;
  const min = numero(nudo[1]);
  const max = numero(nudo[2] || nudo[1]);
  if (min == null) return null;
  return { min, max: max == null ? min : max, unita: null, per: null };
}

function contaDosi(frase) {
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*\d+(?:[.,]\d+)?)?\s*(?:kg|g|l)\s*\/\s*(?:ha|hl)|(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*\d+(?:[.,]\d+)?)?\s+in\s+/gi;
  return (String(frase).match(re) || []).length;
}

function parsaTestoEtichetta(testoEtichetta) {
  const frasi = String(testoEtichetta || "").split(/[.;\n]+/);
  const frammenti = [];
  frasi.forEach((frase) => {
    if (contaDosi(frase) > 1 && /,(?!\d)/.test(frase)) frase.split(/,(?!\d)/).forEach((p) => frammenti.push(p));
    else frammenti.push(frase);
  });
  const finestre = [];
  let unita = null;
  let per = null;
  frammenti.forEach((frammento) => {
    const dose = estraiDoseFrammento(frammento);
    if (!dose) return;
    if (dose.unita) unita = dose.unita;
    if (dose.per) per = dose.per;
    const perEff = dose.per || per;
    const unitaEff = dose.unita || unita;
    if (!perEff || !unitaEff) return;
    const epoca = epocheNelTesto(frammento);
    const finestra = {
      epoca,
      frammento: testo(frammento),
      doseMinHa: null,
      doseMaxHa: null,
      doseMinHl: null,
      doseMaxHl: null,
      unita: unitaEff
    };
    if (perEff === "ha") {
      finestra.doseMinHa = dose.min;
      finestra.doseMaxHa = dose.max;
    } else {
      finestra.doseMinHl = dose.min;
      finestra.doseMaxHl = dose.max;
    }
    finestre.push(finestra);
  });
  return finestre;
}

function limitiNelBlocco(blocco) {
  const t = testo(blocco);
  const max = t.match(/(?:massimo|max\.?)\s*(?:di\s*)?(\d+)\s*(?:trattament|impieg)/i);
  const interv = t.match(/intervallo(?:\s+minimo)?(?:\s+di)?\s*(\d+)\s*giorn/i);
  return {
    impieghiMassimiAnno: max ? numero(max[1]) : null,
    giorniMinimiTraPassaggi: interv ? numero(interv[1]) : null
  };
}

function blocchiColtura(colture, testoEtichetta) {
  const originale = String(testoEtichetta || "");
  const basso = originale.toLowerCase();
  const punti = [];
  (colture || []).forEach((c) => {
    const nome = String(c.colturaScheda || "").toLowerCase();
    if (nome.length < 4) return;
    let da = 0;
    while (da < basso.length) {
      const at = basso.indexOf(nome, da);
      if (at < 0) break;
      punti.push({ coltura: c, at, fine: at + nome.length, nome });
      da = at + nome.length;
    }
  });
  punti.sort((a, b) => a.at - b.at || b.nome.length - a.nome.length);
  const tenuti = [];
  punti.forEach((p) => {
    const dentro = tenuti.some((t) => p.at >= t.at && p.at < t.fine);
    if (!dentro) tenuti.push(p);
  });
  return tenuti.map((p, i) => {
    const fineBlocco = i + 1 < tenuti.length ? tenuti[i + 1].at : originale.length;
    return {
      coltura: p.coltura,
      blocco: originale.slice(p.at, fineBlocco)
    };
  });
}

function finestreDelBlocco(blocco, finestre) {
  const basse = testo(blocco).toLowerCase();
  return (finestre || []).filter((f) => f.frammento && basse.includes(testo(f.frammento).toLowerCase()));
}

function rigaScheda(coltura, finestra, avversita, limiti) {
  const f = finestra || {};
  return {
    colturaScheda: coltura.colturaScheda,
    epoca: f.epoca || null,
    avversita: testo(avversita),
    pienoCampo: true,
    giorniCarenza: coltura.giorniCarenza == null ? null : coltura.giorniCarenza,
    giorniCarenzaSerra: coltura.giorniCarenzaSerra == null ? null : coltura.giorniCarenzaSerra,
    doseMinHa: f.doseMinHa == null ? null : f.doseMinHa,
    doseMaxHa: f.doseMaxHa == null ? null : f.doseMaxHa,
    doseMinHl: f.doseMinHl == null ? null : f.doseMinHl,
    doseMaxHl: f.doseMaxHl == null ? null : f.doseMaxHl,
    unitaDose: f.unita || null,
    impieghiMassimiAnno: limiti.impieghiMassimiAnno,
    giorniMinimiTraPassaggi: limiti.giorniMinimiTraPassaggi
  };
}

function componiRigheScheda(colture, testoEtichetta, finestre, avversitaPerColtura) {
  const mappa = avversitaPerColtura || {};
  const blocchi = blocchiColtura(colture, testoEtichetta);
  const perNome = new Map(blocchi.map((b) => [normalizzaNomeProdotto(b.coltura.colturaScheda), b.blocco]));
  const righe = [];
  (colture || []).forEach((coltura) => {
    const blocco = perNome.get(normalizzaNomeProdotto(coltura.colturaScheda)) || "";
    const sue = finestreDelBlocco(blocco, finestre);
    const limiti = limitiNelBlocco(blocco);
    const basi = sue.length ? sue : [null];
    const avv = mappa[coltura.colturaScheda] || mappa[normalizzaNomeProdotto(coltura.colturaScheda)] || [];
    const nomi = avv.length ? avv : [""];
    basi.forEach((finestra) => {
      nomi.forEach((nomeAvv) => {
        righe.push(rigaScheda(coltura, finestra, nomeAvv, limiti));
      });
    });
  });
  return righe;
}

function idRigaScheda(riga, indice) {
  const base = [riga.colturaScheda, riga.epoca || "", riga.avversita || "", String(indice)]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 180);
  return base || ("riga_" + indice);
}

function componiArchivioProdotto(input = {}) {
  const csv = input.csv || "";
  const trovata = csv
    ? trovaRegistrazioneUnica(parsaCsvFitosanitari(csv), input.nome, input.numero)
    : { esito: "scheda_non_letta", prodotto: null };
  const dataLettura = dataLetturaDaNomeFile(input.urlCsv) || input.dataLettura || null;
  const vuoto = {
    stato: "da_riprovare",
    motivo: trovata.esito === "unica" ? "estrazione_incerta" : (trovata.esito || "scheda_non_letta"),
    fonte: FONTE,
    dataLettura,
    numeroRegistrazione: null,
    principioAttivo: null,
    righe: [],
    revocatoOScaduto: false,
    dataRevocaOScadenza: "",
    testoRevoca: ""
  };
  if (trovata.esito !== "unica") return vuoto;
  const anag = {
    fonte: FONTE,
    dataLettura,
    numeroRegistrazione: trovata.prodotto.numeroRegistrazione || null,
    principioAttivo: trovata.prodotto.principioAttivo || null,
    statoAmministrativoScheda: testo(trovata.prodotto.stato),
    dataVariazioneScheda: dataVariazioneOpenData(trovata.prodotto),
    urlEtichetta: input.urlEtichetta || null,
    dataEtichetta: input.dataEtichetta || ""
  };
  const revoca = avvisoRevocaOScadenza(trovata.prodotto, input.oraMs);
  if (revoca.si) {
    return {
      ...vuoto,
      ...anag,
      stato: "da_verificare",
      motivo: "revocato",
      righe: [],
      revocatoOScaduto: true,
      dataRevocaOScadenza: revoca.data,
      testoRevoca: revoca.testo
    };
  }
  if (Array.isArray(input.righeLette)) {
    if (input.statoLettura === "da_riprovare") {
      return { ...vuoto, ...anag, stato: "da_riprovare", motivo: input.motivoLettura || "scheda_non_letta", righe: [] };
    }
    if (!input.righeLette.length) {
      return { ...vuoto, ...anag, stato: "da_verificare", motivo: input.motivoLettura || "estrazione_incerta", righe: [] };
    }
    return {
      ...anag,
      stato: "pronta",
      motivo: null,
      righe: input.righeLette,
      revocatoOScaduto: false,
      dataRevocaOScadenza: "",
      testoRevoca: ""
    };
  }
  const letta = estraiRigheAffidabili(input.testoEtichetta || "");
  if (!letta.righe.length) {
    return { ...vuoto, ...anag, stato: "da_verificare", motivo: letta.motivo || "estrazione_incerta", righe: [] };
  }
  return { ...anag, stato: "pronta", motivo: null, righe: letta.righe, revocatoOScaduto: false, dataRevocaOScadenza: "", testoRevoca: "" };
}

function richiedeLetturaScheda(before, after) {
  if (!after || !eFitofarmaco(after) || !testo(after.nome)) return false;
  if (!before || !eFitofarmaco(before)) return true;
  if (normalizzaNomeProdotto(before.nome) !== normalizzaNomeProdotto(after.nome)) return true;
  if (testo(before.numeroRegistrazione) === testo(after.numeroRegistrazione)) return false;
  return !(before.letturaSchedaStato === "in_corso" && after.letturaSchedaStato && after.letturaSchedaStato !== "in_corso");
}

function controlloMensileDovuto(iso, oraMs) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return true;
  return Number(oraMs) - t >= MESE_CONTROLLO_MS;
}

function scegliProdottoInPagina(prodotti, oraMs, attesaMs) {
  const fit = (prodotti || []).filter((p) => eFitofarmaco(p) && testo(p.nome) && p.letturaSchedaStato);
  const inCorso = fit.find((p) => p.letturaSchedaStato === "in_corso");
  if (inCorso) {
    inCorso.modoLettura = "completa";
    return inCorso;
  }
  const soglia = Number(oraMs) - Number(attesaMs);
  const daRiprovare = fit.find((p) => {
    if (p.letturaSchedaStato !== "da_riprovare") return false;
    const t = Date.parse(p.letturaSchedaAggiornataAt || "");
    return !Number.isFinite(t) || t <= soglia;
  });
  if (daRiprovare) {
    daRiprovare.modoLettura = "completa";
    return daRiprovare;
  }
  const giaLetto = fit.find((p) => {
    if (p.letturaSchedaStato !== "pronta" && p.letturaSchedaStato !== "da_verificare") return false;
    if (p.letturaSchedaMotivo === "sito_bloccato") return controlloMensileDovuto(p.controlloSchedaAt, oraMs);
    return controlloSettimanaleDovuto(p.controlloSchedaAt, oraMs);
  });
  if (!giaLetto) return null;
  const etichettaVecchia = controlloMensileDovuto(giaLetto.dataEtichettaLettaAt || giaLetto.letturaSchedaCompletaAt, oraMs);
  giaLetto.modoLettura = etichettaVecchia && giaLetto.letturaSchedaMotivo !== "revocato" ? "completa" : "leggera";
  return giaLetto;
}

module.exports = {
  FONTE,
  URL_IODL,
  ATTESA_RIPROVA_MS,
  SETTIMANA_CONTROLLO_MS,
  MESE_CONTROLLO_MS,
  dataVariazioneOpenData,
  schedaOltreSeiMesi,
  controlloSettimanaleDovuto,
  controlloMensileDovuto,
  controlloLeggeroScheda,
  estraiUrlCsv,
  dataLetturaDaNomeFile,
  parsaCsvFitosanitari,
  cercaProdotti,
  parsaTabellaImpieghi,
  filtraRigheSpecie,
  componiRispostaScheda,
  normalizzaNomeProdotto,
  eFitofarmaco,
  trovaRegistrazioneUnica,
  numeroCanonico,
  idDocumentoEtichetta,
  avvisoRevocaOScadenza,
  esitoRispostaMinistero,
  parsaElencoEtichetteMinistero,
  rigaEtichettaPerNumero,
  estraiRigheAffidabili,
  coltureIn,
  parsaTestoEtichetta,
  componiRigheScheda,
  componiArchivioProdotto,
  idRigaScheda,
  richiedeLetturaScheda,
  scegliProdottoInPagina
};
