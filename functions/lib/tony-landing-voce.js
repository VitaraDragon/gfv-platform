"use strict";

/**
 * Logica pura della voce di Tony sulla landing (passo 12b).
 * Niente Firebase, niente rete: solo crypto e costanti.
 */

const crypto = require("node:crypto");
const { COSTANTI } = require("./tony-landing-limiti");

/** Costanti voce landing: stessa voce/modello dell'app, senza override d'ambiente. */
const COSTANTI_VOCE = Object.freeze({
  VOCE_ID: "5zD2eYSLIo8c2zkowMfP",
  MODELLO: "eleven_flash_v2_5",
  URL_TTS: "https://api.elevenlabs.io/v1/text-to-speech",
  FORMATO_USCITA: "mp3_44100_128",
  LINGUA: "it",
  MAX_CARATTERI_TESTO: 800,
  MAX_BYTE_RICHIESTA: 4096,
  VALIDITA_BIGLIETTO_MS: 10 * 60 * 1000,
  TIMEOUT_ELEVENLABS_MS: 15000
});

/**
 * Testo da mandare alla sintesi (e su cui si contano i caratteri).
 * @param {unknown} testo
 * @returns {string}
 */
function preparaTestoVoce(testo) {
  let s = typeof testo === "string" ? testo : "";
  s = s.replace(/[*#_]/g, "");
  s = s.replace(/https?:\/\/\S+/gi, "");
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  // Emoji e simboli pittografici (senza \p{} per ambienti più vecchi).
  s = s.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ""
  );
  s = s.replace(/\bGFV\b/g, "Gi, effe, vu");
  s = s.replace(/€/g, " euro");
  s = s.replace(/\s+/g, " ").trim();
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
 * Controlli in ordine: spenta → biglietto → usato → scaduto → tetto mese → tetto giorno.
 * @param {{
 *   config: object,
 *   biglietto: object|null|undefined,
 *   hashTesto: string,
 *   hashSessione: string,
 *   adessoMs: number,
 *   caratteriGiorno: number,
 *   spesaMeseEur: number
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
  const spesaMeseEur =
    typeof a.spesaMeseEur === "number" && !Number.isNaN(a.spesaMeseEur)
      ? a.spesaMeseEur
      : 0;

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

  const budget =
    typeof config.monthlyBudgetEur === "number" &&
    !Number.isNaN(config.monthlyBudgetEur)
      ? config.monthlyBudgetEur
      : COSTANTI.TETTO_MENSILE_EUR;
  if (spesaMeseEur >= COSTANTI.SOGLIA_SOLO_TESTO * budget) {
    return { consentita: false, codice: "tetto-voce", caratteri: 0 };
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
 * @param {string} testoVoce
 */
function corpoElevenLabs(testoVoce) {
  return {
    text: String(testoVoce || ""),
    model_id: COSTANTI_VOCE.MODELLO,
    language_code: COSTANTI_VOCE.LINGUA
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
  impronta,
  nuovoIdVoce,
  datiBiglietto,
  validaRichiestaVoce,
  decidiVoce,
  corpoElevenLabs,
  urlElevenLabs,
  statoPerCodice
};
