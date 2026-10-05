/**
 * Pagina Trattamenti: lavori e diario di categoria Trattamenti, dati prodotto sulla campagna.
 * @module modules/seminativo/js/trattamenti-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import {
  deleteTrattamentoSeminativo,
  listRigheTrattamento,
  saveTrattamentoSeminativo
} from '../services/trattamenti-service.js';
import { avvisoDosaggioProdotti } from '../models/SeminativoTrattamento.js';
import { applyDiarioVsLavoroCta } from '../../../core/config/manodopera-diario-gate.js';

const DIARIO_HREF = '../../../core/attivita-standalone.html';
const LAVORI_HREF = '../../../core/admin/gestione-lavori-standalone.html';

const REGISTRI = {
  trattamenti: {
    pageType: 'trattamenti_seminativo',
    categoria: 'trattamenti',
    log: 'trattamenti',
    completa: 'Completa trattamento',
    modifica: 'Modifica trattamento',
    summary(count) {
      if (!count) return 'Nessun trattamento seminativo';
      return `${count} trattament${count === 1 ? 'o' : 'i'} seminativo`;
    }
  },
  concimazioni: {
    pageType: 'concimazioni_seminativo',
    categoria: 'concimazione',
    log: 'concimazioni',
    completa: 'Completa concimazione',
    modifica: 'Modifica concimazione',
    summary(count) {
      if (!count) return 'Nessuna concimazione seminativo';
      return `${count} concimazion${count === 1 ? 'e' : 'i'} seminativo`;
    }
  }
};

let registro = REGISTRI.trattamenti;

let terreni = [];
let righe = [];
let visible = [];
let hasManodopera = false;
let hasMagazzino = false;
let editingRow = null;
let listProdottiAnagrafica = [];

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

function syncTonyModules(modules) {
  if (window.Tony && typeof window.Tony.initContextWithModules === 'function') {
    window.Tony.initContextWithModules(modules);
    return;
  }
  if (typeof window.syncTonyModules === 'function') {
    window.syncTonyModules(modules);
  }
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

function buildTableData(rows) {
  const items = rows.map((row) => {
    const trattamento = row.trattamento;
    return {
      id: trattamento ? trattamento.id : (row.lavoroId || row.attivitaId),
      source: row.source,
      data: row.data,
      campagna: campagnaLabel(row),
      campagnaId: row.campagnaId,
      terreno: getTerrenoLabel(row.terrenoId),
      tipoLavoro: row.tipoLavoro,
      prodotto: trattamento ? trattamento.prodotto : '',
      costoTotale: trattamento ? trattamento.costoTotale : null
    };
  });
  return {
    pageType: registro.pageType,
    summary: registro.summary(items.length),
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
      const blob = [
        getTerrenoLabel(row.terrenoId),
        campagnaLabel(row),
        row.tipoLavoro,
        row.data,
        row.trattamento && row.trattamento.prodotto
      ].join(' ').toLowerCase();
      if (!blob.includes(ricerca)) return false;
    }
    return true;
  });
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('trattamenti-table-body');
  const emptyState = document.getElementById('empty-state');
  const loadingDiv = document.getElementById('loading');
  const table = document.getElementById('trattamenti-table');
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
    const trattamento = row.trattamento;
    const ref = row.source === 'lavoro'
      ? `<a class="btn btn-sm btn-secondary" href="${LAVORI_HREF}?lavoroId=${encodeURIComponent(row.lavoroId)}">🔗 Vedi Lavoro</a>`
      : `<a class="btn btn-sm btn-secondary" href="${DIARIO_HREF}?attivitaId=${encodeURIComponent(row.attivitaId || '')}">🔗 Vedi Attività</a>`;
    const azioni = trattamento
      ? `<button type="button" class="btn btn-sm btn-secondary" data-edit-row="${index}">Modifica</button>
         <button type="button" class="btn btn-sm btn-danger" data-delete-row="${index}">Elimina</button>`
      : `<button type="button" class="btn btn-sm btn-success" data-completa-row="${index}">Completa</button>`;
    return `<tr>
      <td>${escapeHtml(row.data || '—')}</td>
      <td>${escapeHtml(campagnaLabel(row) || '—')}</td>
      <td><strong>${escapeHtml(row.tipoLavoro || '—')}</strong></td>
      <td>${escapeHtml(getTerrenoLabel(row.terrenoId))}</td>
      <td>${escapeHtml(trattamento ? trattamento.prodotto : '—')}</td>
      <td>${trattamento && trattamento.superficieTrattata != null ? escapeHtml(trattamento.superficieTrattata) : '—'}</td>
      <td>${trattamento ? euro(trattamento.costoTotale) : '—'}</td>
      <td>${ref}</td>
      <td>${avvisoHtml(trattamento)}</td>
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

function avvisoHtml(trattamento) {
  if (!trattamento) return '—';
  const avviso = avvisoDosaggioProdotti(trattamento.prodotti, listProdottiAnagrafica);
  if (!avviso.hasWarning) return '—';
  return `<span title="${escapeHtml(avviso.tooltip)}">⚠️</span>`;
}

function superficieDefault(row) {
  const trattamento = row.trattamento;
  if (trattamento && trattamento.superficieTrattata != null && !Number.isNaN(trattamento.superficieTrattata)) {
    return trattamento.superficieTrattata;
  }
  if (row.superficieEttari != null && row.superficieEttari !== '') return row.superficieEttari;
  const terreno = terreni.find((item) => item.id === row.terrenoId);
  return terreno && terreno.superficie != null ? terreno.superficie : '';
}

function applySuperficieAnagrafe() {
  if (!editingRow) return;
  const terreno = terreni.find((item) => item.id === editingRow.terrenoId);
  const input = document.getElementById('trattamento-superficie');
  const n = terreno && terreno.superficie != null ? parseFloat(terreno.superficie) : NaN;
  if (input && Number.isFinite(n) && n > 0) {
    input.value = String(Math.round(n * 100) / 100);
    ricalcolaQuantitaCostoProdotti();
  }
}

function renderProdottiTrattamento(rows) {
  const tbody = document.getElementById('tbody-prodotti-trattamento');
  if (!tbody) return;
  const superficie = parseFloat(document.getElementById('trattamento-superficie')?.value) || 0;
  const source = rows && rows.length ? rows : [{ prodottoId: null, prodotto: '', dosaggio: null, costo: 0 }];
  tbody.innerHTML = source.map((row, idx) => {
    const dose = row.dosaggio != null && !Number.isNaN(Number(row.dosaggio)) ? Number(row.dosaggio) : null;
    const anag = listProdottiAnagrafica.find((item) => item.id === row.prodottoId);
    const qta = dose != null && superficie > 0 ? dose * superficie : (row.quantita != null ? Number(row.quantita) : null);
    const prezzo = anag && anag.prezzoUnitario != null ? Number(anag.prezzoUnitario) : null;
    const costo = qta != null && prezzo > 0 ? qta * prezzo : (Number(row.costo) || 0);
    const unita = row.unitaDosaggio || (anag && anag.unitaMisura) || '—';
    const opts = listProdottiAnagrafica.map((item) => {
      const selected = item.id === row.prodottoId ? ' selected' : '';
      return `<option value="${escapeHtml(item.id)}"${selected}>${escapeHtml(item.nome || item.codice || item.id)}</option>`;
    }).join('');
    const altro = !row.prodottoId && row.prodotto;
    return `<tr data-idx="${idx}">
      <td>
        <select class="prodotto-select" data-idx="${idx}">
          <option value="">— Seleziona o Altro —</option>${opts}
        </select>
        <input type="text" class="prodotto-nome-altro" data-idx="${idx}" placeholder="Nome se Altro" value="${altro ? escapeHtml(row.prodotto) : ''}" style="margin-top:4px;display:${altro ? 'block' : 'none'};width:100%">
      </td>
      <td><input type="number" class="prodotto-dosaggio" data-idx="${idx}" min="0" step="0.01" value="${dose != null ? dose : ''}" style="width:75px"></td>
      <td><span class="prodotto-unita">${escapeHtml(unita)}</span></td>
      <td><span class="prodotto-quantita">${qta != null ? qta.toFixed(2) : '—'}</span></td>
      <td><input type="number" class="prodotto-costo" data-idx="${idx}" min="0" step="0.01" value="${(Number(costo) || 0).toFixed(2)}" ${row.prodottoId && prezzo > 0 ? 'readonly' : ''} style="width:100px"></td>
      <td><button type="button" class="btn btn-sm btn-danger rimuovi-prodotto" data-idx="${idx}">🗑️</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.prodotto-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const idx = sel.getAttribute('data-idx');
      const nome = tbody.querySelector(`.prodotto-nome-altro[data-idx="${idx}"]`);
      if (nome) nome.style.display = sel.value ? 'none' : 'block';
      const opt = listProdottiAnagrafica.find((item) => item.id === sel.value);
      const doseInput = tbody.querySelector(`.prodotto-dosaggio[data-idx="${idx}"]`);
      if (opt && doseInput && (opt.dosaggioMin != null || opt.dosaggioMax != null)) {
        doseInput.value = opt.dosaggioMin != null ? opt.dosaggioMin : opt.dosaggioMax;
      }
      ricalcolaQuantitaCostoProdotti();
    });
  });
  tbody.querySelectorAll('.prodotto-dosaggio, .prodotto-costo').forEach((input) => {
    input.addEventListener('input', () => ricalcolaQuantitaCostoProdotti());
  });
  tbody.querySelectorAll('.rimuovi-prodotto').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = getProdottiRowsFromTable();
      current.splice(Number(btn.getAttribute('data-idx')), 1);
      renderProdottiTrattamento(current);
    });
  });
  aggiornaTotaleCostoProdotti();
  aggiornaGiorniCarenzaDaProdotti();
}

function getProdottiRowsFromTable() {
  const tbody = document.getElementById('tbody-prodotti-trattamento');
  if (!tbody) return [];
  const superficie = parseFloat(document.getElementById('trattamento-superficie')?.value) || 0;
  return Array.from(tbody.querySelectorAll('tr[data-idx]')).map((tr) => {
    const sel = tr.querySelector('.prodotto-select');
    const nomeAltro = tr.querySelector('.prodotto-nome-altro');
    const dosaggioInp = tr.querySelector('.prodotto-dosaggio');
    const costoInp = tr.querySelector('.prodotto-costo');
    const prodottoId = sel && sel.value ? sel.value : null;
    const anag = listProdottiAnagrafica.find((item) => item.id === prodottoId);
    const prodotto = prodottoId
      ? (anag && (anag.nome || anag.codice)) || prodottoId
      : (nomeAltro && nomeAltro.value.trim()) || '';
    const dosaggio = dosaggioInp && dosaggioInp.value !== '' ? parseFloat(dosaggioInp.value) : null;
    const costo = costoInp && costoInp.value !== '' ? parseFloat(costoInp.value) : 0;
    const quantita = dosaggio != null && superficie > 0 ? Math.round(dosaggio * superficie * 100) / 100 : null;
    return {
      prodottoId,
      prodotto,
      dosaggio,
      unitaDosaggio: anag ? anag.unitaMisura || null : null,
      quantita,
      costo
    };
  });
}

function ricalcolaQuantitaCostoProdotti() {
  const tbody = document.getElementById('tbody-prodotti-trattamento');
  if (!tbody) return;
  const superficie = parseFloat(document.getElementById('trattamento-superficie')?.value) || 0;
  tbody.querySelectorAll('tr[data-idx]').forEach((tr) => {
    const sel = tr.querySelector('.prodotto-select');
    const doseInput = tr.querySelector('.prodotto-dosaggio');
    const costoInput = tr.querySelector('.prodotto-costo');
    const prodottoId = sel && sel.value ? sel.value : null;
    const anag = listProdottiAnagrafica.find((item) => item.id === prodottoId);
    const dosaggio = doseInput && doseInput.value !== '' ? parseFloat(doseInput.value) : null;
    const qta = dosaggio != null && superficie > 0 ? dosaggio * superficie : null;
    const prezzo = anag && anag.prezzoUnitario != null ? Number(anag.prezzoUnitario) : null;
    const unita = tr.querySelector('.prodotto-unita');
    const quantita = tr.querySelector('.prodotto-quantita');
    if (unita) unita.textContent = (anag && anag.unitaMisura) || '—';
    if (quantita) quantita.textContent = qta != null ? qta.toFixed(2) : '—';
    if (costoInput && prodottoId && prezzo > 0 && qta != null) {
      costoInput.value = (qta * prezzo).toFixed(2);
      costoInput.readOnly = true;
    } else if (costoInput) {
      costoInput.readOnly = false;
    }
  });
  aggiornaTotaleCostoProdotti();
  aggiornaGiorniCarenzaDaProdotti();
}

function aggiornaTotaleCostoProdotti() {
  const totale = getProdottiRowsFromTable().reduce((sum, row) => sum + (Number(row.costo) || 0), 0);
  const el = document.getElementById('totale-costo-prodotti-trattamento');
  if (el) el.textContent = 'Totale costo prodotti: ' + totale.toFixed(2) + ' €';
}

function aggiornaGiorniCarenzaDaProdotti() {
  let maxCarenza = null;
  getProdottiRowsFromTable().forEach((row) => {
    const prod = listProdottiAnagrafica.find((item) => item.id === row.prodottoId);
    if (prod && prod.giorniCarenza != null && Number(prod.giorniCarenza) > (maxCarenza || 0)) {
      maxCarenza = Number(prod.giorniCarenza);
    }
  });
  const input = document.getElementById('trattamento-giorni-carenza');
  if (input && maxCarenza != null) input.value = String(maxCarenza);
}

function validaDosaggiProdotti(rows) {
  const avviso = avvisoDosaggioProdotti(rows, listProdottiAnagrafica);
  return avviso.hasWarning ? { valid: false, message: avviso.tooltip } : { valid: true };
}

async function loadProdottiAnagrafica() {
  try {
    const { getAllProdotti } = await import(resolvePath('../../../modules/magazzino/services/prodotti-service.js'));
    listProdottiAnagrafica = await getAllProdotti({ soloAttivi: true }) || [];
  } catch (err) {
    console.warn('[trattamenti] Anagrafica prodotti non disponibile:', err);
    listProdottiAnagrafica = [];
  }
}

async function openModal(row) {
  editingRow = row;
  const trattamento = row.trattamento;
  document.getElementById('trattamento-id').value = trattamento ? trattamento.id || '' : '';
  const superficie = document.getElementById('trattamento-superficie');
  if (superficie) superficie.value = superficieDefault(row);
  const anagrafe = document.getElementById('trattamento-superficie-anagrafe');
  if (anagrafe) anagrafe.checked = !!(trattamento && trattamento.superficieDaAnagrafeTerreno);
  const note = document.getElementById('trattamento-note');
  if (note) note.value = trattamento ? trattamento.note || '' : '';
  const meteo = document.getElementById('trattamento-condizioni-meteo');
  if (meteo) meteo.value = trattamento && trattamento.condizioniMeteo ? trattamento.condizioniMeteo : '';
  const copertura = document.getElementById('trattamento-copertura-terreno');
  if (copertura) copertura.value = trattamento && trattamento.coperturaTerreno ? trattamento.coperturaTerreno : 'non_dichiarata';
  const carenza = document.getElementById('trattamento-giorni-carenza');
  if (carenza) carenza.value = trattamento && trattamento.giorniCarenza != null ? trattamento.giorniCarenza : '';
  const operatore = document.getElementById('trattamento-operatore');
  if (operatore) operatore.value = trattamento ? trattamento.operatore || '' : '';
  const operatoreGroup = document.getElementById('trattamento-operatore-group');
  const proprietario = document.getElementById('trattamento-proprietario-message');
  if (operatoreGroup) operatoreGroup.style.display = hasManodopera ? '' : 'none';
  if (proprietario) proprietario.style.display = hasManodopera ? 'none' : '';
  const scaricoGroup = document.getElementById('trattamento-scarico-magazzino-group');
  if (scaricoGroup) scaricoGroup.style.display = hasMagazzino ? '' : 'none';
  const scarico = document.getElementById('trattamento-registra-scarico-magazzino');
  if (scarico) scarico.checked = !!(trattamento && trattamento.magazzinoMovimentoIds && trattamento.magazzinoMovimentoIds.length);
  const rows = trattamento && trattamento.prodotti && trattamento.prodotti.length
    ? trattamento.prodotti
    : [{ prodottoId: null, prodotto: '', dosaggio: null, costo: 0 }];
  renderProdottiTrattamento(rows);
  try {
    const { getDatiPrecompilazioneTrattamento } = await import(resolvePath('../../vigneto/services/trattamenti-vigneto-service.js'));
    const prefill = await getDatiPrecompilazioneTrattamento(null, trattamento || {
      lavoroId: row.lavoroId,
      attivitaId: row.attivitaId
    });
    const mano = document.getElementById('trattamento-costo-mano');
    const macchina = document.getElementById('trattamento-costo-macchina');
    if (mano) mano.value = (Number(prefill.costoManodopera) || 0).toFixed(2);
    if (macchina) macchina.value = (Number(prefill.costoMacchina) || 0).toFixed(2);
  } catch (err) {
    console.warn('[trattamenti] prefill costi:', err);
  }
  const title = document.getElementById('modal-trattamento-title');
  if (title) title.textContent = trattamento ? registro.modifica : registro.completa;
  const info = document.getElementById('trattamento-contesto');
  if (info) {
    info.textContent = `${row.data || ''} · ${row.tipoLavoro || ''} · ${getTerrenoLabel(row.terrenoId)} · ${campagnaLabel(row)}`;
  }
  document.getElementById('modal-trattamento').classList.add('active');
}

function closeModal() {
  editingRow = null;
  const modal = document.getElementById('modal-trattamento');
  if (modal) modal.classList.remove('active');
}

export function openSeminativoTrattamentoModal() {
  if (!editingRow && visible.length === 1 && !visible[0].trattamento) {
    openModal(visible[0]);
    return;
  }
  if (!editingRow) {
    alert('Scegli Completa sulla riga del lavoro o dell\'attività da integrare.');
  }
}

async function onSubmit(event) {
  event.preventDefault();
  if (!editingRow) return;
  const rowsProdotti = getProdottiRowsFromTable().filter((row) => String(row.prodotto || '').trim());
  if (!rowsProdotti.length) {
    alert('Aggiungi almeno una riga prodotto con nome.');
    return;
  }
  const checkDose = validaDosaggiProdotti(rowsProdotti);
  if (!checkDose.valid && !window.confirm('Attenzione: ' + checkDose.message + ' Salvare comunque?')) return;
  const anagrafe = document.getElementById('trattamento-superficie-anagrafe');
  const usaAnagrafe = !!(anagrafe && anagrafe.checked);
  if (usaAnagrafe) applySuperficieAnagrafe();
  const superficie = parseFloat(document.getElementById('trattamento-superficie').value);
  const { inferTipoTrattamentoColturaFromTipoLavoroNome } = await import(resolvePath('../../../core/config/trattamenti-lavoro-defaults.js'));
  const tipoEsistente = editingRow.trattamento && editingRow.trattamento.tipoTrattamento;
  const scaricoGroup = document.getElementById('trattamento-scarico-magazzino-group');
  const registra = scaricoGroup && scaricoGroup.style.display !== 'none'
    ? !!document.getElementById('trattamento-registra-scarico-magazzino')?.checked
    : undefined;
  try {
    await saveTrattamentoSeminativo({
      id: document.getElementById('trattamento-id').value || null,
      campagnaId: editingRow.campagnaId,
      terrenoId: editingRow.terrenoId,
      lavoroId: editingRow.lavoroId,
      attivitaId: editingRow.attivitaId,
      data: editingRow.data,
      tipoLavoro: editingRow.tipoLavoro,
      tipoTrattamento: tipoEsistente || inferTipoTrattamentoColturaFromTipoLavoroNome(editingRow.tipoLavoro),
      prodotti: rowsProdotti,
      superficieTrattata: Number.isFinite(superficie) ? superficie : null,
      superficieDaAnagrafeTerreno: usaAnagrafe,
      giorniCarenza: document.getElementById('trattamento-giorni-carenza').value,
      costoManodopera: document.getElementById('trattamento-costo-mano').value,
      costoMacchina: document.getElementById('trattamento-costo-macchina').value,
      note: document.getElementById('trattamento-note').value,
      condizioniMeteo: document.getElementById('trattamento-condizioni-meteo').value || null,
      coperturaTerreno: document.getElementById('trattamento-copertura-terreno').value,
      operatore: document.getElementById('trattamento-operatore')?.value || '',
      magazzinoMovimentoIds: editingRow.trattamento ? editingRow.trattamento.magazzinoMovimentoIds : []
    }, registra === undefined ? {} : { registraScaricoMagazzino: registra });
    closeModal();
    await loadRighe();
  } catch (err) {
    console.error('[trattamenti]', err);
    alert(err.message || 'Errore nel salvataggio');
  }
}

async function confirmDelete(index) {
  const row = visible[index];
  if (!row || !row.trattamento || !row.trattamento.id) return;
  if (!window.confirm('Eliminare i dati prodotto di questo trattamento? Il lavoro o l\'attività nel diario restano.')) return;
  await deleteTrattamentoSeminativo(row.trattamento.id);
  await loadRighe();
}

async function loadRighe() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  const data = await listRigheTrattamento({
    includeLavori: hasManodopera,
    categoria: registro.categoria
  });
  await loadProdottiAnagrafica();
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
  const form = document.getElementById('form-trattamento');
  if (form) form.addEventListener('submit', onSubmit);
  const closeBtn = document.getElementById('btn-close-trattamento-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  const addProdotto = document.getElementById('btn-aggiungi-prodotto-trattamento');
  if (addProdotto) {
    addProdotto.addEventListener('click', () => {
      const rows = getProdottiRowsFromTable();
      rows.push({ prodottoId: null, prodotto: '', dosaggio: null, costo: 0 });
      renderProdottiTrattamento(rows);
    });
  }
  const superficie = document.getElementById('trattamento-superficie');
  if (superficie) superficie.addEventListener('input', () => ricalcolaQuantitaCostoProdotti());
  const anagrafe = document.getElementById('trattamento-superficie-anagrafe');
  if (anagrafe) {
    anagrafe.addEventListener('change', () => {
      if (anagrafe.checked) applySuperficieAnagrafe();
    });
  }
  window.__tonyTrattamentoCampoApi = {
    renderProdotti: renderProdottiTrattamento,
    getProdottiAnagrafica: () => listProdottiAnagrafica,
    syncSuperficieAnagrafeAfterTonyInject: async () => {
      const box = document.getElementById('trattamento-superficie-anagrafe');
      if (box) box.checked = true;
      applySuperficieAnagrafe();
    }
  };
}

async function bootRegistro() {
  publishSeminativoTableData({
    pageType: registro.pageType,
    summary: 'Caricamento dati in corso...',
    items: []
  });
  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[' + registro.log + '] Bootstrap failed:', err);
    throw err;
  }
  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
    const { getCurrentTenantId, getCurrentTenant, initializeTenantService, hasModuleAccess } = tenantServiceModule;
  initializeTenantService();
  setupEventListeners();
  window.openSeminativoTrattamentoModal = openSeminativoTrattamentoModal;
  window.applyFilters = applyFilters;

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
    hasMagazzino = await hasModuleAccess('magazzino');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'seminativo')) modules.push('seminativo');
    if (!modules.some((item) => String(item || '').toLowerCase() === 'tony')) modules.push('tony');
    syncTonyModules(modules);
    await loadRighe();
  });
}

export function initTrattamentiPage() {
  registro = REGISTRI.trattamenti;
  return bootRegistro();
}

export function initConcimazioniPage() {
  registro = REGISTRI.concimazioni;
  return bootRegistro();
}
