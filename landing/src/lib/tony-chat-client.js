/**
 * Chiamata a tonyLandingAsk e lettura dello stream SSE.
 * Nessun import da Firebase: il token arriva da ottieniToken (passata da TonyStage).
 */

import { URL_TONY_LANDING_ASK } from '../config/landing-config.js';
import { corpoRichiesta, creaLettoreSse } from './tony-chat-logica.js';

const TIMEOUT_MS = 30000;

/**
 * @param {{
 *   domanda: string,
 *   sessione: string,
 *   storia: Array,
 *   ottieniToken: () => Promise<string | null>,
 *   ottieniTokenAccesso?: () => Promise<string | null>,
 *   fase?: string,
 *   argomento?: string,
 *   onPezzo?: (delta: string) => void,
 *   segnale?: AbortSignal,
 *   fetchFn?: typeof fetch,
 *   url?: string,
 * }} args
 * @returns {Promise<{ codice: string, testo?: string, mostraRegistrazione?: boolean, domandeRimaste?: number, http?: number, voce?: boolean, idVoce?: string, dati?: object, troppiTerreni?: boolean, fase?: string }>}
 */
export async function chiediATony({
  domanda,
  sessione,
  storia,
  ottieniToken,
  ottieniTokenAccesso,
  fase,
  argomento,
  onPezzo,
  segnale,
  fetchFn = fetch,
  url = URL_TONY_LANDING_ASK,
}) {
  let token = null;
  try {
    token = await ottieniToken();
  } catch {
    token = null;
  }
  if (!token) {
    logDev('app-check-mancante');
    return { codice: 'app-check-mancante' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Firebase-AppCheck': token,
  };

  if (fase === 'account') {
    let idToken = null;
    try {
      idToken =
        typeof ottieniTokenAccesso === 'function'
          ? await ottieniTokenAccesso()
          : null;
    } catch {
      idToken = null;
    }
    if (!idToken) {
      logDev('accesso-mancante');
      return { codice: 'accesso-mancante', http: 401, fase: 'account' };
    }
    headers.Authorization = 'Bearer ' + idToken;
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
      headers,
      body: JSON.stringify(
        corpoRichiesta({ domanda, sessione, storia, fase, argomento })
      ),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });

    const http = risposta.status;
    const tipo = (risposta.headers && risposta.headers.get)
      ? String(risposta.headers.get('content-type') || '')
      : '';

    if (http !== 200 || !tipo.includes('text/event-stream')) {
      let codice = 'errore';
      try {
        const json = await risposta.json();
        if (json && typeof json.codice === 'string') codice = json.codice;
      } catch {
        /* niente corpo JSON */
      }
      if (http === 401) {
        if (codice === 'accesso-mancante' || codice === 'accesso-non-valido') {
          /* già corretto */
        } else if (!codice.startsWith('app-check')) {
          codice = fase === 'account' ? 'accesso-non-valido' : 'app-check-non-valido';
        }
      }
      logDev(codice);
      return { codice, http, fase: fase === 'account' ? 'account' : undefined };
    }

    const lettore = creaLettoreSse();
    const reader = risposta.body && risposta.body.getReader
      ? risposta.body.getReader()
      : null;
    if (!reader) {
      logDev('errore');
      return { codice: 'errore', http };
    }

    const decoder = new TextDecoder();
    let doneEsito = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const pezzo = decoder.decode(value, { stream: true });
      const eventi = lettore.aggiungi(pezzo);
      for (const ev of eventi) {
        if (ev.evento === 'chunk' && ev.dati && typeof ev.dati.delta === 'string') {
          if (typeof onPezzo === 'function') onPezzo(ev.dati.delta);
        }
        if (ev.evento === 'done' && ev.dati && typeof ev.dati === 'object') {
          doneEsito = ev.dati;
        }
      }
    }
    const coda = lettore.aggiungi('\n\n');
    for (const ev of coda) {
      if (ev.evento === 'chunk' && ev.dati && typeof ev.dati.delta === 'string') {
        if (typeof onPezzo === 'function') onPezzo(ev.dati.delta);
      }
      if (ev.evento === 'done' && ev.dati && typeof ev.dati === 'object') {
        doneEsito = ev.dati;
      }
    }

    if (!doneEsito) {
      logDev('errore');
      return { codice: 'errore', http };
    }

    const codice = typeof doneEsito.codice === 'string' ? doneEsito.codice : 'errore';
    logDev(codice);
    const risultato = {
      codice,
      testo: typeof doneEsito.testo === 'string' ? doneEsito.testo : '',
      mostraRegistrazione: doneEsito.mostraRegistrazione === true,
      domandeRimaste:
        typeof doneEsito.domandeRimaste === 'number'
          ? doneEsito.domandeRimaste
          : undefined,
      voce: doneEsito.voce === true,
      http,
    };
    if (fase === 'account') risultato.fase = 'account';
    if (doneEsito.dati && typeof doneEsito.dati === 'object') {
      risultato.dati = doneEsito.dati;
    }
    if (doneEsito.troppiTerreni === true) risultato.troppiTerreni = true;
    if (
      typeof doneEsito.idVoce === 'string' &&
      /^[a-f0-9]{32}$/.test(doneEsito.idVoce)
    ) {
      risultato.idVoce = doneEsito.idVoce;
    }
    return risultato;
  } catch (err) {
    const nome = err && err.name === 'AbortError' ? 'errore' : 'rete';
    logDev(nome);
    return { codice: nome };
  } finally {
    clearTimeout(timer);
    if (segnale) segnale.removeEventListener('abort', onAbortEsterno);
  }
}

function logDev(codice) {
  try {
    if (import.meta.env && import.meta.env.DEV) {
      console.info('[landing] tony:', codice);
    }
  } catch {
    /* ambiente senza import.meta */
  }
}
