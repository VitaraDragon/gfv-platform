/**
 * Helper puri per Vendite ed entrate (niente Firebase / I/O).
 * @module core/admin/js/entrate-utils
 */

/**
 * Converte Timestamp Firestore, Date o stringa in ISO `YYYY-MM-DD`.
 * Usato dalle etichette/filtri del selettore raccolte (evita `String(Timestamp)`).
 * @param {unknown} value
 * @returns {string}
 */
export function toIsoDate(value) {
  if (value == null || value === '') return '';

  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return formatLocalIsoDate(parsed);
    return '';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return formatLocalIsoDate(value);
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        const d = value.toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return formatLocalIsoDate(d);
      } catch (_) {
        /* ignore */
      }
    }
    if (typeof value.seconds === 'number') {
      const ms = value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return formatLocalIsoDate(d);
    }
  }

  return '';
}

function formatLocalIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Sorgente campi per categoria prodotto (consegna senza raccolta).
 * @param {string} categoria
 * @returns {'vigneti'|'frutteti'|'terreni'|null}
 */
export function campiSourceForCategoria(categoria) {
  const c = String(categoria || '');
  if (c === 'uva') return 'vigneti';
  if (c === 'frutta') return 'frutteti';
  if (c === 'seminativo' || c === 'ortaggi') return 'terreni';
  return null;
}
