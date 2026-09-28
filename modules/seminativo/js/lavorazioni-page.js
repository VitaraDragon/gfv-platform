/**
 * Pagina Lavorazioni: legge il diario e, con Manodopera, i lavori.
 * @module modules/seminativo/js/lavorazioni-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import { listLavorazioniCollegate } from '../services/lavorazioni-service.js';

const PAGE_TYPE = 'lavorazioni_seminativo';
const DIARIO_HREF = '../../../core/attivita-standalone.html';
const LAVORI_HREF = '../../../core/admin/gestione-lavori-standalone.html';

let terreni = [];
let tipi = [];
let righe = [];
let visible = [];
let hasManodopera = false;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTerrenoLabel(id) {
  const terreno = terreni.find((t) => t.id === id);
  if (!terreno) return '—';
  const nome = String(terreno.nome || '').trim();
  const podere = String(terreno.podere || '').trim();
  if (nome && podere) return `${nome} – ${podere}`;
  return nome || podere || 'Terreno senza nome';
}

function statoLabel(row) {
  if (row.source === 'diario') return 'Da diario';
  const map = {
    assegnato: 'Assegnato',
    in_corso: 'In corso',
    completato: 'Completato',
    sospeso: 'Sospeso'
  };
  return map[row.stato] || row.stato || 'Lavoro';
}

function syncTonyModules(modules) {
  if (window.Tony && typeof window.Tony.initContextWithModules === 'function') {
    window.Tony.initContextWithModules(modules);
    return;
  }
  if (typeof window.syncTonyModules === 'function') {
    window.syncTonyModules(modules);
    return;
  }
  if (window.Tony && typeof window.Tony.setContext === 'function') {
    window.Tony.setContext('dashboard', {
      info_azienda: { moduli_attivi: modules },
      moduli_attivi: modules
    });
  }
}

function fillSelect(el, options, placeholder) {
  if (!el) return;
  const current = el.value;
  el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` +
    options.map((opt) => (
      `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`
    )).join('');
  if (current && Array.from(el.options).some((o) => o.value === current)) {
    el.value = current;
  }
}

function populateFilters() {
  fillSelect(
    document.getElementById('filter-terreno'),
    terreni.map((t) => ({ value: t.id, label: getTerrenoLabel(t.id) })),
    'Tutti i terreni'
  );
  fillSelect(
    document.getElementById('filter-tipo'),
    tipi.map((t) => ({ value: t.nome, label: t.nome })),
    'Tutti i tipi'
  );
  const origine = document.getElementById('filter-origine');
  if (origine) {
    const lavoroOpt = origine.querySelector('option[value="lavoro"]');
    if (lavoroOpt) lavoroOpt.hidden = !hasManodopera;
  }
  const linkLavoro = document.getElementById('link-nuovo-lavoro');
  if (linkLavoro) linkLavoro.hidden = !hasManodopera;
}

function buildTableData(rows) {
  const items = rows.map((row) => ({
    id: row.id,
    source: row.source,
    terreno: getTerrenoLabel(row.terrenoId),
    terrenoId: row.terrenoId,
    tipoLavoro: row.tipoLavoro,
    data: row.data,
    stato: row.stato,
    campagna: row.campagna || ''
  }));
  const fonte = hasManodopera ? ' e lavori' : '';
  const summary = items.length
    ? `${items.length} lavorazion${items.length === 1 ? 'e' : 'i'} seminativo da diario${fonte}`
    : 'Nessuna lavorazione seminativo nel diario' + (hasManodopera ? ' o nei lavori' : '');
  return { pageType: PAGE_TYPE, summary, items };
}

function applyFilters() {
  const terrenoId = document.getElementById('filter-terreno')?.value || '';
  const tipo = (document.getElementById('filter-tipo')?.value || '').trim().toLowerCase();
  const origine = document.getElementById('filter-origine')?.value || '';
  const ricerca = (document.getElementById('filter-ricerca')?.value || '').trim().toLowerCase();
  visible = righe.filter((row) => {
    if (terrenoId && row.terrenoId !== terrenoId) return false;
    if (tipo && String(row.tipoLavoro || '').toLowerCase() !== tipo) return false;
    if (origine && row.source !== origine) return false;
    if (ricerca) {
      const blob = [
        getTerrenoLabel(row.terrenoId),
        row.tipoLavoro,
        row.data,
        row.campagna,
        row.source,
        statoLabel(row)
      ].join(' ').toLowerCase();
      if (!blob.includes(ricerca)) return false;
    }
    return true;
  });
  renderTable();
}

function resetFilters() {
  ['filter-terreno', 'filter-tipo', 'filter-origine', 'filter-ricerca'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyFilters();
}

function renderTable() {
  const tbody = document.getElementById('lavorazioni-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('lavorazioni-table');
  if (loadingDiv) loadingDiv.style.display = 'none';

  if (!visible.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    publishSeminativoTableData(buildTableData([]));
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';
  tbody.innerHTML = visible.map((row) => {
    const azione = row.source === 'lavoro'
      ? `<a class="btn btn-sm btn-primary" href="${LAVORI_HREF}?lavoroId=${encodeURIComponent(row.id)}">Lavoro</a>`
      : `<a class="btn btn-sm btn-secondary" href="${DIARIO_HREF}">Diario</a>`;
    return `
      <tr>
        <td>${escapeHtml(row.data || '—')}</td>
        <td>${escapeHtml(getTerrenoLabel(row.terrenoId))}</td>
        <td><strong>${escapeHtml(row.tipoLavoro || '—')}</strong></td>
        <td>${escapeHtml(row.campagna || '—')}</td>
        <td>${escapeHtml(statoLabel(row))}</td>
        <td class="actions-cell">${azione}</td>
      </tr>
    `;
  }).join('');
  publishSeminativoTableData(buildTableData(visible));
}

async function loadLavorazioni() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  const data = await listLavorazioniCollegate({ includeLavori: hasManodopera });
  terreni = data.terreni || [];
  tipi = data.tipi || [];
  righe = data.righe || [];
  populateFilters();
  applyFilters();
}

function setupEventListeners() {
  ['filter-terreno', 'filter-tipo', 'filter-origine'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });
  const search = document.getElementById('filter-ricerca');
  if (search) {
    search.addEventListener('input', applyFilters);
    search.addEventListener('change', applyFilters);
  }
  const resetBtn = document.getElementById('btn-reset-filtri');
  if (resetBtn) resetBtn.addEventListener('click', resetFilters);
}

export async function initLavorazioniPage() {
  publishSeminativoTableData({
    pageType: PAGE_TYPE,
    summary: 'Caricamento dati in corso...',
    items: []
  });

  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[lavorazioni] Bootstrap failed:', err);
    throw err;
  }

  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;

  initializeTenantService();
  setupEventListeners();
  window.applyFilters = applyFilters;
  window.resetFilters = resetFilters;

  const auth = getAuthInstance();
  onAuthStateChanged(auth, async (user) => {
    if (!user) user = await resolveAuthUser(auth);
    if (!user) {
      window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
      return;
    }
    const db = getDb();
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
      return;
    }
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      console.warn('[lavorazioni] Tenant non disponibile');
      return;
    }
    const tenant = await getCurrentTenant().catch(() => null);
    const modules = Array.isArray(tenant?.modules) ? tenant.modules.slice() : [];
    hasManodopera = modules.some((m) => String(m || '').toLowerCase() === 'manodopera');
    if (!modules.some((m) => String(m || '').toLowerCase() === 'seminativo')) modules.push('seminativo');
    if (!modules.some((m) => String(m || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);
    await loadLavorazioni();
  });
}
