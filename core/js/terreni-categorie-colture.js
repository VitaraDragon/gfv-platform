/**
 * Deduplica e popola il select «Categoria Coltura» del form terreno.
 * Funzioni pure (salvo popolaSelect, che tocca solo l'elemento passato).
 * @module core/js/terreni-categorie-colture
 */

/**
 * Chiave di dedupe: codice normalizzato, altrimenti nome normalizzato.
 * @param {{ codice?: string, nome?: string, id?: string }|null|undefined} cat
 * @returns {string}
 */
export function chiaveDedupeCategoria(cat) {
  if (!cat || typeof cat !== 'object') return '';
  const codice = typeof cat.codice === 'string' ? cat.codice.trim().toLowerCase() : '';
  if (codice) return `c:${codice}`;
  const nome = typeof cat.nome === 'string' ? cat.nome.trim().toLowerCase() : '';
  if (nome) return `n:${nome}`;
  return cat.id ? `i:${cat.id}` : '';
}

/**
 * Quante colture sono associate all'id categoria nella mappa.
 * @param {{ id?: string }|null|undefined} cat
 * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
 * @returns {number}
 */
export function conteggioColtureCategoria(cat, colturePerCategoria) {
  if (!cat || !cat.id || !colturePerCategoria || typeof colturePerCategoria !== 'object') {
    return 0;
  }
  const lista = colturePerCategoria[cat.id];
  return Array.isArray(lista) ? lista.length : 0;
}

/**
 * Preferisci la categoria con almeno una coltura; altrimenti predefinita;
 * altrimenti ordine minore; altrimenti id stabile.
 * @param {object} a
 * @param {object} b
 * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
 * @returns {number} negativo se a batte b
 */
export function confrontaCategorieDuplicate(a, b, colturePerCategoria) {
  const colA = conteggioColtureCategoria(a, colturePerCategoria) > 0 ? 1 : 0;
  const colB = conteggioColtureCategoria(b, colturePerCategoria) > 0 ? 1 : 0;
  if (colA !== colB) return colB - colA;

  const predA = a && a.predefinita ? 1 : 0;
  const predB = b && b.predefinita ? 1 : 0;
  if (predA !== predB) return predB - predA;

  const ordA = Number.isFinite(a && a.ordine) ? a.ordine : 999;
  const ordB = Number.isFinite(b && b.ordine) ? b.ordine : 999;
  if (ordA !== ordB) return ordA - ordB;

  const idA = a && a.id != null ? String(a.id) : '';
  const idB = b && b.id != null ? String(b.id) : '';
  // Confronto byte (non localeCompare): stesso ordine di Firestore e del canonico in catalogo-dedupe.js
  if (idA === idB) return 0;
  return idA < idB ? -1 : 1;
}

/**
 * Deduplica categorie omonime (stesso codice, fallback nome).
 * Se due doc condividono la chiave, resta quella preferita da confrontaCategorieDuplicate.
 * @param {Array<object>|null|undefined} categorie
 * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
 * @returns {Array<object>}
 */
export function dedupeCategorieColture(categorie, colturePerCategoria) {
  if (!Array.isArray(categorie) || categorie.length === 0) return [];

  const migliori = new Map();
  for (const cat of categorie) {
    if (!cat || typeof cat !== 'object') continue;
    const chiave = chiaveDedupeCategoria(cat);
    if (!chiave) continue;
    const attuale = migliori.get(chiave);
    if (!attuale || confrontaCategorieDuplicate(cat, attuale, colturePerCategoria) < 0) {
      migliori.set(chiave, cat);
    }
  }

  const risultato = Array.from(migliori.values());
  risultato.sort((a, b) => {
    const ordA = Number.isFinite(a && a.ordine) ? a.ordine : 999;
    const ordB = Number.isFinite(b && b.ordine) ? b.ordine : 999;
    if (ordA !== ordB) return ordA - ordB;
    const nomeA = (a && a.nome) || '';
    const nomeB = (b && b.nome) || '';
    return String(nomeA).localeCompare(String(nomeB), 'it');
  });
  return risultato;
}

/**
 * Opzioni per il select categoria (senza DOM).
 * @param {Array<object>|null|undefined} categorie
 * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
 * @returns {Array<{ value: string, text: string }>}
 */
export function opzioniSelectCategorieColture(categorie, colturePerCategoria) {
  return dedupeCategorieColture(categorie, colturePerCategoria).map((cat) => ({
    value: cat.id != null ? String(cat.id) : '',
    text: cat.nome != null ? String(cat.nome) : String(cat.id || ''),
  }));
}

/**
 * Crea un'option. Accetta un factory opzionale per i test senza DOM.
 * @param {string} value
 * @param {string} text
 * @param {((tag: string) => { value: string, textContent: string })|null} createElement
 */
function creaOption(value, text, createElement) {
  if (typeof createElement === 'function') {
    const option = createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }
  if (typeof document !== 'undefined' && document.createElement) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }
  return { value, textContent: text };
}

/**
 * Popola il select categorie con dedupe. Conserva il value corrente se ancora valido.
 * @param {{ innerHTML?: string, value?: string, appendChild?: Function }|null|undefined} selectEl
 * @param {Array<object>|null|undefined} categorie
 * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
 * @param {{ placeholder?: string, messaggioErrore?: string|null, createElement?: Function }} [opts]
 * @returns {Array<object>} categorie mostrate (vuoto se messaggioErrore)
 */
export function popolaSelectCategorieColture(selectEl, categorie, colturePerCategoria, opts = {}) {
  const deduped = dedupeCategorieColture(categorie, colturePerCategoria);
  if (!selectEl) return deduped;

  const placeholder = opts.placeholder != null ? opts.placeholder : '-- Seleziona categoria --';
  const messaggioErrore = opts.messaggioErrore != null ? opts.messaggioErrore : null;
  const createElement = opts.createElement || null;
  const previous = selectEl.value || '';

  selectEl.innerHTML = '';

  const append = (opt) => {
    if (typeof selectEl.appendChild === 'function') {
      selectEl.appendChild(opt);
    }
  };

  if (messaggioErrore) {
    append(creaOption('', messaggioErrore, createElement));
    selectEl.value = '';
    return [];
  }

  append(creaOption('', placeholder, createElement));
  for (const cat of deduped) {
    append(
      creaOption(
        cat.id != null ? String(cat.id) : '',
        cat.nome != null ? String(cat.nome) : '',
        createElement
      )
    );
  }

  const ancoraPresente = deduped.some((c) => c.id != null && String(c.id) === previous);
  selectEl.value = ancoraPresente ? previous : '';
  return deduped;
}
