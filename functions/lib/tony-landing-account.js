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
const { LIMITI, chiaveNome } = require("./tony-landing-setup-core");

const PREFISSI_ESCLUSI = Object.freeze([
  "Dati personali.",
  "Cosa puoi fare qui.",
  "Come rispondi."
]);

const TESTO_RIPIEGO =
  "Non ho capito bene. Riprova con via e comune, oppure un podere, oppure un terreno con nome, ettari e coltura.";

const SINONIMI_COLTURA = Object.freeze([
  { chiavi: ["vigna", "uva", "vite"], nome: "Vite da Vino" },
  { chiavi: ["mele", "melo"], nome: "Melo" },
  { chiavi: ["olive", "olivo"], nome: "Olivo" },
  { chiavi: ["grano duro", "grano tenero", "grano"], nome: "Grano" }
]);

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
    fatto: Object.freeze({ type: "BOOLEAN" }),
    fuoriTema: Object.freeze({ type: "BOOLEAN" })
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

function raccoltiDaOpzioni(opzioni) {
  if (typeof opzioni === "string") return opzioni.trim();
  if (opzioni && typeof opzioni === "object" && typeof opzioni.raccolti === "string") {
    return opzioni.raccolti.trim();
  }
  return "";
}

/**
 * @param {string} argomento
 * @param {string|{ raccolti?: string }} [opzioni]
 * @returns {string}
 */
