/**
 * Pagina Raccolta: lavori e diario di categoria Raccolta, quintali sulla campagna.
 * @module modules/seminativo/js/raccolta-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import {
  deleteRaccoltaSeminativo,
  listRigheRaccolta,
  saveRaccoltaSeminativo
} from '../services/raccolta-service.js';
import {
  RACCOLTA_DESTINAZIONE_LABELS,
  resaQliHa
} from '../models/SeminativoRaccolta.js';
import { applyDiarioVsLavoroCta } from '../../../core/config/manodopera-diario-gate.js';

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
  const nome = String(terreno.nome || '').trim();
  const podere = String(terreno.podere || '').trim();
  if (nome && podere) return `${nome} – ${podere}`;
  return nome || podere || 'Terreno senza nome';
}

function campagnaLabel(row) {
  const coltura = row.colturaNome ? `${row.colturaNome} · ` : '';
  return `${coltura}${row.campagna || ''}`.trim();
}

function destinazioneLabel(value) {
  return RACCOLTA_DESTINAZIONE_LABELS[value] || '—';
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

function qli(value) {
  return value == null || value === '' ? '—' : Number(value).toFixed(2);
}

function buildTableData(rows) {
  const items = rows.map((row) => {
    const raccolta = row.raccolta;
    return {
      id: raccolta ? raccolta.id : (row.lavoroId || row.attivitaId),
      source: row.source,
      data: row.data,
      campagna: campagnaLabel(row),
      campagnaId: row.campagnaId,
      terreno: getTerrenoLabel(row.terrenoId),
      tipoLavoro: row.tipoLavoro,
      varieta: row.varieta || '',
      quantitaQli: raccolta ? raccolta.quantitaQli : null,
      resaQliHa: raccolta ? raccolta.resaQliHa : null,
      destinazione: raccolta ? destinazioneLabel(raccolta.destinazione) : '',
      costoTotale: raccolta ? raccolta.costoTotale : null
    };
  });
  return {
    pageType: 'raccolta_seminativo',
    summary: items.length
      ? `${items.length} raccolt${items.length === 1 ? 'a' : 'e'} seminativo`
      : 'Nessuna raccolta seminativo',
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
      const raccolta = row.raccolta;
      const blob = [
        getTerrenoLabel(row.terrenoId),
        campagnaLabel(row),
        row.tipoLavoro,
        row.varieta,
        row.data,
        raccolta && destinazioneLabel(raccolta.destinazione)
      ].join(' ').toLowerCase();
      if (!blob.includes(ricerca)) return false;
    }
    return true;
  });
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('raccolta-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('raccolta-table');
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
  tbody.innerHTML = visible.map((row, index) => {
    const raccolta = row.raccolta;
    const ref = row.source === 'lavoro'
      ? `<a class="btn btn-sm btn-secondary" href="${LAVORI_HREF}?lavoroId=${encodeURIComponent(row.lavoroId)}">🔗 Vedi Lavoro</a>`
      : `<a class="btn btn-sm btn-secondary" href="${DIARIO_HREF}?attivitaId=${encodeURIComponent(row.attivitaId || '')}">🔗 Vedi Attività</a>`;
    const azioni = raccolta
      ? `<button type="button" class="btn btn-sm btn-secondary" data-edit-row="${index}">Modifica</button>
         <button type="button" class="btn btn-sm btn-danger" data-delete-row="${index}">Elimina</button>`
      : `<button type="button" class="btn btn-sm btn-success" data-completa-row="${index}">Completa</button>`;
    return `<tr>
      <td>${escapeHtml(row.data || '—')}</td>
      <td>${escapeHtml(campagnaLabel(row) || '—')}</td>
      <td><strong>${escapeHtml(row.tipoLavoro || '—')}</strong></td>
      <td>${escapeHtml(getTerrenoLabel(row.terrenoId))}</td>
      <td>${qli(raccolta && raccolta.quantitaQli)}</td>
      <td>${raccolta && raccolta.quantitaEttari != null ? escapeHtml(raccolta.quantitaEttari) : '—'}</td>
      <td>${qli(raccolta && raccolta.resaQliHa)}</td>
      <td>${escapeHtml(raccolta ? destinazioneLabel(raccolta.destinazione) : '—')}</td>
      <td>${raccolta ? euro(raccolta.costoTotale) : '—'}</td>
      <td>${ref}</td>
      <td class="actions-cell">${azioni}</td>
    </tr>`;
  }).join('');
  publishSeminativoTableData(buildTableData(visible));
}

function populateFilters() {
  const campagne = [];
  const seen = new Set();
  righe.forEach((row) => {
    if (!row.campagnaId || seen.has(row.campagnaId)) return;
    seen.add(row.campagnaId);
    campagne.push({ value: row.campagnaId, label: campagnaLabel(row) });
  });
  fillSelect(document.getElementById('filter-terreno'), terreni.map((t) => ({
    value: t.id,
    label: getTerrenoLabel(t.id)
  })), 'Tutti i terreni');
  fillSelect(document.getElementById('filter-campagna'), campagne, 'Tutte le campagne');
  applyDiarioVsLavoroCta(document, hasManodopera);
}

function superficieDefault(row) {
  const raccolta = row.raccolta;
  if (raccolta && raccolta.quantitaEttari != null && !Number.isNaN(raccolta.quantitaEttari)) {
    return raccolta.quantitaEttari;
  }
  if (row.superficieEttari != null && row.superficieEttari !== '') return row.superficieEttari;
  const terreno = terreni.find((item) => item.id === row.terrenoId);
  return terreno && terreno.superficie != null ? terreno.superficie : '';
}

function aggiornaResa() {
  const qliValue = parseFloat(document.getElementById('raccolta-quantita')?.value);
  const ha = parseFloat(document.getElementById('raccolta-superficie')?.value);
  const resa = resaQliHa(qliValue, ha);
  const box = document.getElementById('raccolta-resa-info');
  const label = document.getElementById('raccolta-resa');
  if (label) label.textContent = resa == null ? '—' : `${resa.toFixed(2)} qli/ha`;
  if (box) box.style.display = resa == null ? 'none' : 'block';
}

function closeModal() {
  const modal = document.getElementById('modal-raccolta');
  if (modal) modal.style.display = 'none';
  editingRow = null;
}

function openModal(row) {
  if (!row) return;
  editingRow = row;
  const raccolta = row.raccolta;
  document.getElementById('raccolta-id').value = raccolta ? raccolta.id || '' : '';
  const varieta = document.getElementById('raccolta-varieta');
  if (varieta) varieta.value = (raccolta && raccolta.varieta) || row.varieta || '';
  const quantita = document.getElementById('raccolta-quantita');
  if (quantita) quantita.value = raccolta && raccolta.quantitaQli != null ? raccolta.quantitaQli : '';
  const superficie = document.getElementById('raccolta-superficie');
  if (superficie) superficie.value = superficieDefault(row);
  const anagrafe = document.getElementById('raccolta-superficie-anagrafe');
  if (anagrafe) anagrafe.checked = false;
  const destinazione = document.getElementById('raccolta-destinazione');
  if (destinazione) destinazione.value = raccolta && raccolta.destinazione ? raccolta.destinazione : '';
  const note = document.getElementById('raccolta-note');
  if (note) note.value = raccolta ? raccolta.note || '' : '';
  const mano = document.getElementById('raccolta-costo-mano');
  const macchina = document.getElementById('raccolta-costo-macchina');
  if (mano) mano.value = raccolta ? Number(raccolta.costoManodopera || 0).toFixed(2) : '0.00';
  if (macchina) macchina.value = raccolta ? Number(raccolta.costoMacchina || 0).toFixed(2) : '0.00';
  const proprietario = document.getElementById('raccolta-proprietario-message');
  if (proprietario) proprietario.style.display = hasManodopera ? 'none' : '';
  const title = document.getElementById('modal-raccolta-title');
  if (title) title.textContent = raccolta ? 'Modifica raccolta' : 'Completa raccolta';
  const info = document.getElementById('raccolta-contesto');
  if (info) {
    info.textContent = [
      row.data,
      row.tipoLavoro,
      getTerrenoLabel(row.terrenoId),
      campagnaLabel(row)
    ].filter(Boolean).join(' · ');
  }
  aggiornaResa();
  const modal = document.getElementById('modal-raccolta');
  if (modal) modal.style.display = 'flex';
  prefillCosti(row, raccolta);
}

async function prefillCosti(row, raccolta) {
  if (raccolta) return;
  try {
    const { getDatiPrecompilazioneTrattamento } = await import(resolvePath('../../vigneto/services/trattamenti-vigneto-service.js'));
    const prefill = await getDatiPrecompilazioneTrattamento(null, {
      lavoroId: row.lavoroId,
      attivitaId: row.attivitaId
    });
    const mano = document.getElementById('raccolta-costo-mano');
    const macchina = document.getElementById('raccolta-costo-macchina');
    if (mano) mano.value = (Number(prefill.costoManodopera) || 0).toFixed(2);
    if (macchina) macchina.value = (Number(prefill.costoMacchina) || 0).toFixed(2);
  } catch (err) {
    console.warn('[raccolta] prefill costi:', err);
  }
}

function applySuperficieAnagrafe() {
  if (!editingRow) return;
  const terreno = terreni.find((item) => item.id === editingRow.terrenoId);
  const input = document.getElementById('raccolta-superficie');
  const n = terreno && terreno.superficie != null ? parseFloat(terreno.superficie) : NaN;
  if (input && Number.isFinite(n) && n > 0) {
    input.value = String(Math.round(n * 100) / 100);
    aggiornaResa();
  }
}

async function onSubmit(event) {
  event.preventDefault();
  if (!editingRow) return;
  const row = editingRow;
  const raccolta = row.raccolta;
  try {
    await saveRaccoltaSeminativo({
      id: raccolta ? raccolta.id : null,
      campagnaId: row.campagnaId,
      terrenoId: row.terrenoId,
      lavoroId: row.lavoroId,
      attivitaId: row.attivitaId,
      data: row.data,
      tipoLavoro: row.tipoLavoro,
      varieta: document.getElementById('raccolta-varieta')?.value || row.varieta || '',
      quantitaQli: document.getElementById('raccolta-quantita')?.value,
      quantitaEttari: document.getElementById('raccolta-superficie')?.value,
      destinazione: document.getElementById('raccolta-destinazione')?.value,
      costoManodopera: document.getElementById('raccolta-costo-mano')?.value,
      costoMacchina: document.getElementById('raccolta-costo-macchina')?.value,
      note: document.getElementById('raccolta-note')?.value || ''
    });
    closeModal();
    await loadRighe();
  } catch (err) {
    window.alert(err && err.message ? err.message : 'Salvataggio non riuscito');
  }
}

async function confirmDelete(index) {
  const row = visible[index];
  if (!row || !row.raccolta || !row.raccolta.id) return;
  if (!window.confirm('Eliminare i dati di questa raccolta?')) return;
  try {
    await deleteRaccoltaSeminativo(row.raccolta.id);
    await loadRighe();
  } catch (err) {
    window.alert(err && err.message ? err.message : 'Eliminazione non riuscita');
  }
}

export function openSeminativoRaccoltaModal() {
  if (!editingRow && visible.length === 1 && !visible[0].raccolta) {
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
  const data = await listRigheRaccolta({ includeLavori: hasManodopera });
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
  const form = document.getElementById('form-raccolta');
  if (form) form.addEventListener('submit', onSubmit);
  const closeBtn = document.getElementById('btn-close-raccolta-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  ['raccolta-quantita', 'raccolta-superficie'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', aggiornaResa);
  });
  const anagrafe = document.getElementById('raccolta-superficie-anagrafe');
  if (anagrafe) {
    anagrafe.addEventListener('change', () => {
      if (anagrafe.checked) applySuperficieAnagrafe();
    });
  }
  window.openSeminativoRaccoltaModal = openSeminativoRaccoltaModal;
  window.applyFilters = applyFilters;
}

export async function initRaccoltaPage() {
  publishSeminativoTableData({
    pageType: 'raccolta_seminativo',
    summary: 'Caricamento dati in corso...',
    items: []
  });
  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[raccolta] Bootstrap failed:', err);
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
    const modules = Array.isArray(tenant?.modules) ? tenant.modules.slice() : [];
    hasManodopera = modules.some((item) => String(item || '').toLowerCase() === 'manodopera');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'seminativo')) modules.push('seminativo');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);
    await loadRighe();
  });
}
