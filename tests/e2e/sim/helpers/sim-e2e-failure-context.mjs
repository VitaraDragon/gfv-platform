/**
 * Cattura contesto pagina al fallimento scenario E2E app.
 * @module tests/e2e/sim/helpers/sim-e2e-failure-context
 */

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<object>}
 */
export async function captureSimFailureContext(page) {
  try {
    return await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const toastErr = document.querySelector('.toast-error, .alert-danger, [role="alert"]');
      const tableRows = document.querySelectorAll('table tbody tr').length;
      return {
        url: window.location.href,
        pathname: window.location.pathname,
        title: document.title || '',
        h1: h1 ? (h1.textContent || '').trim().slice(0, 120) : '',
        tableRows,
        toastError: toastErr ? (toastErr.textContent || '').trim().slice(0, 200) : '',
        freemium: !!window.__tonyFreemiumBlocked,
      };
    });
  } catch {
    return { url: '', pathname: '', title: '', h1: '', tableRows: null, toastError: '' };
  }
}

/**
 * @param {Error|string} error
 * @returns {object}
 */
export function parseSimFailureError(error) {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();

  /** @type {object} */
  const hints = {
    raw: message.slice(0, 800),
    assertField: null,
  };

  if (/manifest|seed|sim:run|card non trovata|nessun[a-z]* (prodotto|lavoro|terreno|stub|riga)/i.test(message)) {
    hints.assertField = 'seed';
  } else if (/timeout|exceeded|waiting/i.test(message)) {
    hints.assertField = 'timeout';
  } else if (/tobvisible|tobevisible|locator|getbyrole|selector/i.test(lower)) {
    hints.assertField = 'dom';
  } else if (/tohaveurl|navigation|redirect/i.test(lower)) {
    hints.assertField = 'navigation';
  } else if (/save|submit|requestsubmit|salva/i.test(lower)) {
    hints.assertField = 'save';
  } else if (/toast|alert|errore|error/i.test(lower)) {
    hints.assertField = 'business_error';
  }

  return hints;
}
