// FILE GENERATO da functions/lib/tony-landing-setup-core.js: non modificare a mano.
// Per rigenerarlo: node landing/scripts/genera-setup-core-landing.mjs

/**
 * Controlli dei dati che il visitatore conferma sulla landing
 * (sede legale, poderi, terreni) prima di salvarli nell'azienda.
 *
 * Modulo puro: non legge e non scrive il database, non fa rete,
 * non registra log. L'unico collegamento è l'elenco colture generato.
 *
 * Lo userà functions/tony-landing-setup.js nel passo 8 e, se servirà,
 * la scheda «Confermi?» nel passo 14.
 * Brief v4.2, sezione 8 (8.2.2, 8.3.4–8.3.6, 8.4.2–8.4.4).
 */

const COLTURE_PREDEFINITE = Object.freeze([
  Object.freeze({ nome: "Pesco", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Melo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Pero", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Albicocche", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Prugne", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Ciliegio", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Susino", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Fico", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Nocciolo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Mandorlo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Castagno", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Cotogno", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Sorbo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Nespolo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Giuggiolo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Corbezzolo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Gelso", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Mora", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Lampone", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Mirtillo", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Ribes", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Uva Spina", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Kiwi", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Melograno", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Fico d'India", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Kaki", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Noce", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Pistacchio", categoriaCodice: "frutteto" }),
  Object.freeze({ nome: "Grano", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Mais", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Orzo", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Favino", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Girasole", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Soia", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Colza", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Avena", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Segale", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Fava", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Lenticchia", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Cece", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Lupino", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Cicerchia", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Riso", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Grano Saraceno", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Amaranto", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Quinoa", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Canapa", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Lino", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Carthamo", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Erba Medica", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Trifoglio", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Veccia", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Lupinella", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Sulla", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Sorgo", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Miglio", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Panico", categoriaCodice: "seminativo" }),
  Object.freeze({ nome: "Vite", categoriaCodice: "vite" }),
  Object.freeze({ nome: "Vite da Tavola", categoriaCodice: "vite" }),
  Object.freeze({ nome: "Vite da Vino", categoriaCodice: "vite" }),
  Object.freeze({ nome: "Pomodoro", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Zucchine", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Melanzane", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Peperoni", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Insalata", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Carote", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Patate", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Bietole", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Fragole", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Cipolle", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Aglio", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Fagioli", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Fagiolini", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Piselli", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Cavolo", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Broccoli", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Cavolfiore", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Spinaci", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Lattuga", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Radicchio", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Finocchi", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Sedano", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Cetrioli", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Angurie", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Meloni", categoriaCodice: "ortive" }),
  Object.freeze({ nome: "Prato", categoriaCodice: "prato" }),
  Object.freeze({ nome: "Prato Stabile", categoriaCodice: "prato" }),
  Object.freeze({ nome: "Pascolo", categoriaCodice: "prato" }),
  Object.freeze({ nome: "Olivo", categoriaCodice: "olivo" }),
  Object.freeze({ nome: "Arancio", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Limone", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Mandarino", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Clementine", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Pompelmo", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Bergamotto", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Cedro", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Lime", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Kumquat", categoriaCodice: "agrumeto" }),
  Object.freeze({ nome: "Bosco", categoriaCodice: "bosco" }),
]);

const CATEGORIE_COLTURE_PREDEFINITE = Object.freeze([
  Object.freeze({ nome: "Frutteto", codice: "frutteto" }),
  Object.freeze({ nome: "Seminativo", codice: "seminativo" }),
  Object.freeze({ nome: "Vite", codice: "vite" }),
  Object.freeze({ nome: "Ortive", codice: "ortive" }),
  Object.freeze({ nome: "Prato", codice: "prato" }),
  Object.freeze({ nome: "Olivo", codice: "olivo" }),
  Object.freeze({ nome: "Agrumeto", codice: "agrumeto" }),
  Object.freeze({ nome: "Bosco", codice: "bosco" }),
  Object.freeze({ nome: "Altro", codice: "altro_colture" }),
]);

const LIMITI = Object.freeze({
  REQUEST_ID_MIN: 8,
  REQUEST_ID_MAX: 64,
  INDIRIZZO_MIN: 3,
  INDIRIZZO_MAX: 120,
  CITTA_MIN: 2,
  CITTA_MAX: 80,
  NOME_PODERE_MIN: 1,
  NOME_PODERE_MAX: 60,
  NOME_TERRENO_MIN: 1,
  NOME_TERRENO_MAX: 60,
  COLTURA_MAX: 60,
  MAX_PODERI: 10,
  MAX_TERRENI_PER_RICHIESTA: 5,
  SUPERFICIE_MAX_HA: 1000,
  BYTE_MAX_RICHIESTA: 10240,
  MAX_ERRORI_RIPORTATI: 20
});

const ERRORI = Object.freeze({
  OBBLIGATORIO: "obbligatorio",
  DEVE_ESSERE_TESTO: "deve essere un testo",
  DEVE_ESSERE_NUMERO: "deve essere un numero",
  DEVE_ESSERE_OGGETTO: "deve essere un oggetto",
  DEVE_ESSERE_ELENCO: "deve essere un elenco",
  TROPPO_CORTO: "troppo corto",
  TROPPO_LUNGO: "troppo lungo",
  CARATTERI_NON_AMMESSI: "caratteri non ammessi",
  FORMATO_NON_VALIDO: "formato non valido",
  CHIAVE_NON_AMMESSA: "chiave non ammessa",
  NOME_RIPETUTO: "nome ripetuto",
  TROPPI_ELEMENTI: "troppi elementi",
  TROPPO_GRANDE: "troppo grande",
  MAGGIORE_DI_ZERO: "deve essere maggiore di 0",
  MASSIMO_1000: "deve essere al massimo 1000",
  TROPPO_PICCOLA: "troppo piccola",
  COLTURA_NON_TROVATA: "coltura non trovata",
  CATEGORIA_NON_COLTURA: "è una categoria, non una coltura",
  PODERE_NON_TROVATO: "podere non trovato",
  NOME_GIA_USATO: "nome già usato da un terreno dell'azienda",
  ALTRI_ERRORI: "altri errori"
});

const CARATTERI_VIETATI = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/;
const CHIAVE_SICURA = /^[A-Za-z0-9_]{1,40}$/;
const REQUEST_ID_OK = /^[A-Za-z0-9-]+$/;

function eOggettoSemplice(valore) {
  return valore !== null && typeof valore === "object" && !Array.isArray(valore);
}

function lunghezza(testo) {
  return [...testo].length;
}

function aggiungi(errori, campo, errore) {
  errori.push({ campo: campo, errore: errore });
}

function tagliaErrori(errori) {
  if (errori.length <= LIMITI.MAX_ERRORI_RIPORTATI) return errori.slice();
  const primi = errori.slice(0, LIMITI.MAX_ERRORI_RIPORTATI);
  primi.push({ campo: "(altri)", errore: ERRORI.ALTRI_ERRORI });
  return primi;
}

function esitoNonValido(campi) {
  return {
    ok: false,
    codice: "invalid-argument",
    motivo: "dati-non-validi",
    campi: campi
  };
}

/**
 * @param {unknown} valore
 * @returns {{ ok: true, valore: string } | { ok: false, errore: string }}
 */
function pulisciTesto(valore) {
  if (typeof valore !== "string") {
    return { ok: false, errore: ERRORI.DEVE_ESSERE_TESTO };
  }
  if (CARATTERI_VIETATI.test(valore)) {
    return { ok: false, errore: ERRORI.CARATTERI_NON_AMMESSI };
  }
  const pulito = valore.replace(/\u00A0/g, " ").trim().replace(/ {2,}/g, " ");
  return { ok: true, valore: pulito };
}

/**
 * Chiave per dire «è lo stesso nome».
 * Come normalizzaTesto del catalogo (trim, minuscolo, spazi singoli),
 * più lo spazio non separabile e gli apostrofi tipografici.
 * Gli accenti restano.
 * @param {unknown} valore
 * @returns {string}
 */
function chiaveNome(valore) {
  if (valore == null) return "";
  return String(valore)
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * @param {number} valore
 * @returns {number}
 */
function arrotondaSuperficie(valore) {
  return Math.round((valore + Number.EPSILON) * 100) / 100;
}

function segnalaChiaviExtra(oggetto, ammesse, prefisso, errori) {
  const consentite = Object.create(null);
  for (let i = 0; i < ammesse.length; i++) consentite[ammesse[i]] = true;
  const chiavi = Object.keys(oggetto);
  for (let i = 0; i < chiavi.length; i++) {
    const chiave = chiavi[i];
    if (consentite[chiave]) continue;
    const nome = CHIAVE_SICURA.test(chiave) ? chiave : "(chiave non ammessa)";
    aggiungi(errori, prefisso + nome, ERRORI.CHIAVE_NON_AMMESSA);
  }
}

/**
 * @param {unknown} valore
 * @param {{ obbligatorio?: boolean, min?: number, max?: number }} opts
 * @returns {{ errore: string|null, valore: string|null }}
 */
function normalizzaCampoTesto(valore, opts) {
  if (valore == null) {
    return {
      errore: opts.obbligatorio ? ERRORI.OBBLIGATORIO : null,
      valore: null
    };
  }
  const pulito = pulisciTesto(valore);
  if (!pulito.ok) return { errore: pulito.errore, valore: null };
  if (pulito.valore === "") {
    return {
      errore: opts.obbligatorio ? ERRORI.OBBLIGATORIO : null,
      valore: null
    };
  }
  const n = lunghezza(pulito.valore);
  if (opts.min != null && n < opts.min) {
    return { errore: ERRORI.TROPPO_CORTO, valore: pulito.valore };
  }
  if (opts.max != null && n > opts.max) {
    return { errore: ERRORI.TROPPO_LUNGO, valore: pulito.valore };
  }
  return { errore: null, valore: pulito.valore };
}

function validaRequestId(valore) {
  if (valore == null || valore === "") return { errore: ERRORI.OBBLIGATORIO, valore: null };
  if (typeof valore !== "string") return { errore: ERRORI.DEVE_ESSERE_TESTO, valore: null };
  if (!REQUEST_ID_OK.test(valore)) return { errore: ERRORI.FORMATO_NON_VALIDO, valore: null };
  const n = lunghezza(valore);
  if (n < LIMITI.REQUEST_ID_MIN) return { errore: ERRORI.TROPPO_CORTO, valore: null };
  if (n > LIMITI.REQUEST_ID_MAX) return { errore: ERRORI.TROPPO_LUNGO, valore: null };
  return { errore: null, valore: valore };
}

function validaCap(valore) {
  if (valore == null) return { errore: null, valore: null };
  const pulito = pulisciTesto(valore);
  if (!pulito.ok) return { errore: pulito.errore, valore: null };
  if (pulito.valore === "") return { errore: null, valore: null };
  if (!/^\d{5}$/.test(pulito.valore)) return { errore: ERRORI.FORMATO_NON_VALIDO, valore: null };
  return { errore: null, valore: pulito.valore };
}

function validaProvincia(valore) {
  if (valore == null) return { errore: null, valore: null };
  const pulito = pulisciTesto(valore);
  if (!pulito.ok) return { errore: pulito.errore, valore: null };
  if (pulito.valore === "") return { errore: null, valore: null };
  const maiuscola = pulito.valore.toUpperCase();
  const n = lunghezza(maiuscola);
  if (n < 2) return { errore: ERRORI.TROPPO_CORTO, valore: null };
  if (n > 2) return { errore: ERRORI.TROPPO_LUNGO, valore: null };
  if (!/^[A-Z]{2}$/.test(maiuscola)) return { errore: ERRORI.FORMATO_NON_VALIDO, valore: null };
  return { errore: null, valore: maiuscola };
}

function validaSuperficie(valore) {
  if (valore == null) return { ok: false, errore: ERRORI.OBBLIGATORIO };
  if (typeof valore !== "number" || !Number.isFinite(valore)) {
    return { ok: false, errore: ERRORI.DEVE_ESSERE_NUMERO };
  }
  if (valore <= 0) return { ok: false, errore: ERRORI.MAGGIORE_DI_ZERO };
  if (valore > LIMITI.SUPERFICIE_MAX_HA) return { ok: false, errore: ERRORI.MASSIMO_1000 };
  const arrotondata = arrotondaSuperficie(valore);
  if (arrotondata <= 0) return { ok: false, errore: ERRORI.TROPPO_PICCOLA };
  if (arrotondata > LIMITI.SUPERFICIE_MAX_HA) return { ok: false, errore: ERRORI.MASSIMO_1000 };
  return { ok: true, valore: arrotondata };
}

function validaSede(sede, errori) {
  if (sede == null) return null;
  if (!eOggettoSemplice(sede)) {
    aggiungi(errori, "sede", ERRORI.DEVE_ESSERE_OGGETTO);
    return null;
  }
  segnalaChiaviExtra(sede, ["indirizzo", "citta", "cap", "provincia"], "sede.", errori);
  const indirizzo = normalizzaCampoTesto(sede.indirizzo, {
    obbligatorio: true,
    min: LIMITI.INDIRIZZO_MIN,
    max: LIMITI.INDIRIZZO_MAX
  });
  const citta = normalizzaCampoTesto(sede.citta, {
    obbligatorio: true,
    min: LIMITI.CITTA_MIN,
    max: LIMITI.CITTA_MAX
  });
  const cap = validaCap(sede.cap);
  const provincia = validaProvincia(sede.provincia);
  if (indirizzo.errore) aggiungi(errori, "sede.indirizzo", indirizzo.errore);
  if (citta.errore) aggiungi(errori, "sede.citta", citta.errore);
  if (cap.errore) aggiungi(errori, "sede.cap", cap.errore);
  if (provincia.errore) aggiungi(errori, "sede.provincia", provincia.errore);
  if (indirizzo.errore || citta.errore || cap.errore || provincia.errore) return null;
  const out = { indirizzo: indirizzo.valore, citta: citta.valore };
  if (cap.valore != null) out.cap = cap.valore;
  if (provincia.valore != null) out.provincia = provincia.valore;
  return out;
}

function validaNomiElenco(elementi, errori, opts) {
  const visti = new Set();
  const out = [];
  for (let i = 0; i < elementi.length; i++) {
    const elemento = elementi[i];
    const base = opts.nomeElenco + "[" + i + "]";
    if (!eOggettoSemplice(elemento)) {
      aggiungi(errori, base, ERRORI.DEVE_ESSERE_OGGETTO);
      continue;
    }
    segnalaChiaviExtra(elemento, opts.chiavi, base + ".", errori);
    const nome = normalizzaCampoTesto(elemento.nome, {
      obbligatorio: true,
      min: opts.min,
      max: opts.max
    });
    let ripetuto = false;
    if (nome.valore) {
      const chiave = chiaveNome(nome.valore);
      if (visti.has(chiave)) ripetuto = true;
      else visti.add(chiave);
    }
    if (nome.errore) aggiungi(errori, base + ".nome", nome.errore);
    if (ripetuto) aggiungi(errori, base + ".nome", ERRORI.NOME_RIPETUTO);
    if (opts.completa) {
      opts.completa(elemento, base, errori, nome, ripetuto, out);
    } else if (!nome.errore && !ripetuto) {
      out.push({ nome: nome.valore });
    }
  }
  return out;
}

function validaPoderi(poderi, errori) {
  if (typeof poderi === "undefined") return [];
  if (!Array.isArray(poderi)) {
    aggiungi(errori, "poderi", ERRORI.DEVE_ESSERE_ELENCO);
    return [];
  }
  if (poderi.length > LIMITI.MAX_PODERI) {
    aggiungi(errori, "poderi", ERRORI.TROPPI_ELEMENTI);
    return [];
  }
  return validaNomiElenco(poderi, errori, {
    nomeElenco: "poderi",
    chiavi: ["nome"],
    min: LIMITI.NOME_PODERE_MIN,
    max: LIMITI.NOME_PODERE_MAX
  });
}

function validaTerreni(terreni, errori) {
  if (typeof terreni === "undefined") return [];
  if (!Array.isArray(terreni)) {
    aggiungi(errori, "terreni", ERRORI.DEVE_ESSERE_ELENCO);
    return [];
  }
  if (terreni.length > LIMITI.MAX_TERRENI_PER_RICHIESTA) {
    aggiungi(errori, "terreni", ERRORI.TROPPI_ELEMENTI);
    return [];
  }
  return validaNomiElenco(terreni, errori, {
    nomeElenco: "terreni",
    chiavi: ["nome", "superficie", "coltura", "podere"],
    min: LIMITI.NOME_TERRENO_MIN,
    max: LIMITI.NOME_TERRENO_MAX,
    completa: function (elemento, base, erroriTerreno, nome, ripetuto, out) {
      const superficie = validaSuperficie(elemento.superficie);
      const coltura = normalizzaCampoTesto(elemento.coltura, {
        obbligatorio: false,
        max: LIMITI.COLTURA_MAX
      });
      const podere = normalizzaCampoTesto(elemento.podere, {
        obbligatorio: false,
        min: 1,
        max: LIMITI.NOME_PODERE_MAX
      });
      if (!superficie.ok) aggiungi(erroriTerreno, base + ".superficie", superficie.errore);
      if (coltura.errore) aggiungi(erroriTerreno, base + ".coltura", coltura.errore);
      if (podere.errore) aggiungi(erroriTerreno, base + ".podere", podere.errore);
      if (!nome.errore && !ripetuto && superficie.ok && !coltura.errore && !podere.errore) {
        out.push({
          nome: nome.valore,
          superficie: superficie.valore,
          coltura: coltura.valore,
          podere: podere.valore
        });
      }
    }
  });
}

/**
 * Solo la forma dei dati, senza sapere cosa c'è già in azienda.
 * @param {unknown} data
 */
function validaRichiestaSetup(data) {
  if (!eOggettoSemplice(data)) {
    return esitoNonValido([{ campo: "(richiesta)", errore: ERRORI.DEVE_ESSERE_OGGETTO }]);
  }
  let json;
  try {
    json = JSON.stringify(data);
  } catch {
    return esitoNonValido([{ campo: "(richiesta)", errore: ERRORI.FORMATO_NON_VALIDO }]);
  }
  if (new TextEncoder().encode(json).length > LIMITI.BYTE_MAX_RICHIESTA) {
    return esitoNonValido([{ campo: "(richiesta)", errore: ERRORI.TROPPO_GRANDE }]);
  }

  const errori = [];
  segnalaChiaviExtra(data, ["requestId", "sede", "poderi", "terreni"], "", errori);
  const requestId = validaRequestId(data.requestId);
  if (requestId.errore) aggiungi(errori, "requestId", requestId.errore);
  const sede = validaSede(data.sede, errori);
  const poderi = validaPoderi(data.poderi, errori);
  const terreni = validaTerreni(data.terreni, errori);
  if (errori.length) return esitoNonValido(tagliaErrori(errori));
  if (sede == null && poderi.length === 0 && terreni.length === 0) {
    return { ok: false, codice: "invalid-argument", motivo: "niente-da-salvare" };
  }
  return {
    ok: true,
    richiesta: {
      requestId: requestId.valore,
      sede: sede,
      poderi: poderi,
      terreni: terreni
    }
  };
}

function elencoStringhe(valore) {
  if (!Array.isArray(valore)) return [];
  const out = [];
  for (let i = 0; i < valore.length; i++) {
    if (typeof valore[i] === "string") out.push(valore[i]);
  }
  return out;
}

function trovaStringaEsistente(nome, elenco) {
  const chiave = chiaveNome(nome);
  for (let i = 0; i < elenco.length; i++) {
    if (chiaveNome(elenco[i]) === chiave) return elenco[i];
  }
  return null;
}

/**
 * @param {unknown} nome
 * @param {string[]|undefined} coltureAzienda
 * @returns {{ ok: true, nome: string } | { ok: false, errore: string }}
 */
function trovaColtura(nome, coltureAzienda) {
  const chiave = chiaveNome(nome);
  for (let i = 0; i < COLTURE_PREDEFINITE.length; i++) {
    if (chiaveNome(COLTURE_PREDEFINITE[i].nome) === chiave) {
      return { ok: true, nome: COLTURE_PREDEFINITE[i].nome };
    }
  }
  const azienda = elencoStringhe(coltureAzienda);
  for (let i = 0; i < azienda.length; i++) {
    if (chiaveNome(azienda[i]) === chiave) return { ok: true, nome: azienda[i] };
  }
  for (let i = 0; i < CATEGORIE_COLTURE_PREDEFINITE.length; i++) {
    if (chiaveNome(CATEGORIE_COLTURE_PREDEFINITE[i].nome) === chiave) {
      return { ok: false, errore: ERRORI.CATEGORIA_NON_COLTURA };
    }
  }
  return { ok: false, errore: ERRORI.COLTURA_NON_TROVATA };
}

function nomePodereDaSalvare(nome, poderiRichiesta, poderiEsistenti) {
  const giaSalvato = trovaStringaEsistente(nome, poderiEsistenti);
  if (giaSalvato) return { ok: true, nome: giaSalvato };
  const chiave = chiaveNome(nome);
  for (let i = 0; i < poderiRichiesta.length; i++) {
    if (chiaveNome(poderiRichiesta[i].nome) === chiave) {
      return { ok: true, nome: poderiRichiesta[i].nome };
    }
  }
  return { ok: false, errore: ERRORI.PODERE_NON_TROVATO };
}

function copiaSede(sede) {
  if (sede == null) return null;
  const out = { indirizzo: sede.indirizzo, citta: sede.citta };
  if (sede.cap != null) out.cap = sede.cap;
  if (sede.provincia != null) out.provincia = sede.provincia;
  return out;
}

/**
 * Controlli che dipendono da poderi, terreni e colture già presenti.
 * Riceve la richiesta già pulita da validaRichiestaSetup.
 * @param {{ requestId: string, sede: object|null, poderi: Array<{nome: string}>, terreni: object[] }} richiesta
 * @param {{ poderi?: unknown[], terreni?: unknown[], coltureAzienda?: unknown[] }|null|undefined} esistenti
 */
function risolviControAzienda(richiesta, esistenti) {
  const src = esistenti && typeof esistenti === "object" ? esistenti : {};
  const poderiEsistenti = elencoStringhe(src.poderi);
  const terreniEsistenti = elencoStringhe(src.terreni);
  const coltureAzienda = elencoStringhe(src.coltureAzienda);
  const poderiRichiesta = Array.isArray(richiesta.poderi) ? richiesta.poderi : [];

  const poderiDaCreare = [];
  let poderiGiaPresenti = 0;
  for (let i = 0; i < poderiRichiesta.length; i++) {
    if (trovaStringaEsistente(poderiRichiesta[i].nome, poderiEsistenti)) {
      poderiGiaPresenti += 1;
    } else {
      poderiDaCreare.push({ nome: poderiRichiesta[i].nome });
    }
  }

  const errori = [];
  const terreniOut = [];
  const terreni = Array.isArray(richiesta.terreni) ? richiesta.terreni : [];
  for (let i = 0; i < terreni.length; i++) {
    const terreno = terreni[i];
    const base = "terreni[" + i + "]";
    let bloccato = false;

    if (trovaStringaEsistente(terreno.nome, terreniEsistenti)) {
      aggiungi(errori, base + ".nome", ERRORI.NOME_GIA_USATO);
      bloccato = true;
    }

    let podereSalvato = null;
    if (terreno.podere != null) {
      const podere = nomePodereDaSalvare(terreno.podere, poderiRichiesta, poderiEsistenti);
      if (!podere.ok) {
        aggiungi(errori, base + ".podere", podere.errore);
        bloccato = true;
      } else {
        podereSalvato = podere.nome;
      }
    }

    let colturaSalvata = null;
    if (terreno.coltura != null) {
      const coltura = trovaColtura(terreno.coltura, coltureAzienda);
      if (!coltura.ok) {
        aggiungi(errori, base + ".coltura", coltura.errore);
        bloccato = true;
      } else {
        colturaSalvata = coltura.nome;
      }
    }

    if (!bloccato) {
      const voce = { nome: terreno.nome, superficie: terreno.superficie };
      if (colturaSalvata != null) voce.coltura = colturaSalvata;
      if (podereSalvato != null) voce.podere = podereSalvato;
      terreniOut.push(voce);
    }
  }

  if (errori.length) return esitoNonValido(tagliaErrori(errori));
  return {
    ok: true,
    daScrivere: {
      sede: copiaSede(richiesta.sede),
      poderiDaCreare: poderiDaCreare,
      poderiGiaPresenti: poderiGiaPresenti,
      terreni: terreniOut
    }
  };
}

export { LIMITI, ERRORI, pulisciTesto, chiaveNome, arrotondaSuperficie, trovaColtura, validaRichiestaSetup, risolviControAzienda, COLTURE_PREDEFINITE, CATEGORIE_COLTURE_PREDEFINITE };
