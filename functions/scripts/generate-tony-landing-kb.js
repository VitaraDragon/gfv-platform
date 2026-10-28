#!/usr/bin/env node
"use strict";

/**
 * Genera functions/config/tony-landing-kb.js da:
 * - core/config/subscription-plans.js (piani, moduli, prezzi)
 * - functions/tony-guida-onboarding.js (TONY_GUIDA_ONBOARDING_DAYS)
 * - functions/config/tony-landing-kb-testo.md (testo approvato da Pier)
 *
 * Uso (dalla radice del repo): node functions/scripts/generate-tony-landing-kb.js
 *
 * generaContenuto è pura: il test la chiama senza leggere i file.
 * La lettura e la scrittura girano solo se questo file è il programma principale.
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

/** Segnaposto ammessi nel testo approvato. */
const SEGNAPOSTO_AMMESSI = Object.freeze([
  "giorniGuidaFree",
  "giorniProvaModuli",
  "maxTerreniFree",
  "maxAttivitaMeseFree",
  "prezzoBaseMese",
  "prezzoBaseAnno",
  "prezzoModuliMin",
  "prezzoModuliMax"
]);

/**
 * in `subscription-plans.js` non c'è una costante: i 30 giorni stanno nel testo di `canActivateModule`.
 * Il test controlla che quel testo dica ancora 30 giorni.
 */
const GIORNI_PROVA_MODULI = 30;

/**
 * Formatta un numero all'italiana senza decimali inutili (5, 60, 1, 6; 2,5 se servono i centesimi).
 * @param {number} n
 * @returns {string}
 */
function formattaNumero(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error("Numero non valido: il file non è stato scritto.");
  }
  const arrotondato = Math.round(n * 100) / 100;
  if (Number.isInteger(arrotondato)) return String(arrotondato);
  return String(arrotondato).replace(".", ",");
}

/**
 * Controlla che un valore sia un numero strettamente positivo.
 * @param {unknown} valore
 * @param {string} nome
 * @returns {number}
 */
function numeroPositivo(valore, nome) {
  const n = typeof valore === "number" ? valore : Number(valore);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      "Manca o non è valido " + nome + ": il file non è stato scritto."
    );
  }
  return n;
}

/**
 * Elenco spezzato apposta (parole da non spargere intere nei file di Tony).
 * @returns {{ frammenti: string[], registroIntera: RegExp, trattament: string }}
 */
function costruisciBlocchiVietati() {
  return {
    frammenti: [
      "certific",
      "colleg" + "ato al SI" + "AN",
      "SI" + "AN",
      "a nor" + "ma",
      "quaderno di cam" + "pagna",
      "fattur"
    ],
    registroIntera: new RegExp("\\b" + "registro" + "\\b", "i"),
    trattament: "trattament"
  };
}

/**
 * @param {string} testo
 * @param {{ controllaTrattament?: boolean }} opts
 */
function assertNienteVietato(testo, opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const blocchi = costruisciBlocchiVietati();
  const minuscolo = String(testo || "").toLowerCase();
  for (let i = 0; i < blocchi.frammenti.length; i++) {
    if (minuscolo.indexOf(blocchi.frammenti[i].toLowerCase()) !== -1) {
      throw new Error(
        "Nel testo c'è una parola non ammessa: il file non è stato scritto."
      );
    }
  }
  if (blocchi.registroIntera.test(testo)) {
    throw new Error(
      "Nel testo c'è una parola non ammessa: il file non è stato scritto."
    );
  }
  if (o.controllaTrattament && minuscolo.indexOf(blocchi.trattament) !== -1) {
    throw new Error(
      "Nella descrizione di un modulo c'è una parola non ammessa: il file non è stato scritto."
    );
  }
  if (/\btenants\b/i.test(testo) || /\busers\b/i.test(testo)) {
    throw new Error(
      "Nel testo ci sono parole di isolamento non ammesse: il file non è stato scritto."
    );
  }
}

/**
 * @param {string} testo
 */
function assertNienteDatiVenditore(testo) {
  const t = String(testo || "");
  const vietati = [
    "Rossi",
    "Pierpaolo",
    "persona fisica",
    "partita IVA",
    "codice fiscale",
    "Stripe"
  ];
  for (let i = 0; i < vietati.length; i++) {
    if (t.indexOf(vietati[i]) !== -1) {
      throw new Error(
        "Nel testo ci sono dati di chi vende: il file non è stato scritto."
      );
    }
  }
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t)) {
    throw new Error(
      "Nel testo c'è un indirizzo email: il file non è stato scritto."
    );
  }
}

/**
 * @param {{
 *   piani: object,
 *   moduli: Array<object>,
 *   billing: object,
 *   prezzoAnnuoDaMensile: function(number): number,
 *   giorniGuidaFree: number,
 *   giorniProvaModuli: number,
 *   testo: string
 * }} args
 * @returns {string}
 */
