/**
 * Impianti (vigneti/frutteti) aperti vs chiusi al cambio coltura.
 * I documenti senza `statoImpianto` contano come aperti (dati legacy).
 *
 * @module shared/js/impianto-aperto
 */

export function isImpiantoChiuso(impianto) {
  return !!(impianto && impianto.statoImpianto === 'chiuso');
}

export function isImpiantoAperto(impianto) {
  return !isImpiantoChiuso(impianto);
}

export function impiantiAperti(lista) {
  return (Array.isArray(lista) ? lista : []).filter(isImpiantoAperto);
}

export function nomeImpiantoConStato(impianto, fallback = '-') {
  if (!impianto) return fallback;
  const base = String(impianto.varieta || impianto.nome || impianto.specie || '').trim() || fallback;
  return isImpiantoChiuso(impianto) ? `${base} (chiuso)` : base;
}
