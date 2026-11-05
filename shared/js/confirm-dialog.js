/**
 * Dialogo di conferma dell'app (non window.confirm).
 * Crea l'overlay al primo uso se la pagina non lo ha già.
 *
 * @module shared/js/confirm-dialog
 */

const OVERLAY_ID = 'gfv-confirm-overlay';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function messageToHtml(message) {
  return escapeHtml(message)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 0.75rem;">${line}</p>`)
    .join('');
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'presentation');
  overlay.style.cssText = [
    'display:none',
    'position:fixed',
    'inset:0',
    'z-index:10050',
    'background:rgba(15,23,42,0.45)',
    'align-items:center',
    'justify-content:center',
    'padding:1rem'
  ].join(';');

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="gfv-confirm-title" style="
      background:#fff;color:#0f172a;max-width:32rem;width:100%;
      border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.2);
      padding:1.25rem 1.35rem;font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="display:flex;gap:0.75rem;align-items:flex-start;">
        <div id="gfv-confirm-icon" aria-hidden="true" style="font-size:1.4rem;line-height:1.2;">⚠️</div>
        <div style="flex:1;min-width:0;">
          <h3 id="gfv-confirm-title" style="margin:0 0 0.65rem;font-size:1.1rem;">Conferma</h3>
          <div id="gfv-confirm-body" style="font-size:0.95rem;line-height:1.45;color:#334155;"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.15rem;">
        <button type="button" id="gfv-confirm-cancel" style="
          border:1px solid #cbd5e1;background:#fff;color:#0f172a;
          border-radius:8px;padding:0.45rem 0.9rem;cursor:pointer;font:inherit;
        ">Annulla</button>
        <button type="button" id="gfv-confirm-ok" style="
          border:none;background:#0f766e;color:#fff;
          border-radius:8px;padding:0.45rem 0.9rem;cursor:pointer;font:inherit;
        ">Continua</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   bodyHtml?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   icon?: string
 * }} [options]
 * @returns {Promise<boolean>}
 */
export function showConfirmDialog(options = {}) {
  if (typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  const overlay = ensureOverlay();
  const titleEl = document.getElementById('gfv-confirm-title');
  const bodyEl = document.getElementById('gfv-confirm-body');
  const confirmBtn = document.getElementById('gfv-confirm-ok');
  const cancelBtn = document.getElementById('gfv-confirm-cancel');
  const iconEl = document.getElementById('gfv-confirm-icon');

  if (!titleEl || !bodyEl || !confirmBtn || !cancelBtn) {
    return Promise.resolve(window.confirm(options.message || options.title || 'Confermi?'));
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = previousOverflow;
      confirmBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (event) => {
      if (event.target === overlay) finish(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') finish(false);
    };

    const previousOverflow = document.body.style.overflow;
    titleEl.textContent = options.title || 'Conferma';
    bodyEl.innerHTML = options.bodyHtml || messageToHtml(options.message || '');
    confirmBtn.textContent = options.confirmLabel || 'Continua';
    cancelBtn.textContent = options.cancelLabel || 'Annulla';
    if (iconEl) iconEl.textContent = options.icon || '⚠️';

    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    confirmBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    cancelBtn.focus();
  });
}
