"use strict";

/**
 * Fase «account» di tonyLandingAsk (passo 14): prompt e pulizia JSON.
 * Modulo puro: nessuna rete, nessun database.
 */

const {
  REGOLE_TONY_LANDING,
  costruisciPromptSistema
} = require("./tony-landing-prompt");
const { TESTO_KB, ELENCO_MODULI_KB } = require("../config/tony-landing-kb");
const { COLTURE_PREDEFINITE } = require("../config/colture-predefinite");
const { LIMITI } = require("./tony-landing-setup-core");

const PREFISSI_ESCLUSI = Object.freeze([
  "Dati personali.",
  "Cosa puoi fare qui.",
  "Come rispondi."
]);

const TESTO_RIPIEGO =
  "Non ho capito bene. Riprova con via e comune, oppure un podere, oppure un terreno con nome, ettari e coltura.";

const SCHEMA_RISPOSTA_ACCOUNT = Object.freeze({
  type: "OBJECT",
  properties: Object.freeze({
    testo: Object.freeze({ type: "STRING" }),
    sede: Object.freeze({
      type: "OBJECT",
      nullable: true,
      properties: Object.freeze({
        indirizzo: Object.freeze({ type: "STRING" }),
        citta: Object.freeze({ type: "STRING" }),
        cap: Object.freeze({ type: "STRING" }),
        provincia: Object.freeze({ type: "STRING" })
      })
    }),
    poderi: Object.freeze({
      type: "ARRAY",
      items: Object.freeze({
        type: "OBJECT",
        properties: Object.freeze({
          nome: Object.freeze({ type: "STRING" })
        })
      })
    }),
    terreni: Object.freeze({
      type: "ARRAY",
      items: Object.freeze({
        type: "OBJECT",
        properties: Object.freeze({
          nome: Object.freeze({ type: "STRING" }),
          superficie: Object.freeze({ type: "NUMBER" }),
          coltura: Object.freeze({ type: "STRING", nullable: true }),
          podere: Object.freeze({ type: "STRING", nullable: true })
        })
      })
    }),
    fatto: Object.freeze({ type: "BOOLEAN" })
  }),
  required: Object.freeze(["testo", "fatto"])
});

function regoleTenute() {
  return REGOLE_TONY_LANDING.filter(function (r) {
    const s = String(r || "");
    for (let i = 0; i < PREFISSI_ESCLUSI.length; i++) {
      if (s.indexOf(PREFISSI_ESCLUSI[i]) === 0) return false;
    }
    return true;
  }).map(function (r) {
    // Niente nomi di persona nel prompt della fase account.
    return String(r)
      .replace(/\s+o Pier(?=,|\s|\)|$)/g, "")
      .replace(/Pierpaolo\s+Rossi/g, "chi offre GFV");
  });
}

function elencoNomiColture() {
  const nomi = [];
  for (let i = 0; i < COLTURE_PREDEFINITE.length; i++) {
    const c = COLTURE_PREDEFINITE[i];
    if (c && typeof c.nome === "string" && c.nome) nomi.push(c.nome);
  }
  return nomi.join(", ");
}

/**
 * @param {string} argomento
 * @returns {string}
 */
function promptSistemaAccount(argomento) {
  const arg = String(argomento || "");
  const regoleAiuto = [
    "Aiuto all'account. Aiuti solo a dire sede legale (via, comune, CAP, provincia), poderi (nomi) e terreni (nome, superficie in ha, coltura). L'argomento di adesso è «" +
      arg +
      "».",
    "Mai dati fiscali (Partita IVA, codice fiscale), mai mezzi, operai o il numero di operai, mai dati di altre persone; se li danno, non usarli e ripeti la domanda.",
    "Non dire mai il nome di chi offre GFV né di altre persone.",
    "Superficie: numero in ettari con il punto decimale («2,34 ha» → 2.34); se dicono metri quadri o altre unità, chiedi in ettari.",
    "Coltura: solo un nome dell'elenco colture di GFV (lo trovi sotto); «mele» → «Melo», «uva da vino» → «Vite da Vino», «olive» → «Olivo», «grano duro» → «Grano»; «seminativo», «frutteto», «orto» sono categorie: chiedi «Che cosa ci coltivi? Grano, mais, orzo…» oppure lascia null.",
    "Al massimo 5 terreni; se ne dicono di più: «Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.»",
    "Non dire mai di aver salvato o registrato; alla fine dire «Ecco il riepilogo: controlla e conferma».",
    "Rispondi solo con il JSON dello schema; frasi brevi in testo."
  ];
  const regole = regoleTenute().concat(regoleAiuto);
  const kb =
    String(TESTO_KB || "") +
    "\n\nELENCO COLTURE AMMESSE:\n" +
    elencoNomiColture();
  return costruisciPromptSistema({
    regole: regole,
    testoKb: kb,
    elencoModuli: ELENCO_MODULI_KB
  });
}

