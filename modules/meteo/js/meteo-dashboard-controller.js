/**
 * Controller pagina modulo Meteo — mappa satellitare + pannello dettaglio al click.
 * @module modules/meteo/js/meteo-dashboard-controller
 */

import { fetchMeteoTerreni } from '../../../core/services/meteo-service.js';
import { loadMappaAziendale } from '../../../core/js/dashboard-maps.js';
import {
  compactDailyExtendedForContext,
  renderAlertsBanner,
  renderAlertsList,
  renderHourlyPopBadge,
  renderHourlyRainBadge,
  formatRainMmShort,
  renderMinutelyPrecipStrip,
} from '../../../core/js/meteo-ui-helpers.js';

const OW_ICON_BASE = 'https://openweathermap.org/img/wn/';

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return '';
  }
}

function formatDay(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch (e) {
    return '';
  }
}

export function renderCurrentBlock(meteo) {
  if (!meteo) return '';
  const c = meteo.current || {};
  const iconUrl = c.icon ? `${OW_ICON_BASE}${c.icon}@2x.png` : '';
  const loc = (meteo.location && meteo.location.label) || '—';
  return `
    <div class="meteo-block__current">
      ${iconUrl ? `<img src="${escapeHtml(iconUrl)}" alt="" width="72" height="72" loading="lazy">` : ''}
      <div>
        <p class="meteo-block__place">${escapeHtml(loc)}</p>
        <p class="meteo-block__temp">${c.temp != null ? Math.round(c.temp) : '—'}°C</p>
        <p class="meteo-block__desc">${escapeHtml(c.description || '')}</p>
        <p class="meteo-block__meta">
          ${c.windSpeedKmh != null ? `Vento ${c.windSpeedKmh} km/h` : ''}
          ${c.humidity != null ? `${c.windSpeedKmh != null ? ' · ' : ''}Umidità ${c.humidity}%` : ''}
        </p>
      </div>
    </div>`;
}

export function renderAlerts(meteo) {
  return renderAlertsList(meteo, { cssPrefix: 'meteo' });
}

export function renderHourly(meteo) {
  const hourly = meteo && Array.isArray(meteo.hourly) ? meteo.hourly.slice(0, 48) : [];
  if (!hourly.length) return '<p class="meteo-muted">Previsioni orarie non disponibili.</p>';
  return `<div class="meteo-hourly-scroll">${hourly
    .map((h) => {
      const icon = h.icon ? `${OW_ICON_BASE}${h.icon}.png` : '';
      return `<div class="meteo-hour-chip">
        <span class="meteo-hour-chip__time">${escapeHtml(formatDt(h.dt))}</span>
        ${icon ? `<img src="${escapeHtml(icon)}" alt="" width="36" height="36" loading="lazy">` : ''}
        <span>${h.temp != null ? `${h.temp}°` : '—'}</span>
        ${renderHourlyPopBadge(h.pop, 'meteo')}
        ${renderHourlyRainBadge(h.rainMm, 'meteo')}
      </div>`;
    })
    .join('')}</div>`;
}

export function renderDaily(meteo) {
  const daily = meteo && Array.isArray(meteo.dailyExtended) ? meteo.dailyExtended : [];
  if (!daily.length) return '<p class="meteo-muted">Previsioni giornaliere non disponibili.</p>';
  return `<div class="meteo-daily-grid">${daily
    .map((d) => {
      const icon = d.icon ? `${OW_ICON_BASE}${d.icon}.png` : '';
      return `<span class="meteo-daily-card">
        <span class="meteo-daily-card__day">${escapeHtml(formatDay(d.dt))}</span>
        ${icon ? `<img src="${escapeHtml(icon)}" alt="" width="40" height="40" loading="lazy">` : ''}
        <span>${d.tempMin != null && d.tempMax != null ? `${d.tempMin}–${d.tempMax}°` : '—'}</span>
        ${d.pop != null ? `<span class="meteo-hour-chip__pop">Prob. in giornata ${d.pop}%</span>` : ''}
        ${formatRainMmShort(d.rainMm) ? `<span class="meteo-daily-card__rain">${escapeHtml(formatRainMmShort(d.rainMm))}</span>` : ''}
      </span>`;
    })
    .join('')}</div>`;
}

/**
 * Pannello dettaglio per un terreno selezionato sulla mappa.
 */
