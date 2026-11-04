/**
 * Mette un form in sola consultazione: campi spenti, niente Salva.
 * @module shared/js/form-sola-lettura
 */

export const BANNER_SOLA_LETTURA =
  'Lavoro di un terreno archiviato (o precedente al cambio coltura): solo consultazione';

export function applicaSolaLetturaAlForm(form, { solaLettura, messaggio = BANNER_SOLA_LETTURA } = {}) {
  if (!form) return { salvaVisibile: true };
  const bannerId = 'banner-sola-lettura';
  const esistente = form.querySelector('#' + bannerId);
  if (!solaLettura) {
    if (esistente) esistente.remove();
    form.querySelectorAll('[data-sola-lettura-spento="1"]').forEach((el) => {
      el.disabled = false;
      el.removeAttribute('data-sola-lettura-spento');
    });
    form.querySelectorAll('[data-sola-lettura-nascosto="1"]').forEach((el) => {
      el.style.display = '';
      el.removeAttribute('data-sola-lettura-nascosto');
    });
    return { salvaVisibile: true };
  }
  form.querySelectorAll('input, select, textarea, button').forEach((el) => {
    const tipo = (el.getAttribute('type') || '').toLowerCase();
    const testo = (el.textContent || '').trim().toLowerCase();
    const eSalva = tipo === 'submit' || testo === 'salva' || testo === 'elimina';
    if (eSalva || tipo === 'submit') {
      el.style.display = 'none';
      el.setAttribute('data-sola-lettura-nascosto', '1');
      return;
    }
    if (el.tagName === 'BUTTON') return;
    el.disabled = true;
    el.setAttribute('data-sola-lettura-spento', '1');
  });
  if (!esistente) {
    const banner = form.ownerDocument.createElement('p');
    banner.id = bannerId;
    banner.setAttribute('role', 'status');
    banner.textContent = messaggio;
    form.insertBefore(banner, form.firstChild);
  } else {
    esistente.textContent = messaggio;
  }
  return { salvaVisibile: false };
}
