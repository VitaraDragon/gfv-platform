/**
 * Validazione in italiano dei form auth (con `novalidate`: niente bolle del browser,
 * che escono nella lingua del dispositivo e non su tutti i campi).
 * Nessuna dipendenza da Firebase.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Etichetta leggibile del campo: `<label for=id>` senza asterisco, altrimenti placeholder/name/id.
 * @param {HTMLElement} el
 * @param {ParentNode} root
 * @returns {string}
 */
export function etichettaCampo(el, root) {
  let testo = '';
  try {
    if (el.id && root && root.querySelector) {
      const lab = root.querySelector('label[for="' + String(el.id).replace(/"/g, '') + '"]');
      if (lab) testo = lab.textContent || '';
    }
  } catch (e) { /* selector non valido */ }
  if (!testo) testo = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || 'campo';
  return String(testo).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Primo campo obbligatorio vuoto (o email non valida), con messaggio italiano.
 * @param {HTMLFormElement} form
 * @returns {{ campo: HTMLElement, messaggio: string }|null}
 */
export function primoErroreForm(form) {
  if (!form || !form.elements) return null;
  const elementi = Array.prototype.slice.call(form.elements);
  for (const el of elementi) {
    if (!el || el.disabled || el.type === 'hidden' || el.type === 'button' || el.type === 'submit') continue;
    // campo nascosto (display:none) non va richiesto
    if (el.offsetParent === null && typeof el.getClientRects === 'function' && el.getClientRects().length === 0) continue;
    const valore = el.type === 'checkbox' || el.type === 'radio' ? el.checked : String(el.value == null ? '' : el.value).trim();
    if (el.required && !valore) {
      const nome = etichettaCampo(el, form);
      if (el.type === 'checkbox') return { campo: el, messaggio: 'Per continuare devi accettare: ' + nome + '.' };
      if (el.tagName === 'SELECT') return { campo: el, messaggio: 'Seleziona un valore per «' + nome + '».' };
      return { campo: el, messaggio: 'Compila il campo «' + nome + '».' };
    }
    if (el.type === 'email' && valore && !EMAIL_RE.test(String(valore))) {
      return { campo: el, messaggio: 'Email non valida.' };
    }
  }
  return null;
}

/**
 * Valida il form; se c'è un errore dà il focus al campo e restituisce il messaggio.
 * @param {HTMLFormElement} form
 * @returns {string} messaggio (stringa vuota se il form è valido)
 */
export function validaFormAuth(form) {
  const errore = primoErroreForm(form);
  if (!errore) return '';
  try { errore.campo.focus(); } catch (e) { /* ignore */ }
  return errore.messaggio;
}
