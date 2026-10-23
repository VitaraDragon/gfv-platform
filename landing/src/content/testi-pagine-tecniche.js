/**
 * Testi delle pagine tecniche/legali e meta della home (modo completo).
 * Niente testi legali definitivi: solo contenitori e segnaposto.
 */
import { testiLanding } from './testi-landing.js';

export const testiPagineTecniche = {
  brand: 'Global Farm View',

  // BOZZA: da far rivedere
  riquadroInPreparazione:
    'Testo in preparazione. Il testo definitivo sarà pubblicato qui prima dell\'apertura del servizio.',

  linkTestoCompleto: 'Leggi il testo completo',

  sezioneTony: {
    titolo: "Tony, l'assistente virtuale",
    // BOZZA: da far rivedere
    testo: 'Sezione in preparazione.',
  },

  // BOZZA: da far rivedere
  offertoDa: testiLanding.footer.offertoDa,

  linkHome: 'Pagina principale',
  linkTornaHome: 'Torna alla pagina principale',

  nonTrovata: {
    titolo: 'Pagina non trovata',
    testo:
      "L'indirizzo che hai aperto non esiste. Puoi tornare alla pagina principale di Global Farm View.",
    cta: 'Torna alla pagina principale',
  },

  /** Title e description della home in modo completo (uguali a OG). */
  metaHome: {
    title: testiLanding.documentTitle,
    description:
      'Il gestionale agricolo semplice: basta uno smartphone o un computer con internet. Tony ti guida dal primo accesso. Gratis per iniziare.',
    ogImageAlt: 'Global Farm View: Tony ti guida dal primo accesso',
  },
};
