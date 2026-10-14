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

function carenzaCella(value) {
  const t = testo(value);
  if (!t || t === "-" || t === "—" || /non\s+richiest/i.test(t)) return null;
  return numero(t);
}

function nomeColturaCella(value) {
  return testo(value).replace(/^(coltura|impiego)\s*-\s*/i, "");
}

function parsaPaginaImpieghiSian(html) {
  const testoHtml = String(html || "");
  const pagine = Array.from(testoHtml.matchAll(/name="butPagina"[^>]*value="\s*(\d+)\s*"/gi))
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
  const righe = Array.from(testoHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((m) => celleHtml(m[0]));
  const colture = [];
  righe.forEach((cells) => {
    if (cells.length < 3) return;
    if (/impiego/i.test(cells[0]) && /coltura/i.test(cells[0])) return;
    const colturaScheda = nomeColturaCella(cells[0]);
    if (!colturaScheda || /impiego/i.test(colturaScheda)) return;
    colture.push({
      colturaScheda,
      giorniCarenza: carenzaCella(cells[1]),
      giorniCarenzaSerra: carenzaCella(cells[2])
    });
  });
  return { colture, pagine: Array.from(new Set(pagine)) };
}

function parsaElencoAvversita(html) {
  const testoHtml = String(html || "");
  if (/Impiego\s*-\s*Coltura/i.test(testoHtml)) return [];
  const righe = Array.from(testoHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((m) => celleHtml(m[0]));
  const nomi = [];
  righe.forEach((cells) => {
    const cella = testo(cells[0]);
    if (!cella || /classe\s+avvers/i.test(cella)) return;
    const i = cella.indexOf("-");
    if (i <= 0) return;
    const nome = testo(cella.slice(i + 1));
    if (nome) nomi.push(nome);
  });
  return nomi;
}

function coltureDaPagineImpieghi(pagine) {
  const viste = new Set();
  const out = [];
  (pagine || []).forEach((html) => {
    parsaPaginaImpieghiSian(html).colture.forEach((c) => {
      const k = normalizzaNomeProdotto(c.colturaScheda);
      if (!k || viste.has(k)) return;
      viste.add(k);
      out.push(c);
    });
  });
  return out;
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
    motivo: trovata.esito === "unica" ? "impieghi_non_letti" : (trovata.esito || "scheda_non_letta"),
    fonte: FONTE,
    dataLettura,
    numeroRegistrazione: null,
    principioAttivo: null,
    righe: []
  };
  if (trovata.esito !== "unica") return vuoto;
  const colture = coltureDaPagineImpieghi(input.pagineImpieghi || []);
  const testoEtichetta = input.testoEtichetta || "";
  const finestre = parsaTestoEtichetta(testoEtichetta);
  const righe = componiRigheScheda(colture, testoEtichetta, finestre, input.avversitaPerColtura);
  const anag = {
    fonte: FONTE,
    dataLettura,
    numeroRegistrazione: trovata.prodotto.numeroRegistrazione || null,
    principioAttivo: trovata.prodotto.principioAttivo || null,
    statoAmministrativoScheda: testo(trovata.prodotto.stato),
    dataVariazioneScheda: dataVariazioneOpenData(trovata.prodotto)
  };
  if (!righe.length) return { ...vuoto, ...anag, stato: "da_riprovare", motivo: "impieghi_non_letti", righe: [] };
  if (righe.some((riga) => !testo(riga.avversita))) {
    return { ...vuoto, ...anag, stato: "da_riprovare", motivo: "avversita_non_lette", righe: [] };
  }
  return { ...anag, stato: "pronta", motivo: null, righe };
}

function richiedeLetturaScheda(before, after) {
  if (!after || !eFitofarmaco(after) || !testo(after.nome)) return false;
  if (!before || !eFitofarmaco(before)) return true;
  return normalizzaNomeProdotto(before.nome) !== normalizzaNomeProdotto(after.nome);
}

function scegliProdottoInPagina(prodotti, oraMs, attesaMs) {
  const fit = (prodotti || []).filter((p) => eFitofarmaco(p) && testo(p.nome));
  const inCorso = fit.find((p) => p.letturaSchedaStato === "in_corso");
  if (inCorso) return inCorso;
  const senza = fit.find((p) => !p.letturaSchedaStato);
  if (senza) return senza;
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
  const pronta = fit.find((p) => {
    if (p.letturaSchedaStato !== "pronta") return false;
    return schedaOltreSeiMesi(p.letturaSchedaCompletaAt, oraMs) || controlloSettimanaleDovuto(p.controlloSchedaAt, oraMs);
  });
  if (!pronta) return null;
  pronta.modoLettura = schedaOltreSeiMesi(pronta.letturaSchedaCompletaAt, oraMs) ? "completa" : "leggera";
  return pronta;
}

module.exports = {
  FONTE,
  ATTESA_RIPROVA_MS,
  SETTIMANA_CONTROLLO_MS,
  dataVariazioneOpenData,
  schedaOltreSeiMesi,
  controlloSettimanaleDovuto,
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
  parsaPaginaImpieghiSian,
  parsaElencoAvversita,
  coltureDaPagineImpieghi,
  parsaTestoEtichetta,
  componiRigheScheda,
  componiArchivioProdotto,
  idRigaScheda,
  richiedeLetturaScheda,
  scegliProdottoInPagina
};
