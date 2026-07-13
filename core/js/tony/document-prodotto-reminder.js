/**
 * Reminder completamento anagrafica prodotti creati da Tony Occhi.
 * @module core/js/tony/document-prodotto-reminder
 */

export const TONY_PRODOTTI_REMINDER_STORAGE_KEY = 'tony-occhi-prodotti-da-completare';

/**
 * @param {Array<{ nome?: string, id?: string, categoria?: string }>} prodottiCreati
 * @returns {string}
 */
export function buildProdottoCompletamentoReminderMessage(prodottiCreati) {
  var list = Array.isArray(prodottiCreati) ? prodottiCreati : [];
  if (!list.length) return '';
  var names = list.slice(0, 3).map(function (p) { return p.nome || 'prodotto'; }).join(', ');
  var extra = list.length > 3 ? ' e altri ' + (list.length - 3) : '';
  return (
    'Ho creato ' + list.length + ' prodott' + (list.length === 1 ? 'o' : 'i') +
    ' nuov' + (list.length === 1 ? 'o' : 'i') + ' in anagrafica (' + names + extra +
    '). Apri Prodotti e Magazzino per completare i dati mancanti.'
  );
}

/**
 * @param {Array<{ id?: string, nome?: string, categoria?: string }>} prodottiCreati
 */
export function stashProdottoCompletamentoReminder(prodottiCreati) {
  if (!prodottiCreati || !prodottiCreati.length) return;
  try {
    sessionStorage.setItem(
      TONY_PRODOTTI_REMINDER_STORAGE_KEY,
      JSON.stringify({
        at: Date.now(),
        items: prodottiCreati.map(function (p) {
          return { id: p.id || '', nome: p.nome || '', categoria: p.categoria || '' };
        }),
      })
    );
  } catch (_) { /* ignore */ }
}

/**
 * @returns {{ at: number, items: Array<{ id: string, nome: string, categoria: string }> }|null}
 */
export function pullProdottoCompletamentoReminder() {
  try {
    var raw = sessionStorage.getItem(TONY_PRODOTTI_REMINDER_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TONY_PRODOTTI_REMINDER_STORAGE_KEY);
    var parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

/**
 * @param {Array<{ daCompletare?: boolean, attivo?: boolean }>} prodotti
 * @returns {number}
 */
export function countProdottiDaCompletare(prodotti) {
  return (prodotti || []).filter(function (p) {
    return p.daCompletare === true && p.attivo !== false;
  }).length;
}

/**
 * Messaggio Tony per lista prodotti con anagrafiche incomplete.
 * @param {number} count
 * @returns {string}
 */
export function buildProdottiListaReminderMessage(count) {
  var n = Number(count) || 0;
  if (n <= 0) return '';
  return (
    'Ci sono ' + n + ' prodott' + (n === 1 ? 'o' : 'i') +
    ' da completare in anagrafica, creat' + (n === 1 ? 'o' : 'i') + ' da Tony Occhi.'
  );
}
