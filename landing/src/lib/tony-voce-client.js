/**
 * Chiamata a tonyLandingAudio. Nessun import da Firebase:
 * il token arriva da ottieniToken (passata da TonyStage).
 */

import { URL_TONY_LANDING_AUDIO } from '../config/landing-config.js';
import { corpoRichiestaVoce } from './tony-chat-logica.js';

const TIMEOUT_MS = 20000;
const MAX_BLOB_BYTE = 3000000;

/**
 * @param {{
 *   idVoce: string,
 *   sessione: string,
 *   testo: string,
 *   ottieniToken: () => Promise<string | null>,
 *   segnale?: AbortSignal,
 *   fetchFn?: typeof fetch,
 *   url?: string,
 * }} args
 * @returns {Promise<{ ok: true, blob: Blob } | { ok: false, codice: string, http?: number }>}
 */
export async function chiediVoce({
  idVoce,
  sessione,
  testo,
  ottieniToken,
  segnale,
  fetchFn = fetch,
  url = URL_TONY_LANDING_AUDIO,
}) {
  let token = null;
  try {
    token = await ottieniToken();
  } catch {
    token = null;
  }
  if (!token) {
    logDev('app-check-mancante');
    return { ok: false, codice: 'app-check-mancante' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbortEsterno = () => controller.abort();
  if (segnale) {
    if (segnale.aborted) controller.abort();
    else segnale.addEventListener('abort', onAbortEsterno, { once: true });
  }

  try {
    const risposta = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-AppCheck': token,
      },
      body: JSON.stringify(corpoRichiestaVoce({ idVoce, sessione, testo })),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });

    const http = risposta.status;
    const tipo = risposta.headers && risposta.headers.get
      ? String(risposta.headers.get('content-type') || '')
      : '';

    if (http === 200 && tipo.toLowerCase().startsWith('audio/mpeg')) {
      const blob = await risposta.blob();
      if (!blob || blob.size <= 0 || blob.size > MAX_BLOB_BYTE) {
        logDev('voce-errore');
        return { ok: false, codice: 'voce-errore', http };
      }
      logDev('ok');
      return { ok: true, blob };
    }

    let codice = 'voce-errore';
    try {
      const json = await risposta.json();
      if (json && typeof json.codice === 'string') codice = json.codice;
    } catch {
      /* niente corpo JSON */
    }
    logDev(codice);
    return { ok: false, codice, http };
  } catch (err) {
    const nome = err && err.name === 'AbortError' ? 'voce-errore' : 'rete';
    logDev(nome);
    return { ok: false, codice: nome };
  } finally {
    clearTimeout(timer);
    if (segnale) segnale.removeEventListener('abort', onAbortEsterno);
  }
}

function logDev(codice) {
  try {
    if (import.meta.env && import.meta.env.DEV) {
      console.info('[landing] tony voce:', codice);
    }
  } catch {
    /* ambiente senza import.meta */
  }
}
