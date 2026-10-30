"use strict";

/**
 * Logica pura della voce di Tony sulla landing (passo 12b + correzioni anteprima).
 * Niente Firebase, niente rete: solo crypto e costanti.
 *
 * Ricetta voce (fissa): multilingual v2, solo text + model_id, senza voice_settings,
 * language_code, seed o pronunciation dictionary.
 */

const crypto = require("node:crypto");

/** Costanti voce landing: stessa voce dell'app; modello multilingual (non flash). */
const COSTANTI_VOCE = Object.freeze({
  VOCE_ID: "5zD2eYSLIo8c2zkowMfP",
  MODELLO: "eleven_multilingual_v2",
  URL_TTS: "https://api.elevenlabs.io/v1/text-to-speech",
  FORMATO_USCITA: "mp3_44100_128",
  MAX_CARATTERI_TESTO: 800,
  MAX_BYTE_RICHIESTA: 4096,
  VALIDITA_BIGLIETTO_MS: 10 * 60 * 1000,
  TIMEOUT_ELEVENLABS_MS: 15000
});

const UNITA_0_19 = Object.freeze([
  "zero",
  "uno",
  "due",
  "tre",
  "quattro",
  "cinque",
  "sei",
  "sette",
  "otto",
  "nove",
  "dieci",
  "undici",
  "dodici",
  "tredici",
  "quattordici",
  "quindici",
  "sedici",
  "diciassette",
  "diciotto",
  "diciannove"
]);

const DECINE = Object.freeze([
  "",
  "",
  "venti",
  "trenta",
  "quaranta",
  "cinquanta",
  "sessanta",
  "settanta",
  "ottanta",
  "novanta"
]);

/**
 * @param {number} n intero 0..999
 * @returns {string}
 */
function interoInLettere(n) {
  const v = Math.trunc(n);
  if (v < 0 || v > 999) return String(v);
  if (v < 20) return UNITA_0_19[v];
  if (v < 100) {
    const d = Math.floor(v / 10);
    const u = v % 10;
    let base = DECINE[d];
    if (u === 0) return base;
    if (u === 1 || u === 8) base = base.slice(0, -1);
    return base + UNITA_0_19[u];
  }
  const c = Math.floor(v / 100);
  const resto = v % 100;
  const cento = c === 1 ? "cento" : UNITA_0_19[c] + "cento";
  if (resto === 0) return cento;
  return cento + interoInLettere(resto);
}

/**
 * Parte intera + eventuale decimale (virgola italiana → «virgola …»).
 * @param {string} interoStr
 * @param {string} [decimaleStr]
 * @returns {string}
 */
function numeroParlato(interoStr, decimaleStr) {
  const intero = Number(interoStr);
  if (!Number.isFinite(intero)) return interoStr;
  let out = interoInLettere(intero);
  if (decimaleStr != null && decimaleStr !== "") {
    const cifre = String(decimaleStr).replace(/\D/g, "");
    if (cifre) {
      const dec = Number(cifre);
      out +=
        " virgola " +
        (Number.isFinite(dec) && dec <= 999
          ? interoInLettere(dec)
          : cifre.split("").map(function (c) {
              return UNITA_0_19[Number(c)] || c;
            }).join(" "));
    }
  }
  return out;
}

/** Nomi maschili che vogliono «un» (non «uno») dopo il numero 1. */
const NOMI_UN = Object.freeze([
  "terreno",
  "podere",
  "modulo",
  "euro",
  "ettaro",
  "giorno",
  "mese",
  "anno",
  "account",
  "piano",
  "campo"
]);

/** Nomi femminili / con apostrofo dopo 1. */
const NOMI_UNA = Object.freeze({
  coltura: "una",
  attivita: "un'",
  "attività": "un'",
  domanda: "una",
  risposta: "una",
  azienda: "una",
  sede: "una"
});

