/**
 * Nome da mostrare in intestazioni e contesto (mai undefined / «undefined»).
 * Ordine: nome+cognome → nome azienda corrente → parte email prima di @ → ''.
 * @module core/js/nome-visualizzato
 */

/**
 * @param {{ nome?: string|null, cognome?: string|null, nomeAzienda?: string|null, email?: string|null }} input
 * @returns {string}
 */
export function getNomeVisualizzato(input) {
  const src = input && typeof input === 'object' ? input : {};
  const nome = String(src.nome || '').trim();
  const cognome = String(src.cognome || '').trim();
  const persona = [nome, cognome].filter(Boolean).join(' ');
  if (persona) return persona;

  const azienda = String(src.nomeAzienda || '').trim();
  if (azienda) return azienda;

  const email = String(src.email || '').trim();
  if (email.includes('@')) {
    const locale = email.split('@')[0].trim();
    if (locale) return locale;
  }

  return '';
}
