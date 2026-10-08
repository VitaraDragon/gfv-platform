/**
 * Logica pura ore operai: sovrapposizioni, permessi, storico, ore macchina.
 * Nessun Firebase e nessun DOM.
 *
 * Il controllo di sovrapposizione vive qui (e nel client che lo chiama):
 * Firestore Rules non può interrogare le altre righe dello stesso giorno.
 *
 * @module core/services/ore-operai-logic
 */

import { dateLikeToLocalCalendarIso } from '../js/date-format-it.js';
import {
  isLavoroSquadra,
  isLavoroAutonomo,
  isOraDelCaposquadraSuLavoroSquadra,
  oreVisibileInCodaValidazione
} from './manodopera-ore-validazione-scope.js';

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * @param {string} hhmm
 * @returns {number} minuti da mezzanotte, oppure NaN
 */
export function orarioAMinuti(hhmm) {
  if (hhmm == null) return NaN;
  const m = String(hhmm).trim().match(TIME_RE);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return NaN;
  return h * 60 + min;
}

/**
 * Giorno di calendario locale YYYY-MM-DD.
 * Una stringa già YYYY-MM-DD resta com'è (è un giorno scelto, non un istante).
 * Timestamp, Date e {seconds} passano da dateLikeToLocalCalendarIso:
 * la mezzanotte UTC e la mezzanotte locale dello stesso giorno civile
 * coincidono nei fusi a est di Greenwich (Italia compresa).
 *
 * @param {*} dataLike
 * @returns {string}
 */
