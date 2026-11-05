export function normalizzaDestinazioneVendemmia(value) {
  const testo = String(value == null ? '' : value).trim();
  return !testo || testo.toLowerCase() === 'null' ? null : testo;
}

export function getDestinazioneLabel(value) {
  const destinazione = normalizzaDestinazioneVendemmia(value);
  if (!destinazione) return '-';
  const labels = {
    vino: '🍷 Vino',
    vendita_uva: '🍇 Vendita Uva'
  };
  return labels[destinazione] || destinazione;
}
