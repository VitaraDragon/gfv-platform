/**
 * Gate Manodopera ↔ Diario.
 * Manodopera spenta: solo Diario. Accesa: Gestione lavori; il Diario non crea attività.
 * @module core/config/manodopera-diario-gate
 */

/**
 * @param {string[]|null|undefined} modules
 * @returns {boolean}
 */
export function tenantHasManodopera(modules) {
  if (!Array.isArray(modules)) return false;
  return modules.some((id) => String(id || '').toLowerCase() === 'manodopera');
}

/**
 * Destinazione elenco lavori / attività conto terzi.
 * `da_pianificare` esiste solo in Gestione lavori: senza Manodopera non c'è href.
 * @param {{ hasManodopera?: boolean, stato?: string, from?: 'core'|'module' }} opts
 * @returns {string} href relativo, oppure '' se la voce va nascosta
 */
export function registroLavoriHref(opts) {
  const hasManodopera = !!(opts && opts.hasManodopera);
  const stato = opts && opts.stato ? String(opts.stato) : '';
  const fromModule = opts && opts.from === 'module';
  const core = fromModule ? '../../../core/' : '';

  if (stato === 'da_pianificare') {
    if (!hasManodopera) return '';
    return core + 'admin/gestione-lavori-standalone.html?stato=da_pianificare';
  }

  const params = new URLSearchParams();
  params.set('contoTerzi', 'true');
  if (stato) params.set('stato', stato);
  const query = params.toString();

  if (hasManodopera) {
    return core + 'admin/gestione-lavori-standalone.html?' + query;
  }
  return core + 'attivita-standalone.html?' + query;
}

/**
 * Riscrive i link con `data-gfv-registro` (in_corso, completato, da_pianificare, conto_terzi).
 * @param {ParentNode|null|undefined} root
 * @param {boolean} hasManodopera
 */
export function applyRegistroLavoriLinks(root, hasManodopera) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-gfv-registro]').forEach((el) => {
    const kind = el.getAttribute('data-gfv-registro') || '';
    const from = el.getAttribute('data-gfv-registro-from') === 'core' ? 'core' : 'module';
    const stato = kind === 'conto_terzi' ? '' : kind;
    const href = registroLavoriHref({ hasManodopera, stato, from });
    if (!href) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.setAttribute('href', href);
  });
}

/**
 * «Registra nel diario» vs «Nuovo lavoro» (seminativo e pagine simili).
 * @param {ParentNode|null|undefined} root
 * @param {boolean} hasManodopera
 */
export function applyDiarioVsLavoroCta(root, hasManodopera) {
  if (!root || typeof root.getElementById !== 'function') return;
  const diario = root.getElementById('link-diario');
  const lavoro = root.getElementById('link-nuovo-lavoro');
  if (diario) diario.hidden = !!hasManodopera;
  if (lavoro) lavoro.hidden = !hasManodopera;
}
