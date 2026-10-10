/**
 * Scelta del lavoro per Segna ore a partire dal testo dell'utente.
 * Nessun DOM e nessun Firebase: le pagine passano l'elenco.
 * @module core/js/tony/tony-ora-lavoro-match
 */

import { chiaveGiornoOra, formattaGiornoBreve } from '../../services/ore-operai-logic.js';

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

function testoNomeLabel(lavoro) {
  return `${(lavoro && lavoro.nome) || ''} ${(lavoro && lavoro.label) || ''}`.toLowerCase();
}

/**
 * Quota di parole significative del testo presenti nel lavoro, da 0 a 1.
 * Una parola conta se compare nel nome, nell'etichetta, nel tipo o negli alias.
 * @param {string[]} tokens
 * @param {object|null|undefined} lavoro
 * @returns {number}
 */
export function copertura(tokens, lavoro) {
  const lista = (Array.isArray(tokens) ? tokens : []).filter(Boolean);
  if (!lista.length || !lavoro) return 0;
  const hay = testoConfrontoLavoro(lavoro);
  let trovate = 0;
  for (let i = 0; i < lista.length; i += 1) {
    if (hay.indexOf(lista[i]) >= 0) trovate += 1;
  }
  return trovate / lista.length;
}

/**
 * L'abbinamento è ragionevole solo se il testo copre davvero il lavoro.
 * Con due o più parole serve almeno metà (copertura ≥ 0,5): una sola parola
 * in comune, per esempio «manutenzione» nel tipo, non basta.
 * Con una sola parola, quella deve avere almeno 6 lettere ed essere nel nome
 * o nell'etichetta, non solo nel tipo di lavoro.
 * @param {string[]} tokens
 * @param {object|null|undefined} lavoro
 * @returns {boolean}
 */
export function abbinamentoRagionevole(tokens, lavoro) {
  const lista = (Array.isArray(tokens) ? tokens : []).filter(Boolean);
  if (!lista.length || !lavoro) return false;
  if (lista.length >= 2) return copertura(lista, lavoro) >= 0.5;
  const tok = lista[0];
  if (tok.length < 6) return false;
  return testoNomeLabel(lavoro).indexOf(tok) >= 0;
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
 * Lavoro sospeso: visibile in lista, non si segnano ore nuove.
 * @param {object|null|undefined} lavoro
 * @returns {boolean}
 */
export function eLavoroSospeso(lavoro) {
  return String((lavoro && lavoro.stato) || '').toLowerCase() === 'sospeso';
}

function unicoConQuelNome(lavoro, tutti) {
  const nome = nomeLavoroVisibile(lavoro).toLowerCase();
  if (nome.length < 2) return false;
  const uguali = (tutti || []).filter((altro) => nomeLavoroVisibile(altro).toLowerCase() === nome);
  return uguali.length === 1;
}

/**
 * Allinea i campi che le pagine chiamano in modi diversi (label, statoLavoro, ripresaId).
 * @param {object|null|undefined} lavoro
 * @returns {object|null}
 */
export function normalizzaLavoroMatchOra(lavoro) {
  if (!lavoro || lavoro.id == null || String(lavoro.id).trim() === '') return null;
  const statoRaw = lavoro.stato || lavoro.statoLavoro || lavoro.status || '';
  const ripresa = lavoro.ripresaDaLavoroId || lavoro.ripresaId || '';
  const nome = nomeLavoroVisibile(lavoro);
  return {
    id: String(lavoro.id),
    nome,
    label: String(lavoro.label || lavoro.nome || '').trim(),
    tipoLavoro: lavoro.tipoLavoro || '',
    dataInizio: giornoDelLavoro(lavoro),
    stato: String(statoRaw || '').toLowerCase(),
    ripresaDaLavoroId: ripresa ? String(ripresa) : '',
    macchinaId: lavoro.macchinaId || null,
    attrezzoId: lavoro.attrezzoId || null,
    macchinaNome: lavoro.macchinaNome || '',
    attrezzoNome: lavoro.attrezzoNome || '',
    alias: lavoro.alias || ''
  };
}

/**
 * I sospesi restano nell'elenco per Tony, senza duplicare un id già segnabile.
 * @param {object[]} segnabili
 * @param {object[]} sospesi
 * @returns {object[]}
 */
export function unisciLavoriSegnabiliESospesi(segnabili, sospesi) {
  const byId = new Map();
  (Array.isArray(segnabili) ? segnabili : []).forEach((lavoro) => {
    const n = normalizzaLavoroMatchOra(lavoro);
    if (!n || eLavoroSospeso(n)) return;
    byId.set(n.id, n);
  });
  (Array.isArray(sospesi) ? sospesi : []).forEach((lavoro) => {
    const n = normalizzaLavoroMatchOra(lavoro);
    if (!n) return;
    n.stato = 'sospeso';
    byId.set(n.id, n);
  });
  return Array.from(byId.values());
}

/**
 * Il lavoro scelto in pagina è unico solo se ha un nome visibile.
 * @param {string} id
 * @param {object|null|undefined} dettaglio
 * @param {string} nomeOption
 * @returns {object|null}
 */
export function lavoroDaSceltaUi(id, dettaglio, nomeOption) {
  const idOk = String(id || '').trim();
  if (!idOk) return null;
  const nome = (dettaglio && nomeLavoroVisibile(dettaglio)) || String(nomeOption || '').trim();
  if (!nome || /^seleziona\b/i.test(nome)) return null;
  const base = dettaglio && typeof dettaglio === 'object' ? { ...dettaglio } : {};
  base.id = idOk;
  if (!nomeLavoroVisibile(base)) base.nome = nome;
  return base;
}

function pad2Data(n) {
  return String(n).padStart(2, '0');
}

function isoDaParti(anno, mese, giorno) {
  const y = Number(anno);
  const m = Number(mese);
  const d = Number(giorno);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  return `${y}-${pad2Data(m)}-${pad2Data(d)}`;
}

function isoPiuGiorni(iso, giorni) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + giorni);
  return `${dt.getUTCFullYear()}-${pad2Data(dt.getUTCMonth() + 1)}-${pad2Data(dt.getUTCDate())}`;
}