function taglia(testo, max) {
  const s = String(testo || "").trim();
  if (!s) return "";
  if ([...s].length <= max) return s;
  return [...s].slice(0, max).join("");
}

function pulisciSede(sede) {
  if (!sede || typeof sede !== "object" || Array.isArray(sede)) return null;
  const indirizzo = taglia(sede.indirizzo, LIMITI.INDIRIZZO_MAX);
  const citta = taglia(sede.citta, LIMITI.CITTA_MAX);
  const cap = taglia(sede.cap, 5);
  const provincia = taglia(sede.provincia, 2).toUpperCase();
  if (!indirizzo && !citta && !cap && !provincia) return null;
  return {
    indirizzo: indirizzo || null,
    citta: citta || null,
    cap: cap || null,
    provincia: provincia || null
  };
}

function pulisciPoderi(lista) {
  if (!Array.isArray(lista)) return [];
  const out = [];
  const visti = Object.create(null);
  for (let i = 0; i < lista.length && out.length < LIMITI.MAX_PODERI; i++) {
    const p = lista[i];
    if (!p || typeof p !== "object") continue;
    const nome = taglia(p.nome, LIMITI.NOME_PODERE_MAX);
    if (!nome) continue;
    const chiave = nome.toLowerCase().replace(/\s+/g, " ");
    if (visti[chiave]) continue;
    visti[chiave] = true;
    out.push({ nome: nome });
  }
  return out;
}

function pulisciTerreni(lista) {
  if (!Array.isArray(lista)) return { terreni: [], troppiTerreni: false };
  const troppiTerreni = lista.length > LIMITI.MAX_TERRENI_PER_RICHIESTA;
  const out = [];
  for (
    let i = 0;
    i < lista.length && out.length < LIMITI.MAX_TERRENI_PER_RICHIESTA;
    i++
  ) {
    const t = lista[i];
    if (!t || typeof t !== "object") continue;
    const nome = taglia(t.nome, LIMITI.NOME_TERRENO_MAX);
    const superficie = Number(t.superficie);
    if (!nome) continue;
    if (!Number.isFinite(superficie) || superficie <= 0) continue;
    const voce = { nome: nome, superficie: superficie };
    if (t.coltura == null || t.coltura === "") {
      voce.coltura = null;
    } else {
      voce.coltura = taglia(t.coltura, LIMITI.COLTURA_MAX) || null;
    }
    if (t.podere == null || t.podere === "") {
      voce.podere = null;
    } else {
      voce.podere = taglia(t.podere, LIMITI.NOME_PODERE_MAX) || null;
    }
    out.push(voce);
  }
  return { terreni: out, troppiTerreni: troppiTerreni };
}

/**
 * @param {string} testoJson
 * @returns {{ testo: string, dati: object|null, troppiTerreni?: boolean }}
 */
function rispostaAccountDaTesto(testoJson) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(testoJson || ""));
  } catch (_e) {
    return { testo: TESTO_RIPIEGO, dati: null };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { testo: TESTO_RIPIEGO, dati: null };
  }

  let testo = typeof parsed.testo === "string" ? parsed.testo.trim() : "";
  if (!testo) testo = TESTO_RIPIEGO;
  if (/salvat|registrat/i.test(testo)) {
    testo = "Ecco il riepilogo: controlla e conferma";
  }

  const sede = pulisciSede(parsed.sede);
  const poderi = pulisciPoderi(parsed.poderi);
  const { terreni, troppiTerreni } = pulisciTerreni(parsed.terreni);
  const fatto = parsed.fatto === true;

  return {
    testo: testo,
    dati: {
      sede: sede,
      poderi: poderi,
      terreni: terreni,
      fatto: fatto
    },
    troppiTerreni: troppiTerreni
  };
}

module.exports = {
  SCHEMA_RISPOSTA_ACCOUNT,
  promptSistemaAccount,
  rispostaAccountDaTesto,
  regoleTenute,
  PREFISSI_ESCLUSI,
  TESTO_RIPIEGO
};
