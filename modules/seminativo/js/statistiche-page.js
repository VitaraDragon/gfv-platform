/**
 * Pagina statistiche seminativo: sola lettura, per campagna.
 * @module modules/seminativo/js/statistiche-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import { caricaStatisticheSeminativo } from '../services/statistiche-service.js';
import { totaliStatistiche } from '../models/SeminativoStatistiche.js';

let terreni = [];
let righe = [];
let charts = {};

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

function euro(value) {
  return value == null ? '—' : Number(value).toFixed(2);
}

function qli(value) {
  return value == null ? '—' : Number(value).toFixed(2);
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

function visibleRows() {
  const terrenoId = document.getElementById('filter-terreno')?.value || '';
  const campagnaId = document.getElementById('filter-campagna')?.value || '';
  return righe.filter((row) => {
    if (terrenoId && row.terrenoId !== terrenoId) return false;
    if (campagnaId && row.id !== campagnaId) return false;
    return true;
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderKpi(rows) {
  const tot = totaliStatistiche(rows);
  setText('kpi-produzione', qli(tot.produzioneQli));
  setText('kpi-resa-effettiva', qli(tot.resaEffettivaQliHa));
  setText('kpi-resa-prevista', qli(tot.resaPrevistaMediaQliHa));
  setText('kpi-costo', euro(tot.costoTotale));
  setText('kpi-prodotti', euro(tot.costoProdotti));
  setText('kpi-lavori', euro((Number(tot.costoManodopera) || 0) + (Number(tot.costoMacchine) || 0)));
}

function renderTable(rows) {
  const tbody = document.getElementById('statistiche-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('statistiche-table');
  if (loadingDiv) loadingDiv.style.display = 'none';
  const items = rows.map((row) => ({
    id: row.id,
    campagna: campagnaLabel(row),
    terreno: getTerrenoLabel(row.terrenoId),
    varieta: row.varieta || '',
    superficieEttari: row.superficieEttari,
    produzioneQli: row.produzioneQli,
    resaPrevistaQliHa: row.resaPrevistaQliHa,
    resaEffettivaQliHa: row.resaEffettivaQliHa,
    costoManodopera: row.costoManodopera,
    costoMacchine: row.costoMacchine,
    costoProdotti: row.costoProdotti,
    costoTotale: row.costoTotale
  }));
  publishSeminativoTableData({
    pageType: 'statistiche_seminativo',
    summary: items.length
      ? `${items.length} campagne in statistica`
      : 'Nessuna campagna seminativo',
    items
  });
  if (!rows.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';
  tbody.innerHTML = rows.map((row) => `<tr>
    <td>${escapeHtml(campagnaLabel(row) || '—')}</td>
    <td>${escapeHtml(getTerrenoLabel(row.terrenoId))}</td>
    <td>${qli(row.produzioneQli)}</td>
    <td>${qli(row.resaPrevistaQliHa)}</td>
    <td>${qli(row.resaEffettivaQliHa)}</td>
    <td>${euro(row.costoManodopera)}</td>
    <td>${euro(row.costoMacchine)}</td>
    <td>${euro(row.costoProdotti)}</td>
    <td>${euro(row.costoTotale)}</td>
  </tr>`).join('');
}

function destroyCharts() {
  Object.keys(charts).forEach((key) => {
    if (charts[key] && typeof charts[key].destroy === 'function') charts[key].destroy();
  });
  charts = {};
}

function renderCharts(rows) {
  destroyCharts();
  if (typeof window.Chart !== 'function') return;
  const labels = rows.map((row) => campagnaLabel(row) || 'Campagna');
  const produzione = document.getElementById('chart-produzione');
  const rese = document.getElementById('chart-rese');
  const costi = document.getElementById('chart-costi');
  const gold = '#C9A227';
  if (produzione) {
    charts.produzione = new window.Chart(produzione, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Quintali raccolti', data: rows.map((row) => row.produzioneQli || 0), backgroundColor: gold }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
  if (rese) {
    charts.rese = new window.Chart(rese, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Prevista', data: rows.map((row) => row.resaPrevistaQliHa || 0), backgroundColor: '#8D6E00' },
          { label: 'Effettiva', data: rows.map((row) => row.resaEffettivaQliHa || 0), backgroundColor: gold }
        ]
      },
      options: { responsive: true }
    });
  }
  if (costi) {
    const tot = totaliStatistiche(rows);
    charts.costi = new window.Chart(costi, {
      type: 'doughnut',
      data: {
        labels: ['Manodopera', 'Macchine', 'Prodotti'],
        datasets: [{
          data: [tot.costoManodopera, tot.costoMacchine, tot.costoProdotti],
          backgroundColor: ['#8D6E00', '#C9A227', '#F3E5AB']
        }]
      },
      options: { responsive: true }
    });
  }
}

function render() {
  const rows = visibleRows();
  renderKpi(rows);
  renderTable(rows);
  renderCharts(rows);
}

function populateFilters() {
  fillSelect(document.getElementById('filter-terreno'), terreni.map((t) => ({
    value: t.id,
    label: getTerrenoLabel(t.id)
  })), 'Tutti i terreni');
  const seen = new Set();
  const campagne = [];
  righe.forEach((row) => {
    if (!row.id || seen.has(row.id)) return;
    seen.add(row.id);
    campagne.push({ value: row.id, label: campagnaLabel(row) });
  });
  fillSelect(document.getElementById('filter-campagna'), campagne, 'Tutte le campagne');
}

async function load() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  const data = await caricaStatisticheSeminativo();
  terreni = data.terreni || [];
  righe = data.righe || [];
  populateFilters();
  render();
}

export async function initStatistichePage() {
  publishSeminativoTableData({
    pageType: 'statistiche_seminativo',
    summary: 'Caricamento dati in corso...',
    items: []
  });
  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[statistiche] Bootstrap failed:', err);
    throw err;
  }
  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;
  initializeTenantService();
  ['filter-terreno', 'filter-campagna'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', render);
  });
  const resetBtn = document.getElementById('btn-reset-filtri');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ['filter-terreno', 'filter-campagna'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      render();
    });
  }
  window.applyFilters = render;

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
    if (!getCurrentTenantId()) return;
    const tenant = await getCurrentTenant().catch(() => null);
    const modules = Array.isArray(tenant?.modules) ? tenant.modules.slice() : [];
    if (!modules.some((item) => String(item || '').toLowerCase() === 'seminativo')) modules.push('seminativo');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);
    await load();
  });
}
