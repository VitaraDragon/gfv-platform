/**
 * Famiglia di coltura del terreno. Preferisce colturaCategoria quando c'è.
 * @module shared/js/coltura-terreno
 */

const COLTURE_FRUTTETO = [
  'pesco', 'melo', 'pero', 'albicocche', 'prugne', 'ciliegio', 'susino', 'fico',
  'nocciolo', 'mandorlo', 'castagno', 'cotogno', 'sorbo', 'nespolo', 'giuggiolo',
  'corbezzolo', 'gelso', 'mora', 'lampone', 'mirtillo', 'ribes', 'uva spina',
  'kiwi', 'melograno', 'fico d\'india', 'kaki', 'noce', 'pistacchio', 'frutteto'
];

const SEMINATIVI = ['grano', 'mais', 'orzo', 'favino', 'girasole', 'soia', 'colza', 'avena', 'segale', 'riso'];

export function isColturaFrutteto(coltura) {
  if (!coltura) return false;
  const colturaLower = String(coltura).toLowerCase();
  return COLTURE_FRUTTETO.some((f) => colturaLower.includes(f));
}

export function isColturaVigneto(coltura) {
  if (!coltura) return false;
  const k = String(coltura).toLowerCase();
  return k.includes('vite') || k.includes('vigneto');
}

/**
 * @param {object|string|null|undefined} terrenoOColtura
 * @returns {'vigneto'|'frutteto'|'seminativo'|'altro'|'nessuna'}
 */
export function famigliaColtura(terrenoOColtura) {
  const terreno = terrenoOColtura && typeof terrenoOColtura === 'object' ? terrenoOColtura : null;
  const categoria = String((terreno && terreno.colturaCategoria) || '').toLowerCase();
  const nome = String(
    (terreno && terreno.coltura) || (typeof terrenoOColtura === 'string' ? terrenoOColtura : '')
  ).toLowerCase();
  if (categoria.includes('vite') || categoria.includes('vigneto') || (!categoria && isColturaVigneto(nome))) {
    return 'vigneto';
  }
  if (categoria.includes('frutt') || (!categoria && isColturaFrutteto(nome))) return 'frutteto';
  if (categoria.includes('semin') || SEMINATIVI.some((s) => nome.includes(s))) return 'seminativo';
  if (!nome && !categoria) return 'nessuna';
  return 'altro';
}

export function isTerrenoFrutteto(terreno) {
  return famigliaColtura(terreno) === 'frutteto';
}

export function isTerrenoVigneto(terreno) {
  return famigliaColtura(terreno) === 'vigneto';
}

/**
 * Tendina: solo i terreni che passano il filtro, più sempre il terreno già collegato.
 * @param {Array} terreni
 * @param {{ filtro?: Function, idCorrente?: string }} [opzioni]
 */
export function terreniPerTendina(terreni, opzioni = {}) {
  const lista = Array.isArray(terreni) ? terreni : [];
  const filtro = opzioni.filtro || (() => true);
  const idCorrente = opzioni.idCorrente ? String(opzioni.idCorrente) : '';
  const scelti = lista.filter((t) => t && t.stato !== 'archiviato' && filtro(t));
  if (idCorrente && !scelti.some((t) => String(t.id) === idCorrente)) {
    const corrente = lista.find((t) => t && String(t.id) === idCorrente);
    if (corrente) scelti.unshift(corrente);
  }
  return scelti;
}