function promptSistemaAccount(argomento, opzioni) {
  const arg = String(argomento || "");
  const regoleAiuto = [
    "Aiuto all'account. Aiuti solo a dire sede legale (via, comune, CAP, provincia), poderi (nomi) e terreni (nome, superficie in ha, coltura). L'argomento di adesso è «" +
      arg +
      "».",
    "Mai dati fiscali (Partita IVA, codice fiscale), mai mezzi, operai o il numero di operai, mai dati di altre persone; se li danno, non usarli e ripeti la domanda.",
    "Non dire mai il nome di chi offre GFV né di altre persone.",
    "Scrivi i numeri piccoli in lettere con l'articolo giusto: «un terreno», «un podere», «due terreni»; mai «1 terreno» né «uno terreno».",
    "Provincia: solo sigla di due lettere (es. Bergamo → BG), mai il nome intero della provincia.",
    "Fuori tema: se il messaggio non c'entra col passo (es. «piscina»), rispondi con UNA frase che lo riporta al passo e metti fuoriTema: true; non trattarlo come nome di podere o terreno.",
    "Non fare due volte di seguito la stessa domanda.",
    "Il nome di un podere o di un terreno va scritto esattamente come lo dice l'utente, comprese parole come Podere, Cascina, Tenuta, Campo: non accorciarlo.",
    "Ogni terreno ha il campo podere: se l'utente lo dice, metti il nome del podere uguale a quello in elenco; se c'è un solo podere, metti quello; se ce ne sono più di uno e non l'ha detto, chiedi in quale podere è, citando i nomi.",
    "Quando l'argomento è «terreni» e hai almeno un terreno in elenco, chiedi «Ne hai altri o vediamo il riepilogo?»; se dice no, basta, fatto o riepilogo, metti fatto: true.",
    "Con 5 terreni (argomento «terreni») metti fatto: true.",
    "Se un terreno ha solo il nome, chiedi ettari e coltura di QUEL terreno citandolo per nome.",
    "Superficie: numero in ettari con il punto decimale («2,34 ha» → 2.34); se dicono metri quadri o altre unità, chiedi in ettari.",
    "Coltura: solo un nome dell'elenco colture di GFV (lo trovi sotto); «mele» → «Melo», «uva da vino» → «Vite da Vino», «olive» → «Olivo», «grano duro» → «Grano»; «seminativo», «frutteto», «orto» sono categorie: chiedi «Che cosa ci coltivi? Grano, mais, orzo…» oppure lascia null.",
    "Al massimo 5 terreni; se ne dicono di più: «Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.»",
    "Non dire mai di aver salvato o registrato; alla fine dire «Ecco il riepilogo: controlla e conferma».",
    "Rispondi solo con il JSON dello schema; frasi brevi in testo."
  ];
  const regole = regoleTenute().concat(regoleAiuto);
  let kb =
    String(TESTO_KB || "") +
    "\n\nELENCO COLTURE AMMESSE:\n" +
    elencoNomiColture();
  const raccolti = raccoltiDaOpzioni(opzioni);
  if (raccolti) {
    kb += "\n\nDATI GIÀ RACCOLTI (non richiederli):\n" + raccolti;
  }
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

function pulisciCap(valore) {
  const s = String(valore || "").trim();
  if (!s) return null;
  return /^\d{5}$/.test(s) ? s : null;
}

function pulisciProvincia(valore) {
  const s = String(valore || "").trim().toUpperCase();
  if (!s) return null;
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

function pulisciSede(sede) {
  if (!sede || typeof sede !== "object" || Array.isArray(sede)) return null;
  const indirizzo = taglia(sede.indirizzo, LIMITI.INDIRIZZO_MAX) || null;
  const citta = taglia(sede.citta, LIMITI.CITTA_MAX) || null;
  const cap = pulisciCap(sede.cap);
  const provincia = pulisciProvincia(sede.provincia);
  if (!indirizzo && !citta && !cap && !provincia) return null;
  return {
    indirizzo: indirizzo,
    citta: citta,
    cap: cap,
    provincia: provincia
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

function trovaNomeColturaCanonico(nome) {
  const chiave = chiaveNome(nome);
  for (let i = 0; i < COLTURE_PREDEFINITE.length; i++) {
    if (chiaveNome(COLTURE_PREDEFINITE[i].nome) === chiave) {
      return COLTURE_PREDEFINITE[i].nome;
    }
  }
  return null;
}

/**
 * @param {unknown} grezzo
 * @returns {string|null}
 */
function risolviColturaConSinonimi(grezzo) {
  if (grezzo == null || grezzo === "") return null;
  const testo = taglia(grezzo, LIMITI.COLTURA_MAX);
  if (!testo) return null;
  const diretto = trovaNomeColturaCanonico(testo);
  if (diretto) return diretto;
  const chiave = chiaveNome(testo);
  for (let i = 0; i < SINONIMI_COLTURA.length; i++) {
    const voce = SINONIMI_COLTURA[i];
    for (let j = 0; j < voce.chiavi.length; j++) {
      if (chiaveNome(voce.chiavi[j]) === chiave) {
        return trovaNomeColturaCanonico(voce.nome);
      }
    }
  }
  return null;
}

const PREFISSI_PODERE = Object.freeze([
  "podere",
  "cascina",
  "tenuta",
  "fattoria",
  "azienda"
]);

function nomeSenzaPrefissoPodere(nome) {
  let s = String(nome || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  for (let i = 0; i < PREFISSI_PODERE.length; i++) {
    const p = PREFISSI_PODERE[i];
    if (s.indexOf(p + " ") === 0) {
      s = s.slice(p.length + 1).trim();
      break;
    }
  }
  return s;
}

function corrispondeNomePodere(a, b) {
  const ka = chiaveNome(a);
  const kb = chiaveNome(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  return nomeSenzaPrefissoPodere(ka) === nomeSenzaPrefissoPodere(kb);
}

function risolviNomePodereInElenco(grezzo, poderi) {
  const lista = Array.isArray(poderi) ? poderi : [];
  const cercato = String(grezzo || "").trim();
  if (!cercato) return null;
  for (let i = 0; i < lista.length; i++) {
    const nome =
      lista[i] && lista[i].nome != null ? String(lista[i].nome).trim() : "";
    if (nome && corrispondeNomePodere(cercato, nome)) return nome;
  }
  return null;
}

/**
 * Collega i poderi ai terreni della stessa risposta (rete di sicurezza server).
 * @param {Array<{ nome: string }>} poderi
 * @param {Array<object>} terreni
 * @returns {Array<object>}
 */
function collegaTerreniAiPoderiServer(poderi, terreni) {
  const listaP = Array.isArray(poderi) ? poderi : [];
  const listaT = Array.isArray(terreni) ? terreni : [];
  const nomeUnico =
    listaP.length === 1 && listaP[0] && listaP[0].nome
      ? String(listaP[0].nome).trim()
      : null;
  return listaT.map(function (t) {
    if (!t || typeof t !== "object") return t;
    const voce = Object.assign({}, t);
    const grezzo =
      voce.podere == null || voce.podere === ""
        ? ""
        : String(voce.podere).trim();
    if (grezzo) {
      const risolto = risolviNomePodereInElenco(grezzo, listaP);
      if (risolto) voce.podere = risolto;
      return voce;
    }
    if (nomeUnico) voce.podere = nomeUnico;
    return voce;
  });
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
    if (!nome) continue;
    let superficie = null;
    if (t.superficie != null && t.superficie !== "") {
      const n = Number(t.superficie);
      if (Number.isFinite(n) && n > 0) superficie = n;
    }
    const voce = { nome: nome, superficie: superficie };
    if (t.coltura == null || t.coltura === "") {
      voce.coltura = null;
    } else {
      voce.coltura = risolviColturaConSinonimi(t.coltura);
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
 * Estrae dalla domanda i numeri seguiti da ha / ettar…
 * @param {string} domanda
 * @returns {number[]}
 */
function superficieDaDomanda(domanda) {
  const s = String(domanda || "");
  const re = /(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettar)/gi;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = Number(String(m[1]).replace(",", "."));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/**
 * Se c'è un solo numero con unità nella domanda e un solo terreno con
 * superficie diversa, corregge la superficie.
 * @param {string} domanda
 * @param {{ sede?: object|null, poderi?: object[], terreni?: object[] }|null} dati
 */
function applicaSuperficieDaDomanda(domanda, dati) {
  if (!dati || typeof dati !== "object") return dati;
  const numeri = superficieDaDomanda(domanda);
  if (numeri.length !== 1) return dati;
  const terreni = Array.isArray(dati.terreni) ? dati.terreni : [];
  if (terreni.length !== 1) return dati;
  const t = terreni[0];
  if (!t || typeof t !== "object") return dati;
  if (typeof t.superficie === "number" && t.superficie === numeri[0]) {
    return dati;
  }
  const copia = Object.assign({}, dati, {
    terreni: [
      Object.assign({}, t, {
        superficie: numeri[0]
      })
    ]
  });
  return copia;
}

/**
 * Normalizza i decimali italiani solo per Gemini (1,5 → 1.5).
 * @param {string} domanda
 * @returns {string}
 */
function normalizzaDecimaliPerGemini(domanda) {
  return String(domanda || "").replace(/(\d),(\d)/g, "$1.$2");
}

function correggiUnoNelTesto(testo) {
  return String(testo || "").replace(
    /\buno\b(?=\s+(?:terren|poder|modul|ettar))/gi,
    "un"
  );
}

/**
 * @param {string} testoJson
 * @returns {{ testo: string, dati: object|null, troppiTerreni?: boolean, fuoriTema?: boolean }}
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
  testo = correggiUnoNelTesto(testo);
  if (/salvat|registrat/i.test(testo)) {
    testo = "Ecco il riepilogo: controlla e conferma";
  }

  const sede = pulisciSede(parsed.sede);
  const poderi = pulisciPoderi(parsed.poderi);
  const puliti = pulisciTerreni(parsed.terreni);
  const terreni = collegaTerreniAiPoderiServer(poderi, puliti.terreni);
  const fatto = parsed.fatto === true;
  const fuoriTema = parsed.fuoriTema === true;

  return {
    testo: testo,
    dati: {
      sede: sede,
      poderi: poderi,
      terreni: terreni,
      fatto: fatto,
      fuoriTema: fuoriTema
    },
    troppiTerreni: puliti.troppiTerreni,
    fuoriTema: fuoriTema
  };
}

module.exports = {
  SCHEMA_RISPOSTA_ACCOUNT,
  promptSistemaAccount,
  rispostaAccountDaTesto,
  regoleTenute,
  PREFISSI_ESCLUSI,
  TESTO_RIPIEGO,
  pulisciSede,
  pulisciPoderi,
  pulisciTerreni,
  risolviColturaConSinonimi,
  correggiUnoNelTesto,
  SINONIMI_COLTURA,
  superficieDaDomanda,
  applicaSuperficieDaDomanda,
  normalizzaDecimaliPerGemini,
  collegaTerreniAiPoderiServer,
  corrispondeNomePodere
};
