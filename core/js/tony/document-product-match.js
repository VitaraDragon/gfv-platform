/**
 * Match righe documento → prodotti anagrafica GFV + suggerimento categoria.
 * @module core/js/tony/document-product-match
 */

import { CATEGORIE_PRODOTTO, UNITA_MISURA } from '../../../modules/magazzino/config/categorie-prodotto.js';

const CATEGORIA_KEYWORDS = [
  { id: 'fitofarmaci', keywords: ['fitofarmaco', 'fungicid', 'erbicid', 'insetticid', 'acaricid', 'rame', 'zolfo', 'copper', 'glyphos', 'glifos', 'triazol', 'boscalid'] },
  { id: 'fertilizzanti', keywords: ['fertilizz', 'concime', 'urea', 'npk', 'azoto', 'fosforo', 'potassio', 'ammonio', 'nitrato', 'solfato', 'micronutrient'] },
  { id: 'sementi', keywords: ['seme', 'sementi', 'rootstock', 'portinnesto', 'barbatella', 'piantina'] },
  { id: 'materiale_impianto', keywords: ['palo', 'tutore', 'filo', 'tubo', 'irrigaz', 'valvola', 'raccordo', 'clip', 'aggrappatoio'] },
  { id: 'ricambi', keywords: ['ricambio', 'filtro', 'cinghia', 'candela', 'olio motore', 'pastiglia', 'guarnizione'] },
];

const VALID_CATEGORIA_IDS = CATEGORIE_PRODOTTO.map(function (c) { return c.id; });
const VALID_UNITA_IDS = UNITA_MISURA.map(function (u) { return u.id; });

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

var WEAK_PRODUCT_TOKENS = {
  da: 1, di: 1, del: 1, della: 1, con: 1, per: 1, the: 1,
  fung: 1, fungicida: 1, inse: 1, insetticida: 1, concime: 1,
  lt: 1, kg: 1, pz: 1, nr: 1, num: 1, ddt: 1, bolla: 1,
};

function tokenSet(s) {
  var t = normText(s);
  if (!t) return [];
  return t.split(' ').filter(function (w) { return w.length >= 2; });
}

function isWeakProductToken(w) {
  return !!WEAK_PRODUCT_TOKENS[w] || w.length < 3;
}

/**
 * Intestazione gruppo DDT — non matchare come prodotto.
 * @param {string} descrizione
 * @returns {boolean}
 */
export function isDdtHeaderDescrizione(descrizione) {
  var d = String(descrizione || '').trim();
  if (!d) return false;
  if (/^ddt\s*num/i.test(d)) return true;
  if (/^ddt\s*[nN°.]/i.test(d)) return true;
  if (/^documento\s+di\s+trasporto/i.test(d)) return true;
  if (/^bolla\s+(n|num)/i.test(d)) return true;
  if (/^ddt[\s.:/\d]/i.test(d) && !/\b(fung|inse|concim|maschera|spese|olio|rame|zolfo|fertil|seme)/i.test(d)) {
    return true;
  }
  return false;
}

/**
 * @param {string} categoriaId
 * @returns {string}
 */
export function getCategoriaNome(categoriaId) {
  var c = CATEGORIE_PRODOTTO.find(function (x) { return x.id === categoriaId; });
  return c ? c.nome : String(categoriaId || 'altro');
}

/**
 * @param {string} descrizione
 * @returns {{ categoria: string, score: number }}
 */
export function suggestCategoriaForRiga(descrizione) {
  var text = normText(descrizione);
  if (!text) return { categoria: 'altro', score: 0 };
  var best = { categoria: 'altro', score: 0 };
  CATEGORIA_KEYWORDS.forEach(function (row) {
    var score = 0;
    row.keywords.forEach(function (kw) {
      if (text.indexOf(normText(kw)) >= 0) score += 1;
    });
    if (score > best.score) {
      best = { categoria: row.id, score: score };
    }
  });
  if (best.score === 0) return { categoria: 'altro', score: 0 };
  return { categoria: best.categoria, score: Math.min(1, best.score * 0.25) };
}

/**
 * @param {string} unita
 * @returns {string}
 */
export function mapUnitaOcrToGfv(unita) {
  var u = normText(unita);
  if (!u) return 'pezzi';
  if (u === 'kg' || u.indexOf('chilogram') >= 0) return 'kg';
  if (u === 'l' || u === 'lt' || u.indexOf('lit') >= 0) return 'L';
  if (u === 'pz' || u === 'pezzi' || u === 'pezzo' || u === 'nr' || u === 'n') return 'pezzi';
  if (u === 'm' || u === 'metro') return 'm';
  if (u === 'm2' || u === 'mq' || u.indexOf('metro quad') >= 0) return 'm2';
  if (u.indexOf('sacc') >= 0) return 'sacchi';
  if (u.indexOf('conf') >= 0) return 'confezione';
  if (VALID_UNITA_IDS.indexOf(unita) >= 0) return unita;
  return 'pezzi';
}

/**
 * @param {object} riga
 * @returns {object|null}
 */
export function buildProdottoStubFromRiga(riga) {
  var nome = String((riga && riga.descrizione) || '').trim().slice(0, 200);
  if (!nome) return null;
  var cat = (riga && riga.categoriaSuggerita) || suggestCategoriaForRiga(nome).categoria || 'altro';
  if (VALID_CATEGORIA_IDS.indexOf(cat) < 0) cat = 'altro';
  return {
    nome: nome,
    categoria: cat,
    unitaMisura: mapUnitaOcrToGfv(riga && riga.unita),
    daCompletare: true,
    note: 'Creato automaticamente da Tony Occhi — completare anagrafica',
    attivo: true,
  };
}

