"use strict";

/**
 * Logica pura degli avvisi di spesa di Tony sulla landing (passo 15).
 * Niente Firebase, niente rete.
 */

const { chiaviTempo, normalizzaConfig } = require("./tony-landing-limiti");

const DESTINATARIO_AVVISI = "info@globalfarmview.net";
const SOGLIE_AVVISO = Object.freeze([50, 80, 100]);
const ARGOMENTO_BUDGET = "tony-landing-budget";
const SPENTO_DA = Object.freeze({
  tetto: "tetto-mensile",
  budget: "budget-google"
});
const FREQUENZA_CONTROLLO = "every 15 minutes";
/** Prenotazione `in-invio` più vecchia di così torna riprovabile. */
const PRENOTAZIONE_MAX_MS = 30 * 60 * 1000;

const LINK_CONSOLE_TONY_LANDING =
  "https://console.firebase.google.com/project/gfv-platform/firestore/databases/-default-/data/~2Fconfig~2FtonyLanding";

const CHIAVI_AVVISO = Object.freeze([
  "p50",
  "p80",
  "p100",
  "e80",
  "e95",
  "budgetGoogle"
]);

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ spesaMeseEur: number, budgetEur: number }} args
 * @returns {number|null}
 */
function percentualeSpesa({ spesaMeseEur, budgetEur }) {
  const budget = Number(budgetEur);
  const spesa = Number(spesaMeseEur);
  if (!Number.isFinite(budget) || budget <= 0) return null;
  if (!Number.isFinite(spesa) || spesa < 0) return 0;
  return (spesa / budget) * 100;
}

/**
 * Millisecondi da un campo `il` (Timestamp Firestore, Date, numero o stringa).
 * @param {unknown} il
 * @returns {number|null}
 */
