/**
 * Pagina Semina: lista eventi + modal, collegati a una campagna.
 * @module modules/seminativo/js/semine-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import { SEMINA_UNITA_DOSE } from '../models/SeminativoSemina.js';
import { listTerreniSeminativo } from '../services/seminativi-service.js';
import { getAllSeminativi } from '../services/seminativi-service.js';
import {
  getAllSemine,
  createSemina,
  updateSemina,
  deleteSemina
} from '../services/semine-service.js';
import {
  getVarietaPerColtura,
  addVarietaPersonalizzata
} from '../services/varieta-seminativo-service.js';

const PAGE_TYPE = 'semina_seminativo';

let terreni = [];
let campagne = [];
let allSemine = [];
let visibleSemine = [];
let currentEditingId = null;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTerrenoById(id) {
  return terreni.find((t) => t.id === id) || null;
}

function getTerrenoLabel(t) {
  if (!t) return '—';
  const nome = String(t.nome || '').trim();
  const podere = String(t.podere || '').trim();
  if (nome && podere) return `${nome} – ${podere}`;
  return nome || podere || 'Terreno senza nome';
}

function getCampagnaById(id) {
  return campagne.find((c) => c.id === id) || null;
}

function campagnaLabel(campagna) {
  if (!campagna) return 'Campagna';
  const terreno = getTerrenoLabel(getTerrenoById(campagna.terrenoId));
  return [campagna.colturaNome, campagna.campagna, terreno].filter(Boolean).join(' · ');
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function formatDose(row) {
  if (row.doseSeme == null || Number.isNaN(Number(row.doseSeme))) return '—';
  return `${Number(row.doseSeme)} ${row.unitaDose || 'kg/ha'}`;
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

function selectedCampagna() {
  return getCampagnaById(document.getElementById('semina-campagna')?.value);
}

function refreshVarietaSelect(preferredValue) {
  const el = document.getElementById('semina-varieta');
  const campagna = selectedCampagna();
  const nome = campagna ? (campagna.colturaNome || '') : '';
  const names = nome ? getVarietaPerColtura(nome) : [];
  const preferred = preferredValue != null ? String(preferredValue).trim() : '';
  const opts = names.map((name) => ({ value: name, label: name }));
  if (preferred && !names.some((name) => name.toLowerCase() === preferred.toLowerCase())) {
    opts.push({ value: preferred, label: preferred });
  }
  fillSelect(el, opts, nome ? 'Seleziona varietà' : 'Prima scegli la campagna');
  if (!el || !preferred) return;
  const match = Array.from(el.options).find((option) => (
    option.value.toLowerCase() === preferred.toLowerCase()
  ));
  if (match) el.value = match.value;
}

function populateCampagnaSelects() {
  const opts = campagne.map((c) => ({ value: c.id, label: campagnaLabel(c) }));
  fillSelect(document.getElementById('semina-campagna'), opts, 'Seleziona campagna');
  fillSelect(document.getElementById('filter-campagna'), opts, 'Tutte le campagne');
}

function populateUnitaSelect() {
  const opts = SEMINA_UNITA_DOSE.map((u) => ({ value: u, label: u }));
  fillSelect(document.getElementById('semina-unita'), opts, 'Unità');
  const el = document.getElementById('semina-unita');
  if (el && !el.value) el.value = 'kg/ha';
}

function buildTableData(items) {
  const n = items.length;
  const total = allSemine.length;
  let summary = n === 1 ? '1 semina' : `${n} semine`;
  if (total !== n) summary += ` (filtrate da ${total})`;
  return {
    pageType: PAGE_TYPE,
    summary,
    items: items.map((row) => {
      const campagna = getCampagnaById(row.campagnaId);
      return {
        id: row.id,
        campagnaId: row.campagnaId,
        campagna: campagna ? campagna.campagna : (row.campagna || ''),
        coltura: campagna ? (campagna.colturaNome || '') : (row.colturaNome || ''),
        terreno: getTerrenoLabel(getTerrenoById((campagna && campagna.terrenoId) || row.terrenoId)),
        dataSemina: formatDate(row.dataSemina),
        varieta: row.varieta || '',
        doseSeme: row.doseSeme,
        unitaDose: row.unitaDose || 'kg/ha'
      };
    })
  };
}

function applyFilters() {
  const campagnaId = document.getElementById('filter-campagna')?.value || '';
  const ricerca = String(document.getElementById('filter-ricerca')?.value || '').toLowerCase().trim();
  visibleSemine = allSemine.filter((row) => {
    if (campagnaId && row.campagnaId !== campagnaId) return false;
    if (ricerca) {
      const campagna = getCampagnaById(row.campagnaId);
      const blob = [
        campagnaLabel(campagna),
        row.varieta,
        row.colturaNome,
        formatDate(row.dataSemina)
      ].join(' ').toLowerCase();
      if (!blob.includes(ricerca)) return false;
    }
    return true;
  });
  renderTable();
}

function resetFilters() {
  ['filter-campagna', 'filter-ricerca'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyFilters();
}

function renderTable() {
  const tbody = document.getElementById('semine-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('semine-table');
  if (loadingDiv) loadingDiv.style.display = 'none';

  if (!visibleSemine.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    publishSeminativoTableData(buildTableData([]));
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';
  tbody.innerHTML = visibleSemine.map((row) => {
    const campagna = getCampagnaById(row.campagnaId);
    return `
      <tr>
        <td>${escapeHtml(formatDate(row.dataSemina))}</td>
        <td><strong>${escapeHtml(campagnaLabel(campagna) || row.colturaNome || '—')}</strong></td>
        <td>${escapeHtml(row.varieta || '—')}</td>
        <td>${escapeHtml(formatDose(row))}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-sm btn-primary" data-edit="${escapeHtml(row.id)}">Modifica</button>
          <button type="button" class="btn btn-sm btn-danger" data-delete="${escapeHtml(row.id)}">Elimina</button>
        </td>
      </tr>
    `;
  }).join('');
  publishSeminativoTableData(buildTableData(visibleSemine));
}

function readFormData() {
  const doseRaw = document.getElementById('semina-dose')?.value;
  return {
    campagnaId: document.getElementById('semina-campagna')?.value || null,
    dataSemina: document.getElementById('semina-data')?.value || null,
    varieta: document.getElementById('semina-varieta')?.value || null,
    doseSeme: doseRaw === '' ? null : doseRaw,
    unitaDose: document.getElementById('semina-unita')?.value || 'kg/ha',
    note: document.getElementById('semina-note')?.value || ''
  };
}

function fillForm(row) {
  document.getElementById('semina-id').value = row?.id || '';
  document.getElementById('semina-campagna').value = row?.campagnaId || '';
  document.getElementById('semina-data').value = row?.dataSemina ? formatDate(row.dataSemina) : todayInput();
  const campagna = getCampagnaById(row?.campagnaId);
  const preferred = row?.varieta || (campagna && campagna.varieta) || '';
  refreshVarietaSelect(preferred === '—' ? '' : preferred);
  document.getElementById('semina-dose').value = row?.doseSeme != null ? row.doseSeme : '';
  document.getElementById('semina-unita').value = row?.unitaDose || 'kg/ha';
  document.getElementById('semina-note').value = row?.note || '';
}

function openSeminativoSeminaModal(id) {
  const form = document.getElementById('seminativo-semina-form');
  const modal = document.getElementById('seminativo-semina-modal');
  const title = document.getElementById('seminativo-semina-modal-title');
  if (form) form.reset();
  populateCampagnaSelects();
  populateUnitaSelect();
  if (id) {
    const row = allSemine.find((r) => r.id === id);
    if (!row) return;
    currentEditingId = id;
    if (title) title.textContent = 'Modifica semina';
    fillForm(row);
  } else {
    currentEditingId = null;
    if (title) title.textContent = 'Nuova semina';
    fillForm({ dataSemina: todayInput(), unitaDose: 'kg/ha' });
  }
  if (modal) modal.classList.add('active');
}

function closeSeminativoSeminaModal() {
  const modal = document.getElementById('seminativo-semina-modal');
  if (modal) modal.classList.remove('active');
  currentEditingId = null;
}

function openVarietaModal() {
  if (!selectedCampagna()) {
    alert('Seleziona prima la campagna');
    return;
  }
  const modal = document.getElementById('seminativo-varieta-modal');
  const input = document.getElementById('nuova-varieta');
  if (input) input.value = '';
  if (modal) modal.classList.add('active');
  if (input) input.focus();
}

function closeVarietaModal() {
  const modal = document.getElementById('seminativo-varieta-modal');
  if (modal) modal.classList.remove('active');
  const form = document.getElementById('seminativo-varieta-form');
  if (form) form.reset();
}

function onAddVarieta(event) {
  event.preventDefault();
  const campagna = selectedCampagna();
  const nuova = document.getElementById('nuova-varieta')?.value || '';
  if (!campagna || !campagna.colturaNome) {
    alert('Seleziona prima la campagna');
    return;
  }
  if (!String(nuova).trim()) {
    alert('Inserisci il nome della varietà');
    return;
  }
  if (!addVarietaPersonalizzata(campagna.colturaNome, nuova)) {
    alert('Non riesco a salvare la varietà su questo browser');
    return;
  }
  refreshVarietaSelect(String(nuova).trim());
  closeVarietaModal();
}

function onCampagnaChange() {
  const campagna = selectedCampagna();
  refreshVarietaSelect(campagna?.varieta || '');
}

async function loadSemine() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  campagne = await getAllSeminativi();
  allSemine = await getAllSemine();
  populateCampagnaSelects();
  applyFilters();
}

async function onSubmit(event) {
  event.preventDefault();
  const data = readFormData();
  try {
    if (currentEditingId) await updateSemina(currentEditingId, data);
    else await createSemina(data);
    closeSeminativoSeminaModal();
    await loadSemine();
  } catch (error) {
    console.error('[SEMINE] Errore salvataggio:', error);
    alert(error.message || 'Errore nel salvataggio della semina');
  }
}

async function confirmDelete(id) {
  if (!confirm('Eliminare questa semina?')) return;
  try {
    await deleteSemina(id);
    await loadSemine();
  } catch (error) {
    console.error('[SEMINE] Errore eliminazione:', error);
    alert(error.message || 'Errore nell\'eliminazione della semina');
  }
}

function setupEventListeners() {
  const form = document.getElementById('seminativo-semina-form');
  if (form) form.addEventListener('submit', onSubmit);
  const modal = document.getElementById('seminativo-semina-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'seminativo-semina-modal') closeSeminativoSeminaModal();
    });
  }
  const campagnaSelect = document.getElementById('semina-campagna');
  if (campagnaSelect) campagnaSelect.addEventListener('change', onCampagnaChange);
  const addBtn = document.getElementById('btn-add-varieta');
  if (addBtn) addBtn.addEventListener('click', openVarietaModal);
  const varietaForm = document.getElementById('seminativo-varieta-form');
  if (varietaForm) varietaForm.addEventListener('submit', onAddVarieta);
  const closeVarietaBtn = document.getElementById('btn-close-varieta-modal');
  if (closeVarietaBtn) closeVarietaBtn.addEventListener('click', closeVarietaModal);
  const cancelVarietaBtn = document.getElementById('btn-cancel-varieta');
  if (cancelVarietaBtn) cancelVarietaBtn.addEventListener('click', closeVarietaModal);
  const varietaModal = document.getElementById('seminativo-varieta-modal');
  if (varietaModal) {
    varietaModal.addEventListener('click', (e) => {
      if (e.target.id === 'seminativo-varieta-modal') closeVarietaModal();
    });
  }
  const filterCampagna = document.getElementById('filter-campagna');
  if (filterCampagna) filterCampagna.addEventListener('change', applyFilters);
  const search = document.getElementById('filter-ricerca');
  if (search) {
    search.addEventListener('input', applyFilters);
    search.addEventListener('change', applyFilters);
  }
  const resetBtn = document.getElementById('btn-reset-filtri');
  if (resetBtn) resetBtn.addEventListener('click', resetFilters);
  const newBtn = document.getElementById('btn-nuova-semina');
  if (newBtn) newBtn.addEventListener('click', () => openSeminativoSeminaModal(null));
  const closeBtn = document.getElementById('btn-close-semina-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeSeminativoSeminaModal);
  const cancelBtn = document.getElementById('btn-cancel-semina');
  if (cancelBtn) cancelBtn.addEventListener('click', closeSeminativoSeminaModal);
  const listHost = document.querySelector('.table-container');
  if (listHost) {
    listHost.addEventListener('click', (e) => {
      const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
      const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
      if (editId) openSeminativoSeminaModal(editId);
      if (deleteId) confirmDelete(deleteId);
    });
  }
}

export async function initSeminePage() {
  publishSeminativoTableData({
    pageType: PAGE_TYPE,
    summary: 'Caricamento dati in corso...',
    items: []
  });

  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[semine] Bootstrap failed:', err);
    throw err;
  }

  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;

  initializeTenantService();
  populateUnitaSelect();
  setupEventListeners();

  window.openSeminativoSeminaModal = openSeminativoSeminaModal;
  window.closeSeminativoSeminaModal = closeSeminativoSeminaModal;
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
      console.warn('[semine] Tenant non disponibile');
      return;
    }
    const tenant = await getCurrentTenant().catch(() => null);
    const modules = Array.isArray(tenant?.modules) ? tenant.modules.slice() : [];
    if (!modules.some((m) => String(m || '').toLowerCase() === 'seminativo')) modules.push('seminativo');
    if (!modules.some((m) => String(m || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);

    terreni = await listTerreniSeminativo();
    await loadSemine();
  });
}
