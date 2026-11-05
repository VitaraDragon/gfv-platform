/**
 * Etichette movimento magazzino: mai mostrare l'id grezzo.
 * @module shared/js/magazzino-etichette
 */

export function etichettaAttivitaMovimento(attivita, id) {
  if (!id) return '-';
  if (!attivita) return 'Attività eliminata';
  const parts = [attivita.data, attivita.tipoLavoro, attivita.terrenoNome].filter(Boolean);
  const label = parts.length ? parts.join(' – ') : '';
  if (!label) return 'Attività eliminata';
  if (String(label) === String(id)) return 'Attività eliminata';
  return label;
}

export function etichettaLavoroMovimento(lavoro, id) {
  if (!id) return '-';
  if (!lavoro) return 'Lavoro eliminato';
  const nome = lavoro.nome || '';
  if (!nome || String(nome) === String(id)) return 'Lavoro eliminato';
  return nome;
}
