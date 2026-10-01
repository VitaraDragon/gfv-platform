/**
 * Piano colturale: propone la coltura della campagna successiva e, se confermata, la salva come pianificata.
 * @module modules/seminativo/js/piano-colturale-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { showAlert } from '../../../core/js/gfv-page-utils.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import {
  avvisoSceltaRotazione,
  righePianoColturale
} from '../models/SeminativoRotazione.js';
import {
  createSeminativo,
  getAllSeminativi,
  listColtureSeminativo,
  listTerreniSeminativo,
  updateSeminativo
} from '../services/seminativi-service.js';

const PAGE_TYPE = 'piano_colturale_seminativo';

let righe = [];
let visibili = [];
let colture = [];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function syncTonyModules(modules) {
  if (typeof window.syncTonyModules === 'function') {
    window.syncTonyModules(modules);
  } else if (window.setTonyContext) {
    window.setTonyContext({ moduli_attivi: modules });
  } else {
    window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules } }));
  }
}

function buildTableData(rows) {
  const proposte = rows.reduce((sum, row) => sum + (row.proposte || []).length, 0);
  return {
    pageType: PAGE_TYPE,
    summary: rows.length
      ? `Piano colturale: ${rows.length} terreni, ${proposte} proposte. La conferma crea la campagna successiva in stato pianificato.`
      : 'Nessun terreno seminativo per il piano colturale.',
    items: rows.map((row) => ({
      id: row.terrenoId,
      terreno: row.terrenoNome,
      terrenoId: row.terrenoId,
      campagna: row.campagnaAttuale,
      coltura: row.colturaAttuale,
      campagnaSuccessiva: row.campagnaSuccessiva,
      colturaScelta: row.colturaScelta,
      proposte: (row.proposte || []).map((item) => item.nome).join(', ')
    }))
  };
}

function applyFilters() {
  const terreno = document.getElementById('filter-terreno')?.value || '';
  const ricerca = (document.getElementById('filter-ricerca')?.value || '').trim().toLowerCase();
  visibili = righe.filter((row) => {
    if (terreno && String(row.terrenoId) !== terreno) return false;
    if (!ricerca) return true;
    const blob = [
      row.terrenoNome,
      row.colturaAttuale,
      row.campagnaAttuale,
      row.colturaScelta,
      ...(row.proposte || []).map((item) => item.nome)
    ].join(' ').toLowerCase();
    return blob.includes(ricerca);
  });
  render();
}

function renderProposte(row) {
  if (!row.colturaAttuale) {
    return '<span class="text-muted">Serve una campagna in anagrafica</span>';
  }
  if (row.successivaId && row.successivaStato && row.successivaStato !== 'pianificato') {
    return `<span>Già avviata: ${escapeHtml(row.colturaScelta || '—')}</span>`;
  }
  const bottoni = (row.proposte || []).map((item) => (
    `<button type="button" class="btn btn-sm btn-secondary proposta-btn" data-proposta="${escapeHtml(item.nome)}" data-terreno-id="${escapeHtml(row.terrenoId)}" title="${escapeHtml(item.motivo)}">${escapeHtml(item.nome)}</button>`
  )).join(' ');
  const opzioni = colture.map((coltura) => (
    `<option value="${escapeHtml(coltura.nome)}">${escapeHtml(coltura.nome)}</option>`
  )).join('');
  const scelta = row.colturaScelta
    ? `<div class="scelta-rotazione">Scelta ${escapeHtml(row.campagnaSuccessiva)}: ${escapeHtml(row.colturaScelta)}</div>`
    : '';
  return `${scelta}<div class="proposte-rotazione">${bottoni}</div>
    <div class="altra-coltura">
      <select data-altra-coltura aria-label="Altra coltura">
        <option value="">Altra coltura</option>
        ${opzioni}
      </select>
      <button type="button" class="btn btn-sm btn-primary" data-imposta data-terreno-id="${escapeHtml(row.terrenoId)}">Imposta</button>
    </div>`;
}

function render() {
  const loading = document.getElementById('loading');
  const empty = document.getElementById('empty-state');
  const table = document.getElementById('piano-table');
  const tbody = table ? table.querySelector('tbody') : null;
  if (loading) loading.style.display = 'none';
  if (!tbody) return;
  if (!visibili.length) {
    if (empty) empty.style.display = 'block';
    table.style.display = 'none';
    publishSeminativoTableData(buildTableData([]));
    return;
  }
  if (empty) empty.style.display = 'none';
  table.style.display = 'table';
  tbody.innerHTML = visibili.map((row) => `
    <tr data-terreno-id="${escapeHtml(row.terrenoId)}">
      <td>${escapeHtml(row.terrenoNome)}</td>
      <td>${escapeHtml(row.campagnaAttuale || '—')}</td>
      <td>${escapeHtml(row.colturaAttuale || '—')}</td>
      <td>${escapeHtml(row.campagnaSuccessiva || '—')}</td>
      <td>${renderProposte(row)}</td>
    </tr>
  `).join('');
  publishSeminativoTableData(buildTableData(visibili));
}

function populateTerreni() {
  const select = document.getElementById('filter-terreno');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Tutti i terreni</option>' + righe.map((row) => (
    `<option value="${escapeHtml(row.terrenoId)}">${escapeHtml(row.terrenoNome)}</option>`
  )).join('');
  select.value = current;
}

async function impostaColtura(terrenoId, nome) {
  const row = righe.find((item) => String(item.terrenoId) === String(terrenoId));
  const coltura = colture.find((item) => String(item.nome || '').toLowerCase() === String(nome || '').toLowerCase());
  if (!row || !row.campagnaSuccessiva || !coltura) {
    showAlert('Scegli una coltura del catalogo seminativo.', 'error');
    return;
  }
  if (row.successivaId && row.successivaStato && row.successivaStato !== 'pianificato') {
    showAlert('La campagna successiva è già avviata. Si modifica dall’anagrafica.', 'error');
    return;
  }
  const avviso = avvisoSceltaRotazione(row.colturaAttuale, coltura.nome);
  if (avviso && !window.confirm(avviso + '\n\nImpostare comunque?')) return;
  const payload = {
    colturaId: coltura.id,
    colturaNome: coltura.nome,
    varieta: null
  };
  if (row.successivaId) {
    await updateSeminativo(row.successivaId, payload);
  } else {
    await createSeminativo({
      terrenoId: row.terrenoId,
      campagna: row.campagnaSuccessiva,
      colturaId: coltura.id,
      colturaNome: coltura.nome,
      superficieEttari: row.superficieEttari,
      stato: 'pianificato',
      note: row.colturaAttuale ? `Rotazione dopo ${row.colturaAttuale}` : ''
    });
  }
  showAlert(`Campagna ${row.campagnaSuccessiva} impostata a ${coltura.nome}.`, 'success');
  await load();
}

async function load() {
  const [terreni, campagne, catalogo] = await Promise.all([
    listTerreniSeminativo().catch(() => []),
    getAllSeminativi().catch(() => []),
    listColtureSeminativo().catch(() => [])
  ]);
  colture = catalogo || [];
  righe = righePianoColturale({ terreni, campagne });
  populateTerreni();
  applyFilters();
}

function bind() {
  ['filter-terreno', 'filter-ricerca'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id === 'filter-ricerca' ? 'input' : 'change', applyFilters);
  });
  const reset = document.getElementById('btn-reset-filtri');
  if (reset) {
    reset.addEventListener('click', () => {
      const terreno = document.getElementById('filter-terreno');
      const ricerca = document.getElementById('filter-ricerca');
      if (terreno) terreno.value = '';
      if (ricerca) ricerca.value = '';
      applyFilters();
    });
  }
  const container = document.querySelector('.table-container');
  if (container) {
    container.addEventListener('click', (event) => {
      const proposta = event.target.closest('[data-proposta]');
      if (proposta) {
        impostaColtura(proposta.getAttribute('data-terreno-id'), proposta.getAttribute('data-proposta'))
          .catch((err) => showAlert(err.message || 'Salvataggio non riuscito', 'error'));
        return;
      }
      const imposta = event.target.closest('[data-imposta]');
      if (!imposta) return;
      const riga = imposta.closest('tr');
      const select = riga ? riga.querySelector('[data-altra-coltura]') : null;
      impostaColtura(imposta.getAttribute('data-terreno-id'), select ? select.value : '')
        .catch((err) => showAlert(err.message || 'Salvataggio non riuscito', 'error'));
    });
  }
}

export async function initPianoColturalePage() {
  publishSeminativoTableData({
    pageType: PAGE_TYPE,
    summary: 'Caricamento dati in corso...',
    items: []
  });
  bind();
  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[piano-colturale] Bootstrap failed:', err);
    throw err;
  }
  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, onAuthStateChanged } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;
  const auth = getAuthInstance();
  initializeTenantService();
  onAuthStateChanged(auth, async (user) => {
    if (!user) user = await resolveAuthUser(auth);
    if (!user) {
      window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
      return;
    }
    if (!getCurrentTenantId()) return;
    const tenant = await getCurrentTenant().catch(() => null);
    const modules = Array.isArray(tenant?.modules) ? tenant.modules.slice() : [];
    if (!modules.some((item) => String(item || '').toLowerCase() === 'seminativo')) modules.push('seminativo');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);
    try {
      await load();
    } catch (err) {
      console.error('[piano-colturale]', err);
      showAlert(err.message || 'Caricamento non riuscito', 'error');
    }
  });
}
