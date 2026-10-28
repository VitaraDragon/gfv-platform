/**
 * Logica pura della registrazione nella chat di Tony (niente Vue, niente Firebase).
 */

import {
  ACCETTAZIONE_LEGALE_ATTIVA,
  COOKIE_URL,
  DOCUMENTI_LEGALI,
  VERSIONI_CASELLE,
} from '../../../core/config/accettazione-legale-config.js';
import {
  costruisciPayloadAccettazione,
  validaCaselleRegistrazione,
  validaConfigLegale,
} from '../../../core/services/accettazione-legale.js';
import {
  annullaRegistrazioneParziale,
  codiceErroreRegistrazione,
  creaAccountTitolare,
  normalizzaEmailRegistrazione,
} from '../../../core/services/registrazione-titolare-core.js';
import { urlLoginConEmail } from '../../../core/js/login-email-precompilata.js';
import { URL_LOGIN, URL_REGISTRAZIONE } from '../config/landing-config.js';
import { testiLanding } from '../content/testi-landing.js';

/**
 * @param {{ salutoFinito?: boolean, protezionePronta?: boolean|null }} opts
 * @returns {boolean}
 */
export function moduloRegistrazioneDisponibile({ salutoFinito, protezionePronta }) {
  return salutoFinito === true && protezionePronta === true;
}

/**
 * Stessa condizione della pagina di registrazione dell'app.
 * @returns {boolean}
 */
export function configLegaleAttiva() {
  const config = {
    ACCETTAZIONE_LEGALE_ATTIVA,
    DOCUMENTI_LEGALI,
    VERSIONI_CASELLE,
    COOKIE_URL,
  };
  return ACCETTAZIONE_LEGALE_ATTIVA === true && validaConfigLegale(config, true).ok;
}

/**
 * @returns {Array<{ id: string, htmlParti: Array<{ tipo: 'testo'|'link', testo: string, href?: string }> }>}
 */
export function caselleLegali() {
  if (!configLegaleAttiva()) return [];
  const documenti = DOCUMENTI_LEGALI;
  const caselle = [
    {
      id: 'termini',
      htmlParti: [
        { tipo: 'testo', testo: 'Ho letto e accetto i ' },
        { tipo: 'link', testo: 'Termini di servizio', href: documenti['termini-b2b'].url },
        { tipo: 'testo', testo: " e ho letto l'" },
        { tipo: 'link', testo: 'Informativa privacy', href: documenti.privacy.url },
        { tipo: 'testo', testo: ' di GFV.' },
      ],
    },
    {
      id: 'dpa',
      htmlParti: [
        { tipo: 'testo', testo: 'Accetto il ' },
        { tipo: 'link', testo: 'DPA', href: documenti.dpa.url },
        {
          tipo: 'testo',
          testo:
            ': per i dati dei lavoratori e dei clienti della mia azienda io sono titolare e GFV è responsabile. Dichiaro di poter accettare per conto dell\'azienda.',
        },
      ],
    },
  ];
  if (typeof COOKIE_URL === 'string' && COOKIE_URL.indexOf('https://') === 0) {
    caselle.push({
      id: 'cookie',
      soloLink: true,
      htmlParti: [{ tipo: 'link', testo: 'Cookie', href: COOKIE_URL }],
    });
  }
  return caselle;
}

/**
 * Stessi controlli e messaggi di registrazione-standalone.html (righe 535–600).
 * @param {{ email?: string, password?: string, conferma?: string, aziendaNome?: string, caselle?: { termini?: boolean, dpa?: boolean } }} dati
 */
export function validaModuloRegistrazione({ email, password, conferma, aziendaNome, caselle }) {
  /** @type {Record<string, string>} */
  const errori = {};
  const mail = String(email || '').trim();
  if (!mail) errori.email = 'Email obbligatoria';
  else if (!mail.includes('@')) errori.email = 'Email non valida';

  const pwd = String(password || '');
  if (!pwd) errori.password = 'Password obbligatoria';
  else if (pwd.length < 6) errori.password = 'Password deve essere almeno 6 caratteri';

  const conf = String(conferma || '');
  if (!conf) errori.conferma = 'Conferma password obbligatoria';
  else if (pwd !== conf) errori.conferma = 'Le password non corrispondono';

  if (!String(aziendaNome || '').trim()) errori.azienda = 'Nome azienda obbligatorio';

  if (configLegaleAttiva()) {
    const okCaselle = validaCaselleRegistrazione({
      termini: !!(caselle && caselle.termini),
      dpa: !!(caselle && caselle.dpa),
    });
    if (!caselle || caselle.termini !== true) {
      errori.termini = 'Spunta la casella per continuare.';
    }
    if (!caselle || caselle.dpa !== true) {
      errori.dpa = 'Spunta la casella per continuare.';
    }
    if (!okCaselle && !errori.termini && !errori.dpa) {
      errori.termini = 'Spunta la casella per continuare.';
    }
  }

  return { ok: Object.keys(errori).length === 0, errori };
}

/**
 * @param {string} codice
 * @returns {string}
 */
export function messaggioEsito(codice) {
  const t = testiLanding.tonyBussa.registrazione;
  const mappa = t.errori || {};
  if (codice && mappa[codice]) return mappa[codice];
  return mappa.sconosciuto || '';
}

/**
 * @param {string} email
 * @returns {string}
 */
export function urlDashboardDopoRegistrazione(email) {
  return urlLoginConEmail(URL_LOGIN, email, { registrato: true });
}

/**
 * @param {{
 *   dati: { email: string, password: string, aziendaNome: string, caselle?: object },
 *   fb: object,
 *   attendi?: (ms: number) => Promise<void>
 * }} opts
 */
export async function eseguiRegistrazione({ dati, fb, attendi }) {
  const emailNorm = normalizzaEmailRegistrazione(dati && dati.email);
  try {
    const esito = await creaAccountTitolare({
      email: emailNorm,
      password: dati.password,
      aziendaNome: String((dati && dati.aziendaNome) || '').trim(),
      campiNome: {},
      fb,
      attendi,
    });

    if (configLegaleAttiva() && typeof fb.chiamaAccettazione === 'function') {
      try {
        const payload = costruisciPayloadAccettazione({
          canale: 'registrazione',
          tenantId: esito.tenantId,
          ruolo: 'amministratore',
          documenti: ['termini-b2b', 'privacy', 'dpa'],
          config: {
            ACCETTAZIONE_LEGALE_ATTIVA,
            DOCUMENTI_LEGALI,
            VERSIONI_CASELLE,
            COOKIE_URL,
          },
        });
        await fb.chiamaAccettazione(Object.assign({ azione: 'registra' }, payload));
      } catch {
        return { esito: 'ok-legale-rimandata', codice: null, email: emailNorm };
      }
    }

    return { esito: 'ok', codice: null, email: emailNorm };
  } catch (err) {
    const stato = err && err.statoRegistrazione;
    if (stato && stato.utente && stato.userDocCreato !== true) {
      await annullaRegistrazioneParziale({
        fb,
        stato: {
          utente: stato.utente,
          tenantId: stato.tenantId,
          tenantCreato: stato.tenantCreato === true,
        },
      });
    }
    return {
      esito: 'errore',
      codice: codiceErroreRegistrazione(err),
      email: emailNorm,
    };
  }
}

export { URL_REGISTRAZIONE };
