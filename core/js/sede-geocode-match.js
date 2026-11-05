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
    .replace(/[\u2018\u2019'`\u00b4]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tutti i nomi «comune-like» di un risultato Geocoder (locality, postal_town, admin3;
 * sublocality solo se coincide già col comune atteso — gestito in match).
 * @param {object|null|undefined} result
 * @returns {string[]}
 */
export function nomiComuneDaGeocodeResult(result) {
  const comps = result && Array.isArray(result.address_components) ? result.address_components : [];
  const out = [];
  const seen = Object.create(null);
  function add(name) {
    const n = String(name || '').trim();
    if (!n) return;
    const key = normalizzaComunePerMatch(n);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(n);
  }
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const types = (c && c.types) || [];
    const name = (c && (c.long_name || c.short_name)) || '';
    if (types.indexOf('locality') >= 0) add(name);
    if (types.indexOf('postal_town') >= 0) add(name);
    if (types.indexOf('administrative_area_level_3') >= 0) add(name);
    if (types.indexOf('sublocality') >= 0 || types.indexOf('sublocality_level_1') >= 0) {
      add(name);
    }
  }
  return out;
}

/**
 * Estrae locality o administrative_area_level_3 da un risultato Geocoder (retrocompat).
 * @param {object|null|undefined} result
 * @returns {string}
 */
export function comuneDaGeocodeResult(result) {
  const nomi = nomiComuneDaGeocodeResult(result);
  return nomi[0] || '';
}

/**
 * True se uno qualsiasi dei nomi del risultato corrisponde al comune atteso.
 * Sublocality conta solo se normalizzato coincide col comune (non con una frazione diversa).
 * @param {object|null|undefined} result
 * @param {string} comuneAttesoNorm
 * @returns {boolean}
 */
export function risultatoNelComune(result, comuneAttesoNorm) {
  if (!comuneAttesoNorm) return false;
  const comps = result && Array.isArray(result.address_components) ? result.address_components : [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const types = (c && c.types) || [];
    const name = String((c && (c.long_name || c.short_name)) || '').trim();
    if (!name) continue;
    const norm = normalizzaComunePerMatch(name);
    if (norm !== comuneAttesoNorm) continue;
    if (
      types.indexOf('locality') >= 0 ||
      types.indexOf('postal_town') >= 0 ||
      types.indexOf('administrative_area_level_3') >= 0
    ) {
      return true;
    }
    if (types.indexOf('sublocality') >= 0 || types.indexOf('sublocality_level_1') >= 0) {
      return true;
    }
  }
  return false;
}

/**
 * Punteggio: civico esatto meglio di route; partial_match peggiora.
 * @param {object} result
 * @returns {number}
 */
export function punteggioGeocodeCivico(result) {
  const types = (result && result.types) || [];
  let score = 0;
  if (types.indexOf('street_address') >= 0 || types.indexOf('premise') >= 0) score += 100;
  else if (types.indexOf('route') >= 0) score += 40;
  else if (
    types.indexOf('locality') >= 0 ||
    types.indexOf('administrative_area_level_3') >= 0 ||
    types.indexOf('postal_town') >= 0
  ) {
    score += 20;
  }
  if (result && result.partial_match) score -= 30;
  return score;
}

/**
 * Primo risultato (migliore) la cui locality/admin3/postal_town corrisponde al comune.
 * Preferisce street_address/premise senza partial_match rispetto a route.
 * Se nessuno corrisponde → null (non usare results[0] alla cieca).
 * @param {Array<object>|null|undefined} results
 * @param {string|null|undefined} comuneAtteso
 * @returns {object|null}
 */
export function scegliGeocodeNelComune(results, comuneAtteso) {
  const atteso = normalizzaComunePerMatch(comuneAtteso);
  if (!atteso || !Array.isArray(results) || !results.length) return null;
  let best = null;
  let bestScore = -Infinity;
  let bestCivico = null;
  let bestCivicoScore = -Infinity;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!risultatoNelComune(r, atteso)) continue;
    const score = punteggioGeocodeCivico(r) - i * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
    // Civico (street_address / premise / subpremise) nel comune: vince sempre su route/centro,
    // anche se Google lo marca partial_match o lo elenca dopo un risultato meno preciso.
    if (isCivicoGeocodeResult(r) && score > bestCivicoScore) {
      bestCivicoScore = score;
      bestCivico = r;
    }
  }
  return bestCivico || best;
}

/**
 * True se il risultato Geocoder è un civico preciso.
 * @param {object|null|undefined} result
 * @returns {boolean}
 */
export function isCivicoGeocodeResult(result) {
  const types = (result && result.types) || [];
  return (
    types.indexOf('street_address') >= 0 ||
    types.indexOf('premise') >= 0 ||
    types.indexOf('subpremise') >= 0
  );
}

/**
 * Componente con il tipo indicato che coincide (normalizzato) col comune atteso.
 * @param {object|null|undefined} result
 * @param {string} tipo
 * @param {string} comuneAttesoNorm
 * @returns {boolean}
 */
function componenteTipoNelComune(result, tipo, comuneAttesoNorm) {
  const comps = result && Array.isArray(result.address_components) ? result.address_components : [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const types = (c && c.types) || [];
    if (types.indexOf(tipo) < 0) continue;
    const name = String((c && (c.long_name || c.short_name)) || '').trim();
    if (name && normalizzaComunePerMatch(name) === comuneAttesoNorm) return true;
  }
  return false;
}

/**
 * Risultato «centro comune» (locality / admin3 / postal_town) del comune atteso.
 * @param {Array<object>|null|undefined} results
 * @param {string|null|undefined} comuneAtteso
 * @returns {object|null}
 */
export function scegliCentroComune(results, comuneAtteso) {
  const atteso = normalizzaComunePerMatch(comuneAtteso);
  if (!atteso || !Array.isArray(results) || !results.length) return null;
  // Mai un CAP (postal_code): il suo centroide non è il centro del comune.
  const candidati = results.filter((r) => {
    const types = (r && r.types) || [];
    return types.indexOf('postal_code') < 0 && types.indexOf('postal_code_prefix') < 0;
  });
  // 1) locality col nome del comune; 2) administrative_area_level_3 col nome del comune.
  // Nessun altro ripiego (né postal_code, né civico/route): meglio nessun pin che un pin sbagliato.
  const ordine = ['locality', 'administrative_area_level_3'];
  for (let k = 0; k < ordine.length; k++) {
    const tipo = ordine[k];
    for (let i = 0; i < candidati.length; i++) {
      const r = candidati[i];
      const types = (r && r.types) || [];
      if (types.indexOf(tipo) < 0) continue;
      if (componenteTipoNelComune(r, tipo, atteso)) return r;
    }
  }
  return null;
}

/**
 * Query «solo comune» per ripiego al centro.
 * @param {string} comune
 * @param {string} [provincia]
 * @returns {string}
 */
export function buildQueryCentroComune(comune, provincia) {
  const c = String(comune || '').trim();
  const p = String(provincia || '').trim();
  return [c, p, 'Italia'].filter(Boolean).join(', ');
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