function tokenDataInIso(token, oggiIso) {
  const t = String(token || '').trim().toLowerCase();
  const oggi = String(oggiIso || '');
  if (!oggi) return '';
  if (t === 'oggi') return oggi;
  if (t === 'ieri') return isoPiuGiorni(oggi, -1);
  if (/altro\s+ieri/.test(t)) return isoPiuGiorni(oggi, -2);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoDaParti(iso[1], iso[2], iso[3]);
  const piena = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (piena) return isoDaParti(piena[3], piena[2], piena[1]);
  const breve = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (breve) return isoDaParti(oggi.slice(0, 4), breve[2], breve[1]);
  return '';
}

/**
 * Ultima data detta nel testo, mai nel futuro rispetto a oggi.
 * @param {string} testo
 * @param {string} oggiIso
 * @returns {string}
 */
export function ultimaDataEsplicitaNelTesto(testo, oggiIso) {
  const s = String(testo || '');
  const oggi = String(oggiIso || '');
  const re = /l['’]?\s*altro\s+ieri|\baltro\s+ieri\b|\bieri\b|\boggi\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{1,2}\/\d{1,2}\b/gi;
  let ultima = '';
  let m;
  while ((m = re.exec(s))) {
    const iso = tokenDataInIso(m[0], oggi);
    if (!iso) continue;
    if (oggi && iso > oggi) continue;
    ultima = iso;
  }
  return ultima;
}

/**
 * Richiesta nuova: «segnami…» oppure fascia e lavoro insieme.
 * «30», «sì» e i refusi di orario da soli non lo sono.
 * @param {string} testo
 * @returns {boolean}
 */
export function eRichiestaOreNuova(testo) {
  const t = String(testo || '');
  const segna = /\bsegn\w*/i.test(t);
  const fascia = /\bd[a-z]{0,4}l+e\s+\d{1,2}\b/i.test(t) && /\ba[sxz]{0,2}l+e\s+\d{1,2}\b/i.test(t);
  const lavoro = /\b(sul|sulla|sullo|sui)\b/i.test(t);
  if (segna && (fascia || lavoro)) return true;
  if (fascia && lavoro) return true;
  return false;
}

function dataDaiTurniPrecedenti(turni, oggiIso) {
  const list = Array.isArray(turni) ? turni : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const iso = ultimaDataEsplicitaNelTesto(list[i], oggiIso);
    if (iso) return iso;
  }
  return '';
}

