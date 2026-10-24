/**
 * Unione delle copie omonime del catalogo (categorie, colture, tipi lavoro).
 * Funzioni pure: nessuna lettura/scrittura Firestore.
 *
 * Due documenti con lo stesso codice (o nome, se manca il codice) sono la stessa voce:
 * se ne sceglie uno canonico in modo deterministico e gli altri diventano alias.
 * @module core/js/catalogo-dedupe
 */

/**
 * Testo normalizzato per confronti: trim, minuscolo, spazi singoli.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizzaTesto(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Chiave di raggruppamento di una voce: codice, altrimenti nome, altrimenti id.
 * @param {{ codice?: string, nome?: string, id?: string }|null|undefined} item
 * @returns {string}
 */
export function chiaveCatalogo(item) {
  if (!item || typeof item !== 'object') return '';
  const codice = normalizzaTesto(item.codice);
  if (codice) return `c:${codice}`;
  const nome = normalizzaTesto(item.nome);
  // Senza codice: nome + ambito, così due categorie custom omonime ma per ambiti diversi restano distinte
  if (nome) return item.applicabileA ? `n:${nome}@${normalizzaTesto(item.applicabileA)}` : `n:${nome}`;
  return item.id != null && item.id !== '' ? `i:${item.id}` : '';
}

/**
 * Millisecondi da Timestamp Firestore, Date, {seconds} o numero. null se assente.
 * @param {unknown} value
 * @returns {number|null}
 */
export function millisDa(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value.toMillis === 'function') {
    const t = value.toMillis();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  return null;
}

function confrontaByte(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Ordine di preferenza tra due copie della stessa voce (negativo se vince a).
 * 1) predefinita/predefinito; 2) createdAt più vecchio (chi non lo ha perde);
 * 3) id in ordine byte (niente localeCompare: stabile e uguale ovunque).
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function confrontaCanonico(a, b) {
  const predA = a && (a.predefinita || a.predefinito) ? 1 : 0;
  const predB = b && (b.predefinita || b.predefinito) ? 1 : 0;
  if (predA !== predB) return predB - predA;

  const tA = millisDa(a && a.createdAt);
  const tB = millisDa(b && b.createdAt);
  if (tA != null && tB != null && tA !== tB) return tA - tB;
  if (tA != null && tB == null) return -1;
  if (tA == null && tB != null) return 1;

  const idA = a && a.id != null ? String(a.id) : '';
  const idB = b && b.id != null ? String(b.id) : '';
  return confrontaByte(idA, idB);
}

function copiaCon(item, extra) {
  const copia = Object.create(Object.getPrototypeOf(item) || Object.prototype);
  return Object.assign(copia, item, extra);
}

/**
 * Raggruppa le categorie omonime. Le sottocategorie sono raggruppate per
 * (chiave del padre canonico, chiave propria), così le copie di «Potatura › Manuale»
 * si uniscono anche se appese a copie diverse di «Potatura».
 *
 * @param {Array<object>|null|undefined} categorie
 * @returns {{ canoniche: Array<object>, aliasToCanon: Map<string, string> }}
 *   canoniche: una per gruppo, nell'ordine della prima occorrenza, copia dell'originale con
 *   `aliasIds` (tutti gli id del gruppo, canonico incluso) e `parentId` riscritto sul canonico.
 *   aliasToCanon: id di ogni copia → id canonico.
 */
