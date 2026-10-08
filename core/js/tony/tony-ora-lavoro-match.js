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

function distanzaAlMassimoUno(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let usate = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    usate += 1;
    if (usate > 1) return false;
    if (la > lb) i += 1;
    else if (lb > la) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < la || j < lb) usate += 1;
  return usate <= 1;
}

function tokenERefusoDiStop(token) {
  const chiavi = Object.keys(TONY_ORA_LAVORO_USER_MATCH_STOP);
  for (let i = 0; i < chiavi.length; i += 1) {
    const stop = chiavi[i];
    if (stop.length < 4) continue;
    if (Math.abs(stop.length - token.length) > 1) continue;
    if (distanzaAlMassimoUno(token, stop)) return true;
  }
  return false;
}

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
    if (tokenERefusoDiStop(t)) return false;
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

/**
 * Giorno del lavoro (YYYY-MM-DD). Senza data restituisce stringa vuota.
 * Nomi accettati: dataInizio, data, dataLavoro, dataInizioGiorno.
 * @param {object|null|undefined} lavoro
 * @returns {string}
 */
export function giornoDelLavoro(lavoro) {
  if (!lavoro) return '';
  const raw = lavoro.dataInizio || lavoro.data || lavoro.dataLavoro || lavoro.dataInizioGiorno || '';
  return chiaveGiornoOra(raw) || '';
}

/**
 * True solo se la data c'è ed è oggi. Senza data non è «oggi».
 * @param {object|null|undefined} lavoro
 * @param {string} oggiIso
 * @returns {boolean}
 */
export function eDiOggi(lavoro, oggiIso) {
  if (!oggiIso) return false;
  const giorno = giornoDelLavoro(lavoro);
  if (!giorno) return false;
  return giorno === oggiIso;
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
  return list.filter((lavoro) => eDiOggi(lavoro, oggiIso));
}

function esitoNessuno(list, oggiIso, nominato) {
  const diOggi = lavoriDiOggi(list, oggiIso);
  if (diOggi.length) {
    return { stato: 'nessuno', lavoro: null, candidati: diOggi, nominato: nominato, fonteElenco: 'oggi' };
  }
  return { stato: 'nessuno', lavoro: null, candidati: list, nominato: nominato, fonteElenco: 'disponibili' };
}

function esitoUnico(riga) {
  return {
    stato: 'unico',
    lavoro: riga.lavoro,
    candidati: [riga.lavoro],
    nominato: true
  };
}

function esitoAmbiguo(righe) {
  return {
    stato: 'ambiguo',
    lavoro: null,
    candidati: righe.map((riga) => riga.lavoro),
    nominato: true
  };
}

function esitoDaTesta(righe) {
  const ids = new Set(righe.map((riga) => String(riga.lavoro.id)));
  if (ids.size >= 2) return esitoAmbiguo(righe);
  return esitoUnico(righe[0]);
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

  if (!tokens.length) {
    return esitoNessuno(list, oggiIso, false);
  }

  const conPunteggio = list
    .map((lavoro) => ({ lavoro, score: punteggioLavoro(tokens, lavoro) }))
    .filter((riga) => riga.score > 0);

  if (!conPunteggio.length) {
    return esitoNessuno(list, oggiIso, true);
  }

  conPunteggio.sort((a, b) => b.score - a.score);
  const meglio = conPunteggio[0].score;
  const inTesta = conPunteggio.filter((riga) => riga.score === meglio);

  if (inTesta.length === 1) {
    const vincitore = inTesta[0];
    const soloAbbinamento = conPunteggio.length === 1;
    if (eDiOggi(vincitore.lavoro, oggiIso) || soloAbbinamento) {
      return esitoUnico(vincitore);
    }
    const soloOggi = conPunteggio.filter((riga) => eDiOggi(riga.lavoro, oggiIso));
    if (soloOggi.length) {
      soloOggi.sort((a, b) => b.score - a.score);
      const meglioOggi = soloOggi[0].score;
      return esitoDaTesta(soloOggi.filter((riga) => riga.score === meglioOggi));
    }
    if (dataDiversaDaOggi(vincitore.lavoro, oggiIso)) {
      return esitoNessuno(list, oggiIso, true);
    }
    return esitoUnico(vincitore);
  }

  const diOggiTesta = inTesta.filter((riga) => eDiOggi(riga.lavoro, oggiIso));
  if (diOggiTesta.length === 1) return esitoUnico(diOggiTesta[0]);
  if (diOggiTesta.length >= 2) return esitoAmbiguo(diOggiTesta);
  return esitoAmbiguo(inTesta);
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
    const titolo = esito.fonteElenco === 'disponibili' ? 'I lavori disponibili sono' : 'I lavori di oggi sono';
    return `Non trovo un lavoro con quel nome. ${titolo}: ${elenco}.`;
  }
  return '';
}