/**
 * Converte cifre (+ unità tipiche) in lettere, con accordo «un/una/un'».
 * @param {string} s
 * @returns {string}
 */
function numeriInLettere(s) {
  let out = String(s || "");

  // «2,34 ha» / «2.34 ha» → «due virgola trentaquattro ettari»
  out = out.replace(
    /(\d+)([.,](\d+))?\s*ha\b/gi,
    function (_m, intero, _sep, dec) {
      return numeroParlato(intero, dec) + " ettari";
    }
  );

  // «1 attività» prima (à non è \w: \b dopo la à fallisce)
  out = out.replace(/(\d+)\s+attivit(?:à|a)(?!\w)/gi, function (_m, intero) {
    return Number(intero) === 1
      ? "un'attività"
      : numeroParlato(intero) + " attività";
  });

  // «5 €» già trasformato in «5 euro» prima; gestiamo «N euro/giorni/…»
  out = out.replace(
    /(\d+)([.,](\d+))?\s*(euro|giorni|giorno|mesi|mese|anni|anno|terreni|terreno|poderi|podere|moduli|modulo|colture|coltura|ettari|ettaro)\b/gi,
    function (_m, intero, _sep, dec, unitaRaw) {
      const unita = String(unitaRaw);
      const unitaLow = unita.toLowerCase();
      const n = Number(intero);
      let num = numeroParlato(intero, dec);
      if (!dec && n === 1) {
        if (NOMI_UN.indexOf(unitaLow) >= 0) {
          num = "un";
        } else if (Object.prototype.hasOwnProperty.call(NOMI_UNA, unitaLow)) {
          num = NOMI_UNA[unitaLow];
        }
      }
      return num + " " + unita;
    }
  );

  // Cifre isolate residue
  out = out.replace(/(\d+)([.,](\d+))?/g, function (_m, intero, _sep, dec) {
    return numeroParlato(intero, dec);
  });

  return out;
}

/**
 * «Base» (piano) → «base» minuscolo, così la TTS non legge «beis».
 * @param {string} s
 * @returns {string}
 */
function pianoBaseMinuscolo(s) {
  return String(s || "").replace(/\bBase\b/g, "base");
}

/**
 * Sigla GFV → «Gi effe vu» (una sola volta se già spiegata).
 * @param {string} s
 * @returns {string}
 */
function siglaGfv(s) {
  let out = String(s || "");
  out = out.replace(/\bGFV\b/g, "Gi effe vu");
  // Evita doppie: «Global Farm View, in breve Gi effe vu» / «(Gi effe vu)» / ripetizione
  out = out.replace(
    /Global Farm View\s*[,:]?\s*(in breve\s+)?Gi effe vu/gi,
    "Global Farm View"
  );
  out = out.replace(/Global Farm View\s*\(\s*Gi effe vu\s*\)/gi, "Global Farm View");
  out = out.replace(/\bGi effe vu(\s+Gi effe vu)+\b/g, "Gi effe vu");
  return out;
}

/**
 * Testo da mandare alla sintesi (e su cui si contano i caratteri).
 * A schermo e nei sottotitoli resta l'originale (GFV, Base, 5 €).
 * @param {unknown} testo
 * @returns {string}
 */