export function raggruppaCategorie(categorie) {
  const list = (Array.isArray(categorie) ? categorie : []).filter(
    (c) => c && typeof c === 'object' && c.id != null && c.id !== ''
  );
  const byId = new Map(list.map((c) => [String(c.id), c]));

  const chiaveCache = new Map();
  const chiaveDi = (cat, visti = new Set()) => {
    const id = String(cat.id);
    if (chiaveCache.has(id)) return chiaveCache.get(id);
    const propria = chiaveCatalogo(cat);
    let chiave = propria;
    const parentRef = cat.parentId != null && cat.parentId !== '' ? String(cat.parentId) : '';
    if (parentRef) {
      const padre = byId.get(parentRef);
      if (padre && !visti.has(id)) {
        visti.add(id);
        chiave = `${chiaveDi(padre, visti)}>${propria}`;
      } else {
        chiave = `p:${normalizzaTesto(parentRef)}>${propria}`;
      }
    }
    chiaveCache.set(id, chiave);
    return chiave;
  };

  const gruppi = new Map();
  for (const cat of list) {
    const chiave = chiaveDi(cat);
    if (!chiave) continue;
    if (!gruppi.has(chiave)) gruppi.set(chiave, []);
    gruppi.get(chiave).push(cat);
  }

  const aliasToCanon = new Map();
  const scelte = [];
  for (const membri of gruppi.values()) {
    const ordinati = membri.slice().sort(confrontaCanonico);
    const canonico = ordinati[0];
    const canonId = String(canonico.id);
    membri.forEach((m) => aliasToCanon.set(String(m.id), canonId));
    scelte.push({ canonico, aliasIds: membri.map((m) => String(m.id)) });
  }

  const canoniche = scelte.map(({ canonico, aliasIds }) => {
    const extra = { aliasIds };
    if (canonico.parentId != null && canonico.parentId !== '') {
      const parentCanon = aliasToCanon.get(String(canonico.parentId));
      if (parentCanon) extra.parentId = parentCanon;
    }
    return copiaCon(canonico, extra);
  });

  return { canoniche, aliasToCanon };
}

/**
 * Id canonico di una voce (o l'id stesso se non è un alias noto).
 * @param {string|null|undefined} id
 * @param {Map<string, string>|null|undefined} aliasToCanon
 * @returns {string|null}
 */
export function canonicoDi(id, aliasToCanon) {
  if (id == null || id === '') return id == null ? null : '';
  const key = String(id);
  return (aliasToCanon && aliasToCanon.get(key)) || key;
}

/**
 * Mappa alias → canonico ricavata da voci canoniche che portano `aliasIds`.
 * @param {Array<object>} canoniche
 * @returns {Map<string, string>}
 */
export function aliasMapDaCanoniche(canoniche) {
  const map = new Map();
  (Array.isArray(canoniche) ? canoniche : []).forEach((c) => {
    if (!c || c.id == null) return;
    const canonId = String(c.id);
    map.set(canonId, canonId);
    (Array.isArray(c.aliasIds) ? c.aliasIds : []).forEach((a) => map.set(String(a), canonId));
  });
  return map;
}

/**
 * Toglie i doppioni per nome (normalizzato) tenendo la copia canonica.
 * L'ordine segue la prima occorrenza di ogni nome.
 * @param {Array<object|string>} lista
 * @returns {Array<object|string>}
 */
export function dedupePerNome(lista) {
  if (!Array.isArray(lista)) return [];
  const scelti = new Map();
  const ordine = [];
  for (const item of lista) {
    if (item == null) continue;
    const nome = normalizzaTesto(typeof item === 'string' ? item : item.nome);
    if (!nome) continue;
    if (!scelti.has(nome)) {
      scelti.set(nome, item);
      ordine.push(nome);
    } else if (typeof item === 'object' && confrontaCanonico(item, scelti.get(nome)) < 0) {
      scelti.set(nome, item);
    }
  }
  return ordine.map((n) => scelti.get(n));
}

/**
 * Unisce le colture di tutte le copie di una categoria sotto l'id canonico,
 * senza doppioni per nome. Non modifica l'oggetto in ingresso.
 * @param {Record<string, Array<object>>|null|undefined} colturePerCategoria
 * @param {Map<string, string>|null|undefined} aliasToCanon
 * @returns {Record<string, Array<object>>}
 */
