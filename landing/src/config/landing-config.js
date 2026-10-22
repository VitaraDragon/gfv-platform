/**
 * Landing nuova. Spenta: la landing pubblicata mostra ancora «Coming soon».
 */

export const LANDING_ATTIVA = false;

/** Email di contatto del footer (vuota finché non la decidiamo). */
export const EMAIL_CONTATTO = '';

/** Due righe in prima persona di Pier (da scrivere con lui). */
export const TESTO_CHI_SIAMO = '';

/** URL foto di Pier (vuoto finché non c'è). */
export const FOTO_PIER_URL = '';

/** La commercialista deve ancora confermare la frase sull'IVA. */
export const IVA_CONFERMATA = false;

/** Termini, Privacy e Cookie non sono ancora rivisti dall'avvocato. */
export const TESTI_LEGALI_PRONTI = false;

/**
 * Limiti e prezzi mostrati in «Cosa gestisci» / prezzi.
 * Specchio di core/config/subscription-plans.js (free) e tony-guida-onboarding.js.
 * Un solo punto: non spargere i numeri nel template.
 */
export const LIMITI_LANDING = {
  /** SUBSCRIPTION_PLANS.free.maxTerreni */
  maxTerreniFree: 5,
  /** SUBSCRIPTION_PLANS.free.maxAttivitaMese */
  maxAttivitaMeseFree: 30,
  /** TONY_GUIDA_ONBOARDING_DAYS */
  giorniGuidaTony: 7,
  /** TONY_GUIDA_ONBOARDING_DAILY_LIMIT */
  domandeGuidaGiorno: 30,
  /** SUBSCRIPTION_PLANS.base.price */
  prezzoBaseMese: 5,
};

/** Alias usato anche da rigaPrezzi / test allineamento Tony. */
export const GIORNI_GUIDA_TONY = LIMITI_LANDING.giorniGuidaTony;

export const URL_APP = 'https://vitaradragon.github.io/gfv-platform/';

export const URL_REGISTRAZIONE = `${URL_APP}core/auth/registrazione-standalone.html`;

export const URL_LOGIN = `${URL_APP}core/auth/login-standalone.html`;
