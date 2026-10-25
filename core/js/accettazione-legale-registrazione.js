/**
 * Registrazione (landing o invito): accettazione legale DOPO che account e membership esistono.
 * Se fallisce solo la callable, l'account resta valido: niente rollback, niente deleteUser.
 * L'utente prosegue verso la dashboard e il gate di ingresso gli richiede l'accettazione.
 * Flag spento: la callable non viene mai chiamata.
 * @module core/js/accettazione-legale-registrazione
 */

export const ESITO_ACCETTAZIONE = Object.freeze({
  SALTATA: 'saltata',
  REGISTRATA: 'registrata',
  RIMANDATA: 'rimandata'
});

export const MESSAGGIO_ACCETTAZIONE_RIMANDATA = 'Account creato. Conferma le condizioni al primo accesso.';

/**
 * @param {{ attiva?: boolean, registra?: () => Promise<unknown>, avvisa?: (err: unknown) => void }} opts
 * @returns {Promise<'saltata'|'registrata'|'rimandata'>} non lancia mai
 */
export async function registraAccettazioneDopoAccount(opts) {
  const o = opts || {};
  if (o.attiva !== true || typeof o.registra !== 'function') return ESITO_ACCETTAZIONE.SALTATA;
  try {
    await o.registra();
    return ESITO_ACCETTAZIONE.REGISTRATA;
  } catch (err) {
    try {
      if (typeof o.avvisa === 'function') o.avvisa(err);
      else console.warn('[accettazione-legale] registrazione rimandata al primo accesso');
    } catch (_) { /* ignore */ }
    return ESITO_ACCETTAZIONE.RIMANDATA;
  }
}

/**
 * Testo del messaggio di esito: con accettazione rimandata avvisa l'utente, poi il redirect è lo stesso.
 * @param {string} esito
 * @param {string} messaggioOk
 * @returns {string}
 */
export function messaggioFineRegistrazione(esito, messaggioOk) {
  if (esito === ESITO_ACCETTAZIONE.RIMANDATA) {
    return '✅ ' + MESSAGGIO_ACCETTAZIONE_RIMANDATA + ' Reindirizzamento alla dashboard...';
  }
  return messaggioOk;
}