/**
 * Data di questa richiesta. Non unisce i turni in un solo testo.
 * @param {{ testoNuovo?: string, turniPrecedenti?: string[], oggiIso?: string, inAttesaDi?: { dataIso?: string, tipo?: string }|boolean|null }} input
 * @returns {{ iso: string, fonte: 'esplicita'|'oggi_default'|'continua' }}
 */
export function risolviDataSegnaOre(input) {
  const testo = String((input && input.testoNuovo) || '');
  const oggi = String((input && input.oggiIso) || '');
  const esplicita = ultimaDataEsplicitaNelTesto(testo, oggi);
  if (esplicita) return { iso: esplicita, fonte: 'esplicita' };
  const attesa = input && input.inAttesaDi;
  if (attesa && !eRichiestaOreNuova(testo)) {
    let iso = '';
    if (typeof attesa === 'object' && attesa.dataIso) iso = String(attesa.dataIso);
    if (!iso) iso = dataDaiTurniPrecedenti(input && input.turniPrecedenti, oggi);
    if (iso && (!oggi || iso <= oggi)) return { iso, fonte: 'continua' };
    if (oggi) return { iso: oggi, fonte: 'continua' };
  }
  return { iso: oggi, fonte: 'oggi_default' };
}

/**
 * Come dirla nel riepilogo: «oggi 09/10», «ieri 08/10», altrimenti «il 07/10».
 * @param {string} iso
 * @param {string} oggiIso
 * @returns {string}
 */
export function etichettaDataRiepilogoOre(iso, oggiIso) {
  const giorno = formattaGiornoBreve(iso);
  if (!giorno) return '';
  const chiave = chiaveGiornoOra(iso);
  const oggi = chiaveGiornoOra(oggiIso);
  if (chiave && oggi && chiave === oggi) return `oggi ${giorno}`;
  const ieri = isoPiuGiorni(oggi, -1);
  if (chiave && ieri && chiave === ieri) return `ieri ${giorno}`;
  return `il ${giorno}`;
}

/**
 * @param {string} testo
 * @returns {boolean}
 */
export function testoRiepilogoHaData(testo) {
  const t = String(testo || '');
  return /\b(?:oggi|ieri)\s+\d{1,2}\/\d{1,2}\b/i.test(t) || /\bil\s+\d{1,2}\/\d{1,2}\b/i.test(t);
}

/**
 * Inserisce la data nel riepilogo, se manca.
 * @param {string} testo
 * @param {string} dataTesto
 * @returns {string}
 */
export function inserisciDataNelRiepilogo(testo, dataTesto) {
  const t = String(testo || '');
  const data = String(dataTesto || '').trim();
  if (!/tutto\s+pronto/i.test(t) || !data || testoRiepilogoHaData(t)) return t;
  const conFascia = t.replace(/^(Tutto pronto:\s*)(.+?)(,\s*dalle\s+)/i, function (_full, testa, nome, dalle) {
    return testa + nome + ', ' + data + dalle;
  });
  if (conFascia !== t) return conFascia;
  return t.replace(/^(Tutto pronto:\s*)/i, function (_full, testa) {
    return testa + data + ', ';
  });
}

/**
 * «Tutto pronto» esce solo se il lavoro è unico, il testo ha il nome e ha la data.
 * Se manca la data ma ci viene passata, il testo viene riscritto.
 * @param {{ esito?: { stato?: string, lavoro?: object|null }|null, nomeLavoro?: string, testo?: string, domanda?: string, dataTesto?: string, dataIso?: string, oggiIso?: string }} input
 * @returns {{ ammesso: boolean, testo: string }}
 */
