/**
 * Modello finto per prove in locale (solo con npm run dev e ?tonyfinto=…).
 * Stessa firma di chiediATony; ignora ottieniToken.
 * Questo file non deve finire nella build di produzione.
 */

import { MESSAGGI_CHAT } from './tony-chat-logica.js';

/** Nota mostrata nel fumetto solo in sviluppo. */
export const NOTA_MODELLO_FINTO = 'modello finto (solo in locale)';

/**
 * @param {string} [query]
 * @returns {null | 'ok' | 'lento' | 'spento' | 'tetto' | 'limite' | 'dati' | 'errore' | 'rete' | 'appcheck'}
 */
export function parametroFinto(query) {
  const testo = String(query ?? '');
  const inizio = testo.indexOf('?');
  let q = inizio >= 0 ? testo.slice(inizio + 1) : testo;
  const hash = q.indexOf('#');
  if (hash >= 0) q = q.slice(0, hash);
  let valore = null;
  try {
    valore = new URLSearchParams(q).get('tonyfinto');
  } catch {
    return null;
  }
  if (valore === null || valore === '') return null;
  if (valore === '1') return 'ok';
  const ammessi = [
    'ok',
    'lento',
    'spento',
    'tetto',
    'limite',
    'dati',
    'errore',
    'rete',
    'appcheck',
  ];
  if (ammessi.indexOf(valore) >= 0) return /** @type {any} */ (valore);
  return 'ok';
}

const RISPOSTE_PROVA = Object.freeze({
  'cosa fa gfv?':
    'Global Farm View è il gestionale della tua azienda agricola: terreni, lavori e tutto quello che fai ogni giorno, in un posto solo. Si usa dallo smartphone o dal computer.',
  'quanto costa?':
    'Provalo gratis: con l’account gratuito gestisci i terreni senza carta di credito. Se non vuoi limiti passi al piano Base; i moduli si attivano dentro l’app.',
  'come mi aiuta tony?':
    'Tony è l’assistente virtuale con IA di GFV. Con l’account gratuito ti fa da guida nei primi giorni. Qui sulla pagina può solo spiegare: non apre pagine e non salva niente.',
});

const RISPOSTA_DEFAULT =
  'Global Farm View ti aiuta a gestire l’azienda agricola dallo smartphone. Crea l’account gratuito e dentro ti guido io.';

/**
 * @param {{
 *   domanda: string,
 *   sessione: string,
 *   storia: Array,
 *   ottieniToken?: () => Promise<string | null>,
 *   onPezzo?: (delta: string) => void,
 *   segnale?: AbortSignal,
 *   scenario?: string,
 *   sleepFn?: (ms: number) => Promise<void>,
 * }} args
 */
export async function chiediFinto({
  domanda,
  storia,
  onPezzo,
  segnale,
  scenario = 'ok',
  sleepFn,
}) {
  const sleep =
    typeof sleepFn === 'function'
      ? sleepFn
      : (ms) =>
          new Promise((resolve, reject) => {
            const id = setTimeout(resolve, ms);
            if (segnale) {
              if (segnale.aborted) {
                clearTimeout(id);
                reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                return;
              }
              segnale.addEventListener(
                'abort',
                () => {
                  clearTimeout(id);
                  reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                },
                { once: true }
              );
            }
          });

  const sc = String(scenario || 'ok');

  try {
    if (sc === 'rete') return { codice: 'rete' };
    if (sc === 'appcheck') return { codice: 'app-check-mancante' };

    if (sc === 'spento') {
      return {
        codice: 'spento',
        testo: MESSAGGI_CHAT.spento,
        mostraRegistrazione: true,
        domandeRimaste: 0,
      };
    }
    if (sc === 'tetto') {
      return {
        codice: 'tetto',
        testo: MESSAGGI_CHAT.tetto,
        mostraRegistrazione: true,
        domandeRimaste: 0,
      };
    }
    if (sc === 'limite') {
      return {
        codice: 'limite-sessione',
        testo: MESSAGGI_CHAT.limiteSessione,
        mostraRegistrazione: true,
        domandeRimaste: 0,
      };
    }
    if (sc === 'dati') {
      return {
        codice: 'dati-personali',
        testo: MESSAGGI_CHAT.datiPersonali,
        mostraRegistrazione: true,
      };
    }
    if (sc === 'errore') {
      return {
        codice: 'errore',
        testo: MESSAGGI_CHAT.errore,
        mostraRegistrazione: true,
      };
    }

    const domandeFatte = contaDomandeOk(storia);
    if (domandeFatte >= 14) {
      return {
        codice: 'limite-sessione',
        testo: MESSAGGI_CHAT.limiteSessione,
        mostraRegistrazione: true,
        domandeRimaste: 0,
      };
    }

    const attesaIniziale = sc === 'lento' ? 6000 : 700;
    await sleep(attesaIniziale);

    const chiave = String(domanda || '')
      .trim()
      .toLowerCase();
    const testoCompleto = RISPOSTE_PROVA[chiave] || RISPOSTA_DEFAULT;
    const pezzi = spezzaInPezzi(testoCompleto);
    for (const pezzo of pezzi) {
      if (segnale && segnale.aborted) {
        return { codice: 'errore' };
      }
      if (typeof onPezzo === 'function') onPezzo(pezzo);
      await sleep(80);
    }

    const domandeRimaste = Math.max(0, 14 - domandeFatte);

    return {
      codice: 'ok',
      testo: testoCompleto,
      mostraRegistrazione: false,
      domandeRimaste,
      voce: false,
    };
  } catch (err) {
    if (err && err.name === 'AbortError') return { codice: 'errore' };
    return { codice: 'rete' };
  }
}

function spezzaInPezzi(testo) {
  const parole = String(testo).split(/\s+/).filter(Boolean);
  const pezzi = [];
  let i = 0;
  while (i < parole.length) {
    const n = 3 + Math.floor(Math.random() * 4);
    pezzi.push(parole.slice(i, i + n).join(' ') + (i + n < parole.length ? ' ' : ''));
    i += n;
  }
  return pezzi.length ? pezzi : [testo];
}

function contaDomandeOk(storia) {
  if (!Array.isArray(storia)) return 0;
  return storia.filter((b) => b && b.ruolo === 'utente').length;
}
