/**
 * Pagina anagrafica campagne Orticole: lista + modal CRUD + currentTableData.
 * @module modules/orticole/js/orticole-anagrafica-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishOrticoleTableData } from './orticole-page-context.js';
import {
  ORTICOLA_CAMPAGNA_STATI,
  ORTICOLA_CAMPAGNA_STATO_LABELS,
  ORTICOLA_CICLI_FASE1,
  ORTICOLA_DESTINAZIONI,
  ORTICOLA_DESTINAZIONE_LABELS,
  ORTICOLA_TIPO_IMPIANTO,
  defaultCampagnaLabel
} from '../models/OrticolaCampagna.js';
import {
  getAllOrticole,
  createOrticola,
  updateOrticola,
  deleteOrticola,
  listTerreniOrticole,
  listColtureOrticole
} from '../services/orticole-service.js';
import {
  getVarietaPerColtura,
  addVarietaPersonalizzata
} from '../services/varieta-orticole-service.js';
import { spesePerCampagne } from '../services/orticole-spese-service.js';
import { terreniPerTendina } from '../../../shared/js/coltura-terreno.js';
import { etichettaTerrenoStorico, terreniOperativi } from '../../../shared/js/terreno-archivio.js';

const PAGE_TYPE = 'orticole';

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
  return etichettaTerrenoStorico(t, 'Terreno senza nome');
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
  return ORTICOLA_CAMPAGNA_STATO_LABELS[stato] || stato || '—';
}

function destinazioneLabel(value) {
  return ORTICOLA_DESTINAZIONE_LABELS[value] || value || '—';
}

function tipoImpiantoLabel(value) {
  if (value === 'semina') return 'Semina';
  if (value === 'trapianto') return 'Trapianto';
  return value || '—';
}

function dataImpiantoPrevistaOf(row) {
  return row?.dataImpiantoPrevista || row?.dataSeminaPrevista || null;
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
  let summary = n === 1 ? '1 campagna orticole' : `${n} campagne orticole`;
  if (total !== n) summary += ` (filtrate da ${total})`;
  return {
    pageType: PAGE_TYPE,
    summary,
    items: items.map((row) => ({
      id: row.id,
      terreno: getTerrenoLabel(getTerrenoById(row.terrenoId)),
      terrenoId: row.terrenoId,
      campagna: row.campagna,
      ciclo: row.ciclo || 1,
      coltura: row.colturaNome || '',
      colturaId: row.colturaId,
      varieta: row.varieta || '',
      superficieEttari: row.superficieEttari,
      resaPrevistaQliHa: row.resaPrevistaQliHa,
      tipoImpianto: row.tipoImpianto || 'trapianto',
      destinazionePrevista: row.destinazionePrevista || '',
      stato: row.stato,
      costoTotale: speseById[row.id] ? speseById[row.id].costoTotale : 0,
      dataImpiantoPrevista: formatDate(dataImpiantoPrevistaOf(row)),
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

function populateTerrenoSelects(idCorrente) {
  const etichetta = (t) => ({ value: t.id, label: getTerrenoLabel(t) });
  fillSelect(
    document.getElementById('campagna-terreno'),
    terreniPerTendina(terreni, { idCorrente }).map(etichetta),
    'Seleziona terreno'
  );
  fillSelect(
    document.getElementById('filter-terreno'),
    terreniOperativi(terreni).map(etichetta),
    'Tutti i terreni'
  );
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
  const opts = ORTICOLA_CAMPAGNA_STATI.map((s) => ({ value: s, label: statoLabel(s) }));
  fillSelect(document.getElementById('campagna-stato'), opts, 'Seleziona stato');
  fillSelect(document.getElementById('filter-stato'), opts, 'Tutti gli stati');
}

function populateCicloSelect() {
  const opts = ORTICOLA_CICLI_FASE1.map((c) => ({ value: String(c), label: String(c) }));
  fillSelect(document.getElementById('campagna-ciclo'), opts, 'Ciclo');
  const el = document.getElementById('campagna-ciclo');
  if (el && !el.value) el.value = '1';
}

function populateTipoImpiantoSelect() {
  const opts = ORTICOLA_TIPO_IMPIANTO.map((t) => ({ value: t, label: tipoImpiantoLabel(t) }));
  fillSelect(document.getElementById('campagna-tipo-impianto'), opts, 'Tipo impianto');
  const el = document.getElementById('campagna-tipo-impianto');
  if (el && !el.value) el.value = 'trapianto';
}

function populateDestinazioneSelect() {
  const opts = ORTICOLA_DESTINAZIONI.map((d) => ({ value: d, label: destinazioneLabel(d) }));
  fillSelect(document.getElementById('campagna-destinazione'), opts, 'Seleziona destinazione');
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
        row.ciclo,
        row.colturaNome,
        row.varieta,
        tipoImpiantoLabel(row.tipoImpianto),
        destinazioneLabel(row.destinazionePrevista),
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
  const tbody = document.getElementById('orticole-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('orticole-table');
  if (loadingDiv) loadingDiv.style.display = 'none';

  if (!visibleCampagne.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    publishOrticoleTableData(buildTableData([]));
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';
  tbody.innerHTML = visibleCampagne.map((row) => `
    <tr>
      <td>${escapeHtml(getTerrenoLabel(getTerrenoById(row.terrenoId)))}</td>
      <td>${escapeHtml(row.campagna || '—')}</td>
      <td>${escapeHtml(row.ciclo || 1)}</td>
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
  publishOrticoleTableData(buildTableData(visibleCampagne));
}

function readFormData() {
  const colturaId = document.getElementById('campagna-coltura')?.value || null;
  const coltura = getColturaById(colturaId);
  const superficieRaw = document.getElementById('campagna-superficie')?.value;
  const resaRaw = document.getElementById('campagna-resa-prevista')?.value;
  const cicloRaw = document.getElementById('campagna-ciclo')?.value;
  return {
    terrenoId: document.getElementById('campagna-terreno')?.value || null,
    campagna: document.getElementById('campagna-anno')?.value || '',
    ciclo: cicloRaw === '' ? 1 : cicloRaw,
    colturaId,
    colturaNome: coltura ? (coltura.nome || '') : '',
    varieta: document.getElementById('campagna-varieta')?.value || null,
    superficieEttari: superficieRaw === '' ? null : superficieRaw,
    resaPrevistaQliHa: resaRaw === '' ? null : resaRaw,
    tipoImpianto: document.getElementById('campagna-tipo-impianto')?.value || 'trapianto',
    dataImpiantoPrevista: document.getElementById('campagna-data-impianto')?.value || null,
    dataRaccoltaPrevista: document.getElementById('campagna-data-raccolta')?.value || null,
    destinazionePrevista: document.getElementById('campagna-destinazione')?.value || null,
    stato: document.getElementById('campagna-stato')?.value || 'pianificato',
    note: document.getElementById('campagna-note')?.value || ''
  };
}

function fillForm(row) {
  document.getElementById('campagna-id').value = row?.id || '';
  document.getElementById('campagna-terreno').value = row?.terrenoId || '';
  document.getElementById('campagna-anno').value = row?.campagna || defaultCampagnaLabel();
  document.getElementById('campagna-ciclo').value = String(row?.ciclo || 1);
  document.getElementById('campagna-coltura').value = row?.colturaId || '';
  refreshVarietaSelect(row?.varieta || '');
  document.getElementById('campagna-superficie').value = row?.superficieEttari != null ? row.superficieEttari : '';
  document.getElementById('campagna-resa-prevista').value = row?.resaPrevistaQliHa != null ? row.resaPrevistaQliHa : '';
  document.getElementById('campagna-tipo-impianto').value = row?.tipoImpianto || 'trapianto';
  document.getElementById('campagna-data-impianto').value = toDateInput(dataImpiantoPrevistaOf(row));
  document.getElementById('campagna-data-raccolta').value = toDateInput(row?.dataRaccoltaPrevista);
  document.getElementById('campagna-destinazione').value = row?.destinazionePrevista || '';
  document.getElementById('campagna-stato').value = row?.stato || 'pianificato';
  document.getElementById('campagna-note').value = row?.note || '';
}

function openOrticolaCampagnaModal(id) {
  const form = document.getElementById('orticole-campagna-form');
  const modal = document.getElementById('orticole-campagna-modal');
  const title = document.getElementById('orticole-campagna-modal-title');
  if (form) form.reset();
  populateStatoSelects();
  populateCicloSelect();
  populateTipoImpiantoSelect();
  populateDestinazioneSelect();
  populateColturaSelects();
  if (id) {
    const row = allCampagne.find((r) => r.id === id);
    if (!row) return;
    currentEditingId = id;
    populateTerrenoSelects(row.terrenoId);
    if (title) title.textContent = 'Modifica campagna';
    fillForm(row);
  } else {
    currentEditingId = null;
    populateTerrenoSelects();
    if (title) title.textContent = 'Nuova campagna';
    fillForm({
      campagna: defaultCampagnaLabel(),
      ciclo: 1,
      tipoImpianto: 'trapianto',
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

function closeOrticolaCampagnaModal() {
  const modal = document.getElementById('orticole-campagna-modal');
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
      <h3 style="color: #BF360C; margin-bottom: 15px;">Riepilogo campagna ${escapeHtml(row.campagna || '')}</h3>
      <p style="color: #666; margin-top: 0;">Periodo ${escapeHtml(periodo)}. Lavori completati, attività del diario e costo prodotti di trattamenti e concimazioni.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div style="background: linear-gradient(135deg, #E65100 0%, #BF360C 100%); color: white; padding: 20px; border-radius: 8px;">
          <div style="font-size: 12px; opacity: 0.9; margin-bottom: 5px;">Totale Generale</div>
          <div style="font-size: 28px; font-weight: bold;">€ ${formatEuro(spese.costoTotale)}</div>
        </div>
      </div>
    </div>
    <div style="margin-bottom: 30px;">
      <h4 style="color: #BF360C; margin-bottom: 15px;">👥 Manodopera <span style="font-size: 14px; font-weight: normal; color: #666;">(Totale: € ${formatEuro(spese.costoManodopera)})</span></h4>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
        <div style="background: white; padding: 12px; border-radius: 6px; border-left: 3px solid #6c757d; display: inline-block;">
          <div style="font-size: 11px; color: #666; margin-bottom: 3px;">${spese.costoManodopera > 0 ? 'Lavori e diario' : 'Nessuna attività registrata'}</div>
          <div style="font-size: 18px; font-weight: bold; color: #383d41;">€ ${formatEuro(spese.costoManodopera)}</div>
        </div>
      </div>
    </div>`;
  if (spese.costoMacchine > 0) {
    html += `<div style="margin-bottom: 30px;">
      <h4 style="color: #BF360C; margin-bottom: 15px;">🚜 Macchine</h4>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #6c757d;">
        <div style="font-size: 20px; font-weight: bold; color: #383d41;">€ ${formatEuro(spese.costoMacchine)}</div>
      </div>
    </div>`;
  }
  const prodotti = spese.prodotti || [];
  if (prodotti.length || spese.costoProdotti > 0) {
    html += `<div style="margin-bottom: 30px;">
      <h4 style="color: #BF360C; margin-bottom: 15px;">🧪 Prodotti <span style="font-size: 14px; font-weight: normal; color: #666;">(Totale: € ${formatEuro(spese.costoProdotti)})</span></h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead><tr style="background: #BF360C; color: white;">
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
      <h4 style="color: #BF360C; margin-bottom: 15px;">✅ Lavori Completati (${spese.lavori.length})</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead><tr style="background: #BF360C; color: white;">
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
      <h4 style="color: #BF360C; margin-bottom: 15px;">📝 Attività Dirette del Diario (${spese.attivita.length})</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead><tr style="background: #BF360C; color: white;">
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
  const modal = document.getElementById('orticole-spese-modal');
  const title = document.getElementById('orticole-spese-title');
  const body = document.getElementById('orticole-spese-body');
  if (!row || !modal || !body) return;
  const terreno = getTerrenoLabel(getTerrenoById(row.terrenoId));
  if (title) title.textContent = `📊 Dettaglio Spese - ${row.colturaNome || 'Campagna'} · ${row.campagna || ''} · ${terreno}`;
  body.innerHTML = renderSpeseBody(row);
  modal.classList.add('active');
}

function closeSpeseModal() {
  const modal = document.getElementById('orticole-spese-modal');
  if (modal) modal.classList.remove('active');
}

async function loadCampagne() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  allCampagne = await getAllOrticole();
  try {
    speseById = await spesePerCampagne(allCampagne);
  } catch (err) {
    console.warn('[orticole] spese:', err && err.message);
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
      await updateOrticola(currentEditingId, data);
    } else {
      await createOrticola(data);
    }
    closeOrticolaCampagnaModal();
    await loadCampagne();
  } catch (error) {
    console.error('[orticole] Errore salvataggio campagna:', error);
    alert(error.message || 'Errore nel salvataggio della campagna');
  }
}

async function confirmDelete(id) {
  if (!confirm('Eliminare questa campagna orticole?')) return;
  try {
    await deleteOrticola(id);
    await loadCampagne();
  } catch (error) {
    console.error('[orticole] Errore eliminazione campagna:', error);
    alert(error.message || 'Errore nell\'eliminazione della campagna');
  }
}

function setupEventListeners() {
  const form = document.getElementById('orticole-campagna-form');
  if (form) form.addEventListener('submit', onSubmit);

  const modal = document.getElementById('orticole-campagna-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'orticole-campagna-modal') closeOrticolaCampagnaModal();
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
  if (newBtn) newBtn.addEventListener('click', () => openOrticolaCampagnaModal(null));

  const closeBtn = document.getElementById('btn-close-campagna-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeOrticolaCampagnaModal);
  const cancelBtn = document.getElementById('btn-cancel-campagna');
  if (cancelBtn) cancelBtn.addEventListener('click', closeOrticolaCampagnaModal);
  const closeSpese = document.getElementById('btn-close-spese-modal');
  if (closeSpese) closeSpese.addEventListener('click', closeSpeseModal);

  const listHost = document.querySelector('.table-container');
  if (listHost) {
    listHost.addEventListener('click', (e) => {
      const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
      const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
      const speseId = e.target.closest('[data-spese]')?.getAttribute('data-spese');
      if (speseId) openSpeseModal(speseId);
      if (editId) openOrticolaCampagnaModal(editId);
      if (deleteId) confirmDelete(deleteId);
    });
  }
}

export async function initOrticoleAnagraficaPage() {
  publishOrticoleTableData(placeholderTable());

  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[orticole] Bootstrap failed:', err);
    throw err;
  }

  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;

  initializeTenantService();
  populateStatoSelects();
  populateCicloSelect();
  populateTipoImpiantoSelect();
  populateDestinazioneSelect();
  setupEventListeners();

  window.openOrticolaCampagnaModal = openOrticolaCampagnaModal;
  window.closeOrticolaCampagnaModal = closeOrticolaCampagnaModal;
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
      console.warn('[orticole] Tenant non disponibile');
      return;
    }

    const tenant = await getCurrentTenant().catch(() => null);
    const modules = resolveEffectiveModules(tenant);
    if (!modules.some((m) => String(m || '').toLowerCase() === 'orticole')) modules.push('orticole');
    if (!modules.some((m) => String(m || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);

    terreni = await listTerreniOrticole({ includiArchiviati: true });
    colture = await listColtureOrticole();
    populateTerrenoSelects();
    populateColturaSelects();
    await loadCampagne();
  });
}