export function chiaveGiornoOra(dataLike) {
  if (typeof dataLike === 'string') {
    const trimmed = dataLike.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  return dateLikeToLocalCalendarIso(dataLike);
}

/**
 * Mezzanotte locale del giorno scelto (come il Workspace mobile).
 * @param {*} dataLike
 * @returns {Date|null}
 */
export function dataMezzanotteLocale(dataLike) {
  const key = chiaveGiornoOra(dataLike);
  if (!key) return null;
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (![y, m, d].every((n) => Number.isFinite(n))) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Intervalli semiaperti [inizio, fine). Toccarsi al bordo non è sovrapposizione.
 * @param {{ orarioInizio?: string, orarioFine?: string, inizio?: string, fine?: string }} a
 * @param {{ orarioInizio?: string, orarioFine?: string, inizio?: string, fine?: string }} b
 * @returns {boolean}
 */
export function intervalliSiSovrappongono(a, b) {
  const a0 = orarioAMinuti(a && (a.orarioInizio || a.inizio));
  const a1 = orarioAMinuti(a && (a.orarioFine || a.fine));
  const b0 = orarioAMinuti(b && (b.orarioInizio || b.inizio));
  const b1 = orarioAMinuti(b && (b.orarioFine || b.fine));
  if (![a0, a1, b0, b1].every((n) => Number.isFinite(n))) return false;
  if (a1 <= a0 || b1 <= b0) return false;
  return a0 < b1 && b0 < a1;
}

/**
 * Righe dello stesso utente, stesso giorno, non rifiutate, che si sovrappongono.
 * La riga in modifica si esclude con escludiId. Lavori diversi contano.
 *
 * @param {object} nuova
 * @param {object[]} esistenti
 * @param {{ escludiId?: string }} [opts]
 * @returns {object[]}
 */
export function trovaSovrapposizioni(nuova, esistenti, opts = {}) {
  if (!nuova) return [];
  const giorno = chiaveGiornoOra(nuova.data);
  const userId = String(nuova.operaioId || '');
  const escludiId = opts && opts.escludiId != null ? String(opts.escludiId) : '';
  const list = Array.isArray(esistenti) ? esistenti : [];
  if (!giorno || !userId) return [];
  return list.filter((row) => {
    if (!row) return false;
    if (escludiId && String(row.id || '') === escludiId) return false;
    if (String(row.stato || '') === 'rifiutate') return false;
    if (String(row.operaioId || '') !== userId) return false;
    if (chiaveGiornoOra(row.data) !== giorno) return false;
    return intervalliSiSovrappongono(nuova, row);
  });
}

/**
 * @param {object[]} righe
 * @returns {number}
 */
export function contaRigheConSovrapposizione(righe, universo) {
  const list = Array.isArray(righe) ? righe : [];
  const tutte = Array.isArray(universo) ? universo : list;
  let n = 0;
  for (const row of list) {
    if (!row) continue;
    if (trovaSovrapposizioni(row, tutte, { escludiId: row.id }).length > 0) n += 1;
  }
  return n;
}

export function etichettaStatoOra(stato) {
  if (stato === 'validate') return 'validata';
  if (stato === 'rifiutate') return 'rifiutata';
  return 'in attesa';
}

/**
 * @param {object[]} conflitti
 * @returns {string}
 */
export function messaggioSovrapposizione(conflitti) {
  const c = Array.isArray(conflitti) && conflitti[0];
  if (!c) return 'Queste ore si sovrappongono a un altro turno.';
  const nome = c.lavoroNome || 'un lavoro';
  const inizio = c.orarioInizio || '';
  const fine = c.orarioFine || '';
  const stato = etichettaStatoOra(c.stato);
  return `Ti sovrapponi a ${inizio}–${fine} su «${nome}» (${stato}). Modifica quella riga oppure cambia gli orari.`;
}

/**
 * Minuti da mezzanotte → HH:MM.
 * @param {number} minuti
 * @returns {string}
 */
export function minutiAOrario(minuti) {
  const n = Number(minuti);
  if (!Number.isFinite(n) || n < 0) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h > 23) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Quanto dura l'intervallo, in italiano semplice.
 * @param {number} minuti
 * @returns {string}
 */
export function testoDurataMinuti(minuti) {
  const n = Number(minuti);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n % 60 === 0) {
    const ore = n / 60;
    if (ore === 1) return '1 ora';
    return `${ore} ore`;
  }
  if (n > 60) {
    const ore = Math.floor(n / 60);
    const rest = n % 60;
    const oreTxt = ore === 1 ? '1 ora' : `${ore} ore`;
    return `${oreTxt} e ${rest} minuti`;
  }
  return `${n} minuti`;
}

/**
 * Primo intervallo libero della stessa durata, saltando i blocchi occupati uno dopo l'altro.
 * Le righe rifiutate non occupano. Entro le 23:59. Se non c'è spazio, null.
 *
 * @param {object[]} righeGiorno
 * @param {number} inizioMin
 * @param {number} durataMin
 * @param {{ escludiId?: string }} [opts]
 * @returns {{ inizio: string, fine: string }|null}
 */
export function primoOrarioLiberoDopo(righeGiorno, inizioMin, durataMin, opts = {}) {
  const inizio = Number(inizioMin);
  const durata = Number(durataMin);
  const limite = (23 * 60) + 59;
  if (!Number.isFinite(inizio) || !Number.isFinite(durata) || durata <= 0) return null;
  if (inizio < 0 || inizio >= limite) return null;
  const escludiId = opts && opts.escludiId != null ? String(opts.escludiId) : '';
  const blocchi = (Array.isArray(righeGiorno) ? righeGiorno : [])
    .filter((row) => row && String(row.stato || '') !== 'rifiutate')
    .filter((row) => !escludiId || String(row.id || '') !== escludiId)
    .map((row) => ({
      a: orarioAMinuti(row.orarioInizio || row.inizio),
      b: orarioAMinuti(row.orarioFine || row.fine)
    }))
    .filter((b) => Number.isFinite(b.a) && Number.isFinite(b.b) && b.b > b.a)
    .sort((x, y) => x.a - y.a);

  let cursor = inizio;
  let guard = 0;
  while (cursor + durata <= limite && guard < 200) {
    guard += 1;
    let ostacoloFine = null;
    for (const blocco of blocchi) {
      if (cursor < blocco.b && blocco.a < cursor + durata) {
        if (ostacoloFine == null || blocco.b > ostacoloFine) ostacoloFine = blocco.b;
      }
    }
    if (ostacoloFine == null) {
      const fineTxt = minutiAOrario(cursor + durata);
      const iniTxt = minutiAOrario(cursor);
      if (!iniTxt || !fineTxt) return null;
      return { inizio: iniTxt, fine: fineTxt };
    }
    if (ostacoloFine <= cursor) return null;
    cursor = ostacoloFine;
  }
  return null;
}

/**
 * Messaggio di Tony prima del salvataggio: orario occupato e il primo buco davvero libero.
 * @param {{ orarioInizio?: string, orarioFine?: string, inizio?: string, fine?: string }} nuova
 * @param {object[]} conflitti
 * @param {{ alternativa?: { inizio: string, fine: string }|null, righeGiorno?: object[], escludiId?: string }} [opts]
 * @returns {string}
 */
export function messaggioSovrapposizioneTony(nuova, conflitti, opts = {}) {
  const c = Array.isArray(conflitti) && conflitti[0];
  if (!c) return '';
  const ini = (nuova && (nuova.orarioInizio || nuova.inizio)) || '';
  const fin = (nuova && (nuova.orarioFine || nuova.fine)) || '';
  const nome = c.lavoroNome || 'un lavoro';
  const base = `Dalle ${ini} alle ${fin} ti sovrapponi al turno ${c.orarioInizio || ''}–${c.orarioFine || ''} su «${nome}».`;
  let alternativa = opts && Object.prototype.hasOwnProperty.call(opts, 'alternativa')
    ? opts.alternativa
    : undefined;
  if (alternativa === undefined) {
    const iniMin = orarioAMinuti(ini);
    const finMin = orarioAMinuti(fin);
    const righe = (opts && opts.righeGiorno) || conflitti;
    alternativa = primoOrarioLiberoDopo(righe, iniMin, finMin - iniMin, { escludiId: opts && opts.escludiId });
  }
  if (!alternativa || !alternativa.inizio || !alternativa.fine) {
    return `${base} Dimmi un altro orario.`;
  }
  const quanto = testoDurataMinuti(orarioAMinuti(fin) - orarioAMinuti(ini)) || 'questo turno';
  return `${base} Il primo orario libero di ${quanto} è dalle ${alternativa.inizio} alle ${alternativa.fine}. Va bene?`;
}

/**
 * Controllo usato dalle pagine: conflitti, alternativa libera, messaggio.
 * La logica non va duplicata tra segnatura desktop e workspace.
 *
 * @param {object} nuova
 * @param {object[]} esistenti
 * @param {{ escludiId?: string }} [opts]
 * @returns {{ conflitti: object[], alternativa: { inizio: string, fine: string }|null, messaggio: string }}
 */
export function esitoControlloSovrapposizione(nuova, esistenti, opts = {}) {
  const escludiId = opts && opts.escludiId;
  const conflitti = trovaSovrapposizioni(nuova, esistenti, { escludiId });
  if (!conflitti.length) return { conflitti, alternativa: null, messaggio: '' };
  const iniMin = orarioAMinuti(nuova && (nuova.orarioInizio || nuova.inizio));
  const finMin = orarioAMinuti(nuova && (nuova.orarioFine || nuova.fine));
  const alternativa = primoOrarioLiberoDopo(esistenti, iniMin, finMin - iniMin, { escludiId });
  return {
    conflitti,
    alternativa,
    messaggio: messaggioSovrapposizioneTony(nuova, conflitti, { alternativa })
  };
}

/**
 * Chi deve validare la riga. Stesse regole della coda, senza cambiarle.
 * @param {{ ora?: object, lavoro?: object }} args
 * @returns {'caposquadra'|'manager'}
 */
export function chiValidaOra(args) {
  const ora = args && args.ora;
  const lavoro = args && args.lavoro;
  if (isLavoroAutonomo(lavoro)) return 'manager';
  if (isOraDelCaposquadraSuLavoroSquadra(ora, lavoro)) return 'manager';
  return 'caposquadra';
}

/**
 * Toast dopo il salvataggio. Inizia sempre con «Ora segnata con successo!».
 * @param {'caposquadra'|'manager'} chi
 * @returns {string}
 */
export function messaggioOraSegnataConSuccesso(chi) {
  const chiTesto = chi === 'manager' ? 'il manager' : 'il caposquadra';
  return `Ora segnata con successo! In attesa — la valida ${chiTesto}.`;
}

/**
 * Scritta sulle righe ancora in attesa.
 * @param {'caposquadra'|'manager'} chi
 * @returns {string}
 */
export function testoAttesaValidazione(chi) {
  const chiTesto = chi === 'manager' ? 'il manager' : 'il caposquadra';
  return `In attesa — la valida ${chiTesto}`;
}

/**
 * Il ricalcolo delle stelline scrive profiliManodopera: lo possono fare solo manager e amministratore.
 * @param {boolean} isManager
 * @returns {boolean}
 */
export function deveRichiedereRefreshSkill(isManager) {
  return Boolean(isManager);
}

/**
 * @param {object[]} conflitti
 * @returns {Error & { code: string, conflitti: object[] }}
 */
export function creaErroreSovrapposizione(conflitti) {
  const err = new Error(messaggioSovrapposizione(conflitti));
  err.code = 'ORE_SOVRAPPOSTE';
  err.conflitti = Array.isArray(conflitti) ? conflitti : [];
  return err;
}

/**
 * Testo in #hours-save-status. Tony riconosce il prefisso "Errore salvataggio:".
 * @param {{ message?: string }|null} error
 * @returns {string}
 */
export function testoErroreSalvataggioOre(error) {
  const msg = (error && error.message) || 'Queste ore si sovrappongono a un altro turno.';
  return `Errore salvataggio: ${msg}`;
}

/**
 * Ore macchina da scrivere sulla riga.
 * Con mezzo e campo vuoto si usano le ore nette. Senza mezzo il campo resta vuoto.
 * @param {{ macchinaId?: string|null, attrezzoId?: string|null, oreMacchina?: number|string|null }} oraData
 * @param {number} oreNette
 * @returns {number|null}
 */
export function oreMacchinaDaSalvare(oraData, oreNette) {
  const haMezzo = Boolean(oraData && (oraData.macchinaId || oraData.attrezzoId));
  if (!haMezzo) return null;
  const raw = oraData.oreMacchina;
  if (raw == null || raw === '') return oreNette;
  const n = Number(raw);
  return Number.isFinite(n) ? n : oreNette;
}

/**
 * Il validatore (R4) non è lo smistamento della coda.
 * Il manager può correggere qualunque riga del tenant.
 * Il caposquadra solo le ore dei suoi operai sui propri lavori di squadra.
 *
 * @param {{ ora: object, lavoro: object, userId: string, isCaposquadra: boolean, isManager: boolean }} args
 * @returns {boolean}
 */
export function isValidatoreOre(args) {
  const { ora, lavoro, userId, isCaposquadra, isManager } = args || {};
  if (isManager) return true;
  if (!isCaposquadra) return false;
  if (!isLavoroSquadra(lavoro)) return false;
  if (String(lavoro && lavoro.caposquadraId || '') !== String(userId || '')) return false;
  if (isOraDelCaposquadraSuLavoroSquadra(ora, lavoro)) return false;
  if (String(ora && ora.operaioId || '') === String(userId || '')) return false;
  return true;
}

function messaggioBloccoValidata(ora, lavoro) {
  if (isLavoroAutonomo(lavoro) || isOraDelCaposquadraSuLavoroSquadra(ora, lavoro)) {
    return '🔒 Validata — per correggerla chiedi al manager';
  }
  return '🔒 Validata — per correggerla chiedi al caposquadra';
}

/**
 * Permessi interfaccia secondo R1 (proprietario) e R4 (validatore).
 * La validazione di una riga in coda resta su assertUtentePuoValidareOra.
 *
 * @param {{ ora: object, lavoro: object, userId: string, isCaposquadra: boolean, isManager: boolean }} args
 */
export function permessiOra(args) {
  const { ora, lavoro, userId, isCaposquadra, isManager } = args || {};
  const uid = String(userId || '');
  const owner = Boolean(uid) && String(ora && ora.operaioId || '') === uid;
  const stato = String(ora && ora.stato || '');
  const validatore = isValidatoreOre({ ora, lavoro, userId: uid, isCaposquadra, isManager });
  const modificabile = owner && (stato === 'da_validare' || stato === 'rifiutate');

  let motivoBlocco = '';
  if (owner && stato === 'validate') {
    motivoBlocco = messaggioBloccoValidata(ora, lavoro);
  }

  return {
    puoModificare: modificabile,
    puoEliminare: modificabile,
    puoCorreggere: validatore && (stato === 'validate' || stato === 'da_validare'),
    puoAnnullareValidazione: validatore && stato === 'validate',
    puoRifiutare: validatore && (stato === 'validate' || stato === 'da_validare'),
    motivoBlocco
  };
}

/**
 * Righe validate visibili nella sezione archivio (ultimi 30 giorni).
 * Il manager vede tutto il tenant. Il caposquadra solo i suoi operai di squadra.
 *
 * @param {{ ora: object, lavoro: object, userId: string, isCaposquadra: boolean, isManager: boolean }} args
 * @returns {boolean}
 */
export function oraVisibileInArchivioValidate(args) {
  const { ora, lavoro, userId, isCaposquadra, isManager } = args || {};
  if (String(ora && ora.stato || '') !== 'validate') return false;
  return isValidatoreOre({ ora, lavoro, userId, isCaposquadra, isManager });
}

/**
 * Stesso scope dell'archivio validate, anche per le rifiutate.
 * @param {{ ora: object, lavoro: object, userId: string, isCaposquadra: boolean, isManager: boolean }} args
 * @returns {boolean}
 */
export function oraVisibileInArchivio(args) {
  const { ora, lavoro, userId, isCaposquadra, isManager } = args || {};
  const stato = String(ora && ora.stato || '');
  if (stato !== 'validate' && stato !== 'rifiutate') return false;
  return isValidatoreOre({ ora, lavoro, userId, isCaposquadra, isManager });
}

/**
 * Giorno di calendario dentro gli ultimi N giorni, oggi compreso.
 * @param {*} dataLike
 * @param {number} [giorni]
 * @param {Date} [oggi]
 * @returns {boolean}
 */
export function giornoEntroUltimiGiorni(dataLike, giorni = 30, oggi = new Date()) {
  const key = chiaveGiornoOra(dataLike);
  if (!key) return false;
  const limite = new Date(oggi.getTime());
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - Number(giorni || 30));
  const limiteKey = chiaveGiornoOra(limite);
  return Boolean(limiteKey) && key >= limiteKey;
}

