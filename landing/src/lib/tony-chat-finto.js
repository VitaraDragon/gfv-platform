/**
 * Modello finto per prove in locale (solo con npm run dev e ?tonyfinto=…).
 * Stessa firma di chiediATony; ignora ottieniToken.
 * Questo file non deve finire nella build di produzione.
 */

import { MESSAGGI_CHAT } from './tony-chat-logica.js';
import { parametroVoceFinta } from './tony-voce-finta.js';

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
  if (valore === 'noclip') return 'ok';
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

/**
 * Prova «clip assenti» solo in sviluppo (`?tonyfinto=noclip`).
 * @param {string} [query]
 * @returns {boolean}
 */
export function clipFinteAssenti(query) {
  const testo = String(query ?? '');
  const inizio = testo.indexOf('?');
  let q = inizio >= 0 ? testo.slice(inizio + 1) : testo;
  const hash = q.indexOf('#');
  if (hash >= 0) q = q.slice(0, hash);
  try {
    return new URLSearchParams(q).get('tonyfinto') === 'noclip';
  } catch {
    return false;
  }
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
/**
 * @param {string} [query]
 * @returns {string | null}
 */
export function parametroTonyAiuto(query) {
  const testo = String(query ?? '');
  const inizio = testo.indexOf('?');
  let q = inizio >= 0 ? testo.slice(inizio + 1) : testo;
  const hash = q.indexOf('#');
  if (hash >= 0) q = q.slice(0, hash);
  let valore = null;
  try {
    valore = new URLSearchParams(q).get('tonyaiuto');
  } catch {
    return null;
  }
  if (valore === null || valore === '') return null;
  if (valore === '1') return 'ok';
  const ammessi = ['ok', 'troppi', 'categoria', 'vuoto', 'limite', 'accesso'];
  if (ammessi.indexOf(valore) >= 0) return valore;
  return 'ok';
}

export async function chiediFinto({
  domanda,
  storia,
  onPezzo,
  segnale,
  scenario = 'ok',
  fase,
  argomento,
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

  if (fase === 'account') {
    return chiediFintoAccount({
      argomento,
      onPezzo,
      segnale,
      scenario: sc,
      sleep,
    });
  }

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
    const voceSc =
      typeof window !== 'undefined'
        ? parametroVoceFinta(window.location.search)
        : 'ok';
    const conVoce = (sc === 'ok' || sc === 'lento') && voceSc !== 'no';
    const risultato = {
      codice: 'ok',
      testo: testoCompleto,
      mostraRegistrazione: false,
      domandeRimaste,
      voce: conVoce,
    };
    if (conVoce) {
      risultato.idVoce = 'a1b2c3d4e5f6789012345678abcdef01';
    }
    return risultato;
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

async function chiediFintoAccount({ argomento, onPezzo, segnale, scenario, sleep }) {
  const scChat =
    typeof window !== 'undefined'
      ? parametroTonyAiuto(window.location.search) || 'ok'
      : 'ok';
  const sc = scChat === 'ok' && scenario === 'lento' ? 'ok' : scChat;
  const lento = scenario === 'lento';

  if (sc === 'accesso') {
    return { codice: 'accesso-non-valido', http: 401, fase: 'account' };
  }
  if (sc === 'limite') {
    return {
      codice: 'limite-account',
      testo: MESSAGGI_CHAT.limiteAccount,
      fase: 'account',
      mostraRegistrazione: false,
      domandeRimaste: 0,
    };
  }

  await sleep(lento ? 6000 : 700);

  let testo = 'Ok, ho capito.';
  let dati = { sede: null, poderi: [], terreni: [], fatto: true };
  let troppiTerreni = false;

  if (sc === 'vuoto') {
    testo = 'Non ho capito bene: riprova.';
    dati = { sede: null, poderi: [], terreni: [], fatto: false };
  } else if (sc === 'categoria' && argomento === 'terreni') {
    testo = 'Che cosa ci coltivi? Grano, mais, orzo…';
    dati = {
      sede: null,
      poderi: [],
      terreni: [{ nome: 'Campo', superficie: 1, coltura: null, podere: null }],
      fatto: false,
    };
  } else if (sc === 'troppi' && argomento === 'terreni') {
    testo =
      "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.";
    troppiTerreni = true;
    dati = {
      sede: null,
      poderi: [],
      terreni: [
        { nome: 'T1', superficie: 1, coltura: 'Grano', podere: null },
        { nome: 'T2', superficie: 1, coltura: 'Grano', podere: null },
        { nome: 'T3', superficie: 1, coltura: 'Grano', podere: null },
        { nome: 'T4', superficie: 1, coltura: 'Grano', podere: null },
        { nome: 'T5', superficie: 1, coltura: 'Grano', podere: null },
      ],
      fatto: true,
    };
  } else if (argomento === 'sede') {
    testo = 'Ho segnato la sede: controlla dopo nel riepilogo.';
    dati = {
      sede: {
        indirizzo: 'Via Roma 12',
        citta: 'Faenza',
        cap: '48018',
        provincia: 'RA',
      },
      poderi: [],
      terreni: [],
      fatto: true,
    };
  } else if (argomento === 'poderi') {
    testo = 'Ho segnato il podere Casetti.';
    dati = {
      sede: null,
      poderi: [{ nome: 'Casetti' }],
      terreni: [],
      fatto: true,
    };
  } else if (argomento === 'terreni') {
    testo = 'Ho segnato i terreni: controlla il riepilogo.';
    dati = {
      sede: null,
      poderi: [],
      terreni: [
        { nome: 'Campo grande', superficie: 2.34, coltura: 'Grano', podere: 'Casetti' },
        { nome: 'Meleto', superficie: 1.2, coltura: 'Melo', podere: null },
      ],
      fatto: true,
    };
  }

  const pezzi = spezzaInPezzi(testo);
  for (const pezzo of pezzi) {
    if (segnale && segnale.aborted) return { codice: 'errore', fase: 'account' };
    if (typeof onPezzo === 'function') onPezzo(pezzo);
    await sleep(80);
  }

  return {
    codice: 'ok',
    testo,
    fase: 'account',
    dati,
    troppiTerreni,
    mostraRegistrazione: false,
    domandeRimaste: 10,
    voce: false,
  };
}
