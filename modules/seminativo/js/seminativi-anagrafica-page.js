/**
 * Pagina anagrafica campagne Seminativo: lista + modal CRUD + currentTableData.
 * @module modules/seminativo/js/seminativi-anagrafica-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import {
  SEMINATIVO_CAMPAGNA_STATI,
  SEMINATIVO_CAMPAGNA_STATO_LABELS,
  defaultCampagnaLabel
} from '../models/SeminativoCampagna.js';
import {
  getAllSeminativi,
  createSeminativo,
  updateSeminativo,
  deleteSeminativo,
  listTerreniSeminativo,
  listColtureSeminativo
} from '../services/seminativi-service.js';
import {
  getVarietaPerColtura,
  addVarietaPersonalizzata
} from '../services/varieta-seminativo-service.js';
import { spesePerCampagne } from '../services/seminativo-spese-service.js';

const PAGE_TYPE = 'seminativi';

let terreni = [];
let colture = [];
let allCampagne = [];
let visibleCampagne = [];
let speseById = {};
let currentEditingId = null;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTerrenoLabel(t) {
  if (!t) return '—';
  const nome = String(t.nome || '').trim();
  const podere = String(t.podere || '').trim();
  if (nome && podere) return `${nome} – ${podere}`;
  return nome || podere || 'Terreno senza nome';
}

function getTerrenoById(id) {
  return terreni.find((t) => t.id === id) || null;
}

function getColturaById(id) {
  return colture.find((c) => c.id === id) || null;
}

function formatHa(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2);
}

function formatDate(value) {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function toDateInput(value) {
  const formatted = formatDate(value);
  return formatted === '—' ? '' : formatted;
}

function statoLabel(stato) {
  return SEMINATIVO_CAMPAGNA_STATO_LABELS[stato] || stato || '—';
}

function statoBadgeClass(stato) {
  if (stato === 'raccolto' || stato === 'seminato' || stato === 'in_ciclo') return 'badge-success';
  if (stato === 'pianificato') return 'badge-warning';
  return 'badge-secondary';
}

function placeholderTable() {
  return {
    pageType: PAGE_TYPE,
    summary: 'Caricamento dati in corso...',
    items: []
  };
}

function buildTableData(items) {
  const n = items.length;
  const total = allCampagne.length;
  let summary = n === 1 ? '1 campagna seminativo' : `${n} campagne seminativo`;
  if (total !== n) summary += ` (filtrate da ${total})`;
  return {
    pageType: PAGE_TYPE,
    summary,
    items: items.map((row) => ({
      id: row.id,
      terreno: getTerrenoLabel(getTerrenoById(row.terrenoId)),
      terrenoId: row.terrenoId,
      campagna: row.campagna,
      coltura: row.colturaNome || '',
      colturaId: row.colturaId,
      varieta: row.varieta || '',
      superficieEttari: row.superficieEttari,
      resaPrevistaQliHa: row.resaPrevistaQliHa,
      stato: row.stato,
      costoTotale: speseById[row.id] ? speseById[row.id].costoTotale : 0,
      dataSeminaPrevista: formatDate(row.dataSeminaPrevista),
      dataRaccoltaPrevista: formatDate(row.dataRaccoltaPrevista)
    }))
  };
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

function populateTerrenoSelects() {
  const opts = terreni.map((t) => ({ value: t.id, label: getTerrenoLabel(t) }));
  fillSelect(document.getElementById('campagna-terreno'), opts, 'Seleziona terreno');
  fillSelect(document.getElementById('filter-terreno'), opts, 'Tutti i terreni');
}

function populateColturaSelects() {
  const opts = colture.map((c) => ({ value: c.id, label: c.nome || c.id }));
  fillSelect(document.getElementById('campagna-coltura'), opts, 'Seleziona coltura');
  const names = [...new Set(allCampagne.map((r) => r.colturaNome).filter(Boolean))].sort();
  const filterOpts = names.map((n) => ({ value: n, label: n }));
  fillSelect(document.getElementById('filter-coltura'), filterOpts, 'Tutte le colture');
}

function populateCampagnaFilter() {
  const years = [...new Set(allCampagne.map((r) => r.campagna).filter(Boolean))].sort().reverse();
  fillSelect(
    document.getElementById('filter-campagna'),
    years.map((y) => ({ value: y, label: y })),
    'Tutte le campagne'
  );
}

function selectedColturaNome() {
  const coltura = getColturaById(document.getElementById('campagna-coltura')?.value);
  return coltura ? (coltura.nome || '') : '';
}

function refreshVarietaSelect(preferredValue) {
  const el = document.getElementById('campagna-varieta');
  const nome = selectedColturaNome();
  const names = nome ? getVarietaPerColtura(nome) : [];
  const preferred = preferredValue != null ? String(preferredValue).trim() : '';
  const opts = names.map((name) => ({ value: name, label: name }));
  if (preferred && !names.some((name) => name.toLowerCase() === preferred.toLowerCase())) {
    opts.push({ value: preferred, label: preferred });
  }
  fillSelect(el, opts, nome ? 'Seleziona varietà' : 'Prima scegli la coltura');
  if (!el || !preferred) return;
  const match = Array.from(el.options).find((option) => (
    option.value.toLowerCase() === preferred.toLowerCase()
  ));
  if (match) el.value = match.value;
}

function populateStatoSelects() {
  const opts = SEMINATIVO_CAMPAGNA_STATI.map((s) => ({ value: s, label: statoLabel(s) }));
  fillSelect(document.getElementById('campagna-stato'), opts, 'Seleziona stato');
  fillSelect(document.getElementById('filter-stato'), opts, 'Tutti gli stati');
}

function applyFilters() {
  const terreno = document.getElementById('filter-terreno')?.value || '';
  const campagna = document.getElementById('filter-campagna')?.value || '';
  const coltura = document.getElementById('filter-coltura')?.value || '';
  const stato = document.getElementById('filter-stato')?.value || '';
  const ricerca = String(document.getElementById('filter-ricerca')?.value || '').toLowerCase().trim();

  visibleCampagne = allCampagne.filter((row) => {
    if (terreno && row.terrenoId !== terreno) return false;
    if (campagna && row.campagna !== campagna) return false;
    if (coltura && row.colturaNome !== coltura) return false;
    if (stato && row.stato !== stato) return false;
    if (ricerca) {
      const blob = [
        getTerrenoLabel(getTerrenoById(row.terrenoId)),
        row.campagna,
        row.colturaNome,
        row.varieta,
        statoLabel(row.stato)
      ].join(' ').toLowerCase();
      if (!blob.includes(ricerca)) return false;
    }
    return true;
  });
  renderTable();
}

function resetFilters() {
  ['filter-terreno', 'filter-campagna', 'filter-coltura', 'filter-stato', 'filter-ricerca']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  applyFilters();
}

function formatEuro(value) {
  return (Number(value) || 0).toFixed(2);
}

function speseDi(row) {
  return speseById[row.id] || {
    costoTotale: 0,
    costoManodopera: 0,
    costoMacchine: 0,
    costoProdotti: 0,
    prodotti: [],
    lavori: [],
    attivita: [],
    intervallo: null
  };
}

function renderTable() {
  const tbody = document.getElementById('seminativi-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('seminativi-table');
  if (loadingDiv) loadingDiv.style.display = 'none';

  if (!visibleCampagne.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    publishSeminativoTableData(buildTableData([]));
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';
  tbody.innerHTML = visibleCampagne.map((row) => `
    <tr>
      <td>${escapeHtml(getTerrenoLabel(getTerrenoById(row.terrenoId)))}</td>
      <td>${escapeHtml(row.campagna || '—')}</td>
      <td><strong>${escapeHtml(row.colturaNome || '—')}</strong></td>
      <td>${escapeHtml(row.varieta || '—')}</td>
      <td>${formatHa(row.superficieEttari)}</td>
      <td>${row.resaPrevistaQliHa != null ? escapeHtml(row.resaPrevistaQliHa) : '—'}</td>
      <td>${formatEuro(speseDi(row).costoTotale)}</td>
      <td><span class="badge ${statoBadgeClass(row.stato)}">${escapeHtml(statoLabel(row.stato))}</span></td>
      <td>
        <button type="button" class="btn btn-sm btn-secondary" data-spese="${escapeHtml(row.id)}">📊 Dettaglio</button>
      </td>
      <td class="actions-cell">
        <button type="button" class="btn btn-sm btn-primary" data-edit="${escapeHtml(row.id)}">✏️ Modifica</button>
        <button type="button" class="btn btn-sm btn-danger" data-delete="${escapeHtml(row.id)}">🗑️ Elimina</button>
      </td>
    </tr>
  `).join('');
  publishSeminativoTableData(buildTableData(visibleCampagne));
}

function readFormData() {
  const colturaId = document.getElementById('campagna-coltura')?.value || null;
  const coltura = getColturaById(colturaId);
  const superficieRaw = document.getElementById('campagna-superficie')?.value;
  const resaRaw = document.getElementById('campagna-resa-prevista')?.value;
  return {
    terrenoId: document.getElementById('campagna-terreno')?.value || null,
    campagna: document.getElementById('campagna-anno')?.value || '',
    colturaId,
    colturaNome: coltura ? (coltura.nome || '') : '',
    varieta: document.getElementById('campagna-varieta')?.value || null,
    superficieEttari: superficieRaw === '' ? null : superficieRaw,
    resaPrevistaQliHa: resaRaw === '' ? null : resaRaw,
    dataSeminaPrevista: document.getElementById('campagna-data-semina')?.value || null,
    dataRaccoltaPrevista: document.getElementById('campagna-data-raccolta')?.value || null,
    stato: document.getElementById('campagna-stato')?.value || 'pianificato',
    note: document.getElementById('campagna-note')?.value || ''
  };
}

function fillForm(row) {
  document.getElementById('campagna-id').value = row?.id || '';
  document.getElementById('campagna-terreno').value = row?.terrenoId || '';
  document.getElementById('campagna-anno').value = row?.campagna || defaultCampagnaLabel();
  document.getElementById('campagna-coltura').value = row?.colturaId || '';
  refreshVarietaSelect(row?.varieta || '');
  document.getElementById('campagna-superficie').value = row?.superficieEttari != null ? row.superficieEttari : '';
  document.getElementById('campagna-resa-prevista').value = row?.resaPrevistaQliHa != null ? row.resaPrevistaQliHa : '';
  document.getElementById('campagna-data-semina').value = toDateInput(row?.dataSeminaPrevista);
  document.getElementById('campagna-data-raccolta').value = toDateInput(row?.dataRaccoltaPrevista);
  document.getElementById('campagna-stato').value = row?.stato || 'pianificato';
  document.getElementById('campagna-note').value = row?.note || '';
}

function openSeminativoCampagnaModal(id) {
  const form = document.getElementById('seminativo-campagna-form');
  const modal = document.getElementById('seminativo-campagna-modal');
  const title = document.getElementById('seminativo-campagna-modal-title');
  if (form) form.reset();
  populateStatoSelects();
  populateTerrenoSelects();
  populateColturaSelects();
  if (id) {
    const row = allCampagne.find((r) => r.id === id);
    if (!row) return;
    currentEditingId = id;
    if (title) title.textContent = 'Modifica campagna';
    fillForm(row);
  } else {
    currentEditingId = null;
    if (title) title.textContent = 'Nuova campagna';
    fillForm({
      campagna: defaultCampagnaLabel(),
      stato: 'pianificato'
    });
  }
  if (modal) modal.classList.add('active');
}

function openVarietaModal() {
  const nome = selectedColturaNome();
  if (!nome) {
    alert('Seleziona prima la coltura');
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
  const nome = selectedColturaNome();
  const nuova = document.getElementById('nuova-varieta')?.value || '';
  if (!nome) {
    alert('Seleziona prima la coltura');
    return;
  }
  if (!String(nuova).trim()) {
    alert('Inserisci il nome della varietà');
    return;
  }
  if (!addVarietaPersonalizzata(nome, nuova)) {
    alert('Non riesco a salvare la varietà su questo browser');
    return;
  }
  refreshVarietaSelect(String(nuova).trim());
  closeVarietaModal();
}

function closeSeminativoCampagnaModal() {
  const modal = document.getElementById('seminativo-campagna-modal');
  if (modal) modal.classList.remove('active');
  currentEditingId = null;
}

function prefillSuperficieFromTerreno() {
  const terrenoId = document.getElementById('campagna-terreno')?.value;
  const superficieEl = document.getElementById('campagna-superficie');
  if (!superficieEl) return;
  const terreno = getTerrenoById(terrenoId);
  if (terreno && terreno.superficie && Number(terreno.superficie) > 0) {
    superficieEl.value = parseFloat(terreno.superficie).toFixed(2);
  }
}

function renderSpeseBody(row) {
  const spese = speseDi(row);
  const periodo = spese.intervallo
    ? `${spese.intervallo.inizio} – ${spese.intervallo.fine}`
    : (row.campagna || '');
  const th = 'padding: 12px; text-align: left;';
  const thR = 'padding: 12px; text-align: right;';
  const td = 'padding: 10px; border-bottom: 1px solid #eee;';
  const tdR = td + ' text-align: right;';
  let html = `<div style="margin-bottom: 30px;">
      <h3 style="color: #8D6E00; margin-bottom: 15px;">Riepilogo campagna ${escapeHtml(row.campagna || '')}</h3>
      <p style="color: #666; margin-top: 0;">Periodo ${escapeHtml(periodo)}. Lavori completati, attività del diario e costo prodotti di trattamenti e concimazioni.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div style="background: linear-gradient(135deg, #C9A227 0%, #8D6E00 100%); color: white; padding: 20px; border-radius: 8px;">
          <div style="font-size: 12px; opacity: 0.9; margin-bottom: 5px;">Totale Generale</div>
          <div style="font-size: 28px; font-weight: bold;">€ ${formatEuro(spese.costoTotale)}</div>
        </div>
      </div>
    </div>
    <div style="margin-bottom: 30px;">
      <h4 style="color: #8D6E00; margin-bottom: 15px;">👥 Manodopera <span style="font-size: 14px; font-weight: normal; color: #666;">(Totale: € ${formatEuro(spese.costoManodopera)})</span></h4>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
        <div style="background: white; padding: 12px; border-radius: 6px; border-left: 3px solid #6c757d; display: inline-block;">
          <div style="font-size: 11px; color: #666; margin-bottom: 3px;">${spese.costoManodopera > 0 ? 'Lavori e diario' : 'Nessuna attività registrata'}</div>
          <div style="font-size: 18px; font-weight: bold; color: #383d41;">€ ${formatEuro(spese.costoManodopera)}</div>
        </div>
      </div>
    </div>`;
  if (spese.costoMacchine > 0) {
    html += `<div style="margin-bottom: 30px;">
      <h4 style="color: #8D6E00; margin-bottom: 15px;">🚜 Macchine</h4>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #6c757d;">
        <div style="font-size: 20px; font-weight: bold; color: #383d41;">€ ${formatEuro(spese.costoMacchine)}</div>
      </div>
    </div>`;
  }
  const prodotti = spese.prodotti || [];
  if (prodotti.length || spese.costoProdotti > 0) {
    html += `<div style="margin-bottom: 30px;">
      <h4 style="color: #8D6E00; margin-bottom: 15px;">🧪 Prodotti <span style="font-size: 14px; font-weight: normal; color: #666;">(Totale: € ${formatEuro(spese.costoProdotti)})</span></h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead><tr style="background: #8D6E00; color: white;">
            <th style="${th}">Data</th><th style="${th}">Tipo</th><th style="${th}">Prodotto</th><th style="${thR}">Costo</th>
          </tr></thead>
          <tbody>${prodotti.map((item) => `<tr>
            <td style="${td}">${escapeHtml(item.data || '-')}</td>
            <td style="${td}">${escapeHtml(item.tipoLavoro || '-')}</td>
            <td style="${td}">${escapeHtml(item.nome || '-')}</td>
            <td style="${tdR} font-weight: bold;">€ ${formatEuro(item.costo)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }
  if (spese.lavori.length) {
    html += `<div style="margin-bottom: 30px;">
      <h4 style="color: #8D6E00; margin-bottom: 15px;">✅ Lavori Completati (${spese.lavori.length})</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead><tr style="background: #8D6E00; color: white;">
            <th style="${th}">Data</th><th style="${th}">Nome Lavoro</th><th style="${th}">Tipo</th>
            <th style="${thR}">Costo Manodopera</th><th style="${thR}">Costo Macchine</th><th style="${thR}">Totale</th>
          </tr></thead>
          <tbody>${spese.lavori.map((item) => `<tr>
            <td style="${td}">${escapeHtml(item.data || '-')}</td>
            <td style="${td}"><strong>${escapeHtml(item.nome || '-')}</strong></td>
            <td style="${td}">${escapeHtml(item.tipoLavoro || '-')}</td>
            <td style="${tdR}">€ ${formatEuro(item.costoManodopera)}</td>
            <td style="${tdR}">€ ${formatEuro(item.costoMacchine)}</td>
            <td style="${tdR} font-weight: bold;">€ ${formatEuro(item.costoTotale)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }
  if (spese.attivita.length) {
    html += `<div style="margin-bottom: 30px;">
      <h4 style="color: #8D6E00; margin-bottom: 15px;">📝 Attività Dirette del Diario (${spese.attivita.length})</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead><tr style="background: #8D6E00; color: white;">
            <th style="${th}">Data</th><th style="${th}">Tipo Lavoro</th><th style="${thR}">Ore</th>
            <th style="${thR}">Costo Manodopera</th><th style="${thR}">Costo Macchine</th><th style="${thR}">Totale</th>
          </tr></thead>
          <tbody>${spese.attivita.map((item) => `<tr>
            <td style="${td}">${escapeHtml(item.data || '-')}</td>
            <td style="${td}">${escapeHtml(item.tipoLavoro || '-')}</td>
            <td style="${tdR}">${formatEuro(item.oreNette)} h</td>
            <td style="${tdR}">€ ${formatEuro(item.costoManodopera)}</td>
            <td style="${tdR}">€ ${formatEuro(item.costoMacchine)}</td>
            <td style="${tdR} font-weight: bold;">€ ${formatEuro(item.costoTotale)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }
  return html;
}

function openSpeseModal(id) {
  const row = allCampagne.find((item) => item.id === id);
  const modal = document.getElementById('seminativo-spese-modal');
  const title = document.getElementById('seminativo-spese-title');
  const body = document.getElementById('seminativo-spese-body');
  if (!row || !modal || !body) return;
  const terreno = getTerrenoLabel(getTerrenoById(row.terrenoId));
  if (title) title.textContent = `📊 Dettaglio Spese - ${row.colturaNome || 'Campagna'} · ${row.campagna || ''} · ${terreno}`;
  body.innerHTML = renderSpeseBody(row);
  modal.classList.add('active');
}

function closeSpeseModal() {
  const modal = document.getElementById('seminativo-spese-modal');
  if (modal) modal.classList.remove('active');
}

async function loadCampagne() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  allCampagne = await getAllSeminativi();
  try {
    speseById = await spesePerCampagne(allCampagne);
  } catch (err) {
    console.warn('[seminativi] spese:', err && err.message);
    speseById = {};
  }
  populateCampagnaFilter();
  populateColturaSelects();
  applyFilters();
}

async function onSubmit(event) {
  event.preventDefault();
  const data = readFormData();
  try {
    if (currentEditingId) {
      await updateSeminativo(currentEditingId, data);
    } else {
      await createSeminativo(data);
    }
    closeSeminativoCampagnaModal();
    await loadCampagne();
  } catch (error) {
    console.error('[SEMINATIVI] Errore salvataggio campagna:', error);
    alert(error.message || 'Errore nel salvataggio della campagna');
  }
}

async function confirmDelete(id) {
  if (!confirm('Eliminare questa campagna seminativo?')) return;
  try {
    await deleteSeminativo(id);
    await loadCampagne();
  } catch (error) {
    console.error('[SEMINATIVI] Errore eliminazione campagna:', error);
    alert(error.message || 'Errore nell\'eliminazione della campagna');
  }
}

function setupEventListeners() {
  const form = document.getElementById('seminativo-campagna-form');
  if (form) form.addEventListener('submit', onSubmit);

  const modal = document.getElementById('seminativo-campagna-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'seminativo-campagna-modal') closeSeminativoCampagnaModal();
    });
  }

  const terrenoSelect = document.getElementById('campagna-terreno');
  if (terrenoSelect) terrenoSelect.addEventListener('change', prefillSuperficieFromTerreno);

  const colturaSelect = document.getElementById('campagna-coltura');
  if (colturaSelect) {
    colturaSelect.addEventListener('change', () => refreshVarietaSelect(''));
  }

  const addVarietaBtn = document.getElementById('btn-add-varieta');
  if (addVarietaBtn) addVarietaBtn.addEventListener('click', openVarietaModal);
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

  ['filter-terreno', 'filter-campagna', 'filter-coltura', 'filter-stato'].forEach((id) => {
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

  const newBtn = document.getElementById('btn-nuova-campagna');
  if (newBtn) newBtn.addEventListener('click', () => openSeminativoCampagnaModal(null));

  const closeBtn = document.getElementById('btn-close-campagna-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeSeminativoCampagnaModal);
  const cancelBtn = document.getElementById('btn-cancel-campagna');
  if (cancelBtn) cancelBtn.addEventListener('click', closeSeminativoCampagnaModal);
  const closeSpese = document.getElementById('btn-close-spese-modal');
  if (closeSpese) closeSpese.addEventListener('click', closeSpeseModal);

  const listHost = document.querySelector('.table-container');
  if (listHost) {
    listHost.addEventListener('click', (e) => {
      const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
      const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
      const speseId = e.target.closest('[data-spese]')?.getAttribute('data-spese');
      if (speseId) openSpeseModal(speseId);
      if (editId) openSeminativoCampagnaModal(editId);
      if (deleteId) confirmDelete(deleteId);
    });
  }
}

export async function initSeminativiAnagraficaPage() {
  publishSeminativoTableData(placeholderTable());

  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[seminativi] Bootstrap failed:', err);
    throw err;
  }

  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;

  initializeTenantService();
  populateStatoSelects();
  setupEventListeners();

  window.openSeminativoCampagnaModal = openSeminativoCampagnaModal;
  window.closeSeminativoCampagnaModal = closeSeminativoCampagnaModal;
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
      console.warn('[seminativi] Tenant non disponibile');
      return;
    }

    const tenant = await getCurrentTenant().catch(() => null);
    const modules = Array.isArray(tenant?.modules) ? tenant.modules.slice() : [];
    if (!modules.some((m) => String(m || '').toLowerCase() === 'seminativo')) modules.push('seminativo');
    if (!modules.some((m) => String(m || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);

    terreni = await listTerreniSeminativo();
    colture = await listColtureSeminativo();
    populateTerrenoSelects();
    populateColturaSelects();
    await loadCampagne();
  });
}
