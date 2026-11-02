/**
 * Scelta risultato geocoder sede: deve corrispondere al comune atteso.
 * @module core/js/sede-geocode-match
 */

/**
 * Normalizza comune per confronto (minuscole, senza accenti/apostrofi).
 * @param {string|null|undefined} s
 * @returns {string}
 */
export function normalizzaComunePerMatch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estrae locality o administrative_area_level_3 da un risultato Geocoder.
 * @param {object|null|undefined} result
 * @returns {string}
 */
export function comuneDaGeocodeResult(result) {
  const comps = result && Array.isArray(result.address_components) ? result.address_components : [];
  let locality = '';
  let admin3 = '';
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const types = (c && c.types) || [];
    const name = String((c && (c.long_name || c.short_name)) || '').trim();
    if (!name) continue;
    if (types.indexOf('locality') >= 0 && !locality) locality = name;
    if (types.indexOf('administrative_area_level_3') >= 0 && !admin3) admin3 = name;
  }
  return locality || admin3 || '';
}

/**
 * Primo risultato la cui locality/admin3 corrisponde al comune atteso.
 * Se nessuno corrisponde → null (non usare results[0] alla cieca).
 * @param {Array<object>|null|undefined} results
 * @param {string|null|undefined} comuneAtteso
 * @returns {object|null}
 */
export function scegliGeocodeNelComune(results, comuneAtteso) {
  const atteso = normalizzaComunePerMatch(comuneAtteso);
  if (!atteso || !Array.isArray(results) || !results.length) return null;
  for (let i = 0; i < results.length; i++) {
    const comune = comuneDaGeocodeResult(results[i]);
    if (normalizzaComunePerMatch(comune) === atteso) return results[i];
  }
  return null;
}

/**
 * Decide se al primo accesso va tentato il salvataggio automatico del pin sede.
 * @param {{
 *   indirizzo?: string|null,
 *   citta?: string|null,
 *   sedeCoordinate?: { lat?: number, lng?: number }|null,
 *   autoPinAttempted?: boolean,
 *   autoPinFailed?: boolean,
 * }} args
 * @returns {boolean}
 */
export function deveTentareAutoPinSede(args) {
  const a = args && typeof args === 'object' ? args : {};
  if (a.autoPinAttempted || a.autoPinFailed) return false;
  const via = String(a.indirizzo || '').trim();
  const comune = String(a.citta || '').trim();
  if (!via || !comune) return false;
  const c = a.sedeCoordinate;
  if (c && typeof c === 'object') {
    const lat = typeof c.lat === 'number' ? c.lat : Number(c.lat);
    const lng = typeof c.lng === 'number' ? c.lng : Number(c.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return false;
  }
  return true;
}