export function unisciColturePerCategoria(colturePerCategoria, aliasToCanon) {
  const out = {};
  if (!colturePerCategoria || typeof colturePerCategoria !== 'object') return out;
  for (const [catId, lista] of Object.entries(colturePerCategoria)) {
    const canon = canonicoDi(catId, aliasToCanon);
    if (!out[canon]) out[canon] = [];
    if (Array.isArray(lista)) out[canon].push(...lista);
  }
  for (const key of Object.keys(out)) {
    out[key] = dedupePerNome(out[key]);
  }
  return out;
}

/**
 * Tipi lavoro senza doppioni: stessa chiave nome + categoria canonica + sottocategoria canonica.
 * Restituisce copie con categoriaId/sottocategoriaId riscritti sul canonico.
 * @param {Array<object>} tipi
 * @param {Map<string, string>|null|undefined} aliasToCanon
 * @returns {Array<object>}
 */
export function dedupeTipiLavoro(tipi, aliasToCanon) {
  if (!Array.isArray(tipi)) return [];
  const scelti = new Map();
  const ordine = [];
  for (const tipo of tipi) {
    if (!tipo || typeof tipo !== 'object') continue;
    const categoriaId = tipo.categoriaId != null && tipo.categoriaId !== ''
      ? canonicoDi(tipo.categoriaId, aliasToCanon)
      : tipo.categoriaId ?? null;
    const sottocategoriaId = tipo.sottocategoriaId != null && tipo.sottocategoriaId !== ''
      ? canonicoDi(tipo.sottocategoriaId, aliasToCanon)
      : tipo.sottocategoriaId ?? null;
    const riga = categoriaId === tipo.categoriaId && sottocategoriaId === tipo.sottocategoriaId
      ? tipo
      : { ...tipo, categoriaId, sottocategoriaId };
    const nome = normalizzaTesto(tipo.nome);
    const chiave = nome ? `${nome}|${categoriaId || ''}|${sottocategoriaId || ''}` : `i:${tipo.id}`;
    if (!scelti.has(chiave)) {
      scelti.set(chiave, riga);
      ordine.push(chiave);
    } else if (confrontaCanonico(riga, scelti.get(chiave)) < 0) {
      scelti.set(chiave, riga);
    }
  }
  return ordine.map((k) => scelti.get(k));
}

/**
 * Mappe codice → id canonico per i seed (principali/colture e sottocategorie separate).
 * @param {Array<object>} categorie
 * @returns {{ principali: Map<string, string>, sottocategorie: Map<string, string>, canoniche: Array<object> }}
 */
export function mappeCodiceCanonico(categorie) {
  const { canoniche } = raggruppaCategorie(categorie);
  const principali = new Map();
  const sottocategorie = new Map();
  canoniche.forEach((c) => {
    const codice = normalizzaTesto(c.codice);
    if (!codice) return;
    const target = c.parentId ? sottocategorie : principali;
    if (!target.has(codice)) target.set(codice, String(c.id));
  });
  return { principali, sottocategorie, canoniche };
}

/**
 * Categoria (id canonico) che contiene una coltura, cercata per nome.
 * Serve alla preselezione in Modifica: il terreno salva solo il nome della coltura.
 * @param {string} nomeColtura
 * @param {Record<string, Array<object|string>>|null|undefined} colturePerCategoria
 * @param {Map<string, string>|null|undefined} aliasToCanon
 * @returns {string|null}
 */
export function trovaCategoriaPerColtura(nomeColtura, colturePerCategoria, aliasToCanon) {
  const cercato = normalizzaTesto(nomeColtura);
  if (!cercato || !colturePerCategoria || typeof colturePerCategoria !== 'object') return null;
  for (const [catId, lista] of Object.entries(colturePerCategoria)) {
    if (catId === 'senza_categoria' || !Array.isArray(lista)) continue;
    const trovata = lista.some((c) => normalizzaTesto(typeof c === 'string' ? c : c && c.nome) === cercato);
    if (trovata) return canonicoDi(catId, aliasToCanon);
  }
  return null;
}
