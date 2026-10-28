/**
 * Logica pura della chat di Tony sulla landing (passo 12a).
 * Niente DOM, niente fetch, niente Vue, niente Firebase.
 */

export const MAX_CARATTERI_DOMANDA = 300;
export const MAX_BATTUTE_STORIA = 6;
export const MAX_CARATTERI_BATTUTA_TONY = 600;

/** Frasi fisse (copie di MESSAGGI in functions/lib/tony-landing-limiti.js). */
export const MESSAGGI_CHAT = Object.freeze({
  // BOZZA: da far rivedere
  spento: 'Tony è nei campi. Intanto prova GFV!',
  // BOZZA: da far rivedere
  tetto: 'Tony è nei campi. Intanto prova GFV!',
  // BOZZA: da far rivedere
  limiteSessione:
    "Per oggi ci fermiamo qui: crea il tuo account gratuito e continuiamo dentro GFV!",
  // BOZZA: da far rivedere
  limiteGiorno:
    "Per oggi ci fermiamo qui: crea il tuo account gratuito e continuiamo dentro GFV!",
  // BOZZA: da far rivedere
  limiteGlobale:
    "Oggi ho risposto a tante domande e sono un po' stanco. Intanto prova GFV!",
  // BOZZA: da far rivedere
  datiPersonali:
    "Qui non scrivermi email o password: quando crei l'account te le chiede il modulo.",
  // BOZZA: da far rivedere
  errore: 'In questo momento non riesco a risponderti. Intanto prova GFV!',
});

const ALFABETO_SESSIONE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-';

/**
 * @param {string} [testo]
 * @returns {string}
 */