export function renderTerrenoDetailPanel(terreno, row) {
  const title = terreno.podere ? `${terreno.nome} · ${terreno.podere}` : terreno.nome;

  if (!row || !row.ok) {
    return `
      <section class="meteo-detail-panel">
        <h2>${escapeHtml(title || 'Terreno')}</h2>
        <p class="meteo-muted">${escapeHtml((row && row.message) || 'Meteo non disponibile per questo campo.')}</p>
        ${row && row.code === 'NO_COORDS'
          ? '<p><a href="../../../core/terreni-standalone.html">Traccia il perimetro in Terreni</a></p>'
          : ''}
      </section>`;
  }

  const m = row.meteo;

  return `
    <section class="meteo-detail-panel">
      <h2>${escapeHtml(title || 'Terreno')}</h2>
      ${terreno.coltura ? `<p class="meteo-detail-meta"><strong>Coltura:</strong> ${escapeHtml(terreno.coltura)}</p>` : ''}
      ${terreno.superficie ? `<p class="meteo-detail-meta"><strong>Superficie:</strong> ${Number(terreno.superficie).toFixed(2)} ha</p>` : ''}
      ${renderAlertsBanner(m, { cssPrefix: 'meteo' })}
      ${renderMinutelyPrecipStrip(m, { cssPrefix: 'meteo' })}
      ${renderCurrentBlock(m)}
      <h3 class="meteo-sub">Dettaglio alert</h3>
      ${renderAlerts(m)}
      <h3 class="meteo-sub">Prossime 48 ore</h3>
      ${renderHourly(m)}
      <h3 class="meteo-sub">Prossimi 8 giorni</h3>
      ${renderDaily(m)}
    </section>`;
}

export function renderSedePanel(sede) {
  if (!sede || !sede.ok || !sede.meteo) {
    return `
      <section class="meteo-panel meteo-panel--sede">
        <h2>Sede aziendale</h2>
        <p class="meteo-muted">${escapeHtml((sede && sede.message) || 'Sede non configurata.')}</p>
        <p><a href="../../../core/admin/impostazioni-standalone.html">Imposta sede in Impostazioni</a></p>
      </section>`;
  }
  return `
    <section class="meteo-panel meteo-panel--sede">
      <h2>Sede aziendale</h2>
      ${renderAlertsBanner(sede.meteo, { cssPrefix: 'meteo' })}
      ${renderCurrentBlock(sede.meteo)}
      ${renderMinutelyPrecipStrip(sede.meteo, { cssPrefix: 'meteo' })}
      <details class="meteo-sede-more">
        <summary>Alert e previsioni sede</summary>
        <h3 class="meteo-sub">Dettaglio alert</h3>
        ${renderAlerts(sede.meteo)}
        <h3 class="meteo-sub">48 ore</h3>
        ${renderHourly(sede.meteo)}
        <h3 class="meteo-sub">8 giorni</h3>
        ${renderDaily(sede.meteo)}
      </details>
    </section>`;
}

export function renderMapPlaceholder() {
  return `
    <section class="meteo-detail-panel meteo-detail-panel--hint">
      <h2>Seleziona un campo</h2>
      <p class="meteo-muted">Clicca un appezzamento sulla mappa satellitare per vedere alert, previsioni orarie e giornaliere per quel punto.</p>
      <p class="meteo-muted">I confini sono gli stessi della <strong>Mappa aziendale</strong>; i campi senza perimetro ma con coordinate compaiono come punti.</p>
    </section>`;
}

function buildMeteoTableItems(terreniRows) {
  return (terreniRows || []).map((row) => {
    const m = row && row.meteo ? row.meteo : {};
    const c = m.current || {};
    const today = m.today || {};
    const tomorrow = m.tomorrow || {};
    const alerts = Array.isArray(m.alerts) ? m.alerts : [];
    const ms = m.minutelySummary || {};
    return {
      id: row.terrenoId,
      terrenoId: row.terrenoId,
      nome: row.nome,
      podere: row.podere || null,
      ok: !!row.ok,
      temp: c.temp != null ? c.temp : null,
      description: c.description || '',
      popOggi: today.pop != null ? today.pop : null,
      popDomani: tomorrow.pop != null ? tomorrow.pop : null,
      previsioniGiornaliere: compactDailyExtendedForContext(m.dailyExtended, { slim: true }),
      windSpeedKmh: c.windSpeedKmh != null ? c.windSpeedKmh : null,
      alertsCount: alerts.length,
      hasRainSoon: !!ms.hasRainSoon,
    };
  });
}

function buildMeteoTableSummary(items, apiSummary) {
  const withMeteo = items.filter((i) => i.ok).length;
  const rainSoon = items.filter((i) => i.ok && i.hasRainSoon).length;
  const alerts = items.filter((i) => i.ok && i.alertsCount > 0).length;
  let txt = `${withMeteo} campi con meteo`;
  if (rainSoon) txt += ` · ${rainSoon} con pioggia entro circa un'ora`;
  if (alerts) txt += ` · ${alerts} con alert`;
  if (apiSummary && apiSummary.truncated) txt += ' · max 30 campi';
  return txt;
}

