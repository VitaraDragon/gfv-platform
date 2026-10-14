/**
 * Lettura dell'etichetta autorizzata. Gemini vede il PDF.
 * Una riga entra solo se due letture coincidono e la citazione
 * di quella coltura contiene il numero, l'unità e l'avversità.
 */
const { coltureIn } = require("./registro-trattamenti-scheda-core");

const ISTRUZIONI = [
  "Leggi solo questo PDF, l'etichetta autorizzata del Ministero della Salute.",
  "Non usare altre conoscenze sul prodotto. Non inventare numeri.",
  "Per ogni riga di coltura copia una citazione breve e letterale di quella sola riga.",
  "La citazione deve contenere la coltura, l'avversità e i numeri con la loro unità.",
  "Se in quella riga ci sono due dosi che non sai a chi attribuire, o se non è chiaro se un numero è dose a ettaro, dose a ettolitro, carenza, massimo interventi o intervallo, ometti la coltura.",
  "La dose è il minimo e il massimo scritti in etichetta, mai una dose consigliata. Il volume d'acqua non è la dose.",
  "Serra solo se quella riga dice serra e non dice pieno campo. Se i numeri di pieno campo e serra coincidono, una sola riga di pieno campo.",
  "Se la stessa riga nomina più colture con gli stessi numeri, ripeti la riga una volta per coltura.",
  "Rispondi solo con JSON: {\"righe\":[{\"coltura\":\"\",\"avversita\":\"\",\"citazione\":\"\",\"pienoCampo\":true,\"epoca\":null,\"doseMinHa\":null,\"doseMaxHa\":null,\"unitaHa\":null,\"doseMinHl\":null,\"doseMaxHl\":null,\"unitaHl\":null,\"giorniCarenza\":null,\"giorniCarenzaSerra\":null,\"impieghiMassimiAnno\":null,\"giorniMinimiTraPassaggi\":null}]}",
  "unitaHa e unitaHl sono solo kg, g, l o ml. I giorni di intervallo vanno in giorniMinimiTraPassaggi solo se la riga dice intervallo."
].join(" ");

function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function basso(value) {
  return testo(value).toLowerCase();
}

