/**
 * Hub Seminativo: card e numeri della campagna agricola corrente.
 * @module modules/seminativo/js/seminativo-hub-page
 */

import { formatIsoDateToItalianLong } from '../../../core/js/date-format-it.js';
import { getAllAttivita } from '../../../core/services/attivita-service.js';
import { getAllLavori } from '../../../core/services/lavori-service.js';
import { SEMINATIVO_HUB_CARDS } from '../config/seminativo-hub.js';
import {
  panoramicaHubSeminativo,
  raccolteRecentiHub,
  lavoriRecentiHub,
  testoPanoramicaHub
} from '../models/SeminativoHub.js';
import { publishSeminativoTableData } from './seminativo-page-context.js';
import { getAllSeminativi, listTerreniSeminativo } from '../services/seminativi-service.js';
import { getAllSemine } from '../services/semine-service.js';
import { getAllRaccolteSeminativo } from '../services/raccolta-service.js';

const LAVORI_HREF = '../../../core/admin/gestione-lavori-standalone.html';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderSeminativoHubCards() {
  const root = document.getElementById('seminativo-hub-cards');
  if (!root) return;
  root.innerHTML = SEMINATIVO_HUB_CARDS.map((card) => {
    const pending = card.placeholder
      ? '<span class="action-badge">In arrivo</span>'
      : '';
    const cls = card.placeholder ? 'action-card is-placeholder' : 'action-card';
    return (
      '<a href="' + escapeHtml(card.href) + '" class="' + cls + '" data-card-id="' + escapeHtml(card.id) + '">' +
        '<span class="action-icon">' + card.icon + '</span>' +
        '<span class="action-title">' + escapeHtml(card.title) + '</span>' +
        '<span class="action-description">' + escapeHtml(card.description) + '</span>' +
        pending +
      '</a>'
    );
  }).join('');
}

function formatData(iso) {
  return formatIsoDateToItalianLong(iso) || iso || '—';
}

function formatNumero(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2);
}

function paintBody(tableId, colspan, rowsHtml, emptyText) {
  const tbody = document.querySelector('#' + tableId + ' tbody');
  if (!tbody) return;
  tbody.innerHTML = rowsHtml || (
    '<tr><td colspan="' + colspan + '" class="empty-state">' + escapeHtml(emptyText) + '</td></tr>'
  );
}

function paintRaccolte(rows) {
  const html = (rows || []).map((row) => (
    '<tr>' +
      '<td>' + escapeHtml(formatData(row.data)) + '</td>' +
      '<td>' + escapeHtml(row.terrenoNome || row.colturaNome || '—') + '</td>' +
      '<td>' + escapeHtml(formatNumero(row.quantitaQli)) + '</td>' +
      '<td>' + escapeHtml(formatNumero(row.resaQliHa)) + '</td>' +
      '<td>' + escapeHtml(formatNumero(row.costoTotale)) + '</td>' +
      '<td><a class="btn-link" href="raccolta-standalone.html">Dettaglio</a></td>' +
    '</tr>'
  )).join('');
  paintBody('table-raccolte', 6, html, 'Nessuna raccolta in questa campagna');
}

function paintLavori(rows) {
  const html = (rows || []).map((row) => {
    const azione = row.source === 'diario'
      ? '<span class="badge-diario" title="Attività registrata dal Diario">Da diario</span>'
      : '<a class="btn-link" href="' + LAVORI_HREF + '?lavoroId=' + encodeURIComponent(row.id || '') + '">Dettaglio</a>';
    return (
      '<tr>' +
        '<td>' + escapeHtml(formatData(row.data)) + '</td>' +
        '<td>' + escapeHtml(row.terrenoNome || '—') + '</td>' +
        '<td>' + escapeHtml(row.tipoLavoro || '—') + '</td>' +
        '<td>' + (row.stato === 'completato' ? '✅ Completato' : escapeHtml(row.stato || '—')) + '</td>' +
        '<td>' + azione + '</td>' +
      '</tr>'
    );
  }).join('');
  paintBody('table-lavori', 5, html, 'Nessun lavoro completato in questa campagna');
}

export function paintSeminativoHub(panoramica, elenchi = {}) {
  const p = panoramica || panoramicaHubSeminativo({});
  const raccolte = elenchi.raccolte || [];
  const lavori = elenchi.lavori || [];
  const set = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };
  set('panoramica-title', 'Panoramica ' + p.campagna);
  set('stat-campagne', String(p.campagneAperte));
  set('stat-ettari', Number(p.ettari).toFixed(2));
  set('stat-semine', String(p.semine));
  set('stat-raccolte', String(p.raccolte));
  paintRaccolte(raccolte);
  paintLavori(lavori);

  const cards = SEMINATIVO_HUB_CARDS.map((card) => ({
    id: card.id,
    titolo: card.title,
    href: card.href,
    pageType: card.pageType,
    placeholder: !!card.placeholder,
    kind: 'card'
  }));

  publishSeminativoTableData({
    pageType: 'seminativo_hub',
    summary: testoPanoramicaHub(p)
      + ' Raccolte recenti: ' + raccolte.length
      + '. Lavori: ' + lavori.length + '.',
    campagna: p.campagna,
    campagneAperte: p.campagneAperte,
    ettari: p.ettari,
    semine: p.semine,
    raccolte: p.raccolte,
    cards,
    items: cards.concat(
      raccolte.map((row) => ({ kind: 'raccolta', ...row })),
      lavori.map((row) => ({ kind: 'lavoro', ...row }))
    )
  });
}

export async function refreshSeminativoHub(options = {}) {
  const includeLavori = options.includeLavori !== false;
  const [campagne, semine, raccolte, terreni, attivita, lavori] = await Promise.all([
    getAllSeminativi().catch(() => []),
    getAllSemine().catch(() => []),
    getAllRaccolteSeminativo().catch(() => []),
    listTerreniSeminativo().catch(() => []),
    getAllAttivita().catch(() => []),
    includeLavori ? getAllLavori().catch(() => []) : Promise.resolve([])
  ]);
  const panoramica = panoramicaHubSeminativo({ campagne, semine, raccolte });
  const elenchi = {
    raccolte: raccolteRecentiHub({
      campagna: panoramica.campagna,
      campagne,
      raccolte,
      terreni
    }),
    lavori: lavoriRecentiHub({
      campagna: panoramica.campagna,
      terreni,
      attivita,
      lavori,
      includeLavori
    })
  };
  paintSeminativoHub(panoramica, elenchi);
  return { panoramica, ...elenchi };
}
