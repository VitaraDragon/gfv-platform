/**
 * Scelta del lavoro per Segna ore a partire dal testo dell'utente.
 * Nessun DOM e nessun Firebase: le pagine passano l'elenco.
 * @module core/js/tony/tony-ora-lavoro-match
 */

import { chiaveGiornoOra } from '../../services/ore-operai-logic.js';

/**
 * Parole che non identificano un lavoro.
 * Le prime sono quelle già usate dal widget; in coda le parole vuote della frase ore
 * («segnami», «nessuna pausa») che altrimenti sembrerebbero un nome.
 */
export const TONY_ORA_LAVORO_USER_MATCH_STOP = {
  segnare: 1,
  segniamo: 1,
  segnami: 1,
  segna: 1,
  registare: 1,
  registrare: 1,
  oggi: 1,
  ieri: 1,
  ore: 1,
  orario: 1,
  orari: 1,
  lavoro: 1,
  lavori: 1,
  nelle: 1,
  nella: 1,
  nello: 1,
  negli: 1,
  delle: 1,
  della: 1,
  minuti: 1,
  pausa: 1,
  inizio: 1,
  fine: 1,
  dalle: 1,
  alle: 1,
  confermo: 1,
  certo: 1,
  perfetto: 1,
  quanti: 1,
  vuoi: 1,
  quando: 1,
  dopo: 1,
  prima: 1,
  turno: 1,
  vuole: 1,
  indicami: 1,
  nessuna: 1,
  nessun: 1,
  niente: 1,
  nulla: 1,
  salva: 1,
  salvare: 1,
  pronto: 1,
  bene: 1
};

/**
 * @param {string} testo
 * @returns {string[]}
 */
export function tokenLavoroSignificativi(testo) {
  if (!testo || typeof testo !== 'string') return [];
  return testo.toLowerCase().split(/[^a-zàèéìòù0-9]+/i).filter((t) => {
    if (!t || t.length < 4) return false;
    if (/^\d+$/.test(t)) return false;
    if (TONY_ORA_LAVORO_USER_MATCH_STOP[t]) return false;
    return true;
  });
}

/**
 * @param {object|null|undefined} lavoro
 * @returns {string}
 */
export function nomeLavoroVisibile(lavoro) {
  if (!lavoro) return '';
  return String(lavoro.nome || lavoro.label || '').trim();
}

function testoAlias(lavoro) {
  const alias = lavoro && lavoro.alias;
  if (Array.isArray(alias)) return alias.join(' ');
  return alias ? String(alias) : '';
}

function testoConfrontoLavoro(lavoro) {
  return `${lavoro.nome || ''} ${lavoro.label || ''} ${lavoro.tipoLavoro || ''} ${testoAlias(lavoro)}`.toLowerCase();
}

function giornoDelLavoro(lavoro) {
  if (!lavoro) return '';
  return chiaveGiornoOra(lavoro.dataInizio || lavoro.data || lavoro.dataLavoro || '') || '';
}

function dataDiversaDaOggi(lavoro, oggiIso) {
  if (!oggiIso) return false;
  const giorno = giornoDelLavoro(lavoro);
  if (!giorno) return false;
  return giorno !== oggiIso;
}

function punteggioLavoro(tokens, lavoro) {
  const hay = testoConfrontoLavoro(lavoro);
  let score = 0;
  for (const tok of tokens) {
    if (hay.indexOf(tok) >= 0) score += tok.length;
  }
  return score;
}

function lavoriDiOggi(list, oggiIso) {
  return list.filter((lavoro) => !dataDiversaDaOggi(lavoro, oggiIso));
}

/**
 * Ricava il lavoro dal testo. Mai la prima voce della lista.
 *
 * @param {string} testoUtente
 * @param {object[]} lavori
 * @param {{ oggiIso?: string }} [opts]
 * @returns {{ stato: 'unico'|'ambiguo'|'nessuno', lavoro: object|null, candidati: object[], nominato: boolean }}
 */