export function publishMeteoTonyContext({ items, summary, selectedTerrenoId = null, sede = null }) {
  window.currentTableData = {
    pageType: 'meteo_dashboard',
    summary: summary || 'Caricamento meteo…',
    items: items || [],
    selectedTerrenoId: selectedTerrenoId || null,
    sede: sede || null,
  };
  if (window.Tony && typeof window.Tony.setContext === 'function') {
    const page = (window.Tony.context && window.Tony.context.page) || {};
    window.Tony.setContext(
      'page',
      Object.assign({}, page, {
        pageType: 'meteo_dashboard',
        pagePath: window.location.pathname || '',
        tableDataSummary: window.currentTableData.summary,
        currentTableData: window.currentTableData,
        selectedTerrenoId: selectedTerrenoId || null,
      })
    );
  }
  window.dispatchEvent(
    new CustomEvent('table-data-ready', {
      detail: { currentTableData: window.currentTableData },
    })
  );
}

/**
 * @param {string} tenantId
 * @param {{
 *   sedeRoot: HTMLElement,
 *   detailRoot: HTMLElement,
 *   summaryEl?: HTMLElement,
 *   statusEl?: HTMLElement,
 *   userData: object,
 *   mapDependencies: object,
 *   initialTerrenoId?: string|null
 * }} roots
 */
export async function loadMeteoDashboard(tenantId, roots) {
  const {
    sedeRoot,
    detailRoot,
    summaryEl,
    statusEl,
    userData,
    mapDependencies,
    initialTerrenoId,
  } = roots;

  publishMeteoTonyContext({ items: [], summary: 'Caricamento dati meteo in corso…' });

  if (statusEl) statusEl.textContent = 'Caricamento dati meteo…';
  if (sedeRoot) sedeRoot.innerHTML = '';
  if (detailRoot) detailRoot.innerHTML = renderMapPlaceholder();

  let meteoByTerrenoId = new Map();
  let tableItems = [];
  let tableSummary = '';
  let tableSede = null;
  let selectedTerrenoId = initialTerrenoId || null;

  function syncTonyTableContext() {
    publishMeteoTonyContext({
      items: tableItems,
      summary: tableSummary,
      selectedTerrenoId,
      sede: tableSede,
    });
  }

  function handleTerrenoSelect(terreno, row) {
    selectedTerrenoId = terreno && terreno.id ? terreno.id : null;
    syncTonyTableContext();
    if (!detailRoot) return;
    detailRoot.innerHTML = renderTerrenoDetailPanel(terreno, row);
    if (window.matchMedia('(max-width: 900px)').matches) {
      detailRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  try {
    const data = await fetchMeteoTerreni(tenantId);
    if (!data.ok) {
      if (statusEl) statusEl.textContent = data.message || 'Errore caricamento meteo.';
      publishMeteoTonyContext({ items: [], summary: data.message || 'Meteo non disponibile.' });
      return;
    }

    if (sedeRoot) {
      sedeRoot.innerHTML = renderSedePanel(data.sede);
    }

    if (data.sede && data.sede.ok && data.sede.meteo) {
      const sm = data.sede.meteo;
      tableSede = {
        label: (sm.location && sm.location.label) || 'Sede aziendale',
        previsioniGiornaliere: compactDailyExtendedForContext(sm.dailyExtended, { slim: true }),
      };
    } else {
      tableSede = null;
    }

    const terreniList = data.terreni || [];
    meteoByTerrenoId = new Map();
    terreniList.forEach((row) => {
      if (row && row.terrenoId) meteoByTerrenoId.set(row.terrenoId, row);
    });

    tableItems = buildMeteoTableItems(terreniList);
    tableSummary = buildMeteoTableSummary(tableItems, data.summary);
    syncTonyTableContext();

    if (summaryEl && data.summary) {
      const s = data.summary;
      let txt = `${s.withMeteo} di ${s.total} campi con meteo sulla mappa`;
      if (s.withoutCoords) txt += ` · ${s.withoutCoords} senza coordinate in anagrafia`;
      if (s.truncated) txt += ' · max 30 campi';
      summaryEl.textContent = txt;
    }

    if (statusEl) statusEl.textContent = 'Caricamento mappa…';

    await loadMappaAziendale(userData, false, mapDependencies, {
      mode: 'meteo',
      containerId: 'meteo-mappa-container',
      meteoByTerrenoId,
      onTerrenoSelect: handleTerrenoSelect,
    });

    if (initialTerrenoId && meteoByTerrenoId.has(initialTerrenoId)) {
      const row = meteoByTerrenoId.get(initialTerrenoId);
      handleTerrenoSelect(
        {
          id: initialTerrenoId,
          nome: row.nome,
          podere: row.podere,
        },
        row
      );
    }

    if (statusEl) statusEl.textContent = '';
  } catch (err) {
    console.error('[meteo-dashboard]', err);
    publishMeteoTonyContext({
      items: [],
      summary:
        err && err.code === 'functions/permission-denied'
          ? 'Modulo Meteo non attivo.'
          : 'Impossibile caricare il meteo.',
    });
    if (statusEl) {
      statusEl.textContent =
        err && err.code === 'functions/permission-denied'
          ? 'Modulo Meteo non attivo o piano non idoneo.'
          : 'Impossibile caricare il meteo. Riprova più tardi.';
    }
  }
}
