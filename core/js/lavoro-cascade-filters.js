/**
 * Filtri a cascata lavori/colture (categoria → sottocategoria/tipo, terreno → vendemmia).
 * @module core/js/lavoro-cascade-filters
 */

export function allCategorieFlat(categorieLavoriPrincipali, sottocategorieLavoriMap) {
  const principali = Array.isArray(categorieLavoriPrincipali) ? categorieLavoriPrincipali : [];
  const sottocat = sottocategorieLavoriMap instanceof Map
    ? Array.from(sottocategorieLavoriMap.values()).flat()
    : [];
  return [...principali, ...sottocat];
}

/**
 * Sottocategorie visibili dopo scelta categoria principale.
 * @param {string|null} parentId
 * @param {Map} sottocategorieLavoriMap
 * @returns {Array}
 */
export function getSottocategorieForParent(parentId, sottocategorieLavoriMap) {
  if (!parentId || !(sottocategorieLavoriMap instanceof Map)) return [];
  return sottocategorieLavoriMap.get(parentId) || [];
}

/**
 * Tipi lavoro filtrati per categoria principale o sottocategoria (loadTipiLavoro / dropdown).
 */
export function filterTipiLavoroByCategoria(
  categoriaId,
  tipiLavoroList,
  categorieLavoriPrincipali,
  sottocategorieLavoriMap
) {
  if (!categoriaId || !Array.isArray(tipiLavoroList)) return tipiLavoroList || [];

  const categoriaTrovata = allCategorieFlat(categorieLavoriPrincipali, sottocategorieLavoriMap).find(
    (c) => c.id === categoriaId
  );

  if (categoriaTrovata && categoriaTrovata.parentId) {
    const parentId = categoriaTrovata.parentId;
    return tipiLavoroList.filter(
      (tipo) =>
        tipo.sottocategoriaId === categoriaId ||
        tipo.categoriaId === categoriaId ||
        (tipo.categoriaId === parentId && !tipo.sottocategoriaId)
    );
  }

  const allCategorieIds = [categoriaId];
  const sottocat = getSottocategorieForParent(categoriaId, sottocategorieLavoriMap);
  sottocat.forEach((subcat) => allCategorieIds.push(subcat.id));

  return tipiLavoroList.filter(
    (tipo) =>
      tipo.categoriaId === categoriaId ||
      (tipo.sottocategoriaId && allCategorieIds.includes(tipo.sottocategoriaId)) ||
      (allCategorieIds.includes(tipo.categoriaId) && !tipo.sottocategoriaId)
  );
}

/** Colture uniche dai terreni (populateColtureFromTerreni). */
export function extractColtureUnicheFromTerreni(terreni = []) {
  const coltureUniche = new Set();
  (terreni || []).forEach((terreno) => {
    if (terreno && terreno.coltura && String(terreno.coltura).trim()) {
      coltureUniche.add(String(terreno.coltura).trim());
    }
  });
  return Array.from(coltureUniche).sort((a, b) => a.localeCompare(b, 'it'));
}

/**
 * Mantiene la selezione figlio se ancora valida dopo un ripopola del dropdown padre.
 * @param {string|null|undefined} previousValue
 * @param {Array} options
 * @param {{ getId?: (item: object) => string|null|undefined }} [opts]
 * @returns {string|null}
 */
export function resolvePreserveCascadeSelection(previousValue, options, opts = {}) {
  const getId = opts.getId || ((item) => item?.id);
  if (!previousValue || !Array.isArray(options) || options.length === 0) return null;
  return options.some((item) => getId(item) === previousValue) ? previousValue : null;
}

/** ID effettivo per filtri tipo lavoro: sottocategoria se scelta, altrimenti categoria principale. */
export function resolveCascadeFilterCategoriaId(sottocategoriaId, categoriaPrincipaleId) {
  return sottocategoriaId || categoriaPrincipaleId || null;
}

/** Colture ammesse per categoria coltura attività (updateColtureDropdownAttivita). */
export function coltureDisponibiliPerCategoria(categoriaId, colturePerCategoria = {}) {
  if (!categoriaId) return [];
  const coltureCategoria = colturePerCategoria[categoriaId] || [];
  return coltureCategoria
    .map((coltura) => (typeof coltura === 'string' ? coltura : coltura.nome || coltura))
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), 'it'));
}

export function isCategoriaRaccolta(categoriaId, categorieLavoriPrincipali, sottocategorieLavoriMap) {
  const categoriaTrovata = allCategorieFlat(categorieLavoriPrincipali, sottocategorieLavoriMap).find(
    (c) => c.id === categoriaId
  );
  if (!categoriaTrovata) return false;
  const categoriaNome = (categoriaTrovata.nome || '').toLowerCase();
  const categoriaParent = categoriaTrovata.parentId
    ? (categorieLavoriPrincipali || []).find((c) => c.id === categoriaTrovata.parentId)
    : null;
  const categoriaParentNome = categoriaParent ? (categoriaParent.nome || '').toLowerCase() : '';
  return categoriaNome.includes('raccolta') || categoriaParentNome.includes('raccolta');
}

export function terrenoHaColturaVite(terreno) {
  if (!terreno || !terreno.coltura) return false;
  return String(terreno.coltura).toLowerCase().includes('vite');
}

/** Filtro vendemmia: terreno vite + categoria raccolta → solo tipi vendemmia. */
export function filterTipiLavoroVendemmia(tipiFiltrati, { isRaccolta, isTerrenoVite } = {}) {
  if (!isRaccolta || !isTerrenoVite || !Array.isArray(tipiFiltrati) || tipiFiltrati.length === 0) {
    return tipiFiltrati || [];
  }
  return tipiFiltrati.filter((tipo) => String(tipo.nome || '').toLowerCase().includes('vendemmia'));
}
