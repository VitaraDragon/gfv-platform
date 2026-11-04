/**
 * Tendine vigneto/frutteto: gli impianti chiusi restano fuori.
 * In modifica si tiene sempre l'impianto della riga.
 * @module shared/js/impianto-tendina
 */

export function impiantiAperti(lista, idCorrente) {
  const id = idCorrente ? String(idCorrente) : '';
  return (Array.isArray(lista) ? lista : []).filter((v) => v && (v.statoImpianto !== 'chiuso' || String(v.id) === id));
}

export function tieniImpiantoNellaTendina(select, impianto, etichetta) {
  if (!select || !impianto || impianto.id == null) return;
  const id = String(impianto.id);
  const presente = Array.from(select.options || []).some((opt) => opt.value === id);
  if (presente) return;
  const opt = select.ownerDocument.createElement('option');
  opt.value = id;
  opt.textContent = typeof etichetta === 'function' ? etichetta(impianto) : String(etichetta || id);
  select.appendChild(opt);
}