export function riepilogoSegnaOreAmmesso(input) {
  const testo = String((input && input.testo) || '');
  const nome = String((input && input.nomeLavoro) || '').trim();
  const esito = input && input.esito;
  const domanda = String((input && input.domanda) || '').trim() || 'Su quale lavoro segno le ore?';
  if (!/tutto\s+pronto/i.test(testo)) return { ammesso: true, testo };
  const unico = !!(esito && esito.stato === 'unico' && esito.lavoro);
  let dataTesto = String((input && input.dataTesto) || '').trim();
  if (!dataTesto && input && input.dataIso) {
    dataTesto = etichettaDataRiepilogoOre(input.dataIso, (input && input.oggiIso) || input.dataIso);
  }
  let testoOut = testo;
  if (dataTesto && !testoRiepilogoHaData(testoOut)) {
    testoOut = inserisciDataNelRiepilogo(testoOut, dataTesto);
  }
  const haNome = unico && nome.length >= 2 && testoRiepilogoHaLavoro(testoOut, nome);
  if (haNome && testoRiepilogoHaData(testoOut)) return { ammesso: true, testo: testoOut };
  return { ammesso: false, testo: domanda };
}

function risolviTraSegnabili(testoUtente, list, oggiIso) {
  const tokens = tokenLavoroSignificativi(testoUtente);

  if (!tokens.length) {
    return esitoNessuno(list, oggiIso, false);
  }

  let conPunteggio = list
    .map((lavoro) => ({ lavoro, score: punteggioLavoro(tokens, lavoro) }))
    .filter((riga) => riga.score > 0);

  // Con due o più parole un solo token debole non basta a dire «unico».
  if (tokens.length >= 2) {
    conPunteggio = conPunteggio.filter((riga) => abbinamentoRagionevole(tokens, riga.lavoro));
  }

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

function candidatiSegnabiliDelSospeso(sospeso, conPunteggio) {
  const id = String(sospeso && sospeso.id || '');
  const abbinati = conPunteggio
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((riga) => riga.lavoro);
  const collegati = abbinati.filter((lavoro) => String(lavoro.ripresaDaLavoroId || '') === id);
  const altri = abbinati.filter((lavoro) => String(lavoro.ripresaDaLavoroId || '') !== id);
  return collegati.concat(altri);
}

function esitoSospeso(sospeso, candidati) {
  return {
    stato: 'sospeso',
    lavoro: null,
    lavoroSospeso: sospeso,
    candidati: candidati || [],
    nominato: true
  };
}

/**
 * Ricava il lavoro dal testo. Mai la prima voce della lista.
 * Il match è sui lavori segnabili. Un sospeso si propone solo se l'abbinamento è ragionevole.
 * Con due o più parole, anche un segnabile serve un abbinamento ragionevole.
 *
 * @param {string} testoUtente
 * @param {object[]} lavori
 * @param {{ oggiIso?: string }} [opts]
 * @returns {{ stato: 'unico'|'ambiguo'|'nessuno'|'sospeso', lavoro: object|null, lavoroSospeso?: object|null, candidati: object[], nominato: boolean }}
 */
export function risolviLavoroDaTesto(testoUtente, lavori, opts) {
  const oggiIso = opts && opts.oggiIso ? String(opts.oggiIso) : '';
  const list = (Array.isArray(lavori) ? lavori : [])
    .map((lavoro) => normalizzaLavoroMatchOra(lavoro) || (lavoro && lavoro.id ? lavoro : null))
    .filter((lavoro) => lavoro && lavoro.id);
  const segnabili = list.filter((lavoro) => !eLavoroSospeso(lavoro));
  const sospesi = list.filter((lavoro) => eLavoroSospeso(lavoro));
  const esitoSegnabili = risolviTraSegnabili(testoUtente, segnabili, oggiIso);
  const tokens = tokenLavoroSignificativi(testoUtente);
  if (!tokens.length || !sospesi.length) return esitoSegnabili;

  const conPunteggioSegnabili = segnabili
    .map((lavoro) => ({ lavoro, score: punteggioLavoro(tokens, lavoro) }))
    .filter((riga) => riga.score > 0);
  const meglioSegnabile = conPunteggioSegnabili.reduce((max, riga) => Math.max(max, riga.score), 0);
  const conPunteggioSospesi = sospesi
    .map((lavoro) => ({ lavoro, score: punteggioLavoro(tokens, lavoro) }))
    .filter((riga) => riga.score > 0 && abbinamentoRagionevole(tokens, riga.lavoro));
  if (!conPunteggioSospesi.length) return esitoSegnabili;

  conPunteggioSospesi.sort((a, b) => b.score - a.score);
  const meglioSospeso = conPunteggioSospesi[0].score;
  if (meglioSospeso < meglioSegnabile) return esitoSegnabili;

  const inTesta = conPunteggioSospesi.filter((riga) => riga.score === meglioSospeso);
  const diOggi = inTesta.filter((riga) => eDiOggi(riga.lavoro, oggiIso));
  let scelto = null;
  if (diOggi.length === 1) scelto = diOggi[0].lavoro;
  else if (diOggi.length === 0 && inTesta.length === 1 && unicoConQuelNome(inTesta[0].lavoro, list)) {
    scelto = inTesta[0].lavoro;
  }
  if (!scelto) return esitoSegnabili;

  return esitoSospeso(scelto, candidatiSegnabiliDelSospeso(scelto, conPunteggioSegnabili));
}

/**
 * Domanda quando il lavoro non è uno solo. Stringa vuota se non serve chiedere.
 * @param {{ stato?: string, nominato?: boolean, candidati?: object[] }|null} esito
 * @returns {string}
 */
function etichettaLavoroConGiorno(lavoro) {
  const nome = nomeLavoroVisibile(lavoro);
  const giorno = formattaGiornoBreve(giornoDelLavoro(lavoro));
  if (nome && giorno) return `${nome} (${giorno})`;
  return nome;
}

export function messaggioSceltaLavoroOre(esito) {
  if (!esito) return '';
  if (esito.stato === 'sospeso' && esito.lavoroSospeso) {
    const chi = etichettaLavoroConGiorno(esito.lavoroSospeso) || 'Questo lavoro';
    const nomi = (esito.candidati || []).map(nomeLavoroVisibile).filter(Boolean).slice(0, 6);
    if (nomi.length) {
      return `${chi} è sospeso: non ci segno ore. Ho trovato: ${nomi.join(', ')}. Dimmi il nome.`;
    }
    return `${chi} è sospeso: non ci segno ore. Su quale lavoro segno le ore?`;
  }
  const nomi = (esito.candidati || []).map(nomeLavoroVisibile).filter(Boolean);
  if (esito.stato === 'ambiguo') {
    const elenco = nomi.slice(0, 6).join(', ');
    return `Su quale lavoro? Ho trovato: ${elenco}. Dimmi il nome.`;
  }
  if (esito.stato === 'nessuno' && esito.nominato) {
    const elenco = nomi.length ? nomi.slice(0, 8).join(', ') : 'nessuno';
    const titolo = esito.fonteElenco === 'disponibili' ? 'I lavori disponibili sono' : 'I lavori di oggi sono';
    return `Non trovo un lavoro attivo con questo nome. ${titolo}: ${elenco}.`;
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
  if (esito.stato === 'sospeso') {
    const nota = messaggioSceltaLavoroOre(esito);
    if (!base) return nota;
    if (!nota) return base;
    return `${base} ${nota}`;
  }
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
    copertura,
    abbinamentoRagionevole,
    risolviValoreSelectLavoro,
    messaggioSceltaLavoroOre,
    nomeLavoroVisibile,
    eDiOggi,
    giornoDelLavoro,
    testoRiepilogoHaLavoro,
    unisciAvvisoSovrapposizioneELavoro,
    arricchisciLavoriDaOpzioni,
    eLavoroSospeso,
    normalizzaLavoroMatchOra,
    unisciLavoriSegnabiliESospesi,
    lavoroDaSceltaUi,
    riepilogoSegnaOreAmmesso,
    risolviDataSegnaOre,
    etichettaDataRiepilogoOre,
    testoRiepilogoHaData,
    inserisciDataNelRiepilogo,
    eRichiestaOreNuova
  };
}
