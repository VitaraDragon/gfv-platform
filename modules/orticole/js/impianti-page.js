/**
 * Pagina Semina e trapianto: lista eventi + modal, collegati a una campagna.
 * @module modules/orticole/js/impianti-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishOrticoleTableData } from './orticole-page-context.js';
import {
  IMPIANTO_TIPI,
  SEMINA_UNITA_DOSE
} from '../models/OrticolaImpianto.js';
import { listTerreniOrticole } from '../services/orticole-service.js';
import { etichettaTerrenoStorico, isTerrenoArchiviato } from '../../../shared/js/terreno-archivio.js';
import { getAllOrticole } from '../services/orticole-service.js';
import {
  getAllSemine,
  createSemina,
  updateSemina,
  deleteSemina
} from '../services/impianti-service.js';
import {
  getVarietaPerColtura,
  addVarietaPersonalizzata
} from '../services/varieta-orticole-service.js';

const PAGE_TYPE = 'impianto_orticole';

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
  return etichettaTerrenoStorico(t, 'Terreno senza nome');
}

function campagnaSuTerrenoAttivo(campagna) {
  const terreno = getTerrenoById(campagna && campagna.terrenoId);
  return !!(terreno && !isTerrenoArchiviato(terreno));
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

function tipoImpiantoOf(row) {
  return row?.tipoImpianto || 'trapianto';
}

function dataImpiantoOf(row) {
  return row?.dataImpianto || row?.dataSemina || null;
}

function tipoImpiantoLabel(value) {
  if (value === 'semina') return 'Semina';
  if (value === 'trapianto') return 'Trapianto';
  return value || '—';
}

function formatDoseOrDensita(row) {
  const tipo = tipoImpiantoOf(row);
  if (tipo === 'trapianto') {
    if (row.densitaPianteHa == null || Number.isNaN(Number(row.densitaPianteHa))) return '—';
    return `${Number(row.densitaPianteHa)} piante/ha`;
  }
  if (row.doseSeme == null || Number.isNaN(Number(row.doseSeme))) return '—';
  return `${Number(row.doseSeme)} ${row.unitaDose || 'kg/ha'}`;
}

function syncTipoImpiantoFields() {
  const tipo = document.getElementById('semina-tipo-impianto')?.value || 'trapianto';
  const isSemina = tipo === 'semina';
  const doseGroup = document.getElementById('group-dose-seme');
  const unitaGroup = document.getElementById('group-unita-dose');
  const densitaGroup = document.getElementById('group-densita');
  if (doseGroup) doseGroup.style.display = isSemina ? '' : 'none';
  if (unitaGroup) unitaGroup.style.display = isSemina ? '' : 'none';
  if (densitaGroup) densitaGroup.style.display = isSemina ? 'none' : '';
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

function populateCampagnaSelects(idCampagnaCorrente) {
  const etichetta = (c) => ({ value: c.id, label: campagnaLabel(c) });
  const attive = campagne.filter((c) => campagnaSuTerrenoAttivo(c));
  const perForm = campagne.filter((c) => c.id === idCampagnaCorrente || campagnaSuTerrenoAttivo(c));
  fillSelect(document.getElementById('semina-campagna'), perForm.map(etichetta), 'Seleziona campagna');
  fillSelect(document.getElementById('filter-campagna'), attive.map(etichetta), 'Tutte le campagne');
}

function populateUnitaSelect() {
  const opts = SEMINA_UNITA_DOSE.map((u) => ({ value: u, label: u }));
  fillSelect(document.getElementById('semina-unita'), opts, 'Unità');
  const el = document.getElementById('semina-unita');
  if (el && !el.value) el.value = 'kg/ha';
}

function populateTipoImpiantoSelect(preferred) {
  const el = document.getElementById('semina-tipo-impianto');
  if (!el) return;
  const opts = IMPIANTO_TIPI.map((t) => ({ value: t, label: tipoImpiantoLabel(t) }));
  fillSelect(el, opts, 'Tipo');
  el.value = preferred && IMPIANTO_TIPI.indexOf(preferred) >= 0 ? preferred : 'trapianto';
  syncTipoImpiantoFields();
}

function buildTableData(items) {
  const n = items.length;
  const total = allSemine.length;
  let summary = n === 1 ? '1 impianto' : `${n} impianti`;
  if (total !== n) summary += ` (filtrate da ${total})`;
  return {
    pageType: PAGE_TYPE,
    summary,
    items: items.map((row) => {
      const campagna = getCampagnaById(row.campagnaId);
      const tipo = tipoImpiantoOf(row);
      return {
        id: row.id,
        campagnaId: row.campagnaId,
        campagna: campagna ? campagna.campagna : (row.campagna || ''),
        coltura: campagna ? (campagna.colturaNome || '') : (row.colturaNome || ''),
        terreno: getTerrenoLabel(getTerrenoById((campagna && campagna.terrenoId) || row.terrenoId)),
        dataImpianto: formatDate(dataImpiantoOf(row)),
        tipoImpianto: tipo,
        varieta: row.varieta || '',
        doseSeme: tipo === 'semina' ? row.doseSeme : null,
        unitaDose: tipo === 'semina' ? (row.unitaDose || 'kg/ha') : null,
        densitaPianteHa: tipo === 'trapianto' ? row.densitaPianteHa : null
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
        tipoImpiantoLabel(tipoImpiantoOf(row)),
        formatDate(dataImpiantoOf(row))
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
    publishOrticoleTableData(buildTableData([]));
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';
  tbody.innerHTML = visibleSemine.map((row) => {
    const campagna = getCampagnaById(row.campagnaId);
    const tipo = tipoImpiantoOf(row);
    return `
      <tr>
        <td>${escapeHtml(formatDate(dataImpiantoOf(row)))}</td>
        <td><strong>${escapeHtml(campagnaLabel(campagna) || row.colturaNome || '—')}</strong></td>
        <td>${escapeHtml(tipoImpiantoLabel(tipo))}</td>
        <td>${escapeHtml(row.varieta || '—')}</td>
        <td>${escapeHtml(formatDoseOrDensita(row))}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-sm btn-primary" data-edit="${escapeHtml(row.id)}">Modifica</button>
          <button type="button" class="btn btn-sm btn-danger" data-delete="${escapeHtml(row.id)}">Elimina</button>
        </td>
      </tr>
    `;
  }).join('');
  publishOrticoleTableData(buildTableData(visibleSemine));
}

function readFormData() {
  const tipo = document.getElementById('semina-tipo-impianto')?.value || 'trapianto';
  const doseRaw = document.getElementById('semina-dose')?.value;
  const densitaRaw = document.getElementById('semina-densita')?.value;
  const dataImpianto = document.getElementById('semina-data')?.value || null;
  return {
    campagnaId: document.getElementById('semina-campagna')?.value || null,
    dataImpianto,
    dataSemina: dataImpianto,
    tipoImpianto: tipo,
    varieta: document.getElementById('semina-varieta')?.value || null,
    doseSeme: tipo === 'semina' ? (doseRaw === '' ? null : doseRaw) : null,
    unitaDose: tipo === 'semina' ? (document.getElementById('semina-unita')?.value || 'kg/ha') : null,
    densitaPianteHa: tipo === 'trapianto' ? (densitaRaw === '' ? null : densitaRaw) : null,
    note: document.getElementById('semina-note')?.value || ''
  };
}

function fillForm(row) {
  document.getElementById('semina-id').value = row?.id || '';
  document.getElementById('semina-campagna').value = row?.campagnaId || '';
  const tipo = tipoImpiantoOf(row) || 'trapianto';
  populateTipoImpiantoSelect(tipo);
  document.getElementById('semina-data').value = dataImpiantoOf(row) ? formatDate(dataImpiantoOf(row)) : todayInput();
  const campagna = getCampagnaById(row?.campagnaId);
  const preferred = row?.varieta || (campagna && campagna.varieta) || '';
  refreshVarietaSelect(preferred === '—' ? '' : preferred);
  document.getElementById('semina-dose').value = row?.doseSeme != null ? row.doseSeme : '';
  document.getElementById('semina-unita').value = row?.unitaDose || 'kg/ha';
  document.getElementById('semina-densita').value = row?.densitaPianteHa != null ? row.densitaPianteHa : '';
  document.getElementById('semina-note').value = row?.note || '';
  syncTipoImpiantoFields();
}

function openOrticolaImpiantoModal(id) {
  const form = document.getElementById('orticole-semina-form');
  const modal = document.getElementById('orticole-semina-modal');
  const title = document.getElementById('orticole-semina-modal-title');
  if (form) form.reset();
  populateUnitaSelect();
  if (id) {
    const row = allSemine.find((r) => r.id === id);
    if (!row) return;
    currentEditingId = id;
    populateCampagnaSelects(row.campagnaId);
    if (title) title.textContent = 'Modifica impianto';
    fillForm(row);
  } else {
    currentEditingId = null;
    populateCampagnaSelects();
    if (title) title.textContent = 'Nuovo impianto';
    fillForm({ dataImpianto: todayInput(), tipoImpianto: 'trapianto', unitaDose: 'kg/ha' });
  }
  if (modal) modal.classList.add('active');
}

function closeOrticolaImpiantoModal() {
  const modal = document.getElementById('orticole-semina-modal');
  if (modal) modal.classList.remove('active');
  currentEditingId = null;
}

function openVarietaModal() {
  if (!selectedCampagna()) {
    alert('Seleziona prima la campagna');
    return;
  }
  const modal = document.getElementById('orticole-varieta-modal');
  const input = document.getElementById('nuova-varieta');
  if (input) input.value = '';
  if (modal) modal.classList.add('active');
  if (input) input.focus();
}

function closeVarietaModal() {
  const modal = document.getElementById('orticole-varieta-modal');
  if (modal) modal.classList.remove('active');
  const form = document.getElementById('orticole-varieta-form');
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
  if (campagna?.tipoImpianto && !currentEditingId) {
    populateTipoImpiantoSelect(campagna.tipoImpianto);
  }
}

async function loadSemine() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  campagne = await getAllOrticole();
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
    closeOrticolaImpiantoModal();
    await loadSemine();
  } catch (error) {
    console.error('[impianti] Errore salvataggio:', error);
    alert(error.message || 'Errore nel salvataggio dell\'impianto');
  }
}

async function confirmDelete(id) {
  if (!confirm('Eliminare questo impianto?')) return;
  try {
    await deleteSemina(id);
    await loadSemine();
  } catch (error) {
    console.error('[impianti] Errore eliminazione:', error);
    alert(error.message || 'Errore nell\'eliminazione dell\'impianto');
  }
}

function setupEventListeners() {
  const form = document.getElementById('orticole-semina-form');
  if (form) form.addEventListener('submit', onSubmit);
  const modal = document.getElementById('orticole-semina-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'orticole-semina-modal') closeOrticolaImpiantoModal();
    });
  }
  const campagnaSelect = document.getElementById('semina-campagna');
  if (campagnaSelect) campagnaSelect.addEventListener('change', onCampagnaChange);
  const tipoSelect = document.getElementById('semina-tipo-impianto');
  if (tipoSelect) tipoSelect.addEventListener('change', syncTipoImpiantoFields);
  const addBtn = document.getElementById('btn-add-varieta');
  if (addBtn) addBtn.addEventListener('click', openVarietaModal);
  const varietaForm = document.getElementById('orticole-varieta-form');
  if (varietaForm) varietaForm.addEventListener('submit', onAddVarieta);
  const closeVarietaBtn = document.getElementById('btn-close-varieta-modal');
  if (closeVarietaBtn) closeVarietaBtn.addEventListener('click', closeVarietaModal);
  const cancelVarietaBtn = document.getElementById('btn-cancel-varieta');
  if (cancelVarietaBtn) cancelVarietaBtn.addEventListener('click', closeVarietaModal);
  const varietaModal = document.getElementById('orticole-varieta-modal');
  if (varietaModal) {
    varietaModal.addEventListener('click', (e) => {
      if (e.target.id === 'orticole-varieta-modal') closeVarietaModal();
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
  if (newBtn) newBtn.addEventListener('click', () => openOrticolaImpiantoModal(null));
  const closeBtn = document.getElementById('btn-close-semina-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeOrticolaImpiantoModal);
  const cancelBtn = document.getElementById('btn-cancel-semina');
  if (cancelBtn) cancelBtn.addEventListener('click', closeOrticolaImpiantoModal);
  const listHost = document.querySelector('.table-container');
  if (listHost) {
    listHost.addEventListener('click', (e) => {
      const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
      const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
      if (editId) openOrticolaImpiantoModal(editId);
      if (deleteId) confirmDelete(deleteId);
    });
  }
}

export async function initImpiantiPage() {
  publishOrticoleTableData({
    pageType: PAGE_TYPE,
    summary: 'Caricamento dati in corso...',
    items: []
  });

  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[impianti] Bootstrap failed:', err);
    throw err;
  }

  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;

  initializeTenantService();
  populateUnitaSelect();
  setupEventListeners();

  window.openOrticolaImpiantoModal = openOrticolaImpiantoModal;
  window.closeOrticolaImpiantoModal = closeOrticolaImpiantoModal;
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
      console.warn('[impianti] Tenant non disponibile');
      return;
    }
    const tenant = await getCurrentTenant().catch(() => null);
    const modules = resolveEffectiveModules(tenant);
    if (!modules.some((m) => String(m || '').toLowerCase() === 'orticole')) modules.push('orticole');
    if (!modules.some((m) => String(m || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);

    terreni = await listTerreniOrticole({ includiArchiviati: true });
    await loadSemine();
  });
}
