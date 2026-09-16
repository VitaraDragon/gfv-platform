"use strict";

/**
 * Tony Guida in onboarding per il piano Free.
 *
 * Un tenant appena registrato (piano Free) riceve `tonyGuidaOnboardingEndsAt` sul doc
 * `tenants/{id}`: fino a quella data Tony Guida (solo spiegazioni, mai Avanzato) è
 * disponibile anche su Free, con un tetto giornaliero di richieste chat. Voce (TTS/STT)
 * inclusa; acquisizione documenti esclusa (resta gate Free pieno).
 *
 * Mirror client: core/config/tony-guida-onboarding.js (stesse costanti e regole).
 * Contatore giornaliero: `tenants/{id}/tonyOnboardingQuota/{YYYY-MM-DD}` (solo admin SDK).
 */

const TONY_GUIDA_ONBOARDING_DAYS = 7;
const TONY_GUIDA_ONBOARDING_DAILY_LIMIT = 30;
const TONY_GUIDA_ONBOARDING_FIELD = "tonyGuidaOnboardingEndsAt";
const TONY_GUIDA_ONBOARDING_QUOTA_COLLECTION = "tonyOnboardingQuota";
/** Il giorno di quota segue l'orologio dell'utente italiano, non UTC. */
const TONY_GUIDA_ONBOARDING_TIMEZONE = "Europe/Rome";

const TONY_FREE_DENIED_MESSAGE =
  "Tony non è disponibile sul piano Free. Passa al piano Base dalla pagina Abbonamento per usare Tony Guida.";
const TONY_ONBOARDING_EXPIRED_MESSAGE =
  "Il periodo di prova di Tony Guida (" +
  TONY_GUIDA_ONBOARDING_DAYS +
  " giorni) è terminato. Con il piano Base Tony resta sempre con te: puoi attivarlo dalla pagina Abbonamento.";
