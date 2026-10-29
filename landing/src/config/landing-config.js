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

/** Dominio pubblico previsto. Non è ancora confermato/collegato: serve per canonical, og:url e sitemap. */
export const URL_SITO = 'https://gfvagri.com';
export const DOMINIO_CONFERMATO = false;

/** PEC: il brief la prevede nel footer «se c'è». Vuota finché non la decido. */
export const PEC_CONTATTO = '';

/**
 * P.IVA: per il brief NON si mostra né nel footer né nelle pagine (niente P.IVA e niente codice fiscale).
 * Resta vuota e non è usata da nessuna pagina; serve solo a ricordare che è un dato da decidere.
 */
export const PARTITA_IVA = '';

/** Immagine per le anteprime social (1200×630, logo nuovo + Tony). Non esiste ancora. */
export const OG_IMMAGINE = '/og/gfv-og-1200x630.jpg';
export const OG_IMMAGINE_PRONTA = false;

/**
 * Pagine legali della landing. I testi veri arriveranno da Iubenda.
 * - percorso: indirizzo della pagina sulla landing (non cambia).
 * - urlTestoCompleto: link al testo definitivo (per esempio la pagina Iubenda). Vuoto = segnaposto.
 * - versione: stesso formato di core/config/accettazione-legale-config.js.
 * - chiaveApp: chiave corrispondente in DOCUMENTI_LEGALI dell'app (null per la cookie policy, che nell'app è COOKIE_URL).
 * - testoDefinitivo: true solo quando il testo è copiato nella nostra pagina (non solo link).
 */
export const PAGINE_LEGALI = Object.freeze({
  termini: Object.freeze({
    percorso: '/termini',
    titolo: 'Termini di servizio',
    urlTestoCompleto: '',
    versione: 'termini-b2b-0000-00-00',
    chiaveApp: 'termini-b2b',
    testoDefinitivo: false,
  }),
  privacy: Object.freeze({
    percorso: '/privacy',
    titolo: 'Informativa privacy',
    urlTestoCompleto: '',
    versione: 'privacy-0000-00-00',
    chiaveApp: 'privacy',
    testoDefinitivo: false,
  }),
  cookie: Object.freeze({
    percorso: '/cookie',
    titolo: 'Cookie policy',
    urlTestoCompleto: '',
    versione: 'cookie-0000-00-00',
    chiaveApp: null,
    testoDefinitivo: false,
  }),
});

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

/** Tony bussa ed entra sulla landing. Spento: i pulsanti portano alla registrazione classica. */
export const TONY_BUSSA_ATTIVO = false;

/** Versione della prima casella, salvata con la presa visione. */
export const VERSIONE_AVVISO_TONY = 'avviso-tony-2026-10-26';

export const URL_APP = 'https://vitaradragon.github.io/gfv-platform/';

export const URL_REGISTRAZIONE = `${URL_APP}core/auth/registrazione-standalone.html?da=landing`;

export const URL_LOGIN = `${URL_APP}core/auth/login-standalone.html`;

/** Funzione della chat di Tony sulla landing (passo 10). Regione europe-west1. */
export const URL_TONY_LANDING_ASK =
  'https://europe-west1-gfv-platform.cloudfunctions.net/tonyLandingAsk';

/** Funzione della voce di Tony sulla landing (passo 12b). Regione europe-west1. */
export const URL_TONY_LANDING_AUDIO =
  'https://europe-west1-gfv-platform.cloudfunctions.net/tonyLandingAudio';