function msDaIl(il) {
  if (il == null) return null;
  if (typeof il.toDate === "function") {
    try {
      return il.toDate().getTime();
    } catch {
      return null;
    }
  }
  if (il instanceof Date) {
    const t = il.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof il === "number" && Number.isFinite(il)) return il;
  if (typeof il === "string" && il) {
    const t = Date.parse(il);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Una soglia/prenotazione conta come «già avvisata» se è inviata (o vecchio stile)
 * oppure in-invio da meno di 30 minuti.
 * @param {unknown} valore
 * @param {Date} adesso
 * @returns {boolean}
 */
function avvisoAncoraValido(valore, adesso) {
  if (!valore) return false;
  const now = adesso instanceof Date ? adesso.getTime() : Date.now();
  if (valore && typeof valore === "object" && typeof valore.stato === "string") {
    if (valore.stato === "inviata") return true;
    if (valore.stato === "in-invio") {
      const t = msDaIl(valore.il);
      // Senza ora leggibile non blocchiamo il mese: si riprova.
      if (t == null) return false;
      return now - t < PRENOTAZIONE_MAX_MS;
    }
    return false;
  }
  // Compatibilità passo 15: Timestamp, true, o altro valore truthy senza `stato`.
  return true;
}

/**
 * Filtra gli avvisi del mese: lascia solo le soglie ancora «occupate».
 * @param {object|null|undefined} avvisi
 * @param {Date} adesso
 * @returns {Record<string, true>}
 */
function avvisiValidi(avvisi, adesso) {
  const raw = avvisi && typeof avvisi === "object" ? avvisi : {};
  const out = {};
  const quando = adesso instanceof Date ? adesso : new Date();
  for (let i = 0; i < CHIAVI_AVVISO.length; i += 1) {
    const k = CHIAVI_AVVISO[i];
    if (avvisoAncoraValido(raw[k], quando)) out[k] = true;
  }
  return out;
}

/**
 * Mese (AAAA-MM, Europe/Rome) del budget Google: da costIntervalStart se valido, altrimenti adesso.
 * @param {unknown} dati
 * @param {Date} adesso
 * @returns {string}
 */
function meseBudget(dati, adesso) {
  const a = adesso instanceof Date ? adesso : new Date();
  const raw =
    dati && typeof dati === "object" ? dati.costIntervalStart : null;
  if (raw != null && raw !== "") {
    const d = new Date(/** @type {string|number|Date} */ (raw));
    if (!Number.isNaN(d.getTime())) return chiaviTempo(d).mese;
  }
  return chiaviTempo(a).mese;
}

/**
 * Data di riferimento per il mese del budget (stessa regola di meseBudget).
 * @param {unknown} dati
 * @param {Date} adesso
 * @returns {Date}
 */
function dataMeseBudget(dati, adesso) {
  const a = adesso instanceof Date ? adesso : new Date();
  const raw =
    dati && typeof dati === "object" ? dati.costIntervalStart : null;
  if (raw != null && raw !== "") {
    const d = new Date(/** @type {string|number|Date} */ (raw));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return a;
}

/**
 * @param {{ percentuale: number|null, giaInviate: object|null|undefined }} args
 * @returns {{ soglia: number, daSegnare: number[] }|null}
 */
function sogliaDaAvvisare({ percentuale, giaInviate }) {
  if (percentuale == null || !Number.isFinite(percentuale)) return null;
  const gia = giaInviate && typeof giaInviate === "object" ? giaInviate : {};
  let scelta = null;
  for (let i = 0; i < SOGLIE_AVVISO.length; i += 1) {
    const s = SOGLIE_AVVISO[i];
    if (percentuale + 1e-9 >= s && !gia["p" + s]) {
      scelta = s;
    }
  }
  if (scelta == null) return null;
  const daSegnare = [];
  for (let i = 0; i < SOGLIE_AVVISO.length; i += 1) {
    const s = SOGLIE_AVVISO[i];
    if (s <= scelta && !gia["p" + s]) daSegnare.push(s);
  }
  return { soglia: scelta, daSegnare };
}

/**
 * @param {unknown} dati
 * @returns {{ superato: boolean, percentuale?: number, valuta?: string, motivo?: string }}
 */
function decisioneBudgetGoogle(dati) {
  if (!dati || typeof dati !== "object") {
    return { superato: false, motivo: "messaggio-non-valido" };
  }
  const costAmount = Number(dati.costAmount);
  const budgetAmount = Number(dati.budgetAmount);
  if (
    !Number.isFinite(costAmount) ||
    !Number.isFinite(budgetAmount) ||
    costAmount < 0 ||
    budgetAmount <= 0
  ) {
    return { superato: false, motivo: "messaggio-non-valido" };
  }
  const valuta =
    typeof dati.currencyCode === "string" && dati.currencyCode
      ? String(dati.currencyCode)
      : "EUR";
  const percentuale = (costAmount / budgetAmount) * 100;
  if (costAmount >= budgetAmount) {
    return { superato: true, percentuale, valuta };
  }
  return { superato: false, percentuale, valuta };
}

function formatEuroIt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0,00 €";
  return (
    x.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " €"
  );
}

function formatImportoValuta(n, valuta) {
  const x = Number(n);
  const v = valuta || "EUR";
  if (!Number.isFinite(x)) return "0 " + v;
  return (
    x.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) +
    " " +
    v
  );
}

/**
 * @param {Date|string|number} data
 * @returns {string}
 */
function meseInParole(data) {
  const d = data instanceof Date ? data : new Date(data);
  try {
    const parti = new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Rome"
    }).formatToParts(d);
    const mese = (parti.find((p) => p.type === "month") || {}).value || "";
    const anno = (parti.find((p) => p.type === "year") || {}).value || "";
    return (mese + " " + anno).trim();
  } catch {
    return String(chiaviTempo(d).mese);
  }
}

function involucroHtml(corpoHtml) {
  return (
    "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"></head><body style=\"font-family:Segoe UI,Tahoma,sans-serif;font-size:15px;line-height:1.45;color:#222;\">" +
    "<p>Ciao,</p>" +
    corpoHtml +
    "<p>GFV Platform — avviso automatico</p>" +
    "</body></html>"
  );
}

/**
 * @param {{
 *   soglia: number,
 *   spesaMeseEur: number,
 *   budgetEur: number,
 *   domandeMese: number,
 *   mese: string|Date,
 *   spentoAdesso?: boolean,
 *   voceEleven?: {
 *     usati?: number,
 *     limite?: number,
 *     landing?: number,
 *     rimanenti?: number,
 *     resetLabel?: string,
 *     nonLeggibile?: boolean
 *   }|null
 * }} args
 */
