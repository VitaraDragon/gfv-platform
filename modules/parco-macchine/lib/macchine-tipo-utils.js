/**
 * Helper tipi macchina — flotta stradale vs mezzi agricoli.
 * @module modules/parco-macchine/lib/macchine-tipo-utils
 */

export const TIPI_FLOTTA = ['automezzo', 'veicolo', 'furgone'];

export function isTipoFlotta(tipoMacchina) {
  return TIPI_FLOTTA.includes((tipoMacchina || '').toLowerCase());
}

/**
 * Urgenza manutenzione a km (tagliando).
 * @returns {{ dot: string, rowScaduto: boolean, statoTesto: string }}
 */
export function calcolaStatoScadenzaKm(kmAttuali, sogliaKm) {
  const km = kmAttuali != null ? parseFloat(kmAttuali) : 0;
  const soglia = sogliaKm != null ? parseFloat(sogliaKm) : null;
  if (soglia == null || isNaN(soglia)) {
    return { dot: 'green', rowScaduto: false, statoTesto: '—' };
  }
  const rimanenti = soglia - km;
  if (rimanenti <= 0) return { dot: 'black', rowScaduto: true, statoTesto: 'Superato' };
  if (rimanenti < 500) return { dot: 'red', rowScaduto: false, statoTesto: '< 500 km' };
  if (rimanenti < 2000) return { dot: 'yellow', rowScaduto: false, statoTesto: '< 2.000 km' };
  return { dot: 'green', rowScaduto: false, statoTesto: 'Ok' };
}
