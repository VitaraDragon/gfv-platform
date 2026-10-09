/**
 * Filtri a cascata lavori/colture (categoria → sottocategoria/tipo, terreno → vendemmia).
 * @module core/js/lavoro-cascade-filters
 */

function sottocategorieMapEntries(sottocategorieLavoriMap) {
  if (!sottocategorieLavoriMap) return [];
  if (sottocategorieLavoriMap instanceof Map) return Array.from(sottocategorieLavoriMap.entries());
  if (typeof sottocategorieLavoriMap === 'object') return Object.entries(sottocategorieLavoriMap);
  return [];
}

export function allCategorieFlat(categorieLavoriPrincipali, sottocategorieLavoriMap) {
  const principali = Array.isArray(categorieLavoriPrincipali) ? categorieLavoriPrincipali : [];
  const sottocat = sottocategorieMapEntries(sottocategorieLavoriMap)
    .flatMap(([, list]) => (Array.isArray(list) ? list : []));
  return [...principali, ...sottocat];
}

/**
 * Sottocategorie visibili dopo scelta categoria principale.
 * @param {string|null} parentId
 * @param {Map} sottocategorieLavoriMap
 * @returns {Array}
 */
export function getSottocategorieForParent(parentId, sottocategorieLavoriMap) {
  if (!parentId || !sottocategorieLavoriMap) return [];
  const list = sottocategorieLavoriMap instanceof Map
    ? sottocategorieLavoriMap.get(parentId)
    : sottocategorieLavoriMap[parentId];
  return Array.isArray(list) ? list : [];
}

/**
 * Valore davvero scelto nel select: ignora un `.value` stantio che non è più tra le option.
 * @param {{ selectedIndex?: number, options?: Array<{ value?: string }> }|null|undefined} select
 * @returns {string}
 */
export function listedSelectValue(select) {
  if (!select || typeof select.selectedIndex !== 'number' || select.selectedIndex < 0) return '';
  const opt = select.options && select.options[select.selectedIndex];
  if (!opt || opt.value == null || opt.value === '') return '';
  return String(opt.value);
}

function isCategoriaLavori(categoria) {
  const applicabile = categoria && categoria.applicabileA;
  if (!applicabile) return false;
  return applicabile === 'lavori' || applicabile === 'entrambi';
}

/**
 * Principali lavori + mappa figli. Ricollega `parentId` salvato come codice
 * e tiene i figli anche se `applicabileA` manca, purché il padre sia una categoria lavori.
 * @param {Array} categorie
 * @returns {{ principali: Array, map: Map }}
 */
export function buildLavoroCategorieIndex(categorie) {
  const list = (Array.isArray(categorie) ? categorie : []).filter((c) => c && c.id);
  const byId = new Map(list.map((c) => [String(c.id), c]));
  const byCodice = new Map();
  list.forEach((c) => {
    if (c.codice) byCodice.set(String(c.codice).toLowerCase(), c);
  });

  function resolveParentId(categoria) {
    let parentId = categoria.parentId || null;
    if (parentId && !byId.has(String(parentId))) {
      const viaCodice = byCodice.get(String(parentId).toLowerCase());
      if (viaCodice) parentId = viaCodice.id;
    }
    if (!parentId && categoria.parentCodice) {
      const viaCodice = byCodice.get(String(categoria.parentCodice).toLowerCase());
      if (viaCodice && viaCodice.id !== categoria.id) parentId = viaCodice.id;
    }
    return parentId ? String(parentId) : null;
  }

  const principali = [];
  const principaliIds = new Set();
  list.forEach((c) => {
    if (resolveParentId(c)) return;
    if (!isCategoriaLavori(c)) return;
    principali.push(c);
    principaliIds.add(String(c.id));
  });

  const map = new Map();
  list.forEach((c) => {
    const parentId = resolveParentId(c);
    if (!parentId || !principaliIds.has(parentId)) return;
    if (c.applicabileA === 'attrezzi' || c.applicabileA === 'colture') return;
    const row = String(c.parentId || '') === parentId ? c : { ...c, parentId };
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId).push(row);
  });

  map.forEach((sottocat) => {
    sottocat.sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
  });

  return { principali, map };
}

function resolveCategoriaRef(ref, byId, byCodice) {
  if (ref == null || ref === '') return null;
  const key = String(ref);
  if (byId.has(key)) return key;
  const viaCodice = byCodice.get(key.toLowerCase());
  return viaCodice ? String(viaCodice.id) : key;
}

/**
 * Allinea categoriaId/sottocategoriaId dei tipi agli id delle categorie (anche se in anagrafica c'è il codice).
 * Non scrive su Firestore.
 */
