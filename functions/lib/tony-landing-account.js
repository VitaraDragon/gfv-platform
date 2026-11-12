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
const {
  COLTURE_PREDEFINITE,
  CATEGORIE_COLTURE_PREDEFINITE
} = require("../config/colture-predefinite");
const { LIMITI, chiaveNome } = require("./tony-landing-setup-core");

const PREFISSI_ESCLUSI = Object.freeze([
  "Dati personali.",
  "Cosa puoi fare qui.",
  "Come rispondi."
]);

const TESTO_RIPIEGO =
  "Non ho capito bene. Riprova con via e comune, oppure un podere, oppure un terreno con nome, ettari e coltura.";

/** Plurali e nomi comuni → nome canonico del catalogo GFV. */
const SINONIMI_COLTURA = Object.freeze([
  { chiavi: ["vigna", "uva", "vite"], nome: "Vite da Vino" },
  { chiavi: ["mele", "melo"], nome: "Melo" },
  { chiavi: ["pere", "pero"], nome: "Pero" },
  { chiavi: ["pesche", "peschi", "pesco"], nome: "Pesco" },
  { chiavi: ["noci", "noce"], nome: "Noce" },
  { chiavi: ["albicocco", "albicocchi"], nome: "Albicocche" },
  { chiavi: ["susini", "susino"], nome: "Susino" },
  { chiavi: ["ciliegie", "ciliegi", "ciliegio"], nome: "Ciliegio" },
  { chiavi: ["fichi", "fico"], nome: "Fico" },
  { chiavi: ["pompelmi", "pompelmo"], nome: "Pompelmo" },
  { chiavi: ["olive", "olivo"], nome: "Olivo" },
  { chiavi: ["grano duro", "grano tenero", "grano"], nome: "Grano" },
  { chiavi: ["melogrno"], nome: "Melograno" },
  { chiavi: ["mandorli", "mandorla"], nome: "Mandorlo" }
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
          nome: Object.freeze({ type: "STRING", nullable: true }),
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
 * Legge i nomi podere dalla riga «Poderi: a, b» di serializzaRaccolti.
 * @param {string} raccolti
 * @returns {Array<{ nome: string }>}
 */
function poderiDaRaccolti(raccolti) {
  const s = String(raccolti || "");
  const m = s.match(/(?:^|\n)Poderi:\s*(.+?)(?:\n|$)/i);
  if (!m) return [];
  return String(m[1])
    .split(",")
    .map(function (p) {
      return String(p || "").trim();
    })
    .filter(Boolean)
    .map(function (nome) {
      return { nome: nome };
    });
}

/**
 * Unisce poderi di risposta e da raccolti (per nome, senza doppioni).
 * @param {Array<{ nome?: string }>} daRisposta
 * @param {Array<{ nome?: string }>} daRaccolti
 * @returns {Array<{ nome: string }>}
 */
function unisciPoderi(daRisposta, daRaccolti) {
  const out = [];
  const visti = Object.create(null);
  function aggiungi(lista) {
    const arr = Array.isArray(lista) ? lista : [];
    for (let i = 0; i < arr.length; i++) {
      const nome =
        arr[i] && arr[i].nome != null ? String(arr[i].nome).trim() : "";
      if (!nome) continue;
      const k = chiaveNome(nome);
      if (!k || visti[k]) continue;
      visti[k] = true;
      out.push({ nome: nome });
    }
  }
  aggiungi(daRisposta);
  aggiungi(daRaccolti);
  return out;
}

/**
 * Toglie dal testo una frase che chiede in quale podere (solo con ≤1 podere).
 * @param {string} testo
 * @returns {string}
 */
function togliDomandaPodere(testo) {
  let s = String(testo || "").trim();
  if (!s) return s;
  const pezzi = s.split(/(?<=[.!?])\s+/);
  const filtrati = pezzi.filter(function (p) {
    return !/\b(in|a)?\s*(quale|che)\s+podere\b/i.test(p);
  });
  s = filtrati.join(" ").trim();
  if (!s) s = "Ne hai altri o vediamo il riepilogo?";
  return s;
}

/**
 * In fase terreni non riaprire i poderi (né «hai dei poderi?»).
 * @param {string} testo
 * @returns {string}
 */
function togliRiaperturaPoderi(testo) {
  let s = String(testo || "").trim();
  if (!s) return s;
  const pezzi = s.split(/(?<=[.!?])\s+/);
  const filtrati = pezzi.filter(function (p) {
    if (/\b(in|a)?\s*(quale|che)\s+podere\b/i.test(p)) return false;
    if (/\bhai\s+(dei\s+|dei\s+tuoi\s+|uno\s+o\s+pi[uù]\s+)?poder/i.test(p)) {
      return false;
    }
    if (/\b(dimmi|aggiungi|elenca|indica).{0,40}\bpoder/i.test(p)) return false;
    if (/\bpoderi?\s*\?/i.test(p) && !/\bterren/i.test(p)) return false;
    return true;
  });
  s = filtrati.join(" ").trim();
  if (!s) s = "Ne hai altri o vediamo il riepilogo?";
  return s;
}

/**
 * Toglie domande su CAP/provincia (sede: bastano via e comune).
 * @param {string} testo
 * @returns {string}
 */
function togliDomandaCapProvincia(testo) {
  let s = String(testo || "").trim();
  if (!s) return s;
  const pezzi = s.split(/(?<=[.!?])\s+/);
  const filtrati = pezzi.filter(function (p) {
    if (/\b(qual\s*[e']?\s*)?(è\s+)?(il\s+)?CAP\b/i.test(p)) return false;
    if (/\b(quale\s+)?provincia\b/i.test(p)) return false;
    if (/\bCAP\b.*\?/i.test(p)) return false;
    return true;
  });
  s = filtrati.join(" ").trim();
  if (!s) s = "Mi bastano via e comune.";
  return s;
}

/**
 * @param {string} argomento
 * @param {string|{ raccolti?: string }} [opzioni]
 * @returns {string}
 */
function promptSistemaAccount(argomento, opzioni) {
  const arg = String(argomento || "");
  const raccolti = raccoltiDaOpzioni(opzioni);
  const poderiNoti = poderiDaRaccolti(raccolti);
  const regoleAiuto = [
    "Aiuto all'account. Aiuti solo a dire sede legale (indirizzo o almeno il comune), poderi (nomi) e terreni (nome, superficie in ha, coltura). L'argomento di adesso è «" +
      arg +
      "».",
    "Flusso lineare e obbligatorio: sede → poderi → terreni → riepilogo. Non tornare indietro: se l'argomento è «poderi» non richiedere la sede; se è «terreni» non richiedere di nuovo sede né poderi, a meno che l'utente non lo chieda esplicitamente (es. «aggiungi un podere», «cambio indirizzo»).",
    "Mai dati fiscali (Partita IVA, codice fiscale), mai mezzi, operai o il numero di operai, mai dati di altre persone; se li danno, non usarli e ripeti la domanda.",
    "Non dire mai il nome di chi offre GFV né di altre persone.",
    "Scrivi i numeri piccoli in lettere con l'articolo giusto: «un terreno», «un podere», «due terreni»; mai «1 terreno» né «uno terreno».",
    "Sede: bastano via (con numero civico) e comune. Va bene anche senza la parola «via»: località, strada, vicolo, corso, piazza, «podere Sasso, Brisighella», «Faenza, RA» o anche solo il comune. Non rifiutare e non richiedere la parola via. Se manca il numero civico, chiedilo una volta («Il numero civico, se ce l'hai, dimmelo pure.») e vai avanti. NON chiedere provincia né CAP. Il CAP lascialo null: compilalo solo se quel comune ha un unico CAP che conosci con certezza, altrimenti non inventarlo. La provincia, se la conosci (es. Bergamo → BG), mettila; se no, null. La sede non è un terreno. «podere …, Comune» in questo passo è l'indirizzo, non un podere.",
    "Fuori tema: se il messaggio non c'entra col passo (es. «piscina»), rispondi con UNA frase che lo riporta al passo e metti fuoriTema: true; non trattarlo come nome di podere o terreno.",
    "Non fare due volte di seguito la stessa domanda.",
    "Il nome di un podere o di un terreno va scritto esattamente come lo dice l'utente, comprese parole come Podere, Cascina, Tenuta, Campo: non accorciarlo.",
    "Il nome del terreno non è la coltura, la varietà né gli ettari. «3 ha di trebbiano» ha superficie 3 e varietà trebbiano, ma nome null: chiedi come si chiama quel terreno e tieni ettari e coltura. «laghetto grano 5 ha» è nome laghetto, coltura Grano, 5 ha: la coltura può stare prima degli ettari. Se il nome è già esplicito («si chiama Vigna Alta», «Vigna Alta: 3 ha»), scrivilo e non chiedere di nuovo il nome. Una sola parola che è una coltura («pesco») corregge il terreno in attesa, non ne crea uno nuovo.",
    "I poderi sono facoltativi. Nel passo «poderi» chiedi una volta se ne ha. Un no non inventa poderi. Se ne dice uno, anche fuori dal passo, tienilo senza duplicarlo. Nel passo «terreni» non ripetere la domanda sui poderi.",
    "Ogni terreno ha il campo podere: se l'utente lo dice, metti il nome del podere uguale a quello in elenco; se c'è un solo podere, metti quello; se ce ne sono più di uno e non l'ha detto, chiedi in quale podere è, citando i nomi.",
    "Quando passi ai terreni e non ne hai ancora raccolti, chiedi il primo così: «Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?». Non chiedere «Quanti terreni hai e come si chiamano?». Se l'utente risponde solo con un numero di terreni (es. «7 terreni», «ne ho 4», «cinque»), non mettere fatto: true e non parlare di riepilogo: se il numero è >5 avvisa del limite gratuito, poi chiedi comunque il primo terreno (nome, ettari, coltura).",
    "Quando l'argomento è «terreni» e hai almeno un terreno completo in elenco ma meno di 5, chiedi «Ne hai altri o vediamo il riepilogo?»; se dice no, basta, fatto o riepilogo, metti fatto: true. Usa la forma «Ne hai N su cinque terreni» / «ne hai N su 5» con N esatto (solo se N < 5).",
    "Accetta fino a 5 terreni (il quinto va bene). Quando il quinto terreno è completo (nome + ettari + coltura), NON chiedere «Ne hai altri?»: di' che è stato raggiunto il limite di cinque terreni e metti fatto: true (il client apre il riepilogo). Solo dal sesto in poi rifiuta con: «Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.»",
    "Terreni già raccolti: " +
      terreniDaRaccolti(raccolti).conteggio +
      " di 5. Questo numero è esatto e vale più di ciò che ricordi dalla conversazione. Nel campo terreni restituisci SOLO i terreni nuovi o modificati in questo turno, mai l'elenco già raccolto. Se ne restano da aggiungere (meno di 5), puoi accettarne ancora; quando dici quanti ne ha (e N < 5), usa la forma «ne hai N su 5» o «ne hai N su cinque» con N esatto. Se compare «in attesa del nome», quel terreno è già nel conteggio: quando l'utente dice il nome, NON è un terreno in più.",
    "L'utente ha già creato l'account gratuito ed è collegato: non dire mai di cliccare «Crea il tuo account gratuito», di registrarsi o di scrivere email e password. Se chiede cosa fare adesso o come continuare, rispondi in una frase: se ha meno di 5 terreni chiedi «Ne hai altri o vediamo il riepilogo?»; se li ha già detti tutti, di' che il riepilogo è qui sotto, lo controlla e preme «Sì, salva».",
    "Se un terreno ha solo il nome, chiedi ettari e coltura di QUEL terreno citandolo per nome.",
    "Superficie: numero in ettari con il punto decimale («2,34 ha» → 2.34); se dicono metri quadri o altre unità, chiedi in ettari.",
    "Coltura: solo un nome dell'elenco colture di GFV (lo trovi sotto); nel JSON usa SEMPRE il nome canonico del catalogo, mai il plurale grezzo dell'utente. Esempi: «noci» → «Noce», «pesche»/«peschi» → «Pesco», «mele» → «Melo», «pere» → «Pero», «albicocco» → «Albicocche», «prugne» → «Prugne», «uva da vino» → «Vite da Vino», «olive» → «Olivo», «grano duro» → «Grano». Se la coltura non è in elenco (né come sinonimo), lascia null e chiedila in chat; non inventarla. «seminativo» e «frutteto» sono categorie: chiedi «Che cosa ci coltivi? Grano, mais, orzo…» oppure lascia null.",
    "Il nome del terreno nel JSON ha la prima lettera maiuscola (es. «Prugneto»), come lo confermi a voce.",
    "Ortaggi: «ortaggi», «orto», «ortive», «verdure» sono la categoria Ortive, non una coltura salvabile. " +
      (/categoria Ortive/i.test(raccolti)
        ? "Hai GIÀ chiesto quali ortaggi: NON richiederlo di nuovo. Se l'utente dice «vari», «misti» o simili, proponi di scegliere un ortaggio concreto dall'elenco (es. Insalata, Pomodoro, Zucchine); non mettere fatto:true né mandare al riepilogo finché non c'è una coltura catalogo."
        : "Chiedi UNA sola volta, citando il terreno: «Quali ortaggi soprattutto? Per esempio Pomodoro, Insalata, Zucchine». Se nomina un ortaggio dell'elenco colture, usa quello; se dice «vari/misti», proponi di sceglierne uno (es. Insalata); non andare al riepilogo con sola categoria Ortive."),
    "Se il messaggio dell'utente descrive chiaramente un podere o un terreno (nome, ettari, coltura) anche se l'argomento corrente è un passo precedente, estrai comunque quei dati nel JSON.",
    "Non dire mai di aver salvato o registrato. Non mettere fatto: true alla sede, su un podere o mentre correggi una coltura. «Ecco il riepilogo: controlla e conferma» solo se l'utente chiede il riepilogo.",
    "Rispondi solo con il JSON dello schema; frasi brevi in testo."
  ];
  if (poderiNoti.length === 1) {
    regoleAiuto.push(
      "C'è un solo podere, «" +
        poderiNoti[0].nome +
        "»: ogni terreno va lì. Non chiedere MAI in quale podere."
    );
  } else if (poderiNoti.length === 0) {
    regoleAiuto.push(
      "Nessun podere raccolto: non chiedere in quale podere è un terreno. Se l'argomento è «poderi», la domanda se ne ha resta obbligatoria una volta sola."
    );
  }
  const regole = regoleTenute().concat(regoleAiuto);
  let kb =
    String(TESTO_KB || "") +
    "\n\nELENCO COLTURE AMMESSE:\n" +
    elencoNomiColture();
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

/** Verbi/copule/connettivi tipici del parlato: non sono pezzi di nome né di coltura. */
const RUMORE_PARLATO_NOME = Object.freeze([
  "con",
  "di",
  "da",
  "a",
  "e",
  "ed",
  "sono",
  "è",
  "e'",
  "ha",
  "fa",
  "c'è",
  "cè",
  "ce",
  "misura",
  "sarebbe",
  "che",
  "del",
  "della",
  "dello",
  "dei",
  "degli",
  "delle",
  "ad",
  "al",
  "allo",
  "alla",
  "ho",
  "hai",
  "un",
  "uno",
  "una",
  "il",
  "lo",
  "la",
  "ettaro",
  "ettari",
  "ettar",
  "etari",
  "si",
  "chiama",
  "piama",
  "kiama",
  "chama",
  "ciama",
  "chiamo",
  "chiamiamo",
  "chiamano",
  "chiamalo",
  "chiamiamolo",
  "chiamiamola",
  "chiamato",
  "chiamata",
  "chiamto",
  "detto",
  "nome"
]);

function eRumoreParlatoNome(parola) {
  const k = String(parola || "")
    .trim()
    .toLowerCase()
    .replace(/’/g, "'");
  return !!k && RUMORE_PARLATO_NOME.indexOf(k) >= 0;
}

/**
 * Toglie in coda (e ripete) connettivi/verbi/copule lasciati dal parlato
 * («quercie sono», «lago è», «campo largo con»).
 * «a»/«e» solo se minuscoli (così «Campo A» resta un nome valido).
 * @param {string} grezzo
 * @returns {string}
 */
function togliConnettiviFinaliNome(grezzo) {
  let t = String(grezzo || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  while (true) {
    const m = t.match(
      /\s+(con|di|da|a|e|ed|sono|è|e'|ha|fa|c'è|cè|ce|misura|sarebbe)$/i
    );
    if (!m) break;
    const w = m[1];
    if (/^[ae]$/i.test(w) && w !== w.toLowerCase()) break;
    t = t.slice(0, m.index).trim();
  }
  while (true) {
    const m = t.match(
      /^(sono|è|e'|ha|fa|c'è|cè|ce|misura|sarebbe|ed|con|di|da)\s+/i
    );
    if (!m) break;
    t = t.slice(m[0].length).trim();
  }
  return t;
}

/** «null» e «undefined» non sono nomi di terreno. Prima lettera maiuscola. */
function nomeTerrenoVisibile(nome) {
  const s = togliConnettiviFinaliNome(String(nome == null ? "" : nome).trim());
  if (!s || /^(null|undefined|nullo)$/i.test(s)) return "";
  if (domandaNomeSenzaRisposta(s)) return "";
  if (eRumoreParlatoNome(s) && s.split(/\s+/).length === 1) return "";
  return inizialeMaiuscolaIt(s);
}

/** Via/civico/comune: non è un terreno (il civico non è ettari). */
function sembraIndirizzo(domanda) {
  const d = String(domanda || "");
  if (!d) return false;
  if (/\b(?:ha\b|ettari?\b|etari\b)\b/i.test(d)) return false;
  if (/\b\d+(?:[.,]\d+)?\s+di\s+[a-zà-öø-ÿ]/i.test(d)) return false;
  // «à» non è un carattere di parola per \b: «località » non chiude il confine.
  if (/\blocalit[aà](?![a-zà-öø-ÿ])/i.test(d)) return true;
  return /\b(?:via|viale|v\.le|corso|piazza|piazzale|vicolo|strada|contrada|localit[aà]|loc\.?)\b/i.test(
    d
  );
}

function nomeSembraIndirizzo(nome) {
  return /\b(?:via|viale|corso|piazza|piazzale|vicolo|strada|contrada)\b/i.test(
    String(nome || "")
  );
}

/**
 * Sede detta senza la parola «via».
 * Allineato a landing/src/lib/tony-aiuto-account.js.
 */
const PAROLE_NON_COMUNE = Object.freeze({
  si: 1,
  "sì": 1,
  no: 1,
  ok: 1,
  okay: 1,
  ciao: 1,
  salve: 1,
  boh: 1,
  niente: 1,
  nessuno: 1,
  grazie: 1,
  mah: 1,
  va: 1,
  bene: 1,
  non: 1,
  lo: 1,
  la: 1,
  il: 1,
  un: 1,
  una: 1,
  di: 1,
  da: 1,
  a: 1,
  che: 1,
  allora: 1,
  quindi: 1,
  ecco: 1,
  questo: 1,
  quello: 1,
  quella: 1,
  sono: 1,
  sei: 1,
  ho: 1,
  hai: 1,
  ha: 1
});

const DOMANDA_CIVICO_FACOLTATIVA =
  "Il numero civico, se ce l'hai, dimmelo pure.";

function normalizzaSpaziSede(domanda) {
  return String(domanda || "")
    .trim()
    .replace(/\s+/g, " ");
}

function parolaNonEComune(parola) {
  return Object.prototype.hasOwnProperty.call(
    PAROLE_NON_COMUNE,
    String(parola || "").toLowerCase()
  );
}

function sembraSoloComune(domanda) {
  const d = normalizzaSpaziSede(domanda);
  if (!d || /[?!]/.test(d) || /\d/.test(d)) return false;
  if (
    /\b(?:ha|ettar\w*|etari|terren\w*|campi?|coltur\w*|poder\w*|via|viale|corso|piazza\w*|strada|contrada|localit\w*|vicolo)\b/i.test(
      d
    )
  ) {
    return false;
  }
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]+$/.test(d)) return false;
  const parole = d.split(/\s+/);
  if (parole.length < 1 || parole.length > 4) return false;
  if (parole.some(parolaNonEComune)) return false;
  if (parole.length === 1 && parole[0].length < 4) return false;
  if (parole.length === 1 && risolviColturaConSinonimi(parole[0])) return false;
  return true;
}

function sembraComuneEProvincia(domanda) {
  const d = normalizzaSpaziSede(domanda);
  const m = d.match(/^(.+?)(?:,|\s)\s*\(?([A-Za-z]{2})\)?$/);
  if (!m) return false;
  const luogo = String(m[1] || "").trim();
  if (!luogo || /\d/.test(luogo) || luogo.length < 3) return false;
  return sembraSoloComune(luogo);
}

function sembraPodereComeIndirizzo(domanda) {
  const d = normalizzaSpaziSede(domanda);
  if (!d || /\b(?:ha|ettari?|etari|terren\w*)\b/i.test(d)) return false;
  return /^podere\s+\S.+(?:,|\s+a\s+|\s+di\s+)\s*\S/i.test(d);
}

function sembraSedeDetta(domanda) {
  if (!normalizzaSpaziSede(domanda) || domandaTerrenoEsplicita(domanda)) return false;
  if (sembraIndirizzo(domanda)) return true;
  if (sembraPodereComeIndirizzo(domanda)) return true;
  if (sembraComuneEProvincia(domanda)) return true;
  if (sembraSoloComune(domanda)) return true;
  return false;
}

function inizialeMaiuscolaFraseSede(s) {
  return String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(function (p) {
      return p.charAt(0).toLocaleUpperCase("it") + p.slice(1);
    })
    .join(" ");
}

function sedeDaTesto(domanda) {
  const raw = normalizzaSpaziSede(domanda);
  if (sembraPodereComeIndirizzo(raw)) {
    const m = raw.match(/^podere\s+(.+?)\s*(?:,|\s+a\s+|\s+di\s+)\s*(.+)$/i);
    if (!m) return null;
    return {
      indirizzo: "podere " + inizialeMaiuscolaFraseSede(m[1].trim()),
      citta: inizialeMaiuscolaFraseSede(m[2].trim()),
      cap: null,
      provincia: null
    };
  }
  if (sembraComuneEProvincia(raw)) {
    const m = raw.match(/^(.+?)(?:,|\s)\s*\(?([A-Za-z]{2})\)?$/);
    if (!m) return null;
    return {
      indirizzo: null,
      citta: inizialeMaiuscolaFraseSede(m[1].trim()),
      cap: null,
      provincia: String(m[2] || "").toUpperCase()
    };
  }
  if (sembraSoloComune(raw)) {
    return {
      indirizzo: null,
      citta: inizialeMaiuscolaFraseSede(raw),
      cap: null,
      provincia: null
    };
  }
  if (sembraIndirizzo(raw)) {
    return { indirizzo: raw, citta: null, cap: null, provincia: null };
  }
  return null;
}

function sedeHaQualcosa(sede) {
  return !!(sede && (sede.indirizzo || sede.citta));
}

function testoRifiutaSedeAccettata(testo) {
  const s = String(testo || "").trim();
  if (!s) return false;
  if (
    /\bpoder/i.test(s) &&
    !/riprova con via|non ho capito bene|dove['’]?è la sede legale/i.test(s)
  ) {
    return false;
  }
  return (
    /^non ho capito bene/i.test(s) ||
    /riprova con via/i.test(s) ||
    /dove['’]?è la sede legale/i.test(s) ||
    /mi bastano via/i.test(s)
  );
}

function conDomandaCivico(testo) {
  const s = String(testo || "").trim();
  if (/numero civico/i.test(s)) return s;
  if (!s) return DOMANDA_CIVICO_FACOLTATIVA;
  const base = /[.!?]$/.test(s) ? s : s + ".";
  return base + " " + DOMANDA_CIVICO_FACOLTATIVA;
}

function domandaTerrenoEsplicita(domanda) {
  const d = String(domanda || "");
  if (!d || sembraIndirizzo(d)) return false;
  if (/\b(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettari?\b)/i.test(d)) return true;
  if (/\b(\d+(?:[.,]\d+)?)\s+di\s+[a-zà-öø-ÿ]/i.test(d)) return true;
  return false;
}

const NUMERI_TERRANI_PAROLA = Object.freeze({
  un: 1,
  uno: 1,
  una: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10
});

/** Allineato a landing/src/lib/tony-aiuto-account.js (PAROLE_CONTEGGIO_TERRENI). */
const PAROLE_CONTEGGIO_TERRENI =
  "terren[io]|tereni|terenri|terrni|campi|appezzamenti?";

function normalizzaDomandaConteggio(domanda) {
  return String(domanda || "")
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u00B4]/g, "'")
    .replace(/[?!.,;:]+$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Conteggio esplicito — mai un numero nudo o in parole da solo («6», «sei»).
 * Accetta: «7 terreni», «ne ho 4», «ce ne sono 6», «ho 8 campi».
 * Refusi leggeri sulla parola terreni (tereni, terenri, terrni) se resta inequivocabile.
 * «6 etari» è un refuso di ettari, non un conteggio.
 * @param {string} domanda
 * @returns {number|null}
 */
function numeroTerreniDetto(domanda) {
  const d = normalizzaDomandaConteggio(domanda);
  if (!d) return null;
  if (/\b(?:ha\b|ettari?\b|etari\b)\b/.test(d)) return null;
  if (/\bdi\s+[a-zà-öø-ÿ]/.test(d)) return null;
  const cifraConParola = d.match(
    new RegExp(
      "^(?:ne\\s+ho\\s+|ho\\s+|sono\\s+|ce\\s+ne\\s+sono\\s+|ce\\s+n'è\\s+)?(\\d{1,2})\\s+(?:" +
        PAROLE_CONTEGGIO_TERRENI +
        ")$",
      "i"
    )
  );
  if (cifraConParola) return Number(cifraConParola[1]);
  const parolaConParola = d.match(
    new RegExp(
      "^(?:ne\\s+ho\\s+|ho\\s+|sono\\s+|ce\\s+ne\\s+sono\\s+)?(un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\\s+(?:" +
        PAROLE_CONTEGGIO_TERRENI +
        ")$",
      "i"
    )
  );
  if (parolaConParola) {
    const k = String(parolaConParola[1] || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(NUMERI_TERRANI_PAROLA, k)
      ? NUMERI_TERRANI_PAROLA[k]
      : null;
  }
  const cifraPrefisso = d.match(
    /^(?:ne\s+ho\s+|ce\s+ne\s+sono\s+|ce\s+n'è\s+)(\d{1,2})$/i
  );
  if (cifraPrefisso) return Number(cifraPrefisso[1]);
  const parolaPrefisso = d.match(
    /^(?:ne\s+ho\s+|ce\s+ne\s+sono\s+)(un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)$/i
  );
  if (parolaPrefisso) {
    const k = String(parolaPrefisso[1] || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(NUMERI_TERRANI_PAROLA, k)
      ? NUMERI_TERRANI_PAROLA[k]
      : null;
  }
  return null;
}

function messaggioSoloConteggioTerreni(domanda) {
  return numeroTerreniDetto(domanda) != null;
}

/**
 * Forme comuni del parlato per il nome del terreno (refusi di «si chiama» inclusi).
 * Allineato a landing/src/lib/tony-aiuto-account.js.
 */
const RE_SI_CHIAMA =
  /(?:si\s+(?:chiama|piama|kiama|chama|ciama)|(?:che\s+)?(?:(?:lo|la)\s+)?chiam(?:o|iamo|ano)|chiamiamol[oa]|chiamat[oa]|chiamalo|chiamto|il\s+nome\s+(?:del\s+terreno\s+)?(?:è|e')|(?:^|[\s,.;:…]+)(?:nome|detto|chiamato|chiamto))\s+/i;

const DOMANDA_PODERI_ACCOUNT = "Hai uno o più poderi? Dimmi come li chiami.";

/** «come lo chiamiamo?» non è un nome. «come lo chiamiamo vitaccia» sì. */
function domandaNomeSenzaRisposta(domanda) {
  const d = String(domanda || "").trim();
  if (!d) return false;
  if (/[?]/.test(d)) return true;
  return /^come\s+(?:lo|la|si|che)\s+chiam\w*\s*$/i.test(d);
}

function messaggioSaltaCivico(domanda) {
  const d = normalizzaSpaziSede(domanda)
    .toLowerCase()
    .replace(/[?!.,;:]+$/g, "")
    .replace(/\s+/g, " ");
  if (!d) return false;
  if (/^(dopo|salta|senza|niente)$/.test(d)) return true;
  if (/^non ce l['’ ]?ho$/.test(d)) return true;
  if (/^non c['’]?[eè]$/.test(d)) return true;
  if (/^non lo so$/.test(d)) return true;
  if (/^senza (?:il |numero )?civico$/.test(d)) return true;
  return false;
}

/** Via con numero, o il solo civico («85»). Stringa vuota se non è un civico. */
function indirizzoPortatoDalCivico(domanda) {
  const raw = normalizzaSpaziSede(domanda);
  if (!raw || messaggioSaltaCivico(raw) || domandaTerrenoEsplicita(raw)) return "";
  if (/\d/.test(raw) && (sembraIndirizzo(raw) || sembraSedeDetta(raw))) return raw;
  if (/^\d{1,5}[a-zA-Z]?$/.test(raw)) return raw;
  return "";
}

function sedeDaRigaRaccolti(raccolti) {
  const m = String(raccolti || "").match(/(?:^|\n)Sede:\s*(.+)/);
  if (!m) return null;
  const pezzi = String(m[1] || "")
    .split(",")
    .map(function (p) {
      return p.trim();
    })
    .filter(Boolean);
  let provincia = null;
  let cap = null;
  const rest = [];
  for (let i = 0; i < pezzi.length; i++) {
    const p = pezzi[i];
    if (/^CAP\s+\d{5}$/i.test(p)) {
      cap = p.replace(/^CAP\s+/i, "");
      continue;
    }
    if (/^[A-Za-z]{2}$/.test(p) && rest.length) {
      provincia = p.toUpperCase();
      continue;
    }
    rest.push(p);
  }
  if (!rest.length && !provincia && !cap) return null;
  if (rest.length <= 1) {
    const unico = rest[0] || "";
    if (unico && (/\d/.test(unico) || sembraIndirizzo(unico))) {
      return { indirizzo: unico, citta: null, cap: cap, provincia: provincia };
    }
    return { indirizzo: null, citta: unico || null, cap: cap, provincia: provincia };
  }
  return {
    indirizzo: rest.slice(0, -1).join(", "),
    citta: rest[rest.length - 1],
    cap: cap,
    provincia: provincia
  };
}

function sedeRaccoltaSenzaCivico(raccolti) {
  const sede = sedeDaRigaRaccolti(raccolti);
  if (!sede || (!sede.citta && !sede.indirizzo)) return false;
  return !/\d/.test(String(sede.indirizzo || ""));
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

const CATEGORIA_ORTIVE = "Ortive";

/**
 * «ortaggi», «orto», «ortive», «verdure»… → categoria Ortive.
 * «vari / misti» da soli NON sono una categoria: restano alla categoria già nota.
 * @param {unknown} grezzo
 * @returns {boolean}
 */
function categoriaOrtiveDaTesto(grezzo) {
  const s = String(grezzo == null ? "" : grezzo).toLowerCase();
  if (!s) return false;
  return /\b(ortagg\w*|orto|orti|ortiv\w*|verdur\w*)(?![a-zà-öø-ÿ])/i.test(s);
}

/**
 * Terreni già raccolti dalla riga «Terreno «nome», …» di serializzaRaccolti.
 * La fonte di verità è il client: conteggio esplicito «Terreni già raccolti: N di 5».
 * @param {string} raccolti
 * @returns {{ nomi: string[], conteggio: number }}
 */
function terreniDaRaccolti(raccolti) {
  const s = String(raccolti || "");
  const nomi = [];
  const re = /(?:^|\n)Terreno\s+«([^»]+)»/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const nome = String(m[1] || "").trim();
    if (nome) nomi.push(nome);
  }
  let conteggio = nomi.length;
  const esplicito = s.match(/Terreni già raccolti:\s*(\d+)\s+di\s+\d+/i);
  if (esplicito) {
    const n = Number(esplicito[1]);
    if (Number.isFinite(n) && n > conteggio) conteggio = n;
  }
  return { nomi: nomi, conteggio: conteggio };
}

function superficieGrezza(t) {
  if (!t || t.superficie == null || t.superficie === "") return null;
  const n = Number(t.superficie);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nella stessa risposta, «null» + nome vero con gli stessi ettari è un solo terreno. */
function compattaTerreniGrezzi(lista) {
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    const t = lista[i];
    if (!t || typeof t !== "object") continue;
    const superficie = superficieGrezza(t);
    const nome = nomeTerrenoVisibile(t.nome);
    const voce = Object.assign({}, t, { nome: nome || null, superficie: superficie });
    let idx = -1;
    for (let j = 0; j < out.length; j++) {
      const prev = out[j];
      if (superficie == null || prev.superficie !== superficie) continue;
      const ca = chiaveNome(prev.coltura || "");
      const cb = chiaveNome(voce.coltura || "");
      if (ca && cb && ca !== cb) continue;
      const pa = chiaveNome(prev.podere || "");
      const pb = chiaveNome(voce.podere || "");
      if (pa && pb && pa !== pb) continue;
      const na = nomeTerrenoVisibile(prev.nome);
      const nb = nome;
      if (na && nb && chiaveNome(na) !== chiaveNome(nb)) continue;
      idx = j;
      break;
    }
    if (idx < 0) out.push(voce);
    else if (nome && !nomeTerrenoVisibile(out[idx].nome)) {
      out[idx] = Object.assign({}, out[idx], { nome: nome });
    }
  }
  return out;
}

/**
 * Pulisce i terreni della risposta. Il limite è «già raccolti + nuovi»:
 * i terreni già noti (stesso nome, anche con prefisso podere/tenuta…)
 * sono aggiornamenti e non contano; il modello può rimandare l'intera lista.
 * @param {unknown} lista
 * @param {{ nomi?: string[], conteggio?: number }|string[]} [giaRaccolti]
 */
function ordinaPerNomeDetto(lista, domanda) {
  const frase = String(domanda || "").trim();
  if (!frase || /\d/.test(frase) || frase.split(/\s+/).length > 4) return lista;
  const detto = nomeTerrenoVisibile(frase);
  if (!detto) return lista;
  const copia = lista.slice();
  copia.sort(function (a, b) {
    const ma =
      a && chiaveNome(nomeTerrenoVisibile(a.nome)) === chiaveNome(detto) ? 0 : 1;
    const mb =
      b && chiaveNome(nomeTerrenoVisibile(b.nome)) === chiaveNome(detto) ? 0 : 1;
    return ma - mb;
  });
  return copia;
}

function pulisciTerreni(lista, giaRaccolti, domanda) {
  if (!Array.isArray(lista)) return { terreni: [], troppiTerreni: false };
  const info = Array.isArray(giaRaccolti)
    ? { nomi: giaRaccolti, conteggio: giaRaccolti.length }
    : giaRaccolti && typeof giaRaccolti === "object"
      ? giaRaccolti
      : { nomi: [], conteggio: 0 };
  const nomiNoti = Array.isArray(info.nomi) ? info.nomi : [];
  const noti = Object.create(null);
  for (let i = 0; i < nomiNoti.length; i++) {
    const k = nomeSenzaPrefissoPodere(nomiNoti[i]);
    if (k) noti[k] = true;
  }
  const conteggio = Math.max(
    typeof info.conteggio === "number" ? info.conteggio : 0,
    Object.keys(noti).length
  );
  const limite = LIMITI.MAX_TERRENI_PER_RICHIESTA;
  let troppiTerreni = false;
  let nuovi = 0;
  const visti = Object.create(null);
  const out = [];
  const listaUnica = scartaFantasmaColtura(
    ordinaPerNomeDetto(compattaTerreniGrezzi(lista), domanda),
    domanda
  );
  for (let i = 0; i < listaUnica.length; i++) {
    const t = listaUnica[i];
    if (!t || typeof t !== "object") continue;
    let superficie = null;
    if (t.superficie != null && t.superficie !== "") {
      const n = Number(t.superficie);
      if (Number.isFinite(n) && n > 0) superficie = n;
    }
    let colturaGrezza = null;
    if (t.coltura != null && t.coltura !== "") {
      colturaGrezza = risolviColturaConSinonimi(t.coltura);
      if (!colturaGrezza && categoriaOrtiveDaTesto(t.coltura)) {
        colturaGrezza = CATEGORIA_ORTIVE;
      }
    }
    const nome = nomeTerrenoVisibile(taglia(t.nome, LIMITI.NOME_TERRENO_MAX));
    if (!nome && superficie == null && !colturaGrezza) continue;
    const chiave = nome ? nomeSenzaPrefissoPodere(nome) : "";
    const dedupe =
      chiave ||
      "§" +
        (superficie == null ? "" : String(superficie)) +
        "|" +
        (colturaGrezza || "");
    if (visti[dedupe]) continue;
    visti[dedupe] = true;
    if (!(chiave && noti[chiave])) {
      if (conteggio + nuovi >= limite) {
        troppiTerreni = true;
        continue;
      }
      nuovi += 1;
    }
    const voce = { nome: nome || null, superficie: superficie };
    if (t.coltura == null || t.coltura === "") {
      voce.coltura = null;
    } else {
      voce.coltura = risolviColturaConSinonimi(t.coltura);
      // «ortaggi / orto / verdure» è la categoria Ortive, non una coltura:
      // coltura resta vuota (lo schema di salvataggio rifiuta le categorie).
      if (!voce.coltura && categoriaOrtiveDaTesto(t.coltura)) {
        voce.categoria = CATEGORIA_ORTIVE;
      }
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
 * «Noci» / «Noce» non è il quinto terreno se l'utente ha detto «si chiama pozzo».
 * Si toglie prima del limite, altrimenti il fantasma occupa lo slot e Pozzo sparisce.
 * @param {object[]} lista
 * @param {string} domanda
 */
function scartaFantasmaColtura(lista, domanda) {
  const misure = typeof domanda === "string" ? misureNellaDomanda(domanda) : [];
  if (misure.length !== 1 || !Array.isArray(lista)) return lista;
  const sup = misure[0].superficie;
  const parola = chiaveNome(misure[0].parola || "");
  const esplicito = chiaveNome(nomeEsplicitoNellaFrase(domanda));
  const stessa = lista.filter(function (t) {
    return t && superficieGrezza(t) === sup;
  });
  if (stessa.length < 2) return lista;
  return lista.filter(function (t) {
    if (!t || superficieGrezza(t) !== sup) return true;
    const nome = chiaveNome(nomeTerrenoVisibile(t.nome));
    if (!nome) return true;
    if (esplicito && nome === esplicito) return true;
    if (parola && nome === parola) return false;
    const col = chiaveNome(t.coltura || "");
    if (esplicito && col && nome === col) return false;
    return true;
  });
}

/**
 * Estrae dalla domanda i numeri seguiti da ha / ettar…
 * @param {string} domanda
 * @returns {number[]}
 */
function superficieDaDomanda(domanda) {
  const s = String(domanda || "");
  const re = /(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettar|etari\b)/gi;
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
function stessoAppezzamento(modello, detto) {
  const a = chiaveNome(modello);
  const b = chiaveNome(detto);
  if (!a || !b) return !a;
  if (a === b) return true;
  return a.startsWith(b + " ") || b.startsWith(a + " ");
}

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
  const detto = nomeEsplicitoNellaFrase(domanda);
  const nome = nomeTerrenoVisibile(t.nome);
  if (detto && nome && !stessoAppezzamento(nome, detto)) return dati;
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

var PAROLE_NEL_NOME = Object.freeze([
  "vecchio",
  "vecchia",
  "nuovo",
  "nuova",
  "grande",
  "piccolo",
  "piccola",
  "alto",
  "alta",
  "basso",
  "bassa",
  "lungo",
  "lunga",
  "primo",
  "prima",
  "secondo",
  "seconda"
]);

function restaNelNome(parola) {
  return PAROLE_NEL_NOME.indexOf(String(parola || "").toLowerCase()) >= 0;
}

function inizialeMaiuscolaIt(s) {
  const t = String(s || "");
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase("it") + t.slice(1);
}

function staccaVarietaDalNome(prima) {
  const parole = String(prima || "")
    .split(/\s+/)
    .filter(Boolean);
  if (parole.length < 2) return { nome: parole.join(" "), varieta: "" };
  const ultima = parole[parole.length - 1];
  if (restaNelNome(ultima)) return { nome: parole.join(" "), varieta: "" };
  if (eRumoreParlatoNome(ultima)) {
    return { nome: togliConnettiviFinaliNome(parole.join(" ")), varieta: "" };
  }
  return { nome: parole.slice(0, -1).join(" "), varieta: ultima };
}

function eCategoriaColtura(parola) {
  const k = chiaveNome(parola);
  if (!k) return false;
  for (let i = 0; i < CATEGORIE_COLTURE_PREDEFINITE.length; i++) {
    if (chiaveNome(CATEGORIE_COLTURE_PREDEFINITE[i].nome) === k) return true;
  }
  return false;
}

/**
 * Misure dette dall'utente: «3 ha di trebbiano» e anche «12 di seminativo».
 * @param {string} domanda
 * @returns {Array<{ superficie: number, parola: string }>}
 */
/**
 * Prima parola utile dopo ha/ettari, saltando «e cè del», «ed è», ecc.
 * @param {string} frase
 * @param {RegExpExecArray} matchHa
 * @returns {string}
 */
function varietaDopoUnita(frase, matchHa) {
  if (!matchHa || matchHa.index == null) return "";
  const coda = String(frase || "").slice(matchHa.index + matchHa[0].length);
  const parole = coda.match(/[A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*/g) || [];
  for (let i = 0; i < parole.length; i++) {
    if (!eRumoreParlatoNome(parole[i])) return parole[i];
  }
  return "";
}

function misureNellaDomanda(domanda) {
  const frase = String(domanda || "");
  const out = [];
  if (sembraIndirizzo(frase)) return out;
  const reHa = /(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettari\b|ettaro\b)/gi;
  let m;
  while ((m = reHa.exec(frase)) !== null) {
    let parola = varietaDopoUnita(frase, m);
    if (!parola) {
      const prima = frase.slice(0, m.index);
      const staccata = staccaVarietaDalNome(
        togliConnettiviFinaliNome(
          prima.replace(/^[\s:,\-–—.?!]+|[\s:,\-–—.?!]+$/g, "").trim()
        )
      );
      parola = staccata.varieta && !eRumoreParlatoNome(staccata.varieta) ? staccata.varieta : "";
    }
    out.push({
      superficie: Number(String(m[1]).replace(",", ".")),
      parola: parola
    });
  }
  if (out.length) return out;
  const reDi =
    /(\d+(?:[.,]\d+)?)\s+di\s+([A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)/gi;
  while ((m = reDi.exec(frase)) !== null) {
    const parola = String(m[2] || "");
    if (eRumoreParlatoNome(parola)) continue;
    out.push({
      superficie: Number(String(m[1]).replace(",", ".")),
      parola: parola
    });
  }
  if (out.length) return out;
  // «5 faenza»: civico+comune, non ettari. Solo se la parola è coltura/categoria nota.
  const reNudo =
    /(\d+(?:[.,]\d+)?)\s+(?!ha\b|ettari?\b|ettaro\b|di\b)([A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)/gi;
  while ((m = reNudo.exec(frase)) !== null) {
    const parola = String(m[2] || "");
    if (
      !parola ||
      eRumoreParlatoNome(parola) ||
      (!risolviColturaConSinonimi(parola) && !eCategoriaColtura(parola))
    ) {
      continue;
    }
    out.push({
      superficie: Number(String(m[1]).replace(",", ".")),
      parola: parola
    });
  }
  return out;
}

/**
 * Nome detto prima degli ettari, o con «si chiama». La varietà dopo «di» no.
 * @param {string} frase
 * @returns {string}
 */
/**
 * Ferma il capture di «si chiama X…» prima di «N ha / N ettari / N di …».
 * @param {string} grezzo
 * @returns {string}
 */
function troncaNomePrimaDiMisura(grezzo) {
  const t = String(grezzo || "");
  if (!t) return "";
  const m = t.match(
    /(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettari\b|ettaro\b)|(\d+(?:[.,]\d+)?)\s+di\s+/i
  );
  if (!m || m.index == null) return t.trim();
  return t.slice(0, m.index).trim();
}

function nomeEsplicitoNellaFrase(frase) {
  const s = String(frase || "");
  if (sembraIndirizzo(s)) return "";
  const chiama = s.match(new RegExp(RE_SI_CHIAMA.source + "([^,.]*)", "i"));
  if (chiama) {
    const grezzo = troncaNomePrimaDiMisura(chiama[1]);
    const pulito = togliConnettiviFinaliNome(
      String(grezzo || "")
        .replace(/^(?:ho|ci sono|c'è|cè|ce)\s+/i, "")
        .replace(/^(?:un|uno|una|il|lo|la|i|gli|le)\s+/i, "")
        .replace(/^(?:terreno|appezzamento)\s+/i, "")
        .replace(/^[\s:,\-–—]+|[\s:,\-–—.?!]+$/g, "")
        .trim()
    );
    if (pulito && !eRumoreParlatoNome(pulito)) return nomeTerrenoVisibile(pulito);
  }
  const ha = s.match(
    /(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettari?\b)|(\d+(?:[.,]\d+)?)\s+di\s+|(?<![A-Za-zÀ-ÖØ-öø-ÿ])(\d+(?:[.,]\d+)?)\s+(?!ha\b|ettari?\b|ettaro\b|di\b)[A-Za-zÀ-ÖØ-öø-ÿ]/i
  );
  if (!ha) return "";
  // Match nudo (gruppo 3): solo se la parola dopo è coltura nota, altrimenti è un civico.
  if (ha[3] != null && ha[0] && !/\b(?:ha\b|ettari?\b)|\s+di\s+/i.test(ha[0])) {
    const dopo = s.slice(ha.index).match(
      /^\d+(?:[.,]\d+)?\s+([A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)/i
    );
    const parola = dopo && dopo[1] ? dopo[1] : "";
    if (!risolviColturaConSinonimi(parola) && !eCategoriaColtura(parola)) return "";
  }
  let prima = s.slice(0, ha.index);
  prima = prima.replace(/^(?:ho|ci sono|c'è|cè|ce)\s+/i, "");
  prima = prima.replace(/^(?:un|uno|una|il|lo|la|i|gli|le)\s+/i, "");
  prima = prima.replace(/^(?:terreno|appezzamento)\s+/i, "");
  prima = prima.replace(/^[\s:,\-–—]+|[\s:,\-–—.?!]+$/g, "").trim();
  prima = togliConnettiviFinaliNome(prima);
  prima = nomeTerrenoVisibile(prima);
  if (!prima || eRumoreParlatoNome(prima)) return "";
  return staccaVarietaDalNome(prima).nome;
}

/**
 * Senza un nome esplicito il nome del modello non vale: si chiede dopo.
 * «si chiama Vigna Alta» e «quercione 4 ha» restano. Il client applica la stessa regola.
 * @param {string} domanda
 * @param {{ terreni?: object[] }|null} dati
 */
function applicaNomeTerrenoDaDomanda(domanda, dati) {
  if (!dati || typeof dati !== "object") return dati;
  const terreni = Array.isArray(dati.terreni) ? dati.terreni : null;
  if (!terreni || !terreni.length) return dati;
  const frase = String(domanda || "");
  const nomeEsplicito = nomeEsplicitoNellaFrase(frase);
  const misure = misureNellaDomanda(frase);
  const terreniVisibili = terreni.map(function (t) {
    if (!t || typeof t !== "object") return t;
    const nome = nomeTerrenoVisibile(t.nome);
    const voce = Object.assign({}, t, { nome: nome || null });
    if (voce.coltura && eRumoreParlatoNome(voce.coltura)) voce.coltura = null;
    return voce;
  });
  if (!misure.length) {
    // Risposta breve al «Come si chiama…?»: applica il nome anche senza ettari (regola e).
    const s = frase.trim();
    const breve =
      s &&
      [...s].length <= 80 &&
      !domandaNomeSenzaRisposta(s) &&
      !/\d/.test(s) &&
      !/\b(ha\b|ettar|podere|poderi|riepilogo|coltura)\b/i.test(s) &&
      !/^(no|nope|sì|si|basta|fatto|niente|boh|mah|bo)\b/i.test(s) &&
      !/\b(non so|non lo so|non mi ricordo|non ricordo)\b/i.test(s);
    const nomeBreve = breve
      ? nomeEsplicito || nomeTerrenoVisibile(togliConnettiviFinaliNome(s))
      : "";
    if (nomeBreve && !eRumoreParlatoNome(nomeBreve)) {
      const pendenti = terreniVisibili.filter(function (t) {
        return (
          t &&
          !nomeTerrenoVisibile(t.nome) &&
          (typeof t.superficie === "number" || String(t.coltura || "").trim())
        );
      });
      let target = pendenti.length === 1 ? pendenti[0] : null;
      if (!target && pendenti.length > 1) {
        const k = chiaveNome(nomeBreve);
        const match = pendenti.filter(function (t) {
          return chiaveNome(t.coltura || "") === k;
        });
        if (match.length === 1) target = match[0];
      }
      if (target) {
        const outT = terreniVisibili.map(function (t) {
          if (t !== target) return t;
          return Object.assign({}, t, { nome: nomeBreve });
        });
        return Object.assign({}, dati, { terreni: outT });
      }
    }
    return Object.assign({}, dati, { terreni: terreniVisibili });
  }
  const outT = terreniVisibili.map(function (t, indice) {
    if (!t || typeof t !== "object") return t;
    let misura = misure.find(function (v) {
      return typeof t.superficie === "number" && v.superficie === t.superficie;
    });
    if (!misura && misure.length === terreni.length) misura = misure[indice];
    if (!misura) return t;
    const copia = Object.assign({}, t);
    if (nomeEsplicito && terreni.length === 1) {
      const modello = nomeTerrenoVisibile(t.nome);
      const fantasma =
        modello &&
        !stessoAppezzamento(modello, nomeEsplicito) &&
        (chiaveNome(modello) === chiaveNome(misura && misura.parola) ||
          chiaveNome(modello) === chiaveNome(t.coltura || ""));
      if (modello && !stessoAppezzamento(modello, nomeEsplicito) && !fantasma) return t;
      copia.nome =
        modello && chiaveNome(modello) === chiaveNome(nomeEsplicito)
          ? modello
          : nomeEsplicito;
    } else if (!nomeEsplicito) copia.nome = null;
    else if (
      nomeEsplicito &&
      stessoAppezzamento(nomeTerrenoVisibile(copia.nome), nomeEsplicito) &&
      chiaveNome(copia.nome) !== chiaveNome(nomeEsplicito)
    ) {
      copia.nome = nomeEsplicito;
    }
    if (
      (copia.coltura == null || copia.coltura === "") &&
      misura &&
      misura.parola &&
      !eRumoreParlatoNome(misura.parola)
    ) {
      if (eCategoriaColtura(misura.parola)) {
        copia.categoria = copia.categoria || misura.parola;
      } else {
        const canon = risolviColturaConSinonimi(misura.parola);
        if (canon) copia.coltura = canon;
        else if (domandaTerrenoEsplicita(frase)) {
          // Varietà libera solo con ha/di («3 ha di sangiovese»), non da civico+comune.
          copia.coltura = inizialeMaiuscolaIt(misura.parola);
        }
      }
    }
    return copia;
  });
  const copiaDati = Object.assign({}, dati, { terreni: outT });
  if (
    outT.some(function (t) {
      return t && !nomeTerrenoVisibile(t.nome) && t.coltura;
    })
  ) {
    copiaDati.nomeTerrenoMancante = true;
  }
  return copiaDati;
}

function testoSeMancaNomeTerreno(testo, dati) {
  const terreni = dati && Array.isArray(dati.terreni) ? dati.terreni : [];
  const mancaNome = terreni.some(function (t) {
    return t && !nomeTerrenoVisibile(t.nome) && (t.coltura || typeof t.superficie === "number");
  });
  const completo = terreni.some(function (t) {
    return t && nomeTerrenoVisibile(t.nome) && String(t.coltura || "").trim();
  });
  if (!mancaNome && completo) {
    return String(testo || "")
      .split(/(?<=[.!?])\s+/)
      .filter(function (p) {
        if (/che cosa ci coltivi|cosa ci coltivi|quale coltura/i.test(p)) return false;
        if (/\b(come si chiama|come si chiamano|qual\s*è il nome|che nome)\b/i.test(p)) return false;
        return true;
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!dati || dati.nomeTerrenoMancante !== true) return testo;
  const t = (Array.isArray(dati.terreni) ? dati.terreni : []).find(function (x) {
    return x && !nomeTerrenoVisibile(x.nome) && x.coltura;
  });
  if (!t) return testo;
  if (!t.coltura && /che cosa ci coltivi|cosa ci coltivi|quale coltura/i.test(String(testo || ""))) {
    return testo;
  }
  const n = t && typeof t.superficie === "number" ? t.superficie : null;
  const ett = n == null ? "" : String(n).replace(".", ",") + (n === 1 ? " ettaro" : " ettari");
  const col = t && t.coltura ? String(t.coltura) : "";
  const desc = ett && col ? ett + " di " + col : ett || col;
  return desc
    ? "Come si chiama il terreno da " + desc + "?"
    : "Come si chiama questo terreno?";
}

const CONTEGGIO_IN_PAROLE = Object.freeze({
  un: 1,
  uno: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5
});

const CONTEGGIO_IN_LETTERE = Object.freeze({
  1: "uno",
  2: "due",
  3: "tre",
  4: "quattro",
  5: "cinque"
});

/**
 * N = nomi già raccolti + nomi nuovi di questo turno (dopo il limite).
 * Il conteggio di serializzaRaccolti include il terreno senza nome: il nome
 * che lo completa è un nome nuovo rispetto all'elenco, ma non si somma
 * anche al conteggio (sarebbe un terreno in più).
 * @param {string} raccolti
 * @param {object[]} terreniTurno
 * @returns {number}
 */
function contaTerreniConNomeDopoTurno(raccolti, terreniTurno) {
  const info = terreniDaRaccolti(raccolti);
  const noti = Object.create(null);
  const nomi = Array.isArray(info.nomi) ? info.nomi : [];
  for (let i = 0; i < nomi.length; i++) {
    const k = nomeSenzaPrefissoPodere(nomi[i]);
    if (k) noti[k] = true;
  }
  let nuovi = 0;
  const visti = Object.create(null);
  const lista = Array.isArray(terreniTurno) ? terreniTurno : [];
  for (let i = 0; i < lista.length; i++) {
    const nome = nomeTerrenoVisibile(lista[i] && lista[i].nome);
    if (!nome) continue;
    const k = nomeSenzaPrefissoPodere(nome);
    if (!k || noti[k] || visti[k]) continue;
    visti[k] = true;
    nuovi += 1;
  }
  return nomi.length + nuovi;
}

function riscriviConteggioTerreni(testo, n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return String(testo || "");
  return String(testo || "").replace(
    /\b(ne hai)\s+(\d+|un|uno|due|tre|quattro|cinque)\s+su\s+(5|cinque)(\s+terreni)?\b/gi,
    function (tutto, neHai, detto, den, terreni) {
      const lettere = !/^\d+$/.test(detto);
      const valore = lettere
        ? CONTEGGIO_IN_PAROLE[String(detto).toLowerCase()]
        : Number(detto);
      if (valore === n) return tutto;
      const nuovo = lettere ? CONTEGGIO_IN_LETTERE[n] || String(n) : String(n);
      return neHai + " " + nuovo + " su " + den + (terreni || "");
    }
  );
}

/** «Raggiunto il limite» con meno di 5 terreni con nome: non è il quinto. */
function togliLimiteNonRaggiunto(testo, n) {
  if (typeof n !== "number" || n >= 5) return String(testo || "");
  const originale = String(testo || "");
  const avvisoProspettico = /arrivi a\s+(?:5|cinque)\s+terreni/i.test(originale);
  const giaConteggio =
    /\bne hai\s+(?:\d+|un|uno|due|tre|quattro|cinque)\s+su\s+(?:5|cinque)\b/i.test(
      originale
    );
  let tolto = false;
  let messoConteggio = false;
  const pezzi = originale.split(/(?<=[.!?])\s+/);
  const filtrati = [];
  for (let i = 0; i < pezzi.length; i++) {
    const p = pezzi[i];
    if (/raggiunto il limite/i.test(p)) {
      tolto = true;
      if (!giaConteggio && !messoConteggio) {
        const parola = CONTEGGIO_IN_LETTERE[n] || String(n);
        filtrati.push("Ne hai " + parola + " su cinque terreni.");
        messoConteggio = true;
      }
      continue;
    }
    if (
      !avvisoProspettico &&
      /passando al Base/i.test(p) &&
      /raggiunto il limite/i.test(originale)
    ) {
      tolto = true;
      continue;
    }
    filtrati.push(p);
  }
  let s = filtrati.join(" ").replace(/\s+/g, " ").trim();
  if (tolto && !/ne hai altri o vediamo il riepilogo/i.test(s)) {
    if (s && !/[.!?]$/.test(s)) s += ".";
    s = (s ? s + " " : "") + "Ne hai altri o vediamo il riepilogo?";
  }
  return s;
}

/** Invito a creare l'account. Non basta «clicca», «accedere all'app» o email+password. */
function fraseInvitoRegistrazione(p) {
  return (
    /crea(?:re|i|te)?(?:\s+\S+){0,4}\s+account/i.test(p) ||
    /\bregistr\w*/i.test(p) ||
    /\biscriv\w*/i.test(p)
  );
}

function togliInvitoRegistrazioneAccount(testo, n) {
  const originale = String(testo || "").trim();
  if (!originale) return originale;
  let tolto = false;
  const filtrati = originale.split(/(?<=[.!?])\s+/).filter(function (p) {
    if (!fraseInvitoRegistrazione(p)) return true;
    tolto = true;
    return false;
  });
  let s = filtrati.join(" ").replace(/\s+/g, " ").trim();
  if (tolto && !s) {
    s =
      typeof n === "number" && n >= 5
        ? "Il riepilogo è qui sotto: controllalo e premi «Sì, salva»."
        : "Ne hai altri o vediamo il riepilogo?";
  }
  return s;
}

/** Stesso testo del client (allineaConteggioTerreni): voce e chat coincidono. */
function allineaTestoTurnoAccount(testo, n) {
  return togliInvitoRegistrazioneAccount(
    togliLimiteNonRaggiunto(riscriviConteggioTerreni(testo, n), n),
    n
  );
}

const TESTO_LIMITE_CINQUE =
  "Hai raggiunto il limite di cinque terreni. Controlliamo il riepilogo.";

const ETTARI_IN_LETTERE = Object.freeze({
  1: "un",
  2: "due",
  3: "tre",
  4: "quattro",
  5: "cinque",
  6: "sei",
  7: "sette",
  8: "otto",
  9: "nove",
  10: "dieci",
  11: "undici",
  12: "dodici",
  13: "tredici",
  14: "quattordici",
  15: "quindici",
  16: "sedici",
  17: "diciassette",
  18: "diciotto",
  19: "diciannove",
  20: "venti"
});

function ettariInLettere(n) {
  if (n === 1) return "un ettaro";
  if (Number.isInteger(n) && ETTARI_IN_LETTERE[n]) return ETTARI_IN_LETTERE[n] + " ettari";
  return String(n).replace(".", ",") + " ettari";
}

function fraseConfermaTerreno(t, k) {
  const nome = nomeTerrenoVisibile(t.nome);
  const col = String(t.coltura || "").trim();
  const testa =
    "Il terreno si chiama " +
    nome +
    ", ha " +
    ettariInLettere(t.superficie) +
    " e ci coltivi " +
    col +
    ".";
  if (k >= LIMITI.MAX_TERRENI_PER_RICHIESTA) return testa + " " + TESTO_LIMITE_CINQUE;
  const parola = CONTEGGIO_IN_LETTERE[k] || String(k);
  return (
    testa +
    " Ne hai " +
    parola +
    " su cinque terreni. Ne hai altri o vediamo il riepilogo?"
  );
}

function colturaSenzaNomeInRaccolti(raccolti, superficie) {
  const s = String(raccolti || "");
  const re =
    /Terreno senza nome[^\n]*,\s*(\d+(?:[.,]\d+)?)\s*ha,\s*coltura\s+([^,\n]+)/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = Number(String(m[1]).replace(",", "."));
    if (n === superficie) return String(m[2] || "").trim();
  }
  return "";
}

/**
 * Turno account con terreno completo e testo vuoto (o svuotato): la conferma
 * è deterministica, così il biglietto voce si firma su questo testo.
 * @param {string} testo
 * @param {object|null} dati
 * @param {string} raccolti
 * @returns {string}
 */
function confermaTerrenoSeTestoVuoto(testo, dati, raccolti) {
  if (String(testo || "").trim()) return String(testo || "");
  const lista = dati && Array.isArray(dati.terreni) ? dati.terreni : [];
  if (!lista.length) return "";
  const info = terreniDaRaccolti(raccolti);
  const noti = Object.create(null);
  const nomi = Array.isArray(info.nomi) ? info.nomi : [];
  for (let i = 0; i < nomi.length; i++) {
    const k = nomeSenzaPrefissoPodere(nomi[i]);
    if (k) noti[k] = true;
  }
  function completo(t) {
    return !!(
      t &&
      nomeTerrenoVisibile(t.nome) &&
      typeof t.superficie === "number" &&
      (String(t.coltura || "").trim() || colturaSenzaNomeInRaccolti(raccolti, t.superficie))
    );
  }
  const completi = lista.filter(completo);
  const nuovi = completi.filter(function (t) {
    const k = nomeSenzaPrefissoPodere(nomeTerrenoVisibile(t.nome));
    return k && !noti[k];
  });
  const bersaglio = nuovi.length
    ? nuovi[nuovi.length - 1]
    : completi.length === 1
      ? completi[0]
      : null;
  if (!bersaglio) return "";
  if (!String(bersaglio.coltura || "").trim()) {
    bersaglio.coltura = colturaSenzaNomeInRaccolti(raccolti, bersaglio.superficie);
  }
  if (!String(bersaglio.coltura || "").trim()) return "";
  const k = contaTerreniConNomeDopoTurno(raccolti, lista);
  return fraseConfermaTerreno(bersaglio, k);
}

/**
 * Dopo nome, ettari e coltura definitivi. Non lascia un ok con testo vuoto
 * se il turno ha completato un terreno.
 * @param {string} testo
 * @param {object|null} dati
 * @param {string} [raccolti]
 * @returns {string}
 */
function chiudiTestoAccount(testo, dati, raccolti) {
  const dopoNome = testoSeMancaNomeTerreno(testo, dati);
  return confermaTerrenoSeTestoVuoto(dopoNome, dati, raccolti || "");
}

function togliRiepilogoNonChiesto(testo) {
  return String(testo || "")
    .split(/(?<=[.!?])\s+/)
    .filter(function (p) {
      if (!/riepilogo/i.test(p)) return true;
      return /ne hai altri/i.test(p);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function correggiUnoNelTesto(testo) {
  return String(testo || "").replace(
    /\buno\b(?=\s+(?:terren|poder|modul|ettar))/gi,
    "un"
  );
}

/**
 * @param {string} testoJson
 * @param {{ raccolti?: string }} [opzioni]
 * @returns {{ testo: string, dati: object|null, troppiTerreni?: boolean, fuoriTema?: boolean }}
 */
function parseJsonAccount(testoJson) {
  const grezzo = String(testoJson || "").trim();
  if (!grezzo) return null;
  try {
    const parsed = JSON.parse(grezzo);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch (_e) {
    const i = grezzo.indexOf("{");
    const j = grezzo.lastIndexOf("}");
    if (i < 0 || j <= i) return null;
    try {
      const parsed = JSON.parse(grezzo.slice(i, j + 1));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed;
    } catch (_e2) {
      return null;
    }
  }
}

function rispostaAccountDaTesto(testoJson, opzioni) {
  const parsed = parseJsonAccount(testoJson);
  if (!parsed) {
    return { testo: TESTO_RIPIEGO, dati: null, ripiego: true, jsonOk: false };
  }

  let testo = typeof parsed.testo === "string" ? parsed.testo.trim() : "";
  const domanda =
    opzioni && typeof opzioni === "object" && typeof opzioni.domanda === "string"
      ? opzioni.domanda
      : "";
  const testoMancante = !testo;
  if (testoMancante) testo = TESTO_RIPIEGO;
  testo = correggiUnoNelTesto(testo);
  if (/salvat|registrat/i.test(testo)) {
    const chiedeChiusuraTesto = /riepilogo|basta|ho finito|^fatto\b/i.test(
      String(domanda || "").trim()
    );
    if (!String(domanda || "").trim() || chiedeChiusuraTesto) {
      testo = "Ecco il riepilogo: controlla e conferma";
    } else {
      testo = testo
        .replace(/[^.?!]*(?:salvat\w*|registrat\w*)[^.?!]*[.?!]?/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (/ecco il riepilogo/i.test(testo)) testo = "";
    }
  }
  const chiedeChiusuraPrecoce = /riepilogo|basta|ho finito|^fatto\b/i.test(
    String(domanda || "").trim()
  );
  if (String(domanda || "").trim() && !chiedeChiusuraPrecoce) {
    testo = togliRiepilogoNonChiesto(testo);
  }

  let sede = pulisciSede(parsed.sede);
  let poderiRisposta = pulisciPoderi(parsed.poderi);
  const raccolti = raccoltiDaOpzioni(opzioni);
  const argomento =
    opzioni && typeof opzioni === "object" && typeof opzioni.argomento === "string"
      ? opzioni.argomento
      : "";
  const sedeDetta = argomento === "sede" && sembraSedeDetta(domanda);
  if (sedeDetta && sembraPodereComeIndirizzo(domanda)) {
    poderiRisposta = [];
  }
  if (sedeDetta && !sedeHaQualcosa(sede)) {
    const dedotta = pulisciSede(sedeDaTesto(domanda));
    if (dedotta) sede = dedotta;
  }
  const poderi = unisciPoderi(poderiRisposta, poderiDaRaccolti(raccolti));
  // Testo già consumato come sede/podere: mai terreni (né civico→ettari).
  const bloccaTerreni =
    sembraIndirizzo(domanda) ||
    ((argomento === "sede" || argomento === "poderi") &&
      !domandaTerrenoEsplicita(domanda));
  const grezziTerreni = bloccaTerreni
    ? []
    : (Array.isArray(parsed.terreni) ? parsed.terreni : []).filter(function (t) {
        return !(t && nomeSembraIndirizzo(t.nome));
      });
  const puliti = pulisciTerreni(grezziTerreni, terreniDaRaccolti(raccolti), domanda);
  const terreni = collegaTerreniAiPoderiServer(poderi, puliti.terreni);
  if (argomento === "sede") {
    testo = togliDomandaCapProvincia(testo);
  }
  if (argomento === "terreni") {
    testo = togliRiaperturaPoderi(testo);
  } else if (
    poderi.length <= 1 &&
    /\b(in|a)?\s*(quale|che)\s+podere\b/i.test(testo)
  ) {
    testo = togliDomandaPodere(testo);
  }
  if (testoMancante && puliti.terreni.length) testo = "";
  const chiedeChiusura = /riepilogo|basta|ho finito|^fatto\b/i.test(String(domanda || "").trim());
  const soloConteggioTerreni = messaggioSoloConteggioTerreni(domanda);
  const staDettando =
    !chiedeChiusura &&
    !soloConteggioTerreni &&
    (/(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettari?\b|di\b)/i.test(String(domanda || "")) ||
      /(\d+(?:[.,]\d+)?)\s+(?!ha\b|ettari?\b|ettaro\b|di\b)[A-Za-zÀ-ÖØ-öø-ÿ]/i.test(
        String(domanda || "")
      ));
  let fatto = parsed.fatto === true && !staDettando && !soloConteggioTerreni;
  if (soloConteggioTerreni) {
    fatto = false;
    const nDetto = numeroTerreniDetto(domanda);
    const nGia = terreniDaRaccolti(raccolti).conteggio;
    const pezzi = [];
    if (nDetto != null && nDetto > LIMITI.MAX_TERRENI_PER_RICHIESTA) {
      pezzi.push(
        "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi."
      );
    }
    if (nGia <= 0) {
      pezzi.push(
        "Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?"
      );
    } else if (nGia < LIMITI.MAX_TERRENI_PER_RICHIESTA) {
      pezzi.push("Ne hai altri o vediamo il riepilogo?");
    }
    testo = pezzi.join(" ");
  }
  const fuoriTema = parsed.fuoriTema === true;
  const nConNome = contaTerreniConNomeDopoTurno(raccolti, puliti.terreni);
  testo = allineaTestoTurnoAccount(testo, nConNome);
  const attendeCivico = argomento === "sede" && sedeRaccoltaSenzaCivico(raccolti);
  if (attendeCivico && !domandaTerrenoEsplicita(domanda)) {
    const portato = indirizzoPortatoDalCivico(domanda);
    if (messaggioSaltaCivico(domanda)) {
      sede = null;
      poderiRisposta = [];
      testo = DOMANDA_PODERI_ACCOUNT;
    } else if (portato) {
      const precedente = sedeDaRigaRaccolti(raccolti) || {};
      sede = pulisciSede({
        indirizzo: portato,
        citta: precedente.citta || (sede && sede.citta) || null,
        cap: precedente.cap || (sede && sede.cap) || null,
        provincia: precedente.provincia || (sede && sede.provincia) || null
      });
      poderiRisposta = [];
      testo = DOMANDA_PODERI_ACCOUNT;
    } else {
      sede = null;
      poderiRisposta = [];
      testo = DOMANDA_CIVICO_FACOLTATIVA;
    }
  } else if (sedeDetta) {
    if (testoRifiutaSedeAccettata(testo) && /\d/.test(domanda)) {
      testo = "Hai dei poderi?";
    }
    if (!/\d/.test(domanda)) testo = DOMANDA_CIVICO_FACOLTATIVA;
  }

  return {
    testo: testo,
    dati: {
      sede: sede,
      poderi: poderiRisposta,
      terreni: terreni,
      fatto: fatto,
      fuoriTema: fuoriTema
    },
    troppiTerreni: puliti.troppiTerreni,
    fuoriTema: fuoriTema,
    ripiego: false,
    jsonOk: true
  };
}

module.exports = {
  SCHEMA_RISPOSTA_ACCOUNT,
  promptSistemaAccount,
  rispostaAccountDaTesto,
  parseJsonAccount,
  regoleTenute,
  PREFISSI_ESCLUSI,
  TESTO_RIPIEGO,
  pulisciSede,
  pulisciPoderi,
  pulisciTerreni,
  terreniDaRaccolti,
  categoriaOrtiveDaTesto,
  CATEGORIA_ORTIVE,
  nomeSenzaPrefissoPodere,
  risolviColturaConSinonimi,
  correggiUnoNelTesto,
  SINONIMI_COLTURA,
  superficieDaDomanda,
  applicaSuperficieDaDomanda,
  applicaNomeTerrenoDaDomanda,
  testoSeMancaNomeTerreno,
  chiudiTestoAccount,
  normalizzaDecimaliPerGemini,
  collegaTerreniAiPoderiServer,
  corrispondeNomePodere,
  poderiDaRaccolti,
  togliDomandaPodere,
  togliRiaperturaPoderi,
  togliDomandaCapProvincia,
  sembraIndirizzo,
  nomeSembraIndirizzo,
  domandaTerrenoEsplicita,
  messaggioSoloConteggioTerreni,
  numeroTerreniDetto,
  RE_SI_CHIAMA,
  togliConnettiviFinaliNome,
  troncaNomePrimaDiMisura,
  nomeTerrenoVisibile
};
