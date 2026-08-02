/**
 * Utilità geo da dati terreno (coordinate / poligono) — senza GPS live dipendente.
 *
 * @module core/services/geo-terreno-utils
 */

/**
 * @param {Array<{lat:number,lng:number}>|null|undefined} coords
 * @returns {{lat:number,lng:number}|null}
 */
export function getPolygonCenter(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  let n = 0;
  for (const c of coords) {
    const lat = Number(c?.lat);
    const lng = Number(c?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    latSum += lat;
    lngSum += lng;
    n += 1;
  }
  if (n === 0) return null;
  return { lat: latSum / n, lng: lngSum / n };
}

/**
 * Punto rappresentativo del terreno: coordinate esplicite oppure centro poligono.
 * @param {Object|null|undefined} terreno
 * @returns {{lat:number,lng:number}|null}
 */
export function resolveTerrenoPoint(terreno) {
  if (!terreno) return null;
  const lat = Number(terreno.coordinate?.lat);
  const lng = Number(terreno.coordinate?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return getPolygonCenter(terreno.polygonCoords);
}

/**
 * Distanza Haversine in km.
 * @param {{lat:number,lng:number}|null} a
 * @param {{lat:number,lng:number}|null} b
 * @returns {number|null}
 */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Metadati prossimità tra terreno destinazione e terreno impegno candidato.
 * Usa solo anagrafica terreno (assegnazione lavoro), non posizione telefono.
 *
 * @param {Object|null|undefined} terrenoDest
 * @param {Object|null|undefined} terrenoOrigine
 * @param {string|null|undefined} [terrenoDestId]
 * @param {string|null|undefined} [terrenoOrigineId]
 * @returns {{
 *   stessoTerreno: boolean,
 *   stessoPodere: boolean,
 *   distanzaKm: number|null,
 *   prossimitaLabel: string|null
 * }}
 */
export function computeProximityMeta(
  terrenoDest,
  terrenoOrigine,
  terrenoDestId = null,
  terrenoOrigineId = null
) {
  const destId = terrenoDestId || terrenoDest?.id || null;
  const origId = terrenoOrigineId || terrenoOrigine?.id || null;
  const stessoTerreno = !!(destId && origId && destId === origId);

  const podereDest = (terrenoDest?.podere || '').toString().trim().toLowerCase();
  const podereOrig = (terrenoOrigine?.podere || '').toString().trim().toLowerCase();
  const stessoPodere = !!(podereDest && podereOrig && podereDest === podereOrig);

  let distanzaKm = null;
  if (stessoTerreno) {
    distanzaKm = 0;
  } else {
    distanzaKm = haversineKm(
      resolveTerrenoPoint(terrenoDest),
      resolveTerrenoPoint(terrenoOrigine)
    );
    if (distanzaKm != null) {
      distanzaKm = Math.round(distanzaKm * 10) / 10;
    }
  }

  let prossimitaLabel = null;
  if (stessoTerreno) {
    prossimitaLabel = 'Stesso terreno';
  } else if (stessoPodere && distanzaKm != null) {
    prossimitaLabel = `Stesso podere · ~${distanzaKm} km`;
  } else if (stessoPodere) {
    prossimitaLabel = 'Stesso podere';
  } else if (distanzaKm != null) {
    prossimitaLabel = `~${distanzaKm} km`;
  }

  return { stessoTerreno, stessoPodere, distanzaKm, prossimitaLabel };
}