export function risolviLavoroDaTesto(testoUtente, lavori, opts) {
  const oggiIso = opts && opts.oggiIso ? String(opts.oggiIso) : '';
  const list = (Array.isArray(lavori) ? lavori : []).filter((lavoro) => lavoro && lavoro.id);
  const tokens = tokenLavoroSignificativi(testoUtente);
  const diOggi = lavoriDiOggi(list, oggiIso);

  if (!tokens.length) {
    return { stato: 'nessuno', lavoro: null, candidati: diOggi, nominato: false };
  }

  const conPunteggio = list
    .map((lavoro) => ({ lavoro, score: punteggioLavoro(tokens, lavoro) }))
    .filter((riga) => riga.score > 0);

  if (!conPunteggio.length) {
    return { stato: 'nessuno', lavoro: null, candidati: diOggi, nominato: true };
  }

  conPunteggio.sort((a, b) => b.score - a.score);
  const meglio = conPunteggio[0].score;
  let inTesta = conPunteggio.filter((riga) => riga.score === meglio);

  const vincitoreFuoriOggi = inTesta.length === 1 && dataDiversaDaOggi(inTesta[0].lavoro, oggiIso);
  if (vincitoreFuoriOggi && conPunteggio.length > 1) {
    const soloOggi = conPunteggio.filter((riga) => !dataDiversaDaOggi(riga.lavoro, oggiIso));
    if (!soloOggi.length) {
      return { stato: 'nessuno', lavoro: null, candidati: diOggi, nominato: true };
    }
    soloOggi.sort((a, b) => b.score - a.score);
    const meglioOggi = soloOggi[0].score;
    inTesta = soloOggi.filter((riga) => riga.score === meglioOggi);
  }

  const ids = new Set(inTesta.map((riga) => String(riga.lavoro.id)));
  if (ids.size >= 2) {
    return {
      stato: 'ambiguo',
      lavoro: null,
      candidati: inTesta.map((riga) => riga.lavoro),
      nominato: true
    };
  }

  return {
    stato: 'unico',
    lavoro: inTesta[0].lavoro,
    candidati: [inTesta[0].lavoro],
    nominato: true
  };
}

/**
 * Domanda quando il lavoro non è uno solo. Stringa vuota se non serve chiedere.
 * @param {{ stato?: string, nominato?: boolean, candidati?: object[] }|null} esito
 * @returns {string}
 */
export function messaggioSceltaLavoroOre(esito) {
  if (!esito) return '';
  const nomi = (esito.candidati || []).map(nomeLavoroVisibile).filter(Boolean);
  if (esito.stato === 'ambiguo') {
    const elenco = nomi.slice(0, 6).join(', ');
    return `Su quale lavoro? Ho trovato: ${elenco}. Dimmi il nome.`;
  }
  if (esito.stato === 'nessuno' && esito.nominato) {
    const elenco = nomi.length ? nomi.slice(0, 8).join(', ') : 'nessuno';
    return `Non trovo un lavoro con quel nome. I lavori di oggi sono: ${elenco}.`;
  }
  return '';
}

/**
 * Valore per il select del lavoro: id esatto, oppure un solo nome.
 * Se non è univoco restituisce null e il select non va toccato.
 *
 * @param {string} valore
 * @param {{ value?: string, text?: string }[]} opzioni
 * @returns {string|null}
 */
export function risolviValoreSelectLavoro(valore, opzioni) {
  const valStr = String(valore || '').trim();
  if (!valStr) return null;
  const opts = (Array.isArray(opzioni) ? opzioni : []).filter((o) => o && String(o.value || '').trim());
  const perId = opts.find((o) => String(o.value) === valStr);
  if (perId) return String(perId.value);
  const lavori = opts.map((o) => ({ id: String(o.value), nome: o.text || '' }));
  const esito = risolviLavoroDaTesto(valStr, lavori, {});
  if (esito.stato === 'unico' && esito.lavoro) return String(esito.lavoro.id);
  const search = valStr.toLowerCase();
  const perTesto = opts.filter((o) => {
    const t = String(o.text || '').toLowerCase();
    return t === search || t.indexOf(search) >= 0;
  });
  if (perTesto.length === 1) return String(perTesto[0].value);
  return null;
}

if (typeof window !== 'undefined') {
  window.TonyOraLavoroMatch = {
    risolviLavoroDaTesto,
    risolviValoreSelectLavoro,
    messaggioSceltaLavoroOre,
    nomeLavoroVisibile
  };
}
