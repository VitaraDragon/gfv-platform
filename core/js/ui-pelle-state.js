/**
 * Stato pelle Proposta: funzioni pure (niente DOM, niente catalogo copiato).
 * Il catalogo moduli resta `MODULE_CATALOG` in dashboard-hub.js.
 * @module core/js/ui-pelle-state
 */

export const PELLE_FLAG_ID = 'uiPelleProposta';
export const PELLE_DESKTOP_MQ = '(min-width: 1024px)';

/** Accento solo bordo. Chiave = data-gfv-module (o contoTerzi se body già in quella modalità). */
export const PELLE_ACCENT = {
  home: '#1c1917',
  frutteto: '#FF6F00',
  vigneto: '#6A1B9A',
  manodopera: '#1f6b3a',
  parcoMacchine: '#1565C0',
  contoTerzi: '#EF6C00',
  meteo: '#0288D1',
  oliveto: '#2E7D32',
  lavori: '#2E8B57',
  terreni: '#1f6b3a',
  report: '#1c1917',
  magazzino: '#2E7D32'
};

/** Pagine che non prendono la pelle. Il campo e il login restano com’erano. */
export const PELLE_SKIP_FRAGMENTS = [
  'field-workspace',
  '/mobile/',
  'login-standalone',
  'registrazione-standalone',
  'registrazione-invito',
  'reset-password',
  'simulator-dev',
  'prodotti-test',
  'terreni-test',
  '/dev/'
];

/** Primo frammento che compare nel path vince. `dashboard-standalone.html` è il nome file esatto, non gli hub. */
export const PELLE_PATH_MODULES = [
  ['/modules/magazzino/', 'magazzino'],
  ['/modules/frutteto/', 'frutteto'],
  ['/modules/vigneto/', 'vigneto'],
  ['/modules/manodopera/', 'manodopera'],
  ['/modules/macchine/', 'parcoMacchine'],
  ['/modules/conto-terzi/', 'contoTerzi'],
  ['/modules/meteo/', 'meteo'],
  ['/modules/report/', 'report'],
  ['/modules/vendemmia-meccanica/', 'contoTerzi'],
  ['gestione-lavori', 'lavori'],
  ['validazione-ore', 'manodopera'],
  ['impegni-giornalieri', 'manodopera'],
  ['terreni-standalone', 'terreni'],
  ['mappa-aziendale', 'terreni'],
  ['attivita-standalone', 'diarioAttivita']
];

/**
 * Voci shell. `catalogId` legge etichetta e href da MODULE_CATALOG.
 * Home, Gestione lavori e Impostazioni non sono moduli a pagamento.
 * `optional` si nasconde se `moduliAttivi` è già noto e non contiene l'id.
 */
export const PELLE_SHELL_ORDER = [
  { id: 'home', label: 'Home', hint: 'Tony e oggi', href: 'dashboard-standalone.html' },
  { catalogId: 'terreni', hint: 'Anagrafica e mappa' },
  { id: 'lavori', label: 'Gestione lavori', hint: 'Lista e dettaglio', href: 'admin/gestione-lavori-standalone.html' },
  { catalogId: 'vigneto', hint: 'Anagrafica e vendemmia', optional: true },
  { catalogId: 'frutteto', hint: 'Anagrafica e raccolta', optional: true },
  { catalogId: 'manodopera', hint: 'Squadre e ore', optional: true },
  { catalogId: 'magazzino', hint: 'Prodotti e movimenti', optional: true },
  { catalogId: 'parcoMacchine', hint: 'Trattori e scadenze', optional: true },
  { catalogId: 'contoTerzi', hint: 'Clienti e preventivi', optional: true },
  { catalogId: 'meteo', hint: 'Sede e campi', optional: true },
  { catalogId: 'report', hint: 'Bilancio per area', optional: true },
  { catalogId: 'diarioAttivita', hint: 'Diario', hideWhenManodopera: true },
  { catalogId: 'abbonamento', hint: 'Piano e moduli', menu: 'opzioni' },
  { catalogId: 'statistiche', hint: 'Numeri' },
  { id: 'impostazioni', label: 'Impostazioni', hint: 'Azienda e account', href: 'admin/impostazioni-standalone.html' }
];

const HOME_SKIP = {
  home: true,
  impostazioni: true,
  abbonamento: true,
  statistiche: true,
  diarioAttivita: true
};

/**
 * @param {{ host?: boolean, fieldWorkspace?: boolean, flagOn?: boolean, desktop?: boolean, surface?: string }} input
 */