function num(value) {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formeNumero(n) {
  const s = String(n);
  return [...new Set([s, s.replace(".", ",")])];
}

function contieneNumero(citazione, n) {
  const t = basso(citazione);
  return formeNumero(n).some((forma) => t.includes(forma));
}

function vicino(citazione, n, parola) {
  const t = basso(citazione);
  const re = new RegExp(parola, "i");
  return formeNumero(n).some((forma) => {
    const i = t.indexOf(forma);
    if (i < 0) return false;
    return re.test(t.slice(Math.max(0, i - 35), i + forma.length + 45));
  });
}

function dosiNellaCitazione(citazione, per) {
  const re = new RegExp("(\\d+(?:[.,]\\d+)?)(?:\\s*[–—-]\\s*(\\d+(?:[.,]\\d+)?))?\\s*(kg|g|l|ml)\\s*/\\s*" + per, "gi");
  const out = [];
  const t = testo(citazione);
  let match = re.exec(t);
  while (match) {
    out.push({ min: num(match[1]), max: num(match[2] || match[1]), unita: match[3].toLowerCase() });
    match = re.exec(t);
  }
  return out.filter((dose) => dose.min != null && dose.max != null);
}

function coltureDelNome(nome) {
  const trovate = coltureIn(nome);
  const specifiche = trovate.filter((coltura) => !trovate.some((altra) => altra !== coltura && altra.startsWith(coltura + " ")));
  if (specifiche.length) return specifiche;
  const pulito = basso(nome);
  return pulito ? [pulito] : [];
}

function unitaValida(value) {
  const unita = basso(value);
  return unita === "kg" || unita === "g" || unita === "l" || unita === "ml" ? unita : null;
}

function doseCombacia(trovata, min, max, unita) {
  if (!trovata && min == null) return true;
  if (!trovata || min == null || !unita) return false;
  return trovata.min === min && trovata.max === max && trovata.unita === unita;
}

function accettaProposta(raw, altreColture) {
  const citazione = testo(raw && (raw.citazione || raw.citazioneRiga));
  const nome = testo(raw && (raw.coltura || raw.colturaScheda));
  const avversita = testo(raw && (raw.avversita || raw.avversità));
  if (citazione.length < 12 || citazione.length > 500) return [];
  if (avversita.length < 3 || avversita.length > 80) return [];
  if (!basso(citazione).includes(basso(avversita))) return [];
  if (!nome || !basso(citazione).includes(basso(nome))) return [];
  if (coltureIn(avversita).length) return [];
  if ((altreColture || []).some((coltura) => basso(coltura) === basso(avversita))) return [];

  const haTrovate = dosiNellaCitazione(citazione, "ha");
  const hlTrovate = dosiNellaCitazione(citazione, "hl");
  if (haTrovate.length > 1 || hlTrovate.length > 1) return [];
  if (!haTrovate.length && !hlTrovate.length) return [];
  const ha = haTrovate[0] || null;
  const hl = hlTrovate[0] || null;
  if (ha && ha.unita === "l" && ha.min >= 50 && /acqua|volume/i.test(citazione)) return [];

  const minHa = num(raw.doseMinHa);
  const maxHa = num(raw.doseMaxHa == null ? raw.doseMinHa : raw.doseMaxHa);
  const minHl = num(raw.doseMinHl);
  const maxHl = num(raw.doseMaxHl == null ? raw.doseMinHl : raw.doseMaxHl);
  if (!doseCombacia(ha, minHa, maxHa, unitaValida(raw.unitaHa))) return [];
  if (!doseCombacia(hl, minHl, maxHl, unitaValida(raw.unitaHl))) return [];

  const carenza = num(raw.giorniCarenza);
  if (carenza != null && !vicino(citazione, carenza, "giorn")) return [];
  const carenzaSerra = num(raw.giorniCarenzaSerra);
  if (carenzaSerra != null && (!/serra/i.test(citazione) || !contieneNumero(citazione, carenzaSerra))) return [];
  const massimo = num(raw.impieghiMassimiAnno);
  if (massimo != null && !vicino(citazione, massimo, "massim|trattament|applicaz")) return [];
  const intervallo = num(raw.giorniMinimiTraPassaggi);
  if (intervallo != null && !vicino(citazione, intervallo, "intervall")) return [];
  const epoca = testo(raw.epoca) || null;
  if (epoca && !basso(citazione).includes(basso(epoca))) return [];

  const diceSerra = /serra/i.test(citazione);
  const diceCampo = /pieno campo/i.test(citazione);
  let pienoCampo;
  if (raw.pienoCampo == null) {
    if (diceSerra && diceCampo) return [];
    pienoCampo = !(diceSerra && !diceCampo);
  } else {
    pienoCampo = raw.pienoCampo !== false && raw.pienoCampo !== "false";
    if (!pienoCampo && (!diceSerra || diceCampo)) return [];
    if (pienoCampo && diceSerra && !diceCampo) return [];
  }

  return coltureDelNome(nome).map((coltura) => ({
    colturaScheda: coltura,
    epoca,
    avversita,
    pienoCampo,
    giorniCarenza: carenza,
    giorniCarenzaSerra: carenzaSerra,
    doseMinHa: minHa,
    doseMaxHa: maxHa,
    doseMinHl: minHl,
    doseMaxHl: maxHl,
    unitaDose: null,
    unitaDoseHa: ha ? ha.unita : null,
    unitaDoseHl: hl ? hl.unita : null,
    impieghiMassimiAnno: massimo,
    giorniMinimiTraPassaggi: intervallo,
    affidabilita: "alta"
  }));
}

function coltureDelleProposte(lista) {
  const out = [];
  (lista || []).forEach((raw) => {
    coltureDelNome(testo(raw && (raw.coltura || raw.colturaScheda))).forEach((coltura) => {
      if (!out.includes(coltura)) out.push(coltura);
    });
  });
  return out;
}

function stessaRiga(a, b) {
  const campi = [
    "colturaScheda", "avversita", "pienoCampo", "epoca",
    "doseMinHa", "doseMaxHa", "unitaDoseHa", "doseMinHl", "doseMaxHl", "unitaDoseHl",
    "giorniCarenza", "giorniCarenzaSerra", "impieghiMassimiAnno", "giorniMinimiTraPassaggi"
  ];
  return campi.every((campo) => {
    const va = a[campo];
    const vb = b[campo];
    if (typeof va === "string" || typeof vb === "string") return basso(va) === basso(vb);
    return va === vb;
  });
}

function righeConfermate(prima, seconda) {
  if (!Array.isArray(prima) || !Array.isArray(seconda)) return [];
  const prime = prima.flatMap((raw) => accettaProposta(raw, coltureDelleProposte(prima)));
  const seconde = seconda.flatMap((raw) => accettaProposta(raw, coltureDelleProposte(seconda)));
  return prime.filter((riga) => seconde.some((altra) => stessaRiga(riga, altra)));
}

function parseJsonRighe(risposta) {
  const raw = testo(String(risposta || "").replace(/```json|```/gi, ""));
  const da = raw.indexOf("{");
  const a = raw.lastIndexOf("}");
  if (da < 0 || a <= da) return null;
  try {
    const data = JSON.parse(raw.slice(da, a + 1));
    return Array.isArray(data.righe) ? data.righe : null;
  } catch (err) {
    return null;
  }
}

function istruzioniConferma(righe) {
  const elenco = righe.map((riga) => riga.colturaScheda + " — " + riga.avversita).join("; ");
  return ISTRUZIONI + " Conferma solo queste colture, rileggendo il PDF, e ometti quelle per cui il numero non ha un ruolo chiaro: " + elenco;
}

async function leggiPagineEtichetta(pdfBuffer, chiedi) {
  if (!pdfBuffer || !pdfBuffer.length) {
    return { stato: "da_verificare", motivo: "testo_non_leggibile", righe: [] };
  }
  let prima;
  let seconda;
  try {
    prima = parseJsonRighe(await chiedi(ISTRUZIONI, pdfBuffer));
  } catch (err) {
    return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  }
  if (!prima) return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  const accettate = prima.flatMap((raw) => accettaProposta(raw, coltureDelleProposte(prima)));
  if (!accettate.length) return { stato: "da_verificare", motivo: "estrazione_incerta", righe: [] };
  try {
    seconda = parseJsonRighe(await chiedi(istruzioniConferma(accettate), pdfBuffer));
  } catch (err) {
    return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  }
  if (!seconda) return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  const righe = righeConfermate(prima, seconda);
  if (!righe.length) return { stato: "da_verificare", motivo: "estrazione_incerta", righe: [] };
  return { stato: "pronta", motivo: null, righe };
}

module.exports = {
  ISTRUZIONI,
  accettaProposta,
  righeConfermate,
  parseJsonRighe,
  leggiPagineEtichetta
};