function preparaTestoVoce(testo) {
  let s = typeof testo === "string" ? testo : "";
  s = s.replace(/[*#_]/g, "");
  s = s.replace(/https?:\/\/\S+/gi, "");
  s = s.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  // Emoji e simboli pittografici (senza \p{} per ambienti più vecchi).
  s = s.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ""
  );
  // A capo → pausa SSML (prima di comprimere gli spazi / numeri).
  const BREAK = '<break time="0.6s" />';
  const BREAK_PH = "\uE000BREAK\uE001";
  s = s.replace(/\r\n|\r|\n/g, BREAK_PH);
  s = s.replace(/€/g, " euro");
  s = siglaGfv(s);
  s = pianoBaseMinuscolo(s);
  s = numeriInLettere(s);
  s = s.replace(/\s+/g, " ").trim();
  s = s.split(BREAK_PH).join(BREAK);
  return s;
}

/**
 * @param {string} valore
 * @returns {string}
 */
function impronta(valore) {
  return crypto
    .createHash("sha256")
    .update("tony-landing-voce\n" + String(valore ?? ""), "utf8")
    .digest("hex");
}

/**
 * @param {(n: number) => Buffer} randomBytes
 * @returns {string}
 */
function nuovoIdVoce(randomBytes) {
  return randomBytes(16).toString("hex");
}

/**
 * Campi del biglietto monouso (senza testo né sessione in chiaro).
 * @param {{ testo: string, sessione: string, adesso: number, expireAt: unknown }} args
 */
function datiBiglietto(args) {
  const a = args && typeof args === "object" ? args : {};
  const testo = typeof a.testo === "string" ? a.testo : "";
  const sessione = typeof a.sessione === "string" ? a.sessione : "";
  const adesso = typeof a.adesso === "number" ? a.adesso : 0;
  return {
    hashTesto: impronta(testo),
    hashSessione: impronta(sessione),
    caratteri: preparaTestoVoce(testo).length,
    usato: false,
    scadeIlMs: adesso + COSTANTI_VOCE.VALIDITA_BIGLIETTO_MS,
    expireAt: a.expireAt
  };
}

/**
 * @param {unknown} corpo
 * @returns {{ ok: true, idVoce: string, sessione: string, testo: string } | { ok: false, codice: string }}
 */
function validaRichiestaVoce(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return { ok: false, codice: "richiesta-non-valida" };
  }
  const chiavi = Object.keys(corpo);
  for (let i = 0; i < chiavi.length; i++) {
    if (
      chiavi[i] !== "idVoce" &&
      chiavi[i] !== "sessione" &&
      chiavi[i] !== "testo"
    ) {
      return { ok: false, codice: "richiesta-non-valida" };
    }
  }
  if (typeof corpo.idVoce !== "string" || !/^[a-f0-9]{32}$/.test(corpo.idVoce)) {
    return { ok: false, codice: "id-voce-non-valido" };
  }
  if (typeof corpo.sessione !== "string") {
    return { ok: false, codice: "sessione-non-valida" };
  }
  const sessione = corpo.sessione;
  if (
    sessione.length < 16 ||
    sessione.length > 64 ||
    !/^[A-Za-z0-9-]+$/.test(sessione)
  ) {
    return { ok: false, codice: "sessione-non-valida" };
  }
  if (typeof corpo.testo !== "string") {
    return { ok: false, codice: "testo-vuoto" };
  }
  if (!corpo.testo) {
    return { ok: false, codice: "testo-vuoto" };
  }
  if (corpo.testo.length > COSTANTI_VOCE.MAX_CARATTERI_TESTO) {
    return { ok: false, codice: "testo-troppo-lungo" };
  }
  return {
    ok: true,
    idVoce: corpo.idVoce,
    sessione: sessione,
    testo: corpo.testo
  };
}

/**
 * Controlli in ordine: spenta → biglietto → usato → scaduto →
 * margine ElevenLabs → tetto giorno landing.
 * La spesa Gemini in euro NON spegne più la voce.
 * @param {{
 *   config: object,
 *   biglietto: object|null|undefined,
 *   hashTesto: string,
 *   hashSessione: string,
 *   adessoMs: number,
 *   caratteriGiorno: number,
 *   spesaMeseEur?: number,
 *   margineVoce?: { consentita: boolean, codice?: string }
 * }} args
 */