function testoEmailSpesa({
  soglia,
  spesaMeseEur,
  budgetEur,
  domandeMese,
  mese,
  spentoAdesso,
  voceEleven
}) {
  const spesa = formatEuroIt(spesaMeseEur);
  const tetto = formatEuroIt(budgetEur);
  const domande = Number.isFinite(Number(domandeMese))
    ? String(Math.floor(Number(domandeMese)))
    : "0";
  const meseLabel =
    typeof mese === "string" && /[a-zA-Zàèéìòù]/.test(mese)
      ? mese
      : meseInParole(mese || new Date());
  const spesaE = escapeHtml(spesa);
  const tettoE = escapeHtml(tetto);
  const domandeE = escapeHtml(domande);
  const meseE = escapeHtml(meseLabel);
  const link = escapeHtml(LINK_CONSOLE_TONY_LANDING);

  const rigaGemini =
    "Gemini (landing): " +
    spesa +
    " a " +
    meseLabel +
    " su un tetto di " +
    tetto +
    " (" +
    domande +
    " domande), prezzi di listino.";
  const rigaGeminiE =
    "Gemini (landing): " +
    spesaE +
    " a " +
    meseE +
    " su un tetto di " +
    tettoE +
    " (" +
    domandeE +
    " domande), prezzi di listino.";

  let rigaVoce = "";
  let rigaVoceE = "";
  const v = voceEleven && typeof voceEleven === "object" ? voceEleven : null;
  if (v && v.nonLeggibile === true) {
    rigaVoce = "Voce ElevenLabs: margine ElevenLabs non leggibile.";
    rigaVoceE = escapeHtml(rigaVoce);
  } else if (v && typeof v.limite === "number" && v.limite > 0) {
    const usati = Number(v.usati) || 0;
    const landing = Number(v.landing) || 0;
    const rimanenti =
      typeof v.rimanenti === "number"
        ? v.rimanenti
        : Math.max(0, v.limite - usati);
    const reset =
      typeof v.resetLabel === "string" && v.resetLabel
        ? v.resetLabel
        : "alla prossima ricarica";
    rigaVoce =
      "Voce ElevenLabs: usati " +
      usati.toLocaleString("it-IT") +
      " caratteri su " +
      v.limite.toLocaleString("it-IT") +
      " dell'abbonamento (tutto il piano, anche app e spot), la landing ne ha usati " +
      landing.toLocaleString("it-IT") +
      ". Restano " +
      rimanenti.toLocaleString("it-IT") +
      ", rinnovo " +
      reset +
      ".";
    rigaVoceE = escapeHtml(rigaVoce);
  }

  let oggetto = "";
  let frase = "";
  let testo = "";
  let nonDeviFareNiente = false;

  if (soglia === 50) {
    oggetto = "[GFV] Tony landing: Gemini al 50% del tetto del mese";
    nonDeviFareNiente = true;
    frase =
      rigaGeminiE +
      (rigaVoceE ? " " + rigaVoceE : "") +
      " Non devi fare niente: è solo un avviso.";
    testo =
      rigaGemini +
      (rigaVoce ? " " + rigaVoce : "") +
      " Non devi fare niente: è solo un avviso.";
  } else if (soglia === 80) {
    oggetto = "[GFV] Tony landing: Gemini all'80% del tetto del mese";
    frase =
      rigaGeminiE +
      (rigaVoceE ? " " + rigaVoceE : "") +
      " Al 100% Tony sulla landing si ferma (solo testo Gemini). La voce dipende dai crediti ElevenLabs, non da questo tetto.";
    testo =
      rigaGemini +
      (rigaVoce ? " " + rigaVoce : "") +
      " Al 100% Tony sulla landing si ferma (solo testo Gemini). La voce dipende dai crediti ElevenLabs, non da questo tetto.";
  } else {
    oggetto =
      "[GFV] Tony della landing è spento: tetto Gemini del mese raggiunto";
    if (spentoAdesso === false) {
      frase =
        rigaGeminiE +
        " Tony sulla landing era già spento. Il Tony dell'app funziona normalmente. Per riaccenderlo: console di Firebase → Firestore → config → tonyLanding → enabled = true. " +
        "<a href=\"" +
        link +
        "\">Apri la console</a>.";
      testo =
        rigaGemini +
        " Tony sulla landing era già spento. Il Tony dell'app funziona normalmente. Per riaccenderlo: console di Firebase → Firestore → config → tonyLanding → enabled = true. " +
        LINK_CONSOLE_TONY_LANDING;
    } else {
      frase =
        rigaGeminiE +
        " Tony sulla landing è fermo: i visitatori vedono \"Tony è nei campi. Intanto prova GFV!\". Il Tony dell'app funziona normalmente. Per riaccenderlo: console di Firebase → Firestore → config → tonyLanding → enabled = true. " +
        "<a href=\"" +
        link +
        "\">Apri la console</a>.";
      testo =
        rigaGemini +
        " Tony sulla landing è fermo: i visitatori vedono \"Tony è nei campi. Intanto prova GFV!\". Il Tony dell'app funziona normalmente. Per riaccenderlo: console di Firebase → Firestore → config → tonyLanding → enabled = true. " +
        LINK_CONSOLE_TONY_LANDING;
    }
  }

  void nonDeviFareNiente;

  return {
    oggetto,
    html: involucroHtml("<p>" + frase + "</p>"),
    testo: "Ciao,\n\n" + testo + "\n\nGFV Platform — avviso automatico"
  };
}

