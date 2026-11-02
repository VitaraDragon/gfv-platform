"use strict";

/**
 * Margine abbonamento ElevenLabs (caratteri), usato dalla landing per la voce.
 * Modulo puro + fetch opzionale: nessuna dipendenza Firebase.
 */

const { COSTANTI } = require("./tony-landing-limiti");

const URL_SUBSCRIPTION = "https://api.elevenlabs.io/v1/user/subscription";
const SOGLIE_AVVISO_VOCE = Object.freeze([80, 95]);

/** Cache in memoria (per istanza Cloud Function). */
let cacheSub = { lettoA: 0, dati: null, errore: null };

/**
 * Svuota la cache (solo test).
 */
function svuotaCacheElevenLabs() {
  cacheSub = { lettoA: 0, dati: null, errore: null };
}

/**
 * @param {object|null|undefined} sub
 * @returns {{
 *   ok: boolean,
 *   characterCount: number,
 *   characterLimit: number,
 *   rimanenti: number,
 *   percentUsati: number|null,
 *   resetUnix: number|null,
 *   leggibile: boolean
 * }}
 */
function normalizzaSubscription(sub) {
  if (!sub || typeof sub !== "object") {
    return {
      ok: false,
      characterCount: 0,
      characterLimit: 0,
      rimanenti: 0,
      percentUsati: null,
      resetUnix: null,
      leggibile: false
    };
  }
  const count =
    typeof sub.character_count === "number" && Number.isFinite(sub.character_count)
      ? Math.max(0, Math.floor(sub.character_count))
      : 0;
  const limit =
    typeof sub.character_limit === "number" && Number.isFinite(sub.character_limit)
      ? Math.max(0, Math.floor(sub.character_limit))
      : 0;
  const resetUnix =
    typeof sub.next_character_count_reset_unix === "number" &&
    Number.isFinite(sub.next_character_count_reset_unix)
      ? sub.next_character_count_reset_unix
      : null;
  if (limit <= 0) {
    return {
      ok: false,
      characterCount: count,
      characterLimit: limit,
      rimanenti: 0,
      percentUsati: null,
      resetUnix: resetUnix,
      leggibile: false
    };
  }
  const rimanenti = Math.max(0, limit - count);
  return {
    ok: true,
    characterCount: count,
    characterLimit: limit,
    rimanenti: rimanenti,
    percentUsati: (count / limit) * 100,
    resetUnix: resetUnix,
    leggibile: true
  };
}

/**
 * Decide se la landing può ancora generare voce.
 * @param {{
 *   sub?: object|null,
 *   voiceReserveChars?: number,
 *   apiFallita?: boolean
 * }} args
 * @returns {{ consentita: boolean, codice: string, motivo?: string }}
 */
function decidiMargineVoce(args) {
  const a = args && typeof args === "object" ? args : {};
  if (a.apiFallita === true) {
    // Non bloccare: il limite giornaliero resta come rete di sicurezza.
    return {
      consentita: true,
      codice: "ok",
      motivo: "margine-non-leggibile"
    };
  }
  const n = normalizzaSubscription(a.sub);
  if (!n.leggibile) {
    return {
      consentita: true,
      codice: "ok",
      motivo: "margine-non-leggibile"
    };
  }
  const riserva =
    typeof a.voiceReserveChars === "number" &&
    Number.isFinite(a.voiceReserveChars) &&
    a.voiceReserveChars >= 0
      ? a.voiceReserveChars
      : COSTANTI.VOICE_RESERVE_CHARS_PREDEFINITO;
  const sogliaTrePercento = Math.ceil(n.characterLimit * 0.03);
  const minimo = Math.max(riserva, sogliaTrePercento);
  if (n.rimanenti < minimo) {
    return {
      consentita: false,
      codice: "tetto-voce",
      motivo: "riserva-esaurita",
      rimanenti: n.rimanenti,
      minimo: minimo
    };
  }
  return {
    consentita: true,
    codice: "ok",
    rimanenti: n.rimanenti,
    percentUsati: n.percentUsati
  };
}

/**
 * Quale soglia 80/95 avvisare (la più alta raggiunta non ancora inviata).
 * @param {{ percentUsati: number|null, giaInviate?: object }} args
 * @returns {{ soglia: number, daSegnare: number[] }|null}
 */
function sogliaVoceDaAvvisare({ percentUsati, giaInviate }) {
  if (percentUsati == null || !Number.isFinite(percentUsati)) return null;
  const gia = giaInviate && typeof giaInviate === "object" ? giaInviate : {};
  let scelta = null;
  for (let i = 0; i < SOGLIE_AVVISO_VOCE.length; i += 1) {
    const s = SOGLIE_AVVISO_VOCE[i];
    if (percentUsati + 1e-9 >= s && !gia["e" + s]) {
      scelta = s;
    }
  }
  if (scelta == null) return null;
  const daSegnare = [];
  for (let i = 0; i < SOGLIE_AVVISO_VOCE.length; i += 1) {
    const s = SOGLIE_AVVISO_VOCE[i];
    if (s <= scelta && !gia["e" + s]) daSegnare.push(s);
  }
  return { soglia: scelta, daSegnare };
}

/**
 * GET /v1/user/subscription con cache ~15 minuti.
 * @param {{ chiave: string, fetchFn?: typeof fetch, adessoMs?: number, forza?: boolean }} opts
 */
async function leggiSubscriptionElevenLabs(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const adesso = typeof o.adessoMs === "number" ? o.adessoMs : Date.now();
  if (
    !o.forza &&
    cacheSub.dati &&
    adesso - cacheSub.lettoA < COSTANTI.CACHE_ELEVENLABS_SUB_MS
  ) {
    return {
      ok: true,
      cached: true,
      sub: cacheSub.dati,
      errore: null
    };
  }
  if (
    !o.forza &&
    cacheSub.errore &&
    adesso - cacheSub.lettoA < COSTANTI.CACHE_ELEVENLABS_SUB_MS
  ) {
    return {
      ok: false,
      cached: true,
      sub: null,
      errore: cacheSub.errore
    };
  }

  const fetchFn = typeof o.fetchFn === "function" ? o.fetchFn : fetch;
  const chiave = typeof o.chiave === "string" ? o.chiave : "";
  if (!chiave) {
    cacheSub = { lettoA: adesso, dati: null, errore: "chiave-mancante" };
    return { ok: false, cached: false, sub: null, errore: "chiave-mancante" };
  }

  try {
    const res = await fetchFn(URL_SUBSCRIPTION, {
      method: "GET",
      headers: {
        "xi-api-key": chiave,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      const err = "http-" + res.status;
      cacheSub = { lettoA: adesso, dati: null, errore: err };
      return { ok: false, cached: false, sub: null, errore: err };
    }
    const json = await res.json();
    cacheSub = { lettoA: adesso, dati: json, errore: null };
    return { ok: true, cached: false, sub: json, errore: null };
  } catch (e) {
    const err = String((e && e.message) || "rete").slice(0, 80);
    cacheSub = { lettoA: adesso, dati: null, errore: err };
    return { ok: false, cached: false, sub: null, errore: err };
  }
}

module.exports = {
  URL_SUBSCRIPTION,
  SOGLIE_AVVISO_VOCE,
  svuotaCacheElevenLabs,
  normalizzaSubscription,
  decidiMargineVoce,
  sogliaVoceDaAvvisare,
  leggiSubscriptionElevenLabs
};
