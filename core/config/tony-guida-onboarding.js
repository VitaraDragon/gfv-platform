/**
 * Tony Guida in onboarding per il piano Free (client). Mirror di functions/tony-guida-onboarding.js.
 *
 * Un tenant appena registrato (piano Free) riceve `tonyGuidaOnboardingEndsAt`: fino a quella
 * data Tony Guida (solo spiegazioni, mai Avanzato) è disponibile anche su Free, con tetto
 * giornaliero di richieste chat applicato lato server. Tenant senza campo = nessun periodo.
 *
 * Nota: core/js/gfv-tony-loader.js (script non-module) replica inline la sola regola
 * "campo presente e nel futuro"; tenere allineati.
 *
 * @module core/config/tony-guida-onboarding
 */

export const TONY_GUIDA_ONBOARDING_DAYS = 7;
export const TONY_GUIDA_ONBOARDING_DAILY_LIMIT = 30;
export const TONY_GUIDA_ONBOARDING_FIELD = 'tonyGuidaOnboardingEndsAt';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (e) {
      return null;
    }
  }
  if (typeof value === 'number') {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  if (typeof value === 'object') {
    var secs = value.seconds != null ? value.seconds : value._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000);
  }
  var parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Scadenza per un tenant creato ora (da scrivere in registrazione).
 * @param {Date} [now]
 * @returns {Date}
 */
export function computeTonyGuidaOnboardingEndsAt(now) {
  var base = now instanceof Date ? now : new Date();
  return new Date(base.getTime() + TONY_GUIDA_ONBOARDING_DAYS * DAY_MS);
}

/**
 * @param {object|null|undefined} tenantData
 * @returns {Date|null}
 */
export function getTonyGuidaOnboardingEndsAt(tenantData) {
  var td = tenantData || {};
  return toDate(td[TONY_GUIDA_ONBOARDING_FIELD]);
}

/**
 * @param {object|null|undefined} tenantData
 * @param {Date} [now]
 * @returns {{ active: boolean, endsAt: Date|null, daysLeft: number, expired: boolean }}
 */
export function resolveTonyGuidaOnboarding(tenantData, now) {
  var ref = now instanceof Date ? now : new Date();
  var endsAt = getTonyGuidaOnboardingEndsAt(tenantData);
  if (!endsAt) return { active: false, endsAt: null, daysLeft: 0, expired: false };
  var msLeft = endsAt.getTime() - ref.getTime();
  if (msLeft <= 0) return { active: false, endsAt: endsAt, daysLeft: 0, expired: true };
  return { active: true, endsAt: endsAt, daysLeft: Math.ceil(msLeft / DAY_MS), expired: false };
}

/**
 * Tony Guida raggiungibile su Free? Solo in onboarding.
 * @param {'free'|'base'|null} planId
 * @param {object|null|undefined} tenantData
 * @param {Date} [now]
 */
export function isTonyGuidaOnboardingActive(planId, tenantData, now) {
  if (planId !== 'free') return false;
  return resolveTonyGuidaOnboarding(tenantData, now).active;
}

/**
 * Stato onboarding dal tenant pubblicato in pagina (`window.__gfvTenantData`).
 * @param {Date} [now]
 */
export function getTonyGuidaOnboardingFromWindow(now) {
  try {
    var td = typeof window !== 'undefined' ? window.__gfvTenantData : null;
    return resolveTonyGuidaOnboarding(td, now);
  } catch (e) {
    return { active: false, endsAt: null, daysLeft: 0, expired: false };
  }
}

/**
 * Messaggio di benvenuto in chat durante il periodo di prova.
 * @param {{ daysLeft: number }} onboarding
 */
export function tonyGuidaOnboardingWelcomeMessage(onboarding) {
  var days = onboarding && onboarding.daysLeft ? onboarding.daysLeft : 0;
  var resto = days === 1 ? 'ancora per oggi' : 'ancora per ' + days + ' giorni';
  return (
    'Ciao! Sono Tony, la guida dell\'app. Ti accompagno gratis nei primi ' +
    TONY_GUIDA_ONBOARDING_DAYS +
    ' giorni (' +
    resto +
    '): chiedimi come creare i terreni, registrare le attività, invitare i collaboratori o cosa fanno i moduli. ' +
    'Fino a ' +
    TONY_GUIDA_ONBOARDING_DAILY_LIMIT +
    ' domande al giorno; con il piano Base resto sempre con te.'
  );
}

export default {
  TONY_GUIDA_ONBOARDING_DAYS,
  TONY_GUIDA_ONBOARDING_DAILY_LIMIT,
  TONY_GUIDA_ONBOARDING_FIELD,
  computeTonyGuidaOnboardingEndsAt,
  getTonyGuidaOnboardingEndsAt,
  resolveTonyGuidaOnboarding,
  isTonyGuidaOnboardingActive,
  getTonyGuidaOnboardingFromWindow,
  tonyGuidaOnboardingWelcomeMessage
};