/**
 * Contatori della pagina Validazione ore.
 * «Da validare» è la coda di chi guarda.
 * «Validate» e «Rifiutate» sono le stesse righe e lo stesso periodo della lista archivio.
 *
 * @param {object[]} righe ogni riga è l'ora, oppure { ora, lavoro, lavoroId }
 * @param {{ userId?: string, isCaposquadra?: boolean, isManager?: boolean, giorni?: number, oggi?: Date, filtroOperaioId?: string, filtroLavoroId?: string }} [opts]
 * @returns {{ daValidare: object[], validate: object[], rifiutate: object[], periodoEtichetta: string }}
 */
export function calcolaContatoriOreValidazione(righe, opts = {}) {
  const {
    userId = '',
    isCaposquadra = false,
    isManager = false,
    giorni = 30,
    oggi = new Date(),
    filtroOperaioId = '',
    filtroLavoroId = ''
  } = opts || {};
  const daValidare = [];
  const validate = [];
  const rifiutate = [];
  const list = Array.isArray(righe) ? righe : [];
  for (const row of list) {
    if (!row) continue;
    const ora = row.ora || row;
    const lavoro = row.lavoro || row.lavoroData || {};
    if (String(ora.stato || '') === 'da_validare' && oreVisibileInCodaValidazione({
      oraData: ora,
      lavoroData: lavoro,
      userId,
      isCaposquadra,
      isManager
    })) {
      daValidare.push(row);
    }
    const stato = String(ora.stato || '');
    if (stato !== 'validate' && stato !== 'rifiutate') continue;
    if (!giornoEntroUltimiGiorni(ora.data, giorni, oggi)) continue;
    if (!oraVisibileInArchivio({ ora, lavoro, userId, isCaposquadra, isManager })) continue;
    if (filtroOperaioId && String(ora.operaioId || '') !== String(filtroOperaioId)) continue;
    const lavoroId = row.lavoroId || ora.lavoroId || '';
    if (filtroLavoroId && String(lavoroId) !== String(filtroLavoroId)) continue;
    if (stato === 'validate') validate.push(row);
    else rifiutate.push(row);
  }
  return {
    daValidare,
    validate,
    rifiutate,
    periodoEtichetta: `ultimi ${giorni} giorni`
  };
}

