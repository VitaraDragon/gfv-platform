/**
 * App Check per le funzioni nuove della landing (decisione D2).
 * Unico file della landing che importa Firebase e reCAPTCHA.
 * Lo carica solo TonyStage.vue con import() dopo la prima casella
 * (quando Tony è entrato). Non serve all'app su github.io.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken,
} from 'firebase/app-check';
import {
  CHIAVE_SITO_APP_CHECK,
  CONFIG_FIREBASE_WEB,
} from '../config/firebase-landing-config.js';
import {
  codiceErrore,
  protezioneConfigurata,
  usaTokenDebug,
} from './firebase-landing-logica.js';

/** @type {import('firebase/app').FirebaseApp | null} */
let app = null;
/** @type {import('firebase/app-check').AppCheck | null} */
let appCheck = null;
/** @type {Promise<{ pronta: boolean, motivo?: 'non-configurata' | 'errore' }> | null} */
let promessaAvvio = null;

/**
 * Avvia App Check una sola volta per pagina.
 * Non lancia eccezioni e non blocca la scena di Tony.
 * @returns {Promise<{ pronta: boolean, motivo?: 'non-configurata' | 'errore' }>}
 */
export function avviaProtezione() {
  if (promessaAvvio) return promessaAvvio;
  promessaAvvio = eseguiAvvio();
  return promessaAvvio;
}

async function eseguiAvvio() {
  if (!protezioneConfigurata(CHIAVE_SITO_APP_CHECK)) {
    return { pronta: false, motivo: 'non-configurata' };
  }

  try {
    const host =
      typeof window !== 'undefined' && window.location
        ? window.location.hostname
        : '';
    if (
      usaTokenDebug({
        dev: import.meta.env.DEV === true,
        modo: import.meta.env.MODE,
        hostname: host,
      })
    ) {
      // Solo true: il browser genera da solo il token (mai una stringa nel codice).
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    app = getApps()[0] || initializeApp(CONFIG_FIREBASE_WEB);
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(CHIAVE_SITO_APP_CHECK),
      isTokenAutoRefreshEnabled: true,
    });

    await getToken(appCheck, false);

    if (import.meta.env.DEV) {
      console.info('[landing] App Check pronto');
    }
    return { pronta: true };
  } catch (err) {
    console.warn('[landing] App Check non pronto', codiceErrore(err));
    return { pronta: false, motivo: 'errore' };
  }
}

/**
 * Token App Check per le chiamate (passo 10). Oggi nessuno lo usa.
 * @returns {Promise<string | null>}
 */
export async function tokenAppCheck() {
  const esito = await avviaProtezione();
  if (!esito.pronta || !appCheck) return null;
  try {
    const { token } = await getToken(appCheck, false);
    return typeof token === 'string' && token ? token : null;
  } catch {
    return null;
  }
}

/**
 * App Firebase creata (o null). Serve ai passi 13–14.
 * @returns {import('firebase/app').FirebaseApp | null}
 */
export function appFirebase() {
  return app;
}