function decidiVoce(args) {
  const a = args && typeof args === "object" ? args : {};
  const config = a.config && typeof a.config === "object" ? a.config : {};
  const biglietto =
    a.biglietto && typeof a.biglietto === "object" ? a.biglietto : null;
  const hashTesto = typeof a.hashTesto === "string" ? a.hashTesto : "";
  const hashSessione = typeof a.hashSessione === "string" ? a.hashSessione : "";
  const adessoMs = typeof a.adessoMs === "number" ? a.adessoMs : 0;
  const caratteriGiorno =
    typeof a.caratteriGiorno === "number" && !Number.isNaN(a.caratteriGiorno)
      ? a.caratteriGiorno
      : 0;
  void a.spesaMeseEur;

  if (config.enabled !== true || config.voiceEnabled !== true) {
    return { consentita: false, codice: "voce-spenta", caratteri: 0 };
  }
  if (
    !biglietto ||
    biglietto.hashSessione !== hashSessione ||
    biglietto.hashTesto !== hashTesto
  ) {
    return { consentita: false, codice: "voce-non-valida", caratteri: 0 };
  }
  if (biglietto.usato === true) {
    return { consentita: false, codice: "voce-gia-usata", caratteri: 0 };
  }
  if (
    typeof biglietto.scadeIlMs === "number" &&
    adessoMs > biglietto.scadeIlMs
  ) {
    return { consentita: false, codice: "voce-scaduta", caratteri: 0 };
  }

  const margine =
    a.margineVoce && typeof a.margineVoce === "object" ? a.margineVoce : null;
  if (margine && margine.consentita === false) {
    return {
      consentita: false,
      codice: margine.codice || "tetto-voce",
      caratteri: 0
    };
  }

  const cap =
    typeof config.dailyVoiceCharCap === "number" &&
    !Number.isNaN(config.dailyVoiceCharCap)
      ? config.dailyVoiceCharCap
      : 60000;
  const caratteri =
    typeof biglietto.caratteri === "number" ? biglietto.caratteri : 0;
  if (caratteriGiorno + caratteri > cap) {
    return { consentita: false, codice: "tetto-voce", caratteri: 0 };
  }

  return { consentita: true, codice: "ok", caratteri: caratteri };
}

/**
 * Corpo richiesta ElevenLabs: solo text + model_id (ricetta Pier).
 * @param {string} testoVoce
 */
function corpoElevenLabs(testoVoce) {
  return {
    text: String(testoVoce || ""),
    model_id: COSTANTI_VOCE.MODELLO
  };
}

/**
 * @returns {string}
 */
function urlElevenLabs() {
  return (
    COSTANTI_VOCE.URL_TTS +
    "/" +
    encodeURIComponent(COSTANTI_VOCE.VOCE_ID) +
    "/stream?output_format=" +
    COSTANTI_VOCE.FORMATO_USCITA
  );
}

/**
 * @param {string} codice
 * @returns {number}
 */
function statoPerCodice(codice) {
  switch (codice) {
    case "origine-non-ammessa":
      return 403;
    case "metodo-non-ammesso":
      return 405;
    case "app-check-mancante":
    case "app-check-non-valido":
      return 401;
    case "corpo-troppo-grande":
      return 413;
    case "richiesta-non-valida":
    case "id-voce-non-valido":
    case "sessione-non-valida":
    case "testo-vuoto":
    case "testo-troppo-lungo":
      return 400;
    case "voce-non-valida":
    case "voce-gia-usata":
    case "voce-scaduta":
      return 409;
    case "tetto-voce":
      return 429;
    case "voce-spenta":
      return 503;
    case "voce-errore":
      return 502;
    case "errore":
      return 503;
    default:
      return 503;
  }
}

module.exports = {
  COSTANTI_VOCE,
  preparaTestoVoce,
  numeriInLettere,
  pianoBaseMinuscolo,
  siglaGfv,
  impronta,
  nuovoIdVoce,
  datiBiglietto,
  validaRichiestaVoce,
  decidiVoce,
  corpoElevenLabs,
  urlElevenLabs,
  statoPerCodice
};