export function pulisciDomanda(testo) {
  return String(testo ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Email o password con valore. Domande normali sulla password restano false.
 * @param {string} testo
 * @returns {boolean}
 */
export function contieneDatiPersonaliChat(testo) {
  if (typeof testo !== 'string' || !testo) return false;
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(testo)) return true;
  if (/\bpassword\s*[:=]/i.test(testo)) return true;
  if (/\b(pwd|passwd|pass)\s*[:=]/i.test(testo)) return true;
  if (/parola\s+d['']ordine\s*[:=]/i.test(testo)) return true;
  // Niente \\b prima di «è»: in JS non è una lettera ASCII, il confine di parola fallisce.
  if (
    /\b(password|pwd|passwd|pass)\b[\s,]*(?:è|e'|é|sarebbe)\s+\S/i.test(testo) ||
    /parola\s+d['']ordine[\s,]*(?:è|e'|é|sarebbe|:|=)\s*\S/i.test(testo)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} [testo]
 * @returns {{ ok: true, domanda: string } | { ok: false, motivo: 'vuota' | 'troppo-lunga' | 'dati-personali' }}
 */
export function validaDomanda(testo) {
  const domanda = pulisciDomanda(testo);
  if (contieneDatiPersonaliChat(domanda)) {
    return { ok: false, motivo: 'dati-personali' };
  }
  if (!domanda) return { ok: false, motivo: 'vuota' };
  if (domanda.length > MAX_CARATTERI_DOMANDA) {
    return { ok: false, motivo: 'troppo-lunga' };
  }
  return { ok: true, domanda };
}

/**
 * @param {() => string} [generatore]
 * @returns {string}
 */
export function nuovaSessione(generatore) {
  let raw = '';
  if (typeof generatore === 'function') {
    try {
      raw = String(generatore() || '');
    } catch {
      raw = '';
    }
  }
  if (!raw) {
    let s = '';
    for (let i = 0; i < 32; i += 1) {
      s += ALFABETO_SESSIONE.charAt(Math.floor(Math.random() * ALFABETO_SESSIONE.length));
    }
    raw = s;
  }
  const pulita = raw.replace(/[^A-Za-z0-9-]/g, '');
  if (pulita.length >= 16 && pulita.length <= 64) return pulita;
  if (pulita.length > 64) return pulita.slice(0, 64);
  let s = pulita;
  while (s.length < 16) {
    s += ALFABETO_SESSIONE.charAt(Math.floor(Math.random() * ALFABETO_SESSIONE.length));
  }
  return s;
}

/**
 * @param {Array<{ ruolo?: string, testo?: string }>} storia
 * @param {{ ruolo: 'utente' | 'tony', testo: string }} battuta
 * @returns {Array<{ ruolo: 'utente' | 'tony', testo: string }>}
 */
export function aggiornaStoria(storia, battuta) {
  const lista = Array.isArray(storia) ? storia.slice() : [];
  if (!battuta || (battuta.ruolo !== 'utente' && battuta.ruolo !== 'tony')) {
    return lista.slice(-MAX_BATTUTE_STORIA);
  }
  let testo = String(battuta.testo ?? '');
  if (battuta.ruolo === 'tony' && testo.length > MAX_CARATTERI_BATTUTA_TONY) {
    testo = testo.slice(0, MAX_CARATTERI_BATTUTA_TONY);
  }
  lista.push({ ruolo: battuta.ruolo, testo });
  if (lista.length > MAX_BATTUTE_STORIA) {
    return lista.slice(lista.length - MAX_BATTUTE_STORIA);
  }
  return lista;
}

/**
 * @param {{ domanda: string, sessione: string, storia: Array }} args
 */
export function corpoRichiesta({ domanda, sessione, storia }) {
  return { domanda, sessione, storia };
}

/**
 * Lettore SSE a pezzi: eventi spezzati, \\r\\n, commenti, JSON rotto.
 * @returns {{ aggiungi: (pezzo: string) => Array<{ evento: string, dati: object | null }> }}
 */
export function creaLettoreSse() {
  let buffer = '';

  function aggiungi(pezzoDiTesto) {
    buffer += String(pezzoDiTesto ?? '');
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const eventi = [];
    let separatore;
    while ((separatore = buffer.indexOf('\n\n')) >= 0) {
      const blocco = buffer.slice(0, separatore);
      buffer = buffer.slice(separatore + 2);
      const parsato = parseBloccoSse(blocco);
      if (parsato) eventi.push(parsato);
    }
    return eventi;
  }

  return { aggiungi };
}

function parseBloccoSse(blocco) {
  const righe = blocco.split('\n');
  let evento = 'message';
  const datiRighe = [];
  for (const riga of righe) {
    if (!riga || riga.startsWith(':')) continue;
    if (riga.startsWith('event:')) {
      evento = riga.slice(6).trim();
      continue;
    }
    if (riga.startsWith('data:')) {
      datiRighe.push(riga.slice(5).trimStart());
    }
  }
  if (!datiRighe.length) return null;
  const grezzo = datiRighe.join('\n');
  let dati = null;
  try {
    dati = JSON.parse(grezzo);
  } catch {
    return null;
  }
  return { evento, dati };
}

/**
 * @param {{ codice?: string, testo?: string, mostraRegistrazione?: boolean, domandeRimaste?: number, http?: number }} esito
 */
export function azionePerEsito(esito) {
  const e = esito && typeof esito === 'object' ? esito : {};
  const codice = String(e.codice || '');
  const http = typeof e.http === 'number' ? e.http : 0;
  const testoDone = typeof e.testo === 'string' ? e.testo : '';

  if (
    codice === 'app-check-mancante' ||
    codice === 'app-check-non-valido' ||
    http === 401
  ) {
    return {
      tipo: 'statico',
      testo: MESSAGGI_CHAT.spento,
      mostraRegistrazione: true,
      campoAttivo: false,
    };
  }

  if (
    http === 403 ||
    http === 400 ||
    http === 405 ||
    http === 413 ||
    http === 503 ||
    codice === 'rete' ||
    codice === 'errore'
  ) {
    return {
      tipo: 'statico',
      testo: testoDone || MESSAGGI_CHAT.errore,
      mostraRegistrazione: true,
      campoAttivo: false,
    };
  }

  if (codice === 'ok') {
    const domandeRimaste =
      typeof e.domandeRimaste === 'number' ? e.domandeRimaste : undefined;
    if (domandeRimaste === 0) {
      return {
        tipo: 'limite',
        testo: testoDone || MESSAGGI_CHAT.limiteSessione,
        mostraRegistrazione: true,
        campoAttivo: false,
      };
    }
    return {
      tipo: 'risposta',
      testo: testoDone || MESSAGGI_CHAT.errore,
      mostraRegistrazione: e.mostraRegistrazione === true,
      campoAttivo: true,
    };
  }

  if (codice === 'limite-sessione' || codice === 'limite-giorno') {
    return {
      tipo: 'limite',
      testo: testoDone || MESSAGGI_CHAT.limiteSessione,
      mostraRegistrazione: true,
      campoAttivo: false,
    };
  }

  if (codice === 'dati-personali') {
    return {
      tipo: 'filtro',
      testo: testoDone || MESSAGGI_CHAT.datiPersonali,
      mostraRegistrazione: true,
      campoAttivo: true,
    };
  }

  if (
    codice === 'spento' ||
    codice === 'tetto' ||
    codice === 'limite-globale'
  ) {
    return {
      tipo: 'statico',
      testo: testoDone || MESSAGGI_CHAT[codice === 'limite-globale' ? 'limiteGlobale' : codice] || MESSAGGI_CHAT.errore,
      mostraRegistrazione: true,
      campoAttivo: false,
    };
  }

  return {
    tipo: 'statico',
    testo: MESSAGGI_CHAT.errore,
    mostraRegistrazione: true,
    campoAttivo: false,
  };
}