/**
 * Email soglia crediti ElevenLabs (80% / 95% dell'abbonamento intero).
 * @param {{
 *   soglia: number,
 *   usati: number,
 *   limite: number,
 *   landing: number,
 *   rimanenti: number,
 *   resetLabel?: string
 * }} args
 */
function testoEmailVoceEleven({
  soglia,
  usati,
  limite,
  landing,
  rimanenti,
  resetLabel
}) {
  const reset =
    typeof resetLabel === "string" && resetLabel
      ? resetLabel
      : "alla prossima ricarica";
  const oggetto =
    "[GFV] Crediti voce ElevenLabs al " + soglia + "% dell'abbonamento";
  const corpo =
    "Voce ElevenLabs: usati " +
    Number(usati || 0).toLocaleString("it-IT") +
    " caratteri su " +
    Number(limite || 0).toLocaleString("it-IT") +
    " dell'abbonamento (tutto il piano, anche app e spot), la landing ne ha usati " +
    Number(landing || 0).toLocaleString("it-IT") +
    ". Restano " +
    Number(rimanenti || 0).toLocaleString("it-IT") +
    ", rinnovo " +
    reset +
    "." +
    (soglia >= 95
      ? " Vicino alla riserva: la landing può spegnere la voce da sola e lasciare solo il testo."
      : " Non devi fare niente: è solo un avviso.");
  return {
    oggetto,
    html: involucroHtml("<p>" + escapeHtml(corpo) + "</p>"),
    testo: "Ciao,\n\n" + corpo + "\n\nGFV Platform — avviso automatico"
  };
}

/**
 * Importo per l'email del budget: EUR → «52,00 €»; altra valuta → «52,00 USD» (niente parentesi).
 * @param {number} n
 * @param {string} valuta
 */
function formatImportoBudget(n, valuta) {
  const grezza = String(valuta || "EUR");
  if (grezza.toUpperCase() === "EUR") return formatEuroIt(n);
  return formatImportoValuta(n, grezza);
}

/**
 * BOZZA: da far rivedere
 * @param {{ costo: number, budget: number, valuta: string, mese: string|Date, eraGiaSpento?: boolean }} args
 */
function testoEmailBudget({ costo, budget, valuta, mese, eraGiaSpento }) {
  const costoF = formatImportoBudget(costo, valuta);
  const budgetF = formatImportoBudget(budget, valuta);
  const meseLabel =
    typeof mese === "string" && /[a-zA-Zàèéìòù]/.test(mese)
      ? mese
      : meseInParole(mese || new Date());
  void meseLabel;
  const oggetto =
    "[GFV] Budget Google Cloud superato: Tony della landing è spento";
  const spegnimento = eraGiaSpento
    ? "Tony sulla landing era già spento: resta spento."
    : "Per sicurezza Tony sulla landing è stato spento.";
  const frase =
    "Il budget Google Cloud del progetto ha raggiunto " +
    escapeHtml(costoF) +
    " su " +
    escapeHtml(budgetF) +
    ". " +
    escapeHtml(spegnimento) +
    " Il Tony dell'app non è stato toccato. Controlla la spesa in Google Cloud → Fatturazione prima di riaccenderlo (Firestore → config → tonyLanding → enabled = true). " +
    "<a href=\"" +
    escapeHtml(LINK_CONSOLE_TONY_LANDING) +
    "\">Apri la console</a>.";
  const testo =
    "Il budget Google Cloud del progetto ha raggiunto " +
    costoF +
    " su " +
    budgetF +
    ". " +
    spegnimento +
    " Il Tony dell'app non è stato toccato. Controlla la spesa in Google Cloud → Fatturazione prima di riaccenderlo (Firestore → config → tonyLanding → enabled = true). " +
    LINK_CONSOLE_TONY_LANDING;
  return {
    oggetto,
    html: involucroHtml("<p>" + frase + "</p>"),
    testo: "Ciao,\n\n" + testo + "\n\nGFV Platform — avviso automatico"
  };
}

module.exports = {
  DESTINATARIO_AVVISI,
  SOGLIE_AVVISO,
  ARGOMENTO_BUDGET,
  SPENTO_DA,
  FREQUENZA_CONTROLLO,
  PRENOTAZIONE_MAX_MS,
  LINK_CONSOLE_TONY_LANDING,
  escapeHtml,
  percentualeSpesa,
  sogliaDaAvvisare,
  avvisiValidi,
  meseBudget,
  dataMeseBudget,
  decisioneBudgetGoogle,
  testoEmailSpesa,
  testoEmailVoceEleven,
  testoEmailBudget,
  meseInParole,
  formatEuroIt,
  chiaviTempo,
  normalizzaConfig
};
