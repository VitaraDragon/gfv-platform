/**
 * Categorie prodotto per il modulo Prodotti e Magazzino
 * @module modules/magazzino/config/categorie-prodotto
 */

export const CATEGORIE_PRODOTTO = [
  { id: 'fitofarmaci', nome: 'Fitofarmaci', icona: '🦠' },
  { id: 'fertilizzanti', nome: 'Fertilizzanti', icona: '🌱' },
  { id: 'materiale_impianto', nome: 'Materiale impianto', icona: '🔧' },
  { id: 'ricambi', nome: 'Ricambi', icona: '⚙️' },
  { id: 'sementi', nome: 'Sementi', icona: '🌾' },
  { id: 'carburante', nome: 'Carburante', icona: '⛽' },
  { id: 'altro', nome: 'Altro', icona: '📦' }
];

export const UNITA_MISURA = [
  { id: 'kg', nome: 'kg' },
  { id: 'L', nome: 'L' },
  { id: 'pezzi', nome: 'Pezzi' },
  { id: 'm', nome: 'm' },
  { id: 'm2', nome: 'm²' },
  { id: 'confezione', nome: 'Confezione' },
  { id: 'sacchi', nome: 'Sacchi' },
  { id: 'altro', nome: 'Altro' }
];

export const TIPI_MOVIMENTO = [
  { id: 'entrata', nome: 'Entrata', icona: '➕' },
  { id: 'uscita', nome: 'Uscita', icona: '➖' }
];

/** Sinonimi parlati / OCR → id categoria. Non mappare «urea» (è concime, non AdBlue). */
const CATEGORIA_ALIAS = {
  fitofarmaci: 'fitofarmaci',
  fitofarmaco: 'fitofarmaci',
  fitosanitari: 'fitofarmaci',
  pesticida: 'fitofarmaci',
  pesticidi: 'fitofarmaci',
  fertilizzanti: 'fertilizzanti',
  fertilizzante: 'fertilizzanti',
  concime: 'fertilizzanti',
  concimi: 'fertilizzanti',
  'materiale impianto': 'materiale_impianto',
  materiale_impianto: 'materiale_impianto',
  impianto: 'materiale_impianto',
  ricambi: 'ricambi',
  ricambio: 'ricambi',
  sementi: 'sementi',
  seme: 'sementi',
  carburante: 'carburante',
  carburanti: 'carburante',
  gasolio: 'carburante',
  diesel: 'carburante',
  benzina: 'carburante',
  adblue: 'carburante',
  'ad blue': 'carburante',
  altro: 'altro'
};

export const CATEGORIA_PRODOTTO_IDS = CATEGORIE_PRODOTTO.map(function (c) { return c.id; });

export function isCategoriaProdottoId(id) {
  return CATEGORIA_PRODOTTO_IDS.indexOf(String(id || '')) >= 0;
}

/**
 * Allinea testo libero / CF / OCR ai value di categoria.
 * @param {string|null|undefined} raw
 * @returns {string|null|undefined}
 */
export function normalizeCategoriaProdottoId(raw) {
  if (raw == null || raw === '') return raw;
  var s = String(raw).toLowerCase().trim();
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* ignore */ }
  s = s.replace(/\s+/g, ' ');
  if (CATEGORIA_ALIAS[s]) return CATEGORIA_ALIAS[s];
  if (s.indexOf('carbur') >= 0 || s.indexOf('gasolio') >= 0 || s.indexOf('diesel') >= 0
      || s.indexOf('benzina') >= 0 || s.indexOf('adblue') >= 0 || s.indexOf('ad blue') >= 0) {
    return 'carburante';
  }
  if (s.indexOf('fertil') >= 0 || s.indexOf('concim') >= 0) return 'fertilizzanti';
  if (s.indexOf('fitofarm') >= 0 || s === 'fito' || s.indexOf('pestic') >= 0) return 'fitofarmaci';
  if (s.indexOf('ricamb') >= 0) return 'ricambi';
  if (s.indexOf('sement') >= 0 || /^sem[eie]/i.test(s)) return 'sementi';
  if (s.indexOf('materiale') >= 0 && s.indexOf('impiant') >= 0) return 'materiale_impianto';
  return raw;
}