/**
 * @param {Array<object>} prodotti
 * @param {string} [categoria]
 * @returns {Array<object>}
 */
export function filterProdottiByCategoria(prodotti, categoria) {
  if (!categoria || categoria === 'altro') return prodotti || [];
  var filtered = (prodotti || []).filter(function (p) { return p.categoria === categoria; });
  return filtered.length ? filtered : (prodotti || []);
}

/**
 * @param {string} descrizione
 * @param {string} codiceFornitore
 * @param {Array<{ id: string, nome?: string, codice?: string, categoria?: string }>} prodotti
 * @param {{ categoria?: string }} [opts]
 * @returns {{ prodottoId: string|null, score: number, candidates: Array<{ id: string, label: string, score: number }> }}
 */
export function suggestProdottoForRiga(descrizione, codiceFornitore, prodotti, opts) {
  opts = opts || {};
  if (isDdtHeaderDescrizione(descrizione)) {
    return { prodottoId: null, score: 0, candidates: [] };
  }
  var pool = filterProdottiByCategoria(prodotti, opts.categoria);
  var desc = normText(descrizione);
  var cod = normText(codiceFornitore);
  var descTokens = tokenSet(descrizione);
  var strongDescTokens = descTokens.filter(function (w) { return !isWeakProductToken(w); });
  var candidates = [];

  pool.forEach(function (p) {
    if (!p || !p.id) return;
    // Prodotti spurii creati da intestazioni DDT (acquisizioni precedenti)
    if (isDdtHeaderDescrizione(p.nome) || isDdtHeaderDescrizione(p.codice)) return;
    var nome = normText(p.nome);
    var codice = normText(p.codice);
    var score = 0;
    if (cod && codice && (cod === codice || codice.indexOf(cod) >= 0 || cod.indexOf(codice) >= 0)) {
      score += 0.55;
    }
    if (desc && nome) {
      if (desc === nome) score += 0.7;
      else if (nome.indexOf(desc) >= 0 || desc.indexOf(nome) >= 0) score += 0.45;
      else {
        var nomeTokens = tokenSet(p.nome);
        var strongOverlap = 0;
        var weakOverlap = 0;
        descTokens.forEach(function (dt) {
          var hit = nomeTokens.some(function (nt) {
            if (nt === dt) return true;
            // Prefisso significativo (es. cuprocaffa → cuprocaffaro), non token generici corti
            if (dt.length >= 5 && (nt.indexOf(dt) === 0 || dt.indexOf(nt) === 0)) return true;
            if (nt.length >= 5 && dt.length >= 5 && (nt.indexOf(dt) >= 0 || dt.indexOf(nt) >= 0)) return true;
            return false;
          });
          if (!hit) return;
          if (isWeakProductToken(dt)) weakOverlap += 1;
          else strongOverlap += 1;
        });
        if (strongOverlap > 0) score += Math.min(0.55, strongOverlap * 0.22);
        else if (weakOverlap > 0 && strongDescTokens.length === 0) score += Math.min(0.2, weakOverlap * 0.08);
      }
    }
    if (score > 0.08) {
      var catSuffix = p.categoria && p.categoria !== 'altro' ? ' · ' + getCategoriaNome(p.categoria) : '';
      candidates.push({
        id: p.id,
        label: (p.nome || p.codice || p.id) + (p.codice ? ' (' + p.codice + ')' : '') + catSuffix,
        score: Math.min(1, score),
      });
    }
  });

  if (!candidates.length && opts.categoria && opts.categoria !== 'altro') {
    return suggestProdottoForRiga(descrizione, codiceFornitore, prodotti, {});
  }

  candidates.sort(function (a, b) { return b.score - a.score; });
  var top = candidates[0] || null;
  var second = candidates[1] || null;
  // Evita auto-selezione ambigua (due candidati vicini, tipico Fung.X vs Fung.Y)
  var ambiguous = top && second && (top.score - second.score) < 0.08 && top.score < 0.7;
  var prodottoId = top && top.score >= 0.35 && !ambiguous ? top.id : null;
  return {
    prodottoId: prodottoId,
    score: top ? top.score : 0,
    candidates: candidates.slice(0, 8),
  };
}

/**
 * @param {Array<object>} righe
 * @param {Array<object>} prodotti
 * @returns {Array<object>}
 */
export function enrichRigheWithProdottoSuggestions(righe, prodotti) {
  var byId = {};
  (prodotti || []).forEach(function (p) {
    if (p && p.id) byId[p.id] = p;
  });
  return (righe || []).map(function (r) {
    if (isDdtHeaderDescrizione(r.descrizione)) {
      return Object.assign({}, r, {
        categoriaSuggerita: 'altro',
        categoriaScore: 0,
        prodottoIdSuggerito: null,
        prodottoIdConfermato: '',
        matchCandidates: [],
        matchScore: 0,
      });
    }
    var catSug = suggestCategoriaForRiga(r.descrizione);
    var sug = suggestProdottoForRiga(r.descrizione, r.codiceFornitore, prodotti, { categoria: catSug.categoria });
    var confirmed = r.prodottoIdConfermato || sug.prodottoId || '';
    // Non mantenere selezione su prodotto spurio "DdT num…"
    if (confirmed && byId[confirmed] && isDdtHeaderDescrizione(byId[confirmed].nome)) {
      confirmed = sug.prodottoId || '';
    }
    return Object.assign({}, r, {
      categoriaSuggerita: catSug.categoria,
      categoriaScore: catSug.score,
      prodottoIdSuggerito: sug.prodottoId,
      prodottoIdConfermato: confirmed,
      matchCandidates: sug.candidates,
      matchScore: sug.score,
    });
  });
}
