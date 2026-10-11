/**
 * Accettazione documenti legali. Flag spento: registrazione e invito restano come oggi.
 * URL e date delle versioni li compila Pier prima di mettere il flag a true.
 * @module core/config/accettazione-legale-config
 */

export const ACCETTAZIONE_LEGALE_ATTIVA = false;

export const DOCUMENTI_LEGALI = Object.freeze({
  'termini-b2b': Object.freeze({ versione: 'termini-b2b-0000-00-00', url: '' }),
  privacy: Object.freeze({ versione: 'privacy-0000-00-00', url: '' }),
  dpa: Object.freeze({ versione: 'dpa-0000-00-00', url: '' }),
  'informativa-lavoratori': Object.freeze({
    versione: 'informativa-lavoratori-0000-00-00',
    url: ''
  })
});

/** Identificativo dell'etichetta della casella, non del testo del documento. */
export const VERSIONI_CASELLE = Object.freeze({
  registrazione: 'casella-registrazione-v1',
  invito: 'casella-invito-v1'
});

/** Solo link. Nessun consenso cookie. */
export const COOKIE_URL = '';
