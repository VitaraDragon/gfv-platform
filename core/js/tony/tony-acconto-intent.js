/**
 * Intent Tony «acconto» — risoluzione pura lato client (niente Cloud Functions).
 * Nessun salvataggio automatico: solo proposta di conferma o domande minime.
 *
 * @module core/js/tony/tony-acconto-intent
 */

const ACCONTO_RE =
  /\b(acconto|acconti|liquidazione|saldo)\b|\barrivat[oa]\s+(l['']?\s*)?acconto\b/i;

const PRODOTTO_HINTS = [
  { cat: 'uva', re: /\b(uva|vino|cantina|vendemmia)\b/i },
  { cat: 'frutta', re: /\b(frutta|mela|pere|cilieg|pesca|kiwi)\b/i },
  { cat: 'ortaggi', re: /\b(ortagg|pomodor|zucchin|lattug)\b/i },
  { cat: 'seminativo', re: /\b(grano|mais|orzo|seminat|cereali?)\b/i }
];

/**
 * @param {string} raw
 * @returns {number|null}
 */
export function parseImportoEuro(raw) {
  const text = String(raw || '');
  const m =
    text.match(/(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)/i) ||
    text.match(/(?:€|euro)\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
  if (!m) return null;
  const token = (m[1] || '').replace(/\s/g, '');
  if (!token) return null;
  let normalized = token;
  if (normalized.indexOf(',') >= 0 && normalized.indexOf('.') >= 0) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.indexOf(',') >= 0) {
    normalized = normalized.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Data locale YYYY-MM-DD (non UTC: evita giorno-prima tra 00:00 e 01:00/02:00 IT).
 * @param {Date} [date]
 * @returns {string}
 */
export function todayIsoLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isAccontoUtterance(text) {
  return ACCONTO_RE.test(String(text || ''));
}

/**
 * @param {string} text
 * @returns {string|null} categoria prodotto o null se ambigua/assente
 */
export function inferCategoriaProdotto(text) {
  const hits = PRODOTTO_HINTS.filter((h) => h.re.test(String(text || '')));
  if (hits.length === 1) return hits[0].cat;
  return null;
}

/**
 * Match acquirente per nome contenuto nell'utterance.
 * @param {string} text
 * @param {Array<{ id: string, nome: string, categorieProdotto?: string[] }>} acquirenti
 * @param {string|null} [categoria]
 */
export function matchAcquirenti(text, acquirenti, categoria) {
  const t = String(text || '').toLowerCase();
  let list = Array.isArray(acquirenti) ? acquirenti.slice() : [];
  if (categoria) {
    list = list.filter(
      (a) =>
        !a.categorieProdotto ||
        !a.categorieProdotto.length ||
        a.categorieProdotto.includes(categoria)
    );
  }
  const named = list.filter((a) => {
    const nome = String(a.nome || '').trim().toLowerCase();
    return nome.length >= 3 && t.indexOf(nome) >= 0;
  });
  if (named.length) return named;
  return list;
}

/**
 * @param {Array<{ id: string, acquirenteId: string, stato?: string, annata?: string, categoriaProdotto?: string, labelBreve?: Function }>} conferimenti
 * @param {{ acquirenteId?: string, categoria?: string|null }} filters
 */
export function matchConferimentiAperti(conferimenti, filters = {}) {
  let list = (conferimenti || []).filter((c) => !c.stato || c.stato === 'aperto');
  if (filters.acquirenteId) {
    list = list.filter((c) => String(c.acquirenteId) === String(filters.acquirenteId));
  }
  if (filters.categoria) {
    list = list.filter((c) => c.categoriaProdotto === filters.categoria);
  }
  return list;
}

/**
 * @param {string} text
 * @param {{
 *   acquirenti: Array<object>,
 *   conferimenti: Array<object>,
 *   todayIso?: string,
 *   now?: Date,
 *   acquirenteLabel?: (a: object) => string,
 *   conferimentoLabel?: (c: object, a: object|null) => string
 * }} ctx
 * @returns {{
 *   handled: boolean,
 *   stato: 'conferma'|'chiedi_prodotto'|'chiedi_acquirente'|'chiedi_conferimento'|'manca_importo'|'ignora',
 *   replyText: string,
 *   pending?: { importo: number, acquirenteId: string, conferimentoId: string, data: string, tipo: 'acconto'|'saldo', categoriaProdotto?: string|null },
 *   opzioni?: Array<{ id: string, label: string }>
 * }}
 */
export function resolveAccontoIntent(text, ctx) {
  if (!isAccontoUtterance(text)) {
    return { handled: false, stato: 'ignora', replyText: '' };
  }

  const importo = parseImportoEuro(text);
  if (importo == null) {
    return {
      handled: true,
      stato: 'manca_importo',
      replyText: 'Quanto è l’acconto? Dimmi l’importo in euro.'
    };
  }

  const tipo = /\bsaldo\b|\bliquidazione\b/i.test(text) ? 'saldo' : 'acconto';
  const categoria = inferCategoriaProdotto(text);
  const acqAll = ctx.acquirenti || [];
  const confAll = ctx.conferimenti || [];

  if (!categoria && acqAll.length > 1) {
    const cats = new Set();
    acqAll.forEach((a) => (a.categorieProdotto || []).forEach((c) => cats.add(c)));
    if (cats.size > 1) {
      return {
        handled: true,
        stato: 'chiedi_prodotto',
        replyText: 'Per quale prodotto? Uva, frutta, ortaggi o seminativo?',
        opzioni: Array.from(cats).map((c) => ({ id: c, label: c }))
      };
    }
  }

  const matchedAcq = matchAcquirenti(text, acqAll, categoria);
  if (matchedAcq.length === 0) {
    return {
      handled: true,
      stato: 'chiedi_acquirente',
      replyText: 'Non trovo un acquirente adatto. Quale cantina o cooperativa?'
    };
  }
  if (matchedAcq.length > 1) {
    const labelFn = ctx.acquirenteLabel || ((a) => a.nome);
    return {
      handled: true,
      stato: 'chiedi_acquirente',
      replyText:
        'Quale acquirente? ' +
        matchedAcq
          .slice(0, 5)
          .map((a) => labelFn(a))
          .join(', '),
      opzioni: matchedAcq.slice(0, 5).map((a) => ({ id: a.id, label: labelFn(a) }))
    };
  }

  const acq = matchedAcq[0];
  const confs = matchConferimentiAperti(confAll, {
    acquirenteId: acq.id,
    categoria
  });
  if (confs.length === 0) {
    return {
      handled: true,
      stato: 'chiedi_conferimento',
      replyText: `Non c’è un conferimento aperto per ${acq.nome}. Aprine uno dalla pagina Vendite ed entrate, poi riprova.`
    };
  }
  if (confs.length > 1) {
    const labelFn =
      ctx.conferimentoLabel ||
      ((c) => c.labelBreve ? c.labelBreve(acq.nome) : `${c.categoriaProdotto} ${c.annata}`);
    return {
      handled: true,
      stato: 'chiedi_conferimento',
      replyText:
        'Su quale annata/conferimento? ' +
        confs
          .slice(0, 5)
          .map((c) => labelFn(c, acq))
          .join('; '),
      opzioni: confs.slice(0, 5).map((c) => ({ id: c.id, label: labelFn(c, acq) }))
    };
  }

  const conf = confs[0];
  const labelFn =
    ctx.conferimentoLabel ||
    ((c) => (c.labelBreve ? c.labelBreve(acq.nome) : `${c.categoriaProdotto} ${c.annata}, ${acq.nome}`));
  const label = labelFn(conf, acq);
  const data = ctx.todayIso || todayIsoLocal(ctx.now || new Date());
  const importoFmt = importo.toLocaleString('it-IT', {
    minimumFractionDigits: importo % 1 ? 2 : 0,
    maximumFractionDigits: 2
  });

  return {
    handled: true,
    stato: 'conferma',
    replyText: `Registro ${importoFmt} € come ${tipo} incassato oggi su "${label}"?`,
    pending: {
      importo,
      acquirenteId: acq.id,
      conferimentoId: conf.id,
      data,
      tipo,
      categoriaProdotto: conf.categoriaProdotto || categoria || null
    }
  };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isConfermaAffermativa(text) {
  const t = String(text || '').trim().toLowerCase();
  return /^(s[iì]|ok|va bene|confermo|salva|procedi|d'accordo|daccordo)([!.\s]|$)/i.test(t)
    || /^(s[iì]\s+salva|ok\s+salva|conferma)$/i.test(t);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isConfermaNegativa(text) {
  const t = String(text || '').trim().toLowerCase();
  return /^(no|annulla|lascia|non\s+salv)/i.test(t);
}

export default {
  parseImportoEuro,
  todayIsoLocal,
  isAccontoUtterance,
  inferCategoriaProdotto,
  matchAcquirenti,
  matchConferimentiAperti,
  resolveAccontoIntent,
  isConfermaAffermativa,
  isConfermaNegativa
};