export function relinkTipiLavoroToCategorie(tipiLavoroList, categorieLavoriPrincipali, sottocategorieLavoriMap) {
  if (!Array.isArray(tipiLavoroList) || tipiLavoroList.length === 0) return tipiLavoroList || [];
  const flat = allCategorieFlat(categorieLavoriPrincipali, sottocategorieLavoriMap);
  const byId = new Map(flat.filter((c) => c && c.id).map((c) => [String(c.id), c]));
  const byCodice = new Map();
  flat.forEach((c) => {
    if (c && c.codice) byCodice.set(String(c.codice).toLowerCase(), c);
  });

  return tipiLavoroList.map((tipo) => {
    if (!tipo) return tipo;
    let categoriaId = resolveCategoriaRef(tipo.categoriaId, byId, byCodice);
    let sottocategoriaId = resolveCategoriaRef(tipo.sottocategoriaId, byId, byCodice);
    const asSub = (id) => {
      const row = id ? byId.get(String(id)) : null;
      return row && row.parentId ? row : null;
    };
    const subFromCategoria = asSub(categoriaId);
    if (subFromCategoria && !sottocategoriaId) {
      sottocategoriaId = String(subFromCategoria.id);
      categoriaId = String(subFromCategoria.parentId);
    }
    const sub = asSub(sottocategoriaId);
    if (sub && (!categoriaId || !byId.has(String(categoriaId)) || asSub(categoriaId))) {
      categoriaId = String(sub.parentId);
    }
    if (categoriaId === (tipo.categoriaId == null ? null : String(tipo.categoriaId))
      && sottocategoriaId === (tipo.sottocategoriaId == null ? null : String(tipo.sottocategoriaId))) {
      return tipo;
    }
    return { ...tipo, categoriaId, sottocategoriaId };
  });
}

/**
 * Id da mostrare nei due select. Se `categoriaOrSubId` è una sottocategoria, risale al padre:
 * altrimenti il select principale resta sul placeholder.
 */
export function resolveLavoroCascadeParents(
  categoriaOrSubId,
  sottocategoriaId,
  categorieLavoriPrincipali,
  sottocategorieLavoriMap
) {
  const principali = Array.isArray(categorieLavoriPrincipali) ? categorieLavoriPrincipali : [];
  const principaleIds = new Set(principali.filter((c) => c && c.id).map((c) => String(c.id)));
  const childHint = sottocategoriaId || null;

  if (!categoriaOrSubId && !childHint) {
    return { categoriaPrincipaleId: null, sottocategoriaId: null };
  }

  if (categoriaOrSubId && principaleIds.has(String(categoriaOrSubId))) {
    const parentId = String(categoriaOrSubId);
    const subs = getSottocategorieForParent(parentId, sottocategorieLavoriMap);
    const subOk = childHint && subs.some((s) => String(s.id) === String(childHint))
      ? String(childHint)
      : null;
    return { categoriaPrincipaleId: parentId, sottocategoriaId: subOk };
  }

  const childId = String(childHint || categoriaOrSubId);
  for (const [parentId, list] of sottocategorieMapEntries(sottocategorieLavoriMap)) {
    if (!Array.isArray(list)) continue;
    if (list.some((s) => s && String(s.id) === childId)) {
      return { categoriaPrincipaleId: String(parentId), sottocategoriaId: childId };
    }
  }

  return {
    categoriaPrincipaleId: categoriaOrSubId ? String(categoriaOrSubId) : null,
    sottocategoriaId: childHint ? String(childHint) : null,
  };
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

  const tipi = relinkTipiLavoroToCategorie(
    tipiLavoroList,
    categorieLavoriPrincipali,
    sottocategorieLavoriMap
  );
  const categoriaKey = String(categoriaId);

  const categoriaTrovata = allCategorieFlat(categorieLavoriPrincipali, sottocategorieLavoriMap).find(
    (c) => c && String(c.id) === categoriaKey
  );

  const sameId = (a, b) => a != null && b != null && String(a) === String(b);

  if (categoriaTrovata && categoriaTrovata.parentId) {
    const parentId = categoriaTrovata.parentId;
    return tipi.filter(
      (tipo) =>
        sameId(tipo.sottocategoriaId, categoriaKey) ||
        sameId(tipo.categoriaId, categoriaKey) ||
        (sameId(tipo.categoriaId, parentId) && !tipo.sottocategoriaId)
    );
  }

  const allCategorieIds = [categoriaKey];
  const sottocat = getSottocategorieForParent(categoriaKey, sottocategorieLavoriMap);
  sottocat.forEach((subcat) => allCategorieIds.push(String(subcat.id)));

  return tipi.filter(
    (tipo) =>
      sameId(tipo.categoriaId, categoriaKey) ||
      (tipo.sottocategoriaId && allCategorieIds.includes(String(tipo.sottocategoriaId))) ||
      (tipo.categoriaId && allCategorieIds.includes(String(tipo.categoriaId)) && !tipo.sottocategoriaId)
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