/**
 * @param {string} orarioInizio
 * @param {string} orarioFine
 * @param {number} pauseMinuti
 * @returns {number}
 */
export function calcolaOreNette(orarioInizio, orarioFine, pauseMinuti) {
  const inizio = orarioAMinuti(orarioInizio);
  const fine = orarioAMinuti(orarioFine);
  const pause = Number(pauseMinuti) || 0;
  if (!Number.isFinite(inizio) || !Number.isFinite(fine)) return 0;
  const minutiNetti = fine - inizio - pause;
  if (minutiNetti <= 0) return 0;
  return minutiNetti / 60;
}

/**
 * @param {object[]} righe
 * @returns {number}
 */
export function sommaOreNette(righe) {
  const list = Array.isArray(righe) ? righe : [];
  let sum = 0;
  for (const row of list) {
    const n = Number(row && row.oreNette);
    if (Number.isFinite(n)) sum += n;
  }
  return sum;
}

/**
 * @param {number} oreDecimali
 * @returns {string} es. "12h 30min"
 */
export function formattaOreMinuti(oreDecimali) {
  const n = Number(oreDecimali);
  if (!Number.isFinite(n) || n <= 0) return '0h';
  const ore = Math.floor(n + 1e-9);
  const minuti = Math.round((n - ore) * 60);
  if (minuti <= 0) return `${ore}h`;
  if (minuti >= 60) return `${ore + 1}h`;
  return `${ore}h ${minuti}min`;
}

