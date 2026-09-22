/**
 * Pelle Proposta su ogni pagina ufficio che carica il bootstrap.
 * Spenta con data-gfv-pelle-host="0", sul campo e sul login.
 * Flag uiPelleProposta. Spento = attributo oggi e niente shell.
 * @module core/js/ui-pelle
 */

import { isFeatureEnabledFromWindow } from '../config/feature-flags.js';
import {
  PELLE_FLAG_ID,
  PELLE_DESKTOP_MQ,
  PELLE_ACCENT,
  computePelleState,
  isFieldWorkspacePath,
  isPelleSkippedPath,
  moduleFromPath,
  visibleShellEntries,
  homeActionsFromShell,
  cardsModelFromRows
} from './ui-pelle-state.js';

const FONT_ID = 'gfv-pelle-font';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

let booted = false;
let applySeq = 0;
let shellSig = '';
let listObserver = null;
let homeObserver = null;
let listTimer = 0;
let homeTimer = 0;
let catalogCache = null;
let homeLock = false;
let listLock = false;

function coreDir() {
  return new URL('../', import.meta.url);
}

function absHref(rel) {
  return new URL(rel, coreDir()).href;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageHost() {
  if (document.documentElement.getAttribute('data-gfv-pelle-host') === '0') return false;
  const path = window.location && window.location.pathname;
  if (isFieldWorkspacePath(path) || isPelleSkippedPath(path)) return false;
  return true;
}

function ensurePageMeta() {
  const html = document.documentElement;
  const path = window.location && window.location.pathname;
  if (!html.getAttribute('data-gfv-module')) {
    const mod = moduleFromPath(path);
    if (mod) html.setAttribute('data-gfv-module', mod);
  }
  if (!html.getAttribute('data-gfv-pelle-place')) {
    const h1 = document.querySelector('h1');
    const raw = (h1 && h1.textContent) || document.title || 'GFV';
    const place = String(raw)
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
      .replace(/\s*-\s*GFV[\s\S]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
    html.setAttribute('data-gfv-pelle-place', place || 'GFV');
  }
  if (
    !html.getAttribute('data-gfv-pelle-surface') &&
    moduleFromPath(path) === 'home' &&
    String(path || '').indexOf('/modules/') < 0
  ) {
    html.setAttribute('data-gfv-pelle-surface', 'home');
  }
}

function resolveAccentId() {
  if (document.body && document.body.classList.contains('conto-terzi-mode') && PELLE_ACCENT.contoTerzi) {
    return 'contoTerzi';
  }
  return document.documentElement.getAttribute('data-gfv-module') || '';
}

function ensureFont(on) {
  let link = document.getElementById(FONT_ID);
  if (!on) {
    if (link) link.remove();
    return;
  }
  if (link) return;
  link = document.createElement('link');
  link.id = FONT_ID;
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

function clearPelleAttrs() {
  const html = document.documentElement;
  html.removeAttribute('data-pelle');
  html.removeAttribute('data-shell');
  html.removeAttribute('data-accent');
  html.removeAttribute('data-gfv-pelle-lab');
  html.style.removeProperty('--gfv-pelle-accent');
}

function unmountShell() {
  const root = document.getElementById('gfv-pelle-shell');
  if (root) root.remove();
  shellSig = '';
  document.documentElement.removeAttribute('data-gfv-pelle-lab');
}

function unmountHome() {
  ['gfv-pelle-briefing', 'gfv-pelle-home-actions'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  const attention = document.querySelector('.dashboard-hub-block--attention');
  if (attention) attention.classList.remove('is-open');
}

function unmountCards() {
  document.querySelectorAll('.gfv-pelle-cards').forEach((el) => el.remove());
}

function disconnectObservers() {
  if (listObserver) {
    listObserver.disconnect();
    listObserver = null;
  }
  if (homeObserver) {
    homeObserver.disconnect();
    homeObserver = null;
  }
}

function markCurrent(root) {
  const path = window.location.pathname;
  root.querySelectorAll('a[href]').forEach((a) => {
    let on = false;
    try {
      on = new URL(a.getAttribute('href'), window.location.href).pathname === path;
    } catch (e) { /* ignore */ }
    a.setAttribute('aria-current', on ? 'page' : 'false');
  });
}

function setLab(open) {
  const html = document.documentElement;
  html.setAttribute('data-gfv-pelle-lab', open ? 'open' : 'closed');
  const handle = document.getElementById('gfv-pelle-handle');
  const lab = document.getElementById('gfv-pelle-lab');
  if (handle) handle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (lab) lab.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function loadCatalog() {
  if (catalogCache) return Promise.resolve(catalogCache);
  return import('./dashboard-hub.js').then((mod) => {
    catalogCache = mod.MODULE_CATALOG || {};
    return catalogCache;
  });
}

function shellEntriesFrom(catalog) {
  const moduli = window.__gfvModuliAttivi;
  return visibleShellEntries(catalog, Array.isArray(moduli) ? moduli : null);
}

function mountShell(entries) {
  const sig = entries.map((e) => e.id + '\t' + e.href).join('|');
  let root = document.getElementById('gfv-pelle-shell');
  if (root && shellSig === sig) {
    markCurrent(root);
    const place = document.documentElement.getAttribute('data-gfv-pelle-place') || 'Home';
    const label = document.getElementById('gfv-pelle-handle-label');
    if (label) label.textContent = 'Proposta · ' + place;
    return;
  }
  shellSig = sig;
  const place = document.documentElement.getAttribute('data-gfv-pelle-place') || 'Home';
  if (!root) {
    root = document.createElement('div');
    root.id = 'gfv-pelle-shell';
    document.body.prepend(root);
  }
  const links = entries.map((e) => {
    return (
      '<a class="gfv-pelle-mod" href="' + escapeHtml(absHref(e.href)) + '">' +
      escapeHtml(e.label) +
      (e.hint ? '<small>' + escapeHtml(e.hint) + '</small>' : '') +
      '</a>'
    );
  }).join('');
  root.innerHTML =
    '<button type="button" class="gfv-pelle-handle" id="gfv-pelle-handle" aria-expanded="false" aria-controls="gfv-pelle-lab">' +
    '<span class="gfv-pelle-grip" aria-hidden="true"></span>' +
    '<span class="gfv-pelle-handle-label" id="gfv-pelle-handle-label">Proposta · ' + escapeHtml(place) + '</span>' +
    '<span class="gfv-pelle-handle-hint">Tocca per i moduli</span>' +
    '</button>' +
    '<div class="gfv-pelle-backdrop" id="gfv-pelle-backdrop" hidden></div>' +
    '<nav class="gfv-pelle-lab" id="gfv-pelle-lab" aria-hidden="true" aria-label="Moduli">' +
    '<p class="gfv-pelle-kicker gfv-pelle-kicker--phone">Scegli un modulo. Il menu si chiude.</p>' +
    '<p class="gfv-pelle-kicker gfv-pelle-kicker--desk">Moduli</p>' +
    '<div class="gfv-pelle-mods">' + links + '</div>' +
    '</nav>';
  markCurrent(root);
  const handle = document.getElementById('gfv-pelle-handle');
  const backdrop = document.getElementById('gfv-pelle-backdrop');
  if (handle) {
    handle.addEventListener('click', () => {
      const open = document.documentElement.getAttribute('data-gfv-pelle-lab') === 'open';
      setLab(!open);
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', () => setLab(false));
  }
  root.querySelectorAll('a.gfv-pelle-mod').forEach((a) => {
    a.addEventListener('click', () => setLab(false));
  });
  setLab(false);
}

function syncBriefing() {
  const p = document.getElementById('gfv-pelle-briefing-text');
  if (!p) return;
  const first = document.querySelector('#dashboard-hub-attention-list li, #dashboard-hub-today-list li');
  const text = first ? first.textContent.replace(/\s+/g, ' ').trim() : '';
  p.textContent = text || 'Nessun avviso in evidenza. I moduli sono nel menu.';
  const items = document.querySelectorAll('#dashboard-hub-attention-list li');
  let more = document.getElementById('gfv-pelle-briefing-more');
  if (items.length > 1) {
    if (!more) {
      more = document.createElement('button');
      more.type = 'button';
      more.id = 'gfv-pelle-briefing-more';
      more.className = 'gfv-pelle-more';
      p.parentElement.appendChild(more);
      more.addEventListener('click', () => {
        const block = document.querySelector('.dashboard-hub-block--attention');
        if (!block) return;
        block.classList.toggle('is-open');
        more.textContent = block.classList.contains('is-open') ? 'Chiudi avvisi' : 'Altri avvisi';
      });
    }
    const block = document.querySelector('.dashboard-hub-block--attention');
    const open = block && block.classList.contains('is-open');
    more.textContent = open ? 'Chiudi avvisi' : 'Altri avvisi';
  } else if (more) {
    more.remove();
  }
}

function mountHome(entries) {
  const content = document.getElementById('dashboard-content');
  if (!content) return;
  homeLock = true;
  try {
  const actions = homeActionsFromShell(entries);
  let brief = document.getElementById('gfv-pelle-briefing');
  if (!brief) {
    brief = document.createElement('div');
    brief.id = 'gfv-pelle-briefing';
    brief.className = 'gfv-pelle-briefing';
    const img = document.createElement('img');
    img.alt = '';
    img.src = new URL('../images/tony-icon.png', import.meta.url).href;
    img.width = 48;
    img.height = 48;
    const p = document.createElement('p');
    p.id = 'gfv-pelle-briefing-text';
    brief.appendChild(img);
    brief.appendChild(p);
  }
  if (content.firstChild !== brief) content.prepend(brief);

  let box = document.getElementById('gfv-pelle-home-actions');
  if (!box) {
    box = document.createElement('section');
    box.id = 'gfv-pelle-home-actions';
    box.className = 'gfv-pelle-panel';
    box.setAttribute('aria-label', 'Azioni rapide');
  }
  const hub = document.getElementById('dashboard-panorama-hub');
  if (hub) hub.after(box);
  else brief.after(box);
  const h2 = '<h2>Azioni rapide</h2>';
  const cards = actions.map((a) => {
    return (
      '<a class="gfv-pelle-card" href="' + escapeHtml(absHref(a.href)) + '">' +
      '<span class="gfv-pelle-ico" aria-hidden="true"></span>' +
      '<strong>' + escapeHtml(a.label) + '</strong>' +
      (a.hint ? '<small>' + escapeHtml(a.hint) + '</small>' : '') +
      '</a>'
    );
  }).join('');
  box.innerHTML = h2 + '<div class="gfv-pelle-cards-grid">' + cards + '</div>';
  syncBriefing();
  } finally {
    queueMicrotask(() => { homeLock = false; });
  }
}

function rowModelsFromTable(table) {
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent || '');
  const rows = Array.from(table.querySelectorAll('tbody tr')).filter((tr) => tr.querySelector('td'));
  return {
    headers,
    rows: rows.map((tr) => ({
      alert: /\balert\b|gfv-row-alert/.test(tr.className || ''),
      cells: Array.from(tr.children).map((td) => ({
        text: td.textContent || '',
        html: td.innerHTML || ''
      }))
    }))
  };
}

function renderCardsHost(host) {
  const tables = Array.from(host.querySelectorAll('table'));
  let wrap = host.querySelector(':scope > .gfv-pelle-cards');
  if (!tables.length) {
    if (wrap) wrap.remove();
    return;
  }
  const models = tables.map(rowModelsFromTable);
  const cards = models.flatMap((m) => cardsModelFromRows(m.headers, m.rows));
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'gfv-pelle-cards';
    host.appendChild(wrap);
  }
  if (!cards.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = cards.map((card) => {
    return (
      '<article class="gfv-pelle-job' + (card.alert ? ' is-alert' : '') + '">' +
      '<div class="gfv-pelle-job-top"><h3>' + escapeHtml(card.title) + '</h3>' +
      '<div class="gfv-pelle-job-pills">' + card.statoHtml + '</div></div>' +
      (card.facts.length ? '<p class="gfv-pelle-job-line">' + escapeHtml(card.facts.join(' · ')) + '</p>' : '') +
      (card.actionsHtml ? '<div class="gfv-pelle-job-actions">' + card.actionsHtml + '</div>' : '') +
      '</article>'
    );
  }).join('');
}

function isOwnPelleMutation(record) {
  const target = record.target;
  const el = target && target.nodeType === 1 ? target : (target && target.parentElement);
  if (el && typeof el.closest === 'function') {
    if (el.closest('.gfv-pelle-cards, #gfv-pelle-briefing, #gfv-pelle-home-actions, #gfv-pelle-shell')) return true;
    if (el.id === 'gfv-pelle-briefing' || el.id === 'gfv-pelle-home-actions') return true;
  }
  const added = record.addedNodes ? Array.from(record.addedNodes) : [];
  return added.length > 0 && added.every((node) => {
    if (!node || node.nodeType !== 1) return false;
    const id = node.id || '';
    if (id === 'gfv-pelle-briefing' || id === 'gfv-pelle-home-actions' || id === 'gfv-pelle-shell') return true;
    if (node.classList && node.classList.contains('gfv-pelle-cards')) return true;
    return typeof node.closest === 'function' && !!node.closest('.gfv-pelle-cards, #gfv-pelle-briefing, #gfv-pelle-home-actions');
  });
}

function listHosts() {
  const nodes = Array.from(document.querySelectorAll('[data-gfv-pelle-list], .table-responsive, .table-container'));
  return nodes.filter((el) => {
    if (el.closest('.modal') || el.closest('.gfv-pelle-cards')) return false;
    const parent = el.parentElement;
    if (parent && parent.closest('[data-gfv-pelle-list], .table-responsive, .table-container')) return false;
    return true;
  });
}

function syncLists() {
  listLock = true;
  try {
    listHosts().forEach(renderCardsHost);
  } finally {
    listLock = false;
  }
}

function watchLists() {
  if (!listObserver) {
    listObserver = new MutationObserver((records) => {
      if (listLock) return;
      if (records.every(isOwnPelleMutation)) return;
      window.clearTimeout(listTimer);
      listTimer = window.setTimeout(syncLists, 40);
    });
    document.querySelectorAll('.content, .container, #dashboard-content').forEach((el) => {
      listObserver.observe(el, { childList: true, subtree: true });
    });
  }
  syncLists();
}

function watchHome(entries) {
  const content = document.getElementById('dashboard-content');
  if (!content) return;
  if (!homeObserver) {
    homeObserver = new MutationObserver((records) => {
      if (homeLock) return;
      if (records.every(isOwnPelleMutation)) return;
      window.clearTimeout(homeTimer);
      homeTimer = window.setTimeout(() => {
        if (!catalogCache) return;
        if (document.documentElement.getAttribute('data-pelle') !== 'proposta') return;
        mountHome(shellEntriesFrom(catalogCache));
      }, 40);
    });
    homeObserver.observe(content, { childList: true, subtree: true, characterData: true });
  }
  mountHome(entries);
}

function onEscape(e) {
  if (e.key !== 'Escape') return;
  if (document.documentElement.getAttribute('data-gfv-pelle-lab') === 'open') setLab(false);
}

/**
 * Imposta data-pelle su documentElement. No-op fuori dalle pagine host.
 */
export function applyPelleFromFlags() {
  if (typeof document === 'undefined') return;
  const seq = ++applySeq;
  const field = isFieldWorkspacePath(window.location && window.location.pathname);
  const desktop = typeof window.matchMedia === 'function' && window.matchMedia(PELLE_DESKTOP_MQ).matches;
  const flagOn = isFeatureEnabledFromWindow(PELLE_FLAG_ID);
  if (pageHost()) ensurePageMeta();
  const surface = document.documentElement.getAttribute('data-gfv-pelle-surface') || '';
  const state = computePelleState({
    host: pageHost(),
    fieldWorkspace: field,
    flagOn,
    desktop,
    surface
  });
  if (!state.apply) {
    clearPelleAttrs();
    unmountShell();
    unmountHome();
    unmountCards();
    disconnectObservers();
    ensureFont(false);
    return;
  }
  const html = document.documentElement;
  html.setAttribute('data-pelle', state.pelle);
  html.setAttribute('data-shell', state.shell);
  const accentId = resolveAccentId();
  if (accentId && PELLE_ACCENT[accentId]) {
    html.setAttribute('data-accent', accentId);
    html.style.setProperty('--gfv-pelle-accent', PELLE_ACCENT[accentId]);
  } else {
    html.removeAttribute('data-accent');
    html.style.removeProperty('--gfv-pelle-accent');
  }
  ensureFont(state.pelle === 'proposta');
  if (!state.mountShell) {
    unmountShell();
    unmountHome();
    unmountCards();
    disconnectObservers();
    return;
  }
  loadCatalog().then((catalog) => {
    if (seq !== applySeq) return;
    if (document.documentElement.getAttribute('data-pelle') !== 'proposta') return;
    const entries = shellEntriesFrom(catalog);
    mountShell(entries);
    if (state.mountHome) {
      watchHome(entries);
    } else {
      unmountHome();
      if (homeObserver) {
        homeObserver.disconnect();
        homeObserver = null;
      }
    }
    if (state.mountCards) watchLists();
    else {
      unmountCards();
      if (listObserver) {
        listObserver.disconnect();
        listObserver = null;
      }
    }
  }).catch(() => { /* catalogo non disponibile: la pagina resta col chrome carta */ });
}

export function bootPelle() {
  applyPelleFromFlags();
  if (booted || typeof window === 'undefined') return;
  booted = true;
  window.addEventListener('gfv-feature-flags', applyPelleFromFlags);
  window.addEventListener('gfv-tenant-tony-ready', applyPelleFromFlags);
  window.addEventListener('keydown', onEscape);
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia(PELLE_DESKTOP_MQ);
    const onMq = () => applyPelleFromFlags();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMq);
    else if (typeof mq.addListener === 'function') mq.addListener(onMq);
  }
}