function generaContenuto(args) {
  const a = args && typeof args === "object" ? args : {};
  const piani = a.piani && typeof a.piani === "object" ? a.piani : {};
  const moduli = Array.isArray(a.moduli) ? a.moduli : [];
  const billing = a.billing && typeof a.billing === "object" ? a.billing : {};
  const prezzoAnnuoDaMensile =
    typeof a.prezzoAnnuoDaMensile === "function" ? a.prezzoAnnuoDaMensile : null;
  let testo = typeof a.testo === "string" ? a.testo : "";

  if (!testo.trim()) {
    throw new Error("Il testo approvato è vuoto: il file non è stato scritto.");
  }
  if (testo.indexOf("[DA CONFERMARE") !== -1) {
    throw new Error(
      "Nel testo approvato c'è ancora un punto DA CONFERMARE: il file non è stato scritto."
    );
  }

  const free = piani.free && typeof piani.free === "object" ? piani.free : {};
  const base = piani.base && typeof piani.base === "object" ? piani.base : {};

  const maxTerreniFree = numeroPositivo(free.maxTerreni, "maxTerreniFree");
  const maxAttivitaMeseFree = numeroPositivo(
    free.maxAttivitaMese,
    "maxAttivitaMeseFree"
  );
  const prezzoBaseMese = numeroPositivo(base.price, "prezzoBaseMese");
  const giorniGuidaFree = numeroPositivo(a.giorniGuidaFree, "giorniGuidaFree");
  const giorniProvaModuli = numeroPositivo(
    a.giorniProvaModuli,
    "giorniProvaModuli"
  );

  if (!prezzoAnnuoDaMensile) {
    throw new Error("Manca prezzoAnnuoDaMensile: il file non è stato scritto.");
  }
  if (billing.chargeInterval !== "year") {
    throw new Error(
      "L'addebito non è annuale (chargeInterval): il file non è stato scritto."
    );
  }
  const prezzoBaseAnno = numeroPositivo(
    prezzoAnnuoDaMensile(prezzoBaseMese),
    "prezzoBaseAnno"
  );

  const nomePerId = Object.create(null);
  for (let i = 0; i < moduli.length; i++) {
    const m = moduli[i];
    if (m && typeof m.id === "string" && typeof m.name === "string") {
      nomePerId[m.id] = m.name;
    }
  }

  const disponibili = [];
  for (let i = 0; i < moduli.length; i++) {
    const m = moduli[i];
    if (!m || m.available !== true) continue;
    const prezzo = m.price;
    if (typeof prezzo !== "number" || !Number.isFinite(prezzo) || prezzo <= 0) {
      throw new Error(
        "Modulo disponibile senza prezzo valido (" +
          (m.id || "?") +
          "): il file non è stato scritto."
      );
    }
    const descrizione =
      typeof m.description === "string" ? m.description : "";
    assertNienteVietato(descrizione, { controllaTrattament: true });
    const richiedeIds = Array.isArray(m.requiresModules) ? m.requiresModules : [];
    const richiede = [];
    for (let j = 0; j < richiedeIds.length; j++) {
      const idReq = richiedeIds[j];
      const nome = nomePerId[idReq];
      if (!nome) {
        throw new Error(
          "Dipendenza modulo sconosciuta (" +
            idReq +
            "): il file non è stato scritto."
        );
      }
      richiede.push(nome);
    }
    disponibili.push({
      id: m.id,
      nome: m.name,
      descrizione: descrizione,
      richiede: richiede,
      price: prezzo
    });
  }

  if (disponibili.length === 0) {
    throw new Error(
      "Nessun modulo disponibile: il file non è stato scritto."
    );
  }

  const prezzi = disponibili.map(function (m) {
    return m.price;
  });
  const prezzoModuliMin = Math.min.apply(null, prezzi);
  const prezzoModuliMax = Math.max.apply(null, prezzi);

  const valori = {
    giorniGuidaFree: giorniGuidaFree,
    giorniProvaModuli: giorniProvaModuli,
    maxTerreniFree: maxTerreniFree,
    maxAttivitaMeseFree: maxAttivitaMeseFree,
    prezzoBaseMese: prezzoBaseMese,
    prezzoBaseAnno: prezzoBaseAnno,
    prezzoModuliMin: prezzoModuliMin,
    prezzoModuliMax: prezzoModuliMax
  };

  const trovati = testo.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
  for (let i = 0; i < trovati.length; i++) {
    const dentro = trovati[i].replace(/\{\{\s*|\s*\}\}/g, "");
    if (SEGNAPOSTO_AMMESSI.indexOf(dentro) === -1) {
      throw new Error(
        "Segnaposto sconosciuto {{" +
          dentro +
          "}}: il file non è stato scritto."
      );
    }
  }

  let testoFinale = testo;
  for (let i = 0; i < SEGNAPOSTO_AMMESSI.length; i++) {
    const chiave = SEGNAPOSTO_AMMESSI[i];
    const re = new RegExp("\\{\\{\\s*" + chiave + "\\s*\\}\\}", "g");
    testoFinale = testoFinale.replace(re, formattaNumero(valori[chiave]));
  }
  if (/\{\{/.test(testoFinale)) {
    throw new Error(
      "Restano segnaposto non sostituiti: il file non è stato scritto."
    );
  }

  assertNienteDatiVenditore(testoFinale);
  assertNienteVietato(testoFinale, { controllaTrattament: true });

  const moduliKb = disponibili.map(function (m) {
    return {
      id: m.id,
      nome: m.nome,
      descrizione: m.descrizione,
      richiede: m.richiede.slice()
    };
  });

  const elencoRighe = moduliKb.map(function (m) {
    const baseRiga = "- " + m.nome + ": " + m.descrizione;
    if (m.richiede.length === 0) return baseRiga;
    return baseRiga + " (richiede: " + m.richiede.join(", ") + ")";
  });
  const elencoModuli = elencoRighe.join("\n");
  assertNienteVietato(elencoModuli, { controllaTrattament: true });
  assertNienteDatiVenditore(elencoModuli);

  const datiKb = {
    maxTerreniFree: maxTerreniFree,
    maxAttivitaMeseFree: maxAttivitaMeseFree,
    prezzoBaseMese: prezzoBaseMese,
    prezzoBaseAnno: prezzoBaseAnno,
    prezzoModuliMin: prezzoModuliMin,
    prezzoModuliMax: prezzoModuliMax,
    giorniGuidaFree: giorniGuidaFree,
    giorniProvaModuli: giorniProvaModuli
  };

  const righeModuli = moduliKb.map(function (m) {
    return (
      "  Object.freeze({ id: " +
      JSON.stringify(m.id) +
      ", nome: " +
      JSON.stringify(m.nome) +
      ", descrizione: " +
      JSON.stringify(m.descrizione) +
      ", richiede: Object.freeze(" +
      JSON.stringify(m.richiede) +
      ") }),"
    );
  });

  const linee = [
    '"use strict";',
    "// FILE GENERATO da functions/scripts/generate-tony-landing-kb.js: NON modificarlo a mano.",
    "// Fonti: core/config/subscription-plans.js, functions/tony-guida-onboarding.js (TONY_GUIDA_ONBOARDING_DAYS),",
    "// functions/config/tony-landing-kb-testo.md (testo approvato da Pier).",
    "// Per rigenerarlo, dalla radice del repo: node functions/scripts/generate-tony-landing-kb.js",
    "const DATI_KB = Object.freeze(" + JSON.stringify(datiKb) + ");",
    "const MODULI_KB = Object.freeze([",
    ...righeModuli,
    "]);",
    "const TESTO_KB = " + JSON.stringify(testoFinale) + ";",
    "const ELENCO_MODULI_KB = " + JSON.stringify(elencoModuli) + ";",
    "module.exports = { DATI_KB, MODULI_KB, TESTO_KB, ELENCO_MODULI_KB };",
    ""
  ];
  return linee.join("\n");
}

async function main() {
  const radice = path.join(__dirname, "..", "..");
  const sorgentePiani = path.join(radice, "core", "config", "subscription-plans.js");
  const percorsoTesto = path.join(
    __dirname,
    "..",
    "config",
    "tony-landing-kb-testo.md"
  );
  const destinazione = path.join(__dirname, "..", "config", "tony-landing-kb.js");

  const modulo = await import(pathToFileURL(sorgentePiani).href);
  const { TONY_GUIDA_ONBOARDING_DAYS } = require("../tony-guida-onboarding");
  let testo = fs.readFileSync(percorsoTesto, "utf8");
  testo = testo.replace(/\r\n/g, "\n");

  const contenuto = generaContenuto({
    piani: modulo.SUBSCRIPTION_PLANS,
    moduli: modulo.AVAILABLE_MODULES,
    billing: modulo.BILLING,
    prezzoAnnuoDaMensile: modulo.monthlyToAnnual,
    giorniGuidaFree: TONY_GUIDA_ONBOARDING_DAYS,
    giorniProvaModuli: GIORNI_PROVA_MODULI,
    testo: testo
  });

  fs.mkdirSync(path.dirname(destinazione), { recursive: true });
  fs.writeFileSync(destinazione, contenuto, "utf8");

  const kb = require(destinazione);
  console.log("Scritto " + destinazione);
  console.log("Moduli disponibili: " + kb.MODULI_KB.length);
  console.log(
    "Base: " +
      kb.DATI_KB.prezzoBaseMese +
      " €/mese, " +
      kb.DATI_KB.prezzoBaseAnno +
      " €/anno"
  );
  console.log(
    "Range moduli: da " +
      kb.DATI_KB.prezzoModuliMin +
      " € a " +
      kb.DATI_KB.prezzoModuliMax +
      " € al mese"
  );
  console.log("Giorni guida free: " + kb.DATI_KB.giorniGuidaFree);
  console.log("Caratteri TESTO_KB: " + kb.TESTO_KB.length);
}

if (require.main === module) {
  main().catch(function (err) {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  generaContenuto,
  GIORNI_PROVA_MODULI,
  SEGNAPOSTO_AMMESSI,
  formattaNumero
};
