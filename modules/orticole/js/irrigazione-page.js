/**
 * Pagina Irrigazione: lavori e diario di tipo irrigazione, volume e metodo sulla campagna.
 * @module modules/orticole/js/irrigazione-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishOrticoleTableData } from './orticole-page-context.js';
import {
  deleteIrrigazioneOrticole,
  listRigheIrrigazione,
  saveIrrigazioneOrticole
} from '../services/irrigazione-service.js';
import {
  IRRIGAZIONE_METODO_LABELS,
  IRRIGAZIONE_METODI,
  metodoDaTipoLavoro
} from '../models/OrticolaIrrigazione.js';
import { applyDiarioVsLavoroCta } from '../../../core/config/manodopera-diario-gate.js';
import { etichettaTerrenoStorico, terreniOperativi } from '../../../shared/js/terreno-archivio.js';
import { htmlAzioniRegistro, isRegistroSolaLettura } from '../../../shared/js/storico-sola-lettura.js';

const DIARIO_HREF = '../../../core/attivita-standalone.html';
const LAVORI_HREF = '../../../core/admin/gestione-lavori-standalone.html';

let terreni = [];
let righe = [];
let visible = [];
let hasManodopera = false;
let editingRow = null;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTerrenoLabel(id) {
  const terreno = terreni.find((item) => item.id === id);
  if (!terreno) return '—';
  return etichettaTerrenoStorico(terreno, 'Terreno senza nome');
}

function campagnaLabel(row) {
  const coltura = row.colturaNome ? `${row.colturaNome} · ` : '';
  return `${coltura}${row.campagna || ''}`.trim();
}

function metodoLabel(value) {
  return IRRIGAZIONE_METODO_LABELS[value] || '—';
}

function syncTonyModules(modules) {
  if (window.Tony && typeof window.Tony.initContextWithModules === 'function') {
    window.Tony.initContextWithModules(modules);
    return;
  }
  if (typeof window.syncTonyModules === 'function') window.syncTonyModules(modules);
}

function fillSelect(el, options, placeholder) {
  if (!el) return;
  const current = el.value;
  el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` +
    options.map((opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
  if (current && Array.from(el.options).some((option) => option.value === current)) el.value = current;
}

function euro(value) {
  return value == null || value === '' ? '—' : Number(value).toFixed(2);
}

function volume(value) {
  return value == null || value === '' ? '—' : Number(value).toFixed(2);
}

function buildTableData(rows) {
  const items = rows.map((row) => {
    const irrigazione = row.irrigazione;
    return {
      id: irrigazione ? irrigazione.id : (row.lavoroId || row.attivitaId),
      source: row.source,
      data: row.data,
      campagna: campagnaLabel(row),
      campagnaId: row.campagnaId,
      terreno: getTerrenoLabel(row.terrenoId),
      tipoLavoro: row.tipoLavoro,
      metodo: irrigazione ? metodoLabel(irrigazione.metodo) : '',
      volumeM3: irrigazione ? irrigazione.volumeM3 : null,
      superficieEttari: irrigazione ? irrigazione.superficieEttari : null,
      costoTotale: irrigazione ? irrigazione.costoTotale : null
    };
  });
  return {
    pageType: 'irrigazione_orticole',
    summary: items.length
      ? `${items.length} irrigazion${items.length === 1 ? 'e' : 'i'} orticole`
      : 'Nessuna irrigazione orticole',
    items
  };
}

function applyFilters() {
  const terrenoId = document.getElementById('filter-terreno')?.value || '';
  const campagnaId = document.getElementById('filter-campagna')?.value || '';
  const ricerca = (document.getElementById('filter-ricerca')?.value || '').trim().toLowerCase();
  visible = righe.filter((row) => {
    if (terrenoId && row.terrenoId !== terrenoId) return false;
    if (campagnaId && row.campagnaId !== campagnaId) return false;
    if (ricerca) {
      const irrigazione = row.irrigazione;
      const blob = [
        getTerrenoLabel(row.terrenoId),
        campagnaLabel(row),
        row.tipoLavoro,
        row.data,
        irrigazione && metodoLabel(irrigazione.metodo)
      ].join(' ').toLowerCase();
      if (!blob.includes(ricerca)) return false;
    }
    return true;
  });
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('irrigazione-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('irrigazione-table');
  if (loadingDiv) loadingDiv.style.display = 'none';
  if (!visible.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    publishOrticoleTableData(buildTableData([]));
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';
  tbody.innerHTML = visible.map((row, index) => {
    const irrigazione = row.irrigazione;
    const ref = row.source === 'lavoro'
      ? `<a class="btn btn-sm btn-secondary" href="${LAVORI_HREF}?lavoroId=${encodeURIComponent(row.lavoroId)}">🔗 Vedi Lavoro</a>`
      : `<a class="btn btn-sm btn-secondary" href="${DIARIO_HREF}?attivitaId=${encodeURIComponent(row.attivitaId || '')}">🔗 Vedi Attività</a>`;
    const azioni = htmlAzioniRegistro(
      isRegistroSolaLettura({
        registro: irrigazione || row,
        terreno: terreni.find((item) => item.id === row.terrenoId)
      }),
      irrigazione
        ? `<button type="button" class="btn btn-sm btn-secondary" data-edit-row="${index}">Modifica</button>
         <button type="button" class="btn btn-sm btn-danger" data-delete-row="${index}">Elimina</button>`
        : `<button type="button" class="btn btn-sm btn-success" data-completa-row="${index}">Completa</button>`
    );
    return `<tr>
      <td>${escapeHtml(row.data || '—')}</td>
      <td>${escapeHtml(campagnaLabel(row) || '—')}</td>
      <td><strong>${escapeHtml(row.tipoLavoro || '—')}</strong></td>
      <td>${escapeHtml(getTerrenoLabel(row.terrenoId))}</td>
      <td>${escapeHtml(irrigazione ? metodoLabel(irrigazione.metodo) : '—')}</td>
      <td>${volume(irrigazione && irrigazione.volumeM3)}</td>
      <td>${irrigazione && irrigazione.superficieEttari != null ? escapeHtml(irrigazione.superficieEttari) : '—'}</td>
      <td>${irrigazione ? euro(irrigazione.costoTotale) : '—'}</td>
      <td class="actions-cell">${ref} ${azioni}</td>
    </tr>`;
  }).join('');
  publishOrticoleTableData(buildTableData(visible));
}

function populateFilters() {
  const campagne = [];
  const seen = new Set();
  righe.forEach((row) => {
    if (!row.campagnaId || seen.has(row.campagnaId)) return;
    seen.add(row.campagnaId);
    campagne.push({ value: row.campagnaId, label: campagnaLabel(row) });
  });
  fillSelect(document.getElementById('filter-terreno'), terreniOperativi(terreni).map((t) => ({
    value: t.id,
    label: getTerrenoLabel(t.id)
  })), 'Tutti i terreni');
  fillSelect(document.getElementById('filter-campagna'), campagne, 'Tutte le campagne');
  applyDiarioVsLavoroCta(document, hasManodopera);
}

function superficieDefault(row) {
  const irrigazione = row.irrigazione;
  if (irrigazione && irrigazione.superficieEttari != null && !Number.isNaN(irrigazione.superficieEttari)) {
    return irrigazione.superficieEttari;
  }
  if (row.superficieEttari != null && row.superficieEttari !== '') return row.superficieEttari;
  const terreno = terreni.find((item) => item.id === row.terrenoId);
  return terreno && terreno.superficie != null ? terreno.superficie : '';
}

function populateMetodoSelect(preferred) {
  const el = document.getElementById('irrigazione-metodo');
  if (!el) return;
  const opts = IRRIGAZIONE_METODI.map((value) => ({
    value,
    label: IRRIGAZIONE_METODO_LABELS[value] || value
  }));
  fillSelect(el, opts, 'Seleziona metodo');
  if (preferred && IRRIGAZIONE_METODI.indexOf(preferred) >= 0) el.value = preferred;
}

function closeModal() {
  const modal = document.getElementById('modal-irrigazione');
  if (modal) modal.style.display = 'none';
  editingRow = null;
}

function openModal(row) {
  if (!row) return;
  editingRow = row;
  const irrigazione = row.irrigazione;
  document.getElementById('irrigazione-id').value = irrigazione ? irrigazione.id || '' : '';
  const volumeEl = document.getElementById('irrigazione-volume');
  if (volumeEl) volumeEl.value = irrigazione && irrigazione.volumeM3 != null ? irrigazione.volumeM3 : '';
  const preferredMetodo = (irrigazione && irrigazione.metodo)
    || metodoDaTipoLavoro(row.tipoLavoro)
    || '';
  populateMetodoSelect(preferredMetodo);
  const superficie = document.getElementById('irrigazione-superficie');
  if (superficie) superficie.value = superficieDefault(row);
  const anagrafe = document.getElementById('irrigazione-superficie-anagrafe');
  if (anagrafe) anagrafe.checked = false;
  const note = document.getElementById('irrigazione-note');
  if (note) note.value = irrigazione ? irrigazione.note || '' : '';
  const mano = document.getElementById('irrigazione-costo-mano');
  const macchina = document.getElementById('irrigazione-costo-macchina');
  if (mano) mano.value = irrigazione ? Number(irrigazione.costoManodopera || 0).toFixed(2) : '0.00';
  if (macchina) macchina.value = irrigazione ? Number(irrigazione.costoMacchina || 0).toFixed(2) : '0.00';
  const proprietario = document.getElementById('irrigazione-proprietario-message');
  if (proprietario) proprietario.style.display = hasManodopera ? 'none' : '';
  const title = document.getElementById('modal-irrigazione-title');
  if (title) title.textContent = irrigazione ? 'Modifica irrigazione' : 'Completa irrigazione';
  const info = document.getElementById('irrigazione-contesto');
  if (info) {
    info.textContent = [
      row.data,
      row.tipoLavoro,
      getTerrenoLabel(row.terrenoId),
      campagnaLabel(row)
    ].filter(Boolean).join(' · ');
  }
  const modal = document.getElementById('modal-irrigazione');
  if (modal) modal.style.display = 'flex';
  prefillCosti(row, irrigazione);
}

async function prefillCosti(row, irrigazione) {
  if (irrigazione) return;
  try {
    const { getDatiPrecompilazioneTrattamento } = await import(resolvePath('../../vigneto/services/trattamenti-vigneto-service.js'));
    const prefill = await getDatiPrecompilazioneTrattamento(null, {
      lavoroId: row.lavoroId,
      attivitaId: row.attivitaId
    });
    const mano = document.getElementById('irrigazione-costo-mano');
    const macchina = document.getElementById('irrigazione-costo-macchina');
    if (mano) mano.value = (Number(prefill.costoManodopera) || 0).toFixed(2);
    if (macchina) macchina.value = (Number(prefill.costoMacchina) || 0).toFixed(2);
  } catch (err) {
    console.warn('[irrigazione] prefill costi:', err);
  }
}

function applySuperficieAnagrafe() {
  if (!editingRow) return;
  const terreno = terreni.find((item) => item.id === editingRow.terrenoId);
  const input = document.getElementById('irrigazione-superficie');
  const n = terreno && terreno.superficie != null ? parseFloat(terreno.superficie) : NaN;
  if (input && Number.isFinite(n) && n > 0) {
    input.value = String(Math.round(n * 100) / 100);
  }
}

async function onSubmit(event) {
  event.preventDefault();
  if (!editingRow) return;
  const row = editingRow;
  const irrigazione = row.irrigazione;
  try {
    await saveIrrigazioneOrticole({
      id: irrigazione ? irrigazione.id : null,
      campagnaId: row.campagnaId,
      terrenoId: row.terrenoId,
      lavoroId: row.lavoroId,
      attivitaId: row.attivitaId,
      data: row.data,
      tipoLavoro: row.tipoLavoro,
      volumeM3: document.getElementById('irrigazione-volume')?.value,
      metodo: document.getElementById('irrigazione-metodo')?.value,
      superficieEttari: document.getElementById('irrigazione-superficie')?.value || null,
      costoManodopera: document.getElementById('irrigazione-costo-mano')?.value,
      costoMacchina: document.getElementById('irrigazione-costo-macchina')?.value,
      note: document.getElementById('irrigazione-note')?.value || ''
    });
    closeModal();
    await loadRighe();
  } catch (err) {
    window.alert(err && err.message ? err.message : 'Salvataggio non riuscito');
  }
}

async function confirmDelete(index) {
  const row = visible[index];
  if (!row || !row.irrigazione || !row.irrigazione.id) return;
  if (!window.confirm('Eliminare i dati di questa irrigazione?')) return;
  try {
    await deleteIrrigazioneOrticole(row.irrigazione.id);
    await loadRighe();
  } catch (err) {
    window.alert(err && err.message ? err.message : 'Eliminazione non riuscita');
  }
}

export function openOrticolaIrrigazioneModal() {
  if (!editingRow && visible.length === 1 && !visible[0].irrigazione) {
    openModal(visible[0]);
    return;
  }
  if (!editingRow) {
    window.alert('Scegli Completa sulla riga del lavoro o dell\'attività da integrare.');
  }
}

async function loadRighe() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  const data = await listRigheIrrigazione({ includeLavori: hasManodopera });
  terreni = data.terreni || [];
  righe = data.righe || [];
  populateFilters();
  applyFilters();
}

function setupEventListeners() {
  ['filter-terreno', 'filter-campagna'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });
  const search = document.getElementById('filter-ricerca');
  if (search) search.addEventListener('input', applyFilters);
  const resetBtn = document.getElementById('btn-reset-filtri');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ['filter-terreno', 'filter-campagna', 'filter-ricerca'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      applyFilters();
    });
  }
  const listHost = document.querySelector('.table-container');
  if (listHost) {
    listHost.addEventListener('click', (event) => {
      const completa = event.target.closest('[data-completa-row]');
      const edit = event.target.closest('[data-edit-row]');
      const remove = event.target.closest('[data-delete-row]');
      if (completa) openModal(visible[Number(completa.getAttribute('data-completa-row'))]);
      if (edit) openModal(visible[Number(edit.getAttribute('data-edit-row'))]);
      if (remove) confirmDelete(Number(remove.getAttribute('data-delete-row')));
    });
  }
  const form = document.getElementById('form-irrigazione');
  if (form) form.addEventListener('submit', onSubmit);
  const closeBtn = document.getElementById('btn-close-irrigazione-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  const anagrafe = document.getElementById('irrigazione-superficie-anagrafe');
  if (anagrafe) {
    anagrafe.addEventListener('change', () => {
      if (anagrafe.checked) applySuperficieAnagrafe();
    });
  }
  window.openOrticolaIrrigazioneModal = openOrticolaIrrigazioneModal;
  window.applyFilters = applyFilters;
}

export async function initIrrigazionePage() {
  publishOrticoleTableData({
    pageType: 'irrigazione_orticole',
    summary: 'Caricamento dati in corso...',
    items: []
  });
  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[irrigazione] Bootstrap failed:', err);
    throw err;
  }
  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;
  initializeTenantService();
  setupEventListeners();

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
    if (!tenantId) return;
    const tenant = await getCurrentTenant().catch(() => null);
    const modules = resolveEffectiveModules(tenant);
    hasManodopera = modules.some((item) => String(item || '').toLowerCase() === 'manodopera');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'orticole')) modules.push('orticole');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);
    await loadRighe();
  });
}