/**
 * Aggiunge l'avviso di sovrapposizione alla domanda sul lavoro.
 * @param {string} avviso
 * @param {{ stato?: string, candidati?: object[] }|null} esito
 * @returns {string}
 */
export function unisciAvvisoSovrapposizioneELavoro(avviso, esito) {
  const base = String(avviso || '').trim();
  if (!esito || esito.stato === 'unico') return base;
  const nomi = (esito.candidati || []).map(nomeLavoroVisibile).filter(Boolean).slice(0, 6);
  let coda = 'E su quale lavoro?';
  if (esito.stato === 'ambiguo' && nomi.length === 2) {
    coda = `E su quale lavoro: ${nomi[0]} o ${nomi[1]}?`;
  } else if (esito.stato === 'ambiguo' && nomi.length > 2) {
    coda = `E su quale lavoro: ${nomi.join(', ')}?`;
  } else if (nomi.length) {
    coda = `E su quale lavoro: ${nomi.join(', ')}?`;
  }
  if (!base) return coda;
  return `${base} ${coda}`;
}

/**
 * «Tutto pronto» del modello è accettabile solo se contiene il nome del lavoro.
 * Un testo che non è un riepilogo resta com'è.
 * @param {string} testo
 * @param {string} nomeLavoro
 * @returns {boolean}
 */
export function testoRiepilogoHaLavoro(testo, nomeLavoro) {
  const t = String(testo || '');
  if (!/tutto\s+pronto/i.test(t)) return true;
  const nome = String(nomeLavoro || '').trim();
  if (nome.length < 2) return false;
  return t.toLowerCase().indexOf(nome.toLowerCase()) >= 0;
}

/**
 * Opzioni del select arricchite con la data presa dall'elenco, a parità di id.
 * @param {{ value?: string, text?: string }[]} opzioni
 * @param {object[]} lavoriDatati
 * @returns {object[]}
 */
export function arricchisciLavoriDaOpzioni(opzioni, lavoriDatati) {
  const byId = new Map();
  (Array.isArray(lavoriDatati) ? lavoriDatati : []).forEach((lavoro) => {
    if (lavoro && lavoro.id) byId.set(String(lavoro.id), lavoro);
  });
  return (Array.isArray(opzioni) ? opzioni : [])
    .filter((o) => o && String(o.value || '').trim())
    .map((o) => {
      const id = String(o.value);
      const src = byId.get(id) || {};
      return {
        id,
        nome: (o.text || src.nome || src.label || '').trim(),
        label: (o.text || src.label || src.nome || '').trim(),
        tipoLavoro: src.tipoLavoro || '',
        dataInizio: giornoDelLavoro(src),
        macchinaNome: src.macchinaNome || '',
        attrezzoNome: src.attrezzoNome || ''
      };
    });
}

/**
 * Valore per il select del lavoro: id esatto, oppure un solo nome.
 * Se non è univoco restituisce null e il select non va toccato.
 *
 * @param {string} valore
 * @param {{ value?: string, text?: string }[]} opzioni
 * @param {{ lavori?: object[], oggiIso?: string }} [optsMatch]
 * @returns {string|null}
 */
export function risolviValoreSelectLavoro(valore, opzioni, optsMatch) {
  const valStr = String(valore || '').trim();
  if (!valStr) return null;
  const opts = (Array.isArray(opzioni) ? opzioni : []).filter((o) => o && String(o.value || '').trim());
  const perId = opts.find((o) => String(o.value) === valStr);
  if (perId) return String(perId.value);
  const extra = optsMatch && Array.isArray(optsMatch.lavori) ? optsMatch.lavori : [];
  const lavori = extra.length
    ? arricchisciLavoriDaOpzioni(opts, extra)
    : opts.map((o) => ({ id: String(o.value), nome: o.text || '' }));
  const esito = risolviLavoroDaTesto(valStr, lavori, { oggiIso: optsMatch && optsMatch.oggiIso ? optsMatch.oggiIso : '' });
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
    nomeLavoroVisibile,
    eDiOggi,
    giornoDelLavoro,
    testoRiepilogoHaLavoro,
    unisciAvvisoSovrapposizioneELavoro,
    arricchisciLavoriDaOpzioni
  };
}