const TONY_ONBOARDING_QUOTA_MESSAGE =
  "Hai raggiunto il limite giornaliero di " +
  TONY_GUIDA_ONBOARDING_DAILY_LIMIT +
  " domande del periodo di prova di Tony Guida. Riprova domani, oppure passa al piano Base per usare Tony senza limiti.";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate();
    } catch (e) {
      return null;
    }
  }
  if (typeof value === "number") {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  if (typeof value === "object") {
    const secs = value.seconds != null ? value.seconds : value._seconds;
    if (typeof secs === "number") return new Date(secs * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Scadenza onboarding per un tenant creato ora.
 * @param {Date} [now]
 * @returns {Date}
 */
function computeTonyGuidaOnboardingEndsAt(now = new Date()) {
  return new Date(now.getTime() + TONY_GUIDA_ONBOARDING_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * @param {object|null|undefined} tenantData
 * @returns {Date|null}
 */
function getTonyGuidaOnboardingEndsAt(tenantData) {
  const td = tenantData || {};
  return toDate(td[TONY_GUIDA_ONBOARDING_FIELD]);
}

/**
 * Stato onboarding: attivo solo se il campo esiste ed è nel futuro. Tenant senza campo
 * (creati prima della feature) non ricevono il periodo di prova.
 * @param {object|null|undefined} tenantData
 * @param {Date} [now]
 * @returns {{ active: boolean, endsAt: Date|null, daysLeft: number, expired: boolean }}
 */
function resolveTonyGuidaOnboarding(tenantData, now = new Date()) {
  const endsAt = getTonyGuidaOnboardingEndsAt(tenantData);
  if (!endsAt) {
    return { active: false, endsAt: null, daysLeft: 0, expired: false };
  }
  const msLeft = endsAt.getTime() - now.getTime();
  if (msLeft <= 0) {
    return { active: false, endsAt, daysLeft: 0, expired: true };
  }
  return {
    active: true,
    endsAt,
    daysLeft: Math.ceil(msLeft / (24 * 60 * 60 * 1000)),
    expired: false,
  };
}

/**
 * Tony Guida raggiungibile su Free? Solo durante l'onboarding.
 * @param {'free'|'base'} planId
 * @param {object|null|undefined} tenantData
 * @param {Date} [now]
 */
function isTonyGuidaOnboardingActive(planId, tenantData, now = new Date()) {
  if (planId !== "free") return false;
  return resolveTonyGuidaOnboarding(tenantData, now).active;
}

/**
 * Messaggio di rifiuto per un tenant Free: distingue "mai avuto" da "periodo terminato".
 * @param {object|null|undefined} tenantData
 * @param {Date} [now]
 */
function tonyFreeDeniedMessage(tenantData, now = new Date()) {
  const ob = resolveTonyGuidaOnboarding(tenantData, now);
  return ob.expired ? TONY_ONBOARDING_EXPIRED_MESSAGE : TONY_FREE_DENIED_MESSAGE;
}

/**
 * Chiave giorno (YYYY-MM-DD) nel fuso Europe/Rome.
 * @param {Date} [now]
 */
function tonyGuidaOnboardingDayKey(now = new Date()) {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: TONY_GUIDA_ONBOARDING_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch (e) {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Nota per il system prompt: Tony sa di essere in periodo di prova e quanto manca.
 * @param {{ active: boolean, daysLeft: number }} onboarding
 */
function buildTonyGuidaOnboardingPromptNote(onboarding) {
  if (!onboarding || !onboarding.active) return "";
  const giorni = onboarding.daysLeft === 1 ? "1 giorno" : onboarding.daysLeft + " giorni";
  return (
    "\nPERIODO DI PROVA TONY GUIDA (piano Free, onboarding nuovo tenant):\n" +
    "- L'azienda è sul piano Free e ha Tony Guida in prova gratuita per " +
    TONY_GUIDA_ONBOARDING_DAYS +
    " giorni dalla registrazione; mancano " +
    giorni +
    ". Limite " +
    TONY_GUIDA_ONBOARDING_DAILY_LIMIT +
    " domande al giorno.\n" +
    "- Se l'utente chiede di Tony, del piano o di cosa succede dopo: spiega che dopo il periodo di prova Tony resta disponibile con il piano Base (pagina Abbonamento). Non ripeterlo se non richiesto.\n" +
    "- Il piano Free ha limiti: massimo 5 terreni e 30 attività al mese; i moduli si possono provare gratis 30 giorni dalla pagina Abbonamento.\n" +
    "- Aiuta l'utente nei primi passi: creare terreni, registrare attività, invitare collaboratori, scoprire i moduli.\n"
  );
}

/**
 * Consuma una richiesta chat della quota giornaliera (transazione Firestore).
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} tenantId
 * @param {Date} [now]
 * @returns {Promise<{ allowed: boolean, count: number, remaining: number, dayKey: string }>}
 */
async function consumeTonyGuidaOnboardingQuota(db, tenantId, now = new Date()) {
  const admin = require("firebase-admin");
  const dayKey = tonyGuidaOnboardingDayKey(now);
  const ref = db
    .collection("tenants")
    .doc(String(tenantId))
    .collection(TONY_GUIDA_ONBOARDING_QUOTA_COLLECTION)
    .doc(dayKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number((snap.data() || {}).count || 0) : 0;
    if (count >= TONY_GUIDA_ONBOARDING_DAILY_LIMIT) {
      return { allowed: false, count, remaining: 0, dayKey };
    }
    const next = count + 1;
    tx.set(
      ref,
      {
        count: next,
        limit: TONY_GUIDA_ONBOARDING_DAILY_LIMIT,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { allowed: true, count: next, remaining: TONY_GUIDA_ONBOARDING_DAILY_LIMIT - next, dayKey };
  });
}

module.exports = {
  TONY_GUIDA_ONBOARDING_DAYS,
  TONY_GUIDA_ONBOARDING_DAILY_LIMIT,
  TONY_GUIDA_ONBOARDING_FIELD,
  TONY_GUIDA_ONBOARDING_QUOTA_COLLECTION,
  TONY_GUIDA_ONBOARDING_TIMEZONE,
  TONY_FREE_DENIED_MESSAGE,
  TONY_ONBOARDING_EXPIRED_MESSAGE,
  TONY_ONBOARDING_QUOTA_MESSAGE,
  computeTonyGuidaOnboardingEndsAt,
  getTonyGuidaOnboardingEndsAt,
  resolveTonyGuidaOnboarding,
  isTonyGuidaOnboardingActive,
  tonyFreeDeniedMessage,
  tonyGuidaOnboardingDayKey,
  buildTonyGuidaOnboardingPromptNote,
  consumeTonyGuidaOnboardingQuota,
};