export function computePelleState(input) {
  const host = !!(input && input.host);
  const field = !!(input && input.fieldWorkspace);
  if (!host || field) {
    return {
      apply: false,
      pelle: 'oggi',
      shell: 'phone',
      mountShell: false,
      mountCards: false,
      mountHome: false
    };
  }
  const flagOn = !!(input && input.flagOn);
  const desktop = !!(input && input.desktop);
  return {
    apply: true,
    pelle: flagOn ? 'proposta' : 'oggi',
    shell: desktop ? 'desktop' : 'phone',
    mountShell: flagOn,
    mountCards: flagOn && !desktop,
    mountHome: flagOn && input.surface === 'home'
  };
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isFieldWorkspacePath(pathname) {
  return String(pathname || '').replace(/\\/g, '/').indexOf('field-workspace') >= 0;
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPelleSkippedPath(pathname) {
  const p = String(pathname || '').replace(/\\/g, '/').toLowerCase();
  return PELLE_SKIP_FRAGMENTS.some((fragment) => p.indexOf(fragment) >= 0);
}

/**
 * @param {string} pathname
 * @returns {string}
 */
export function moduleFromPath(pathname) {
  const p = String(pathname || '').replace(/\\/g, '/');
  const file = p.split('/').pop() || '';
  if (file === 'dashboard-standalone.html') return 'home';
  for (let i = 0; i < PELLE_PATH_MODULES.length; i += 1) {
    const frag = PELLE_PATH_MODULES[i][0];
    const mod = PELLE_PATH_MODULES[i][1];
    if (p.indexOf(frag) >= 0) return mod;
  }
  return '';
}

/** Pagine impianto condivise: il file sta nel vigneto, il colore segue ?coltura=. */
const SHARED_COLTURA_FILES = {
  'calcolo-materiali-standalone.html': true,
  'pianifica-impianto-standalone.html': true
};

const COLTURA_TO_MODULE = {
  frutteto: 'frutteto',
  vigneto: 'vigneto',
  oliveto: 'oliveto'
};

export function moduleFromLocation(pathname, search) {
  const file = String(pathname || '').replace(/\\/g, '/').split('/').pop() || '';
  if (SHARED_COLTURA_FILES[file]) {
    const coltura = String(new URLSearchParams(String(search || '').replace(/^\?/, '')).get('coltura') || '').toLowerCase();
    if (COLTURA_TO_MODULE[coltura]) return COLTURA_TO_MODULE[coltura];
  }
  return moduleFromPath(pathname);
}

/**
 * @param {Record<string, { label?: string, href?: string, hrefManodopera?: string }>|null|undefined} catalog
 * @param {string[]|null|undefined} moduliAttivi null = non ancora noti (i moduli optional restano visibili)
 * @param {Array} [order]
 */
export function visibleShellEntries(catalog, moduliAttivi, order) {
  const active = Array.isArray(moduliAttivi) ? moduliAttivi : null;
  const list = Array.isArray(order) ? order : PELLE_SHELL_ORDER;
  const out = [];
  list.forEach((item) => {
    if (item.catalogId) {
      const meta = catalog && catalog[item.catalogId];
      if (!meta || !meta.href) return;
      if (item.hideWhenManodopera && active && active.indexOf('manodopera') >= 0) return;
      if (item.optional && active && active.indexOf(item.catalogId) < 0) return;
      const href =
        item.catalogId === 'statistiche' &&
        active &&
        active.indexOf('manodopera') >= 0 &&
        meta.hrefManodopera
          ? meta.hrefManodopera
          : meta.href;
      out.push({
        id: item.catalogId,
        label: meta.label || item.catalogId,
        hint: item.hint || '',
        href,
        menu: item.menu || ''
      });
      return;
    }
    if (!item.href || !item.label) return;
    out.push({
      id: item.id,
      label: item.label,
      hint: item.hint || '',
      href: item.href
    });
  });
  return out;
}

/**
 * Quattro–sei azioni in home. Il resto del catalogo sta nello shell.
 * @param {Array<{ id: string, label: string, hint: string, href: string }>} entries
 * @param {number} [max]
 */
export function homeActionsFromShell(entries, max) {
  const limit = typeof max === 'number' ? max : 6;
  return (entries || []).filter((e) => e && !HOME_SKIP[e.id]).slice(0, limit);
}

/** Impostazioni e le voci con menu «opzioni» non stanno nell’elenco moduli. */
export function moduleMenuEntries(entries) {
  return (entries || []).filter((e) => e && e.id !== 'impostazioni' && e.menu !== 'opzioni');
}

export function accountMenuEntries(entries) {
  const fromShell = (entries || []).filter((e) => e && e.menu === 'opzioni');
  return [
    { id: 'impostazioni', label: 'Impostazioni', hint: 'Azienda e account', href: 'admin/impostazioni-standalone.html' },
    ...fromShell,
    { id: 'guide', label: 'Guide', hint: 'Come si usa', href: '../documentazione-utente/index.html', blank: true },
    { id: 'logout', label: 'Logout', hint: 'Esci dall’account', action: 'logout' }
  ];
}

export function mapMenuEntries() {
  return [
    { id: 'mappa', label: 'Mappa aziendale', hint: 'Terreni e lavori', href: 'mappa-aziendale-standalone.html' }
  ];
}

/**
 * Scheda da una riga tabella: titolo, fino a 3 fatti, stato, azioni.
 * @param {string[]} headers
 * @param {Array<{ alert?: boolean, cells: Array<{ text?: string, html?: string }> }>} rows
 */
export function cardsModelFromRows(headers, rows) {
  const heads = Array.isArray(headers) ? headers : [];
  const actionIdx = heads.findIndex((h) => /azioni/i.test(String(h || '')));
  const statoIdx = heads.findIndex((h) => /^stato$/i.test(String(h || '').trim()));
  return (rows || []).map((row) => {
    const cells = (row && row.cells) || [];
    const title = cells[0] ? String(cells[0].text || '').trim() : '';
    const facts = [];
    cells.forEach((cell, i) => {
      if (i === 0 || i === actionIdx || i === statoIdx) return;
      if (facts.length >= 3) return;
      const text = String((cell && cell.text) || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const label = heads[i] ? String(heads[i]).trim() : '';
      facts.push(label ? label + ': ' + text : text);
    });
    return {
      title: title || 'Voce',
      facts,
      statoHtml: statoIdx >= 0 && cells[statoIdx] ? String(cells[statoIdx].html || '') : '',
      actionsHtml: actionIdx >= 0 && cells[actionIdx] ? String(cells[actionIdx].html || '') : '',
      alert: !!(row && row.alert)
    };
  });
}