/**
 * @param {*} val
 * @returns {string} gg/mm
 */
export function formattaGiornoBreve(val) {
  const iso = chiaveGiornoOra(val);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!d || !m) return '';
  return `${d}/${m}`;
}

const GIORNI_SETTIMANA_IT = [
  'domenica',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato'
];

/**
 * @param {*} val
 * @returns {string} gg/mm/aaaa
 */
export function formattaDataItaliana(val) {
  const iso = chiaveGiornoOra(val);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

/**
 * @param {*} val
 * @returns {string} es. «giovedì 08/10/2026»
 */
export function formattaDataItalianaConGiorno(val) {
  const iso = chiaveGiornoOra(val);
  if (!iso) return '';
  const [ys, ms, ds] = iso.split('-');
  const dt = new Date(Number(ys), Number(ms) - 1, Number(ds), 12, 0, 0);
  if (isNaN(dt.getTime())) return formattaDataItaliana(iso);
  const giorno = GIORNI_SETTIMANA_IT[dt.getDay()] || '';
  return `${giorno} ${ds}/${ms}/${ys}`.trim();
}

export function snapshotCampiOra(ora) {
  if (!ora || typeof ora !== 'object') {
    return {
      data: '',
      orarioInizio: '',
      orarioFine: '',
      pauseMinuti: 0,
      oreNette: 0,
      note: '',
      stato: ''
    };
  }
  return {
    data: chiaveGiornoOra(ora.data) || '',
    orarioInizio: ora.orarioInizio || '',
    orarioFine: ora.orarioFine || '',
    pauseMinuti: Number(ora.pauseMinuti) || 0,
    oreNette: Number(ora.oreNette) || 0,
    note: ora.note || '',
    stato: ora.stato || ''
  };
}

/**
 * @param {{ azione: string, da: string, il: *, motivo?: string, prima: object, dopo: object }} args
 */
export function buildVoceStorico(args) {
  const a = args || {};
  return {
    azione: a.azione,
    da: String(a.da || ''),
    il: a.il != null ? a.il : null,
    motivo: a.motivo != null ? String(a.motivo).trim() : '',
    prima: snapshotCampiOra(a.prima),
    dopo: snapshotCampiOra(a.dopo)
  };
}

/**
 * @param {object[]|null|undefined} storico
 * @param {object} voce
 * @param {number} [max]
 * @returns {object[]}
 */
export function aggiungiVoceStorico(storico, voce, max = 20) {
  const list = Array.isArray(storico) ? storico.slice() : [];
  list.push(voce);
  const limite = Number(max) > 0 ? Number(max) : 20;
  if (list.length > limite) return list.slice(list.length - limite);
  return list;
}

/**
 * @param {object|null} contabilizzate
 * @returns {{ macchinaId: string|null, attrezzoId: string|null, ore: number }|null}
 */
function normalizzaContabilizzate(contabilizzate) {
  if (!contabilizzate || typeof contabilizzate !== 'object') return null;
  const ore = Number(contabilizzate.ore);
  if (!Number.isFinite(ore)) return null;
  const macchinaId = contabilizzate.macchinaId || null;
  const attrezzoId = contabilizzate.attrezzoId || null;
  if (!macchinaId && !attrezzoId) return null;
  return { macchinaId, attrezzoId, ore };
}

function oreSuId(cont, id) {
  if (!cont || !id) return 0;
  let n = 0;
  if (cont.macchinaId === id) n += cont.ore;
  if (cont.attrezzoId === id && cont.attrezzoId !== cont.macchinaId) n += cont.ore;
  return n;
}

/**
 * Piano di rettifica del contatore macchina/attrezzo.
 * Senza oreMacchinaContabilizzate non si tocca la macchina.
 *
 * @param {object|null} contabilizzate
 * @param {'correzione'|'annulla'|'rifiuto'} azione
 * @param {{ macchinaId?: string|null, attrezzoId?: string|null, ore?: number }|null} [prossimo]
 * @returns {{ operazioni: Array<{id: string, delta: number}>, avviso: string, azzeraCampo: boolean, prossimoContabilizzate: object|null }}
 */
function rigaHaMezzo(riga) {
  return Boolean(riga && (riga.macchinaId || riga.attrezzoId));
}

export function pianoRettificaOreMacchina(contabilizzate, azione, prossimo = null, riga = null) {
  const prima = normalizzaContabilizzate(contabilizzate);
  if (!prima) {
    const haMezzo = rigaHaMezzo(riga) || rigaHaMezzo(contabilizzate) || rigaHaMezzo(prossimo);
    return {
      operazioni: [],
      avviso: haMezzo ? 'ore macchina da verificare a mano' : '',
      azzeraCampo: false,
      prossimoContabilizzate: null
    };
  }

  if (azione === 'annulla' || azione === 'rifiuto') {
    const operazioni = [];
    if (prima.macchinaId) operazioni.push({ id: prima.macchinaId, delta: -prima.ore });
    if (prima.attrezzoId && prima.attrezzoId !== prima.macchinaId) {
      operazioni.push({ id: prima.attrezzoId, delta: -prima.ore });
    }
    return {
      operazioni: operazioni.filter((op) => op.delta !== 0),
      avviso: '',
      azzeraCampo: true,
      prossimoContabilizzate: null
    };
  }

  const dopo = normalizzaContabilizzate(prossimo) || {
    macchinaId: null,
    attrezzoId: null,
    ore: 0
  };
  const ids = new Set(
    [prima.macchinaId, prima.attrezzoId, dopo.macchinaId, dopo.attrezzoId].filter(Boolean)
  );
  const operazioni = [];
  ids.forEach((id) => {
    const delta = oreSuId(dopo, id) - oreSuId(prima, id);
    if (delta !== 0) operazioni.push({ id, delta });
  });
  const tiene = (dopo.macchinaId || dopo.attrezzoId) && dopo.ore > 0;
  return {
    operazioni,
    avviso: '',
    azzeraCampo: !tiene,
    prossimoContabilizzate: tiene ? dopo : null
  };
}

/**
 * Timestamp Firestore, Date, secondi {seconds} o stringa → Date locale.
 * @param {*} val
 * @returns {Date|null}
 */
export function istanteTraccia(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch (e) {
      return null;
    }
  }
  if (typeof val === 'object' && val.seconds != null) {
    const ms = Number(val.seconds) * 1000 + Math.floor(Number(val.nanoseconds || 0) / 1e6);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * gg/mm/aaaa hh:mm in ora locale.
 * @param {*} val
 * @returns {string}
 */
export function formattaDataOraTraccia(val) {
  const d = istanteTraccia(val);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function testoVoceTraccia(azione, chi, quando, motivo) {
  const nome = chi ? ` da ${chi}` : '';
  const data = quando ? ` il ${quando}` : '';
  const mot = motivo ? ` — ${motivo}` : '';
  if (azione === 'validazione') return `Validata${nome}${data}`;
  if (azione === 'modifica') return `Modificata${nome}${data}`;
  if (azione === 'correzione') return `Corretta${nome}${data}${mot}`;
  if (azione === 'annulla_validazione') return `Validazione annullata${nome}${data}${mot}`;
  if (azione === 'rifiuto') return `Rifiutata${nome}${data}${mot}`;
  return '';
}

const AZIONI_TRACCIA = new Set(['validazione', 'modifica', 'correzione', 'annulla_validazione', 'rifiuto']);

/**
 * Stesso autore e stesso minuto: la validazione corrente è già nello storico.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function stessoMinutoTraccia(a, b) {
  const da = istanteTraccia(a);
  const db = istanteTraccia(b);
  if (!da || !db) return false;
  return Math.floor(da.getTime() / 60000) === Math.floor(db.getTime() / 60000);
}

function storicoHaVoce(storico, azione, da, il) {
  return (Array.isArray(storico) ? storico : []).some((voce) => {
    if (!voce || voce.azione !== azione) return false;
    if (String(voce.da || '') !== String(da || '')) return false;
    if (!il && !voce.il) return true;
    return stessoMinutoTraccia(voce.il, il);
  });
}

/**
 * Se la validazione attuale non è già nello storico, la aggiunge.
 * Serve alle righe vecchie, prima di azzerare validatoDa e validatoIl.
 * @param {object[]|null|undefined} storico
 * @param {object} ora
 * @returns {object[]}
 */
export function assicuraVoceValidazione(storico, ora) {
  const list = Array.isArray(storico) ? storico.slice() : [];
  if (!ora || (!ora.validatoDa && !ora.validatoIl)) return list;
  if (storicoHaVoce(list, 'validazione', ora.validatoDa, ora.validatoIl)) return list;
  return aggiungiVoceStorico(list, buildVoceStorico({
    azione: 'validazione',
    da: ora.validatoDa || '',
    il: ora.validatoIl != null ? ora.validatoIl : null,
    motivo: '',
    prima: ora,
    dopo: { ...snapshotCampiOra(ora), stato: 'validate' }
  }));
}

/**
 * Se il rifiuto attuale non è già nello storico, lo sposta lì.
 * I campi rifiutatoDa / rifiutatoIl / motivoRifiuto non decidono più l'etichetta.
 * @param {object[]|null|undefined} storico
 * @param {object} ora
 * @returns {object[]}
 */
export function assicuraVoceRifiuto(storico, ora) {
  const list = Array.isArray(storico) ? storico.slice() : [];
  if (!ora || (!ora.rifiutatoDa && !ora.rifiutatoIl && !ora.motivoRifiuto)) return list;
  if (storicoHaVoce(list, 'rifiuto', ora.rifiutatoDa, ora.rifiutatoIl)) return list;
  return aggiungiVoceStorico(list, buildVoceStorico({
    azione: 'rifiuto',
    da: ora.rifiutatoDa || '',
    il: ora.rifiutatoIl != null ? ora.rifiutatoIl : null,
    motivo: ora.motivoRifiuto || '',
    prima: ora,
    dopo: { ...snapshotCampiOra(ora), stato: 'rifiutate' }
  }));
}

/**
 * Etichetta dello stato attuale. Una riga tornata in attesa non resta «rifiutata».
 * @param {object} ora
 * @param {'caposquadra'|'manager'} [chi]
 * @returns {string}
 */
export function etichettaStatoAttualeOra(ora, chi) {
  if (!ora) return '';
  if (ora.stato === 'da_validare') {
    const chiTesto = chi === 'manager' ? 'il manager' : 'il caposquadra';
    return `Da validare — la valida ${chiTesto}`;
  }
  if (ora.stato === 'validate') return 'Validata';
  if (ora.stato === 'rifiutate') return 'Rifiutata';
  return etichettaStatoOra(ora.stato);
}

/**
 * Elenco ordinato per data. Tutte le voci dello storico, validazioni comprese.
 * La validazione corrente si aggiunge solo se non è già nello storico (stesso autore, stesso minuto).
 * Due voci con lo stesso testo ma in momenti diversi restano tutte e due.
 * @param {object} ora
 * @param {(uid: string) => string} [nomeDi]
 * @returns {string[]}
 */
export function vociTracciaOra(ora, nomeDi) {
  if (!ora) return [];
  const nome = typeof nomeDi === 'function' ? nomeDi : () => '';
  const eventi = [];
  const spinge = (azione, da, il, motivo) => {
    const quando = formattaDataOraTraccia(il);
    const chi = da ? (nome(da) || '') : '';
    const motivoTesto = motivo ? String(motivo).trim() : '';
    const testo = testoVoceTraccia(azione, chi, quando, motivoTesto);
    if (!testo) return;
    const t = istanteTraccia(il);
    eventi.push({ t: t ? t.getTime() : 0, minuto: t ? Math.floor(t.getTime() / 60000) : 0, testo });
  };

  const storico = Array.isArray(ora.storicoModifiche) ? ora.storicoModifiche : [];
  let haRifiutoStorico = false;
  storico.forEach((voce) => {
    if (!voce || !AZIONI_TRACCIA.has(voce.azione)) return;
    if (voce.azione === 'rifiuto') haRifiutoStorico = true;
    spinge(voce.azione, voce.da, voce.il, voce.motivo);
  });

  const giaValidazione = storicoHaVoce(storico, 'validazione', ora.validatoDa, ora.validatoIl);
  if ((ora.validatoDa || ora.validatoIl) && !giaValidazione) {
    spinge('validazione', ora.validatoDa, ora.validatoIl, '');
  }

  const haCampiRifiuto = Boolean(ora.rifiutatoDa || ora.rifiutatoIl || ora.motivoRifiuto);
  if (!haRifiutoStorico && haCampiRifiuto) {
    spinge('rifiuto', ora.rifiutatoDa, ora.rifiutatoIl, ora.motivoRifiuto);
  }

  eventi.sort((a, b) => a.t - b.t);
  const visti = new Set();
  const out = [];
  eventi.forEach((evento) => {
    const chiave = `${evento.testo}\n${evento.minuto}`;
    if (visti.has(chiave)) return;
    visti.add(chiave);
    out.push(evento.testo);
  });
  return out;
}

/**
 * Traccia completa in una riga. Data e ora locali.
 * @param {object} ora
 * @param {(uid: string) => string} [nomeDi]
 * @returns {string}
 */
export function formatTracciaOra(ora, nomeDi) {
  return vociTracciaOra(ora, nomeDi).join(' · ');
}

/**
 * Versione corta per la tabella, con il testo intero se serve «mostra tutto».
 * @param {string[]} voci
 * @param {number} [max]
 * @returns {{ full: string, breve: string, tronca: boolean }}
 */
export function riassuntoTraccia(voci, max = 90) {
  const full = (Array.isArray(voci) ? voci : []).join(' · ');
  const limite = Number(max) > 20 ? Number(max) : 90;
  if (full.length <= limite) return { full, breve: full, tronca: false };
  return { full, breve: `${full.slice(0, limite - 1).trim()}…`, tronca: true };
}

/**
 * @param {string} orarioInizio
 * @param {string} orarioFine
 * @param {number} pauseMinuti
 * @returns {string|null} messaggio di errore, oppure null
 */
export function validaIntervalloOra(orarioInizio, orarioFine, pauseMinuti) {
  const inizio = orarioAMinuti(orarioInizio);
  const fine = orarioAMinuti(orarioFine);
  if (!Number.isFinite(inizio) || !Number.isFinite(fine)) {
    return 'Formato orario non valido (usa HH:MM)';
  }
  if (fine <= inizio) return 'Orario fine deve essere maggiore di orario inizio';
  const pause = Number(pauseMinuti);
  if (!Number.isFinite(pause) || pause < 0) return 'Pause non possono essere negative';
  if (pause >= fine - inizio) return 'Pause non possono essere maggiori o uguali al tempo di lavoro';
  return null;
}
