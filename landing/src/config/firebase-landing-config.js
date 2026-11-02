/**
 * Configurazione web pubblica di Firebase per la landing (App Check).
 * Stessi valori di core/config/firebase-config.js (app web gfv-platform).
 * Non sono segreti: sono già pubblici nell'app su github.io.
 * Lo importa solo il modulo App Check della landing (pezzo caricato dopo la prima casella).
 */

/** @type {Readonly<{ apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string }>} */
export const CONFIG_FIREBASE_WEB = Object.freeze({
  apiKey: 'AIzaSyBOqH6Oax3_JRQhMaU8Fp36wxgYo3s_pw0',
  authDomain: 'gfv-platform.firebaseapp.com',
  projectId: 'gfv-platform',
  storageBucket: 'gfv-platform.firebasestorage.app',
  messagingSenderId: '495860225347',
  appId: '1:495860225347:web:79edd2bdd78fe92f0bcbf6',
});

/**
 * Chiave sito pubblica (App Check / protezione della landing).
 * Creata da Pier in Google Cloud per i domini della landing.
 * Vuota = protezione spenta (nessun caricamento).
 */
export const CHIAVE_SITO_APP_CHECK = '6LfzRwMuAAAAAMBsCosTZDNXXGVlhzgajk__xjYn';
