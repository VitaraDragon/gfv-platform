/**
 * Widget meteo in dashboard (base sede; espanso con modulo meteo) + pannello laterale ibrido.
 * @module core/js/dashboard-meteo
 */

import { fetchMeteoSedeWithLocalCache, getMeteoSedeCachedPayload } from '../services/meteo-service.js';
import { loadDashboardOperativitaOggiCounts } from './dashboard-data.js';
import { getDashboardCountsSnapshot, ORE_READY_EVENT } from './dashboard-counts-snapshot.js';
import {
  buildTodayForecastCopy,
  formatRainMmShort,
  renderAlertsBanner,
  renderHourlyPopBadge,
  renderMinutelyPrecipStrip,
} from './meteo-ui-helpers.js';
import { dashboardPerfAsync } from './dashboard-perf.js';

const OW_ICON_BASE = 'https://openweathermap.org/img/wn/';
const METEO_MODULE_HREF = '../modules/meteo/views/meteo-dashboard-standalone.html';
const GESTIONE_LAVORI_HREF = './admin/gestione-lavori-standalone.html';
const VALIDAZIONE_ORE_HREF = './admin/validazione-ore-standalone.html';

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatUpdatedAt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
  } catch (e) {
    return '';
  }
}

function formatShortDt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function formatForecastDayLabel(entry, fallbackLabel) {
  if (fallbackLabel) return fallbackLabel;
  if (!entry || !entry.dt) return '—';
  try {
    const d = new Date(entry.dt);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch (e) {
    return '—';
  }
}

function collectUpcomingForecastDays(meteo, maxDays = 3) {
  if (Array.isArray(meteo.dailyExtended) && meteo.dailyExtended.length > 1) {
    return meteo.dailyExtended.slice(1, 1 + maxDays).map((d) => ({ ...d }));
  }
  const out = [];
  if (meteo.tomorrow) {
    out.push(Object.assign({ label: 'Domani' }, meteo.tomorrow));
  }
  return out.slice(0, maxDays);
}

function renderAttribution() {
  return `<p class="dashboard-meteo__attribution">
      Dati meteo by <a href="https://openweathermap.org" target="_blank" rel="noopener noreferrer">OpenWeather</a>
    </p>`;
}

function renderForecastDayCard(entry) {
  const label = formatForecastDayLabel(entry, entry.label);
  const temp =
    entry.tempMin != null && entry.tempMax != null ? `${entry.tempMin}–${entry.tempMax}°C` : '—';
  const pop = entry.pop != null ? `${entry.pop}%` : '—';
  const rain = formatRainMmShort(entry.rainMm);
  const rainPart = rain ? ` · ${escapeHtml(rain)}` : '';
  const desc = entry.description ? escapeHtml(String(entry.description)) : '';

  return `<article class="dashboard-meteo-forecast-card">
    <p class="dashboard-meteo-forecast-card__day">${escapeHtml(label)}</p>
    <p class="dashboard-meteo-forecast-card__temp">${escapeHtml(temp)}</p>
    <p class="dashboard-meteo-forecast-card__meta">Pioggia ${escapeHtml(pop)}${rainPart}</p>
    ${desc ? `<p class="dashboard-meteo-forecast-card__desc">${desc}</p>` : ''}
  </article>`;
}

function renderSideForecast(meteo, { expanded = false } = {}) {
  const days = collectUpcomingForecastDays(meteo, 3);
  if (!days.length) {
    return `<section class="dashboard-meteo-side-block dashboard-meteo-side-block--forecast">
      <h3 class="dashboard-meteo-side-block__title">Prossimi giorni</h3>
      <p class="dashboard-meteo__message">Previsioni giornaliere non disponibili.</p>
    </section>`;
  }

  const cards = days.map(renderForecastDayCard).join('');
  const moduleLink = expanded
    ? `<p class="dashboard-meteo-side-block__link"><a href="${escapeHtml(METEO_MODULE_HREF)}" class="dashboard-meteo__link">Modulo Meteo →</a></p>`
    : '';

  return `<section class="dashboard-meteo-side-block dashboard-meteo-side-block--forecast">
    <h3 class="dashboard-meteo-side-block__title">Prossimi giorni</h3>
    <div class="dashboard-meteo-forecast-grid">${cards}</div>
    ${moduleLink}
  </section>`;
}

function renderKpiCard(label, value, href, tone) {
  const toneClass = tone ? ` dashboard-meteo-kpi--${tone}` : '';
  return `<a class="dashboard-meteo-kpi${toneClass}" href="${escapeHtml(href)}">
    <span class="dashboard-meteo-kpi__value">${escapeHtml(String(value))}</span>
    <span class="dashboard-meteo-kpi__label">${escapeHtml(label)}</span>
  </a>`;
}

function renderSideOperativita(snapshot) {
  const s = snapshot || { programmatiOggi: 0, inCorso: 0, oreDaValidare: 0 };
  return `<section class="dashboard-meteo-side-block dashboard-meteo-side-block--ops">
    <h3 class="dashboard-meteo-side-block__title">Operatività oggi</h3>
    <div class="dashboard-meteo-kpi-grid">
      ${renderKpiCard('Programmati oggi', s.programmatiOggi, `${GESTIONE_LAVORI_HREF}`, s.programmatiOggi > 0 ? 'info' : '')}
      ${renderKpiCard('In corso', s.inCorso, `${GESTIONE_LAVORI_HREF}?stato=in_corso`, s.inCorso > 0 ? 'active' : '')}
      ${renderKpiCard('Ore da validare', s.oreDaValidare, VALIDAZIONE_ORE_HREF, s.oreDaValidare > 0 ? 'warn' : '')}
    </div>
  </section>`;
}

function renderMeteoSidePanel(meteo, opsSnapshot, { expanded = false, hasManodopera = false } = {}) {
  const forecast = renderSideForecast(meteo, { expanded });
  const ops = hasManodopera ? renderSideOperativita(opsSnapshot) : '';
  const onlyForecast = !hasManodopera ? ' dashboard-meteo-side__inner--forecast-only' : '';
  return `<div class="dashboard-meteo-side__inner${onlyForecast}">${forecast}${ops}</div>`;
}

function renderMeteoContent(meteo, cached, { expanded = false } = {}) {
  const c = meteo.current || {};
  const iconUrl = c.icon ? `${OW_ICON_BASE}${c.icon}@2x.png` : '';
  const label = (meteo.location && meteo.location.label) || 'Sede aziendale';
  const updated = formatUpdatedAt(meteo.updatedAt);
  const cacheNote = cached ? ' · dati in cache' : '';

  const todayCopy = buildTodayForecastCopy(meteo);

  const alertsBanner =
    expanded ? renderAlertsBanner(meteo, { cssPrefix: 'dashboard-meteo' }) : '';

  const minutelyHtml =
    expanded ? renderMinutelyPrecipStrip(meteo, { cssPrefix: 'dashboard-meteo' }) : '';

  const hourly = Array.isArray(meteo.hourly) ? meteo.hourly.slice(0, 6) : [];
  const hourlyHtml =
    expanded && hourly.length
      ? `<div class="dashboard-meteo__hourly">
          <p class="dashboard-meteo__subheading">Prossime ore</p>
          <div class="dashboard-meteo__hourly-scroll">${hourly
            .map((h) => {
              const hIcon = h.icon ? `${OW_ICON_BASE}${h.icon}.png` : '';
              return `<span class="dashboard-meteo__hour-chip">
                <span class="dashboard-meteo__hour-time">${escapeHtml(formatShortDt(h.dt).split(',')[1] || formatShortDt(h.dt))}</span>
                ${hIcon ? `<img src="${escapeHtml(hIcon)}" alt="" width="32" height="32" loading="lazy">` : ''}
                <span>${h.temp != null ? `${h.temp}°` : '—'}</span>
                ${renderHourlyPopBadge(h.pop, 'dashboard-meteo')}
              </span>`;
            })
            .join('')}</div>
        </div>`
      : '';

  return `
    <span class="dashboard-meteo__main">
      ${iconUrl ? `<img class="dashboard-meteo__icon" src="${escapeHtml(iconUrl)}" alt="" width="64" height="64" loading="lazy">` : ''}
      <span class="dashboard-meteo__body">
        <p class="dashboard-meteo__location">${escapeHtml(label)}</p>
        <p class="dashboard-meteo__temp-line">
          <span class="dashboard-meteo__temp">${c.temp != null ? Math.round(c.temp) : '—'}°C</span>
          <span class="dashboard-meteo__desc">${escapeHtml(c.description || '—')}</span>
        </p>
        <p class="dashboard-meteo__meta">
          ${c.windSpeedKmh != null ? `Vento ${c.windSpeedKmh} km/h` : ''}
          ${c.humidity != null ? `${c.windSpeedKmh != null ? ' · ' : ''}Umidità ${c.humidity}%` : ''}
        </p>
        ${todayCopy.main ? `<p class="dashboard-meteo__forecast">${escapeHtml(todayCopy.main)}</p>` : ''}
        ${todayCopy.note ? `<p class="dashboard-meteo__forecast dashboard-meteo__forecast-note">${escapeHtml(todayCopy.note)}</p>` : ''}
        ${alertsBanner}
        ${minutelyHtml}
        ${hourlyHtml}
        ${updated ? `<p class="dashboard-meteo__updated">Aggiornato ${escapeHtml(updated)}${cacheNote}</p>` : ''}
      </span>
    </span>
    ${renderAttribution()}
  `;
}

function renderMeteoMessage(message, { linkHref, linkLabel } = {}) {
  const link =
    linkHref && linkLabel
      ? ` <a href="${escapeHtml(linkHref)}" class="dashboard-meteo__link">${escapeHtml(linkLabel)}</a>`
      : '';
  return `<p class="dashboard-meteo__message">${escapeHtml(message)}${link}</p>`;
}

/**
 * Carica e renderizza il widget meteo (#dashboard-meteo-widget) e pannello laterale (#dashboard-meteo-side).
 * @param {{ tenantId?: string|null, planId?: string, hasMeteoModule?: boolean, hasManodopera?: boolean, dependencies?: Object, countsSnapshot?: Object }} options
 */
export async function initDashboardMeteo(options = {}) {
  const section = document.getElementById('dashboard-meteo-widget');
  const side = document.getElementById('dashboard-meteo-side');
  const row = section && section.closest('.dashboard-meteo-row');
  if (!section) return;

  const planId = options.planId || window.__gfvSubscriptionPlanId || 'base';
  const tenantId = options.tenantId || null;
  const hasMeteoModule = !!options.hasMeteoModule;
  const hasManodopera = !!options.hasManodopera;
  const dependencies = options.dependencies || null;
  const countsSnapshot = options.countsSnapshot || getDashboardCountsSnapshot();

  function setRowVisible(visible) {
    if (row) row.hidden = !visible;
  }

  if (planId === 'free') {
    setRowVisible(false);
    return;
  }

  setRowVisible(true);
  section.classList.toggle('dashboard-meteo-widget--expanded', hasMeteoModule);
  if (side) {
    side.classList.toggle('dashboard-meteo-side--with-ops', hasManodopera);
  }

  const heading = section.querySelector('h2');
  if (heading) {
    heading.innerHTML = hasMeteoModule
      ? '<span class="section-icon" aria-hidden="true">🌦️</span> Meteo'
      : '<span class="section-icon" aria-hidden="true">🌤</span> Meteo sede';
  }

  const body = section.querySelector('.dashboard-meteo__content');
  if (!body) return;

  if (!tenantId) {
    body.innerHTML = renderMeteoMessage('Accedi con un account aziendale per vedere il meteo.');
    if (side) side.innerHTML = '';
    return;
  }

  body.innerHTML = renderMeteoMessage('Caricamento meteo…');
  if (side) side.innerHTML = '<div class="dashboard-meteo-side__inner"><p class="dashboard-meteo__message">Caricamento…</p></div>';

  const opsFromSnapshot =
    countsSnapshot && countsSnapshot.operativitaOggi ? countsSnapshot.operativitaOggi : null;

  function applyMeteoResult(result, opsSnapshot) {
    if (!result.ok && result.code === 'SEDE_NOT_SET') {
      body.innerHTML = renderMeteoMessage(result.message || 'Sede non impostata.', {
        linkHref: './admin/impostazioni-standalone.html',
        linkLabel: 'Imposta in Impostazioni →',
      });
      if (side) side.innerHTML = '';
      return;
    }

    if (!result.ok || !result.meteo) {
      body.innerHTML = renderMeteoMessage(result.message || 'Meteo non disponibile al momento.');
      if (side) side.innerHTML = '';
      return;
    }

    body.innerHTML = renderMeteoContent(result.meteo, !!result.cached, { expanded: hasMeteoModule });
    if (side) {
      side.innerHTML = renderMeteoSidePanel(result.meteo, opsSnapshot, {
        expanded: hasMeteoModule,
        hasManodopera,
      });
    }
  }

  const cachedPayload = getMeteoSedeCachedPayload(tenantId, hasMeteoModule);
  if (cachedPayload && cachedPayload.ok && cachedPayload.meteo) {
    applyMeteoResult(cachedPayload, opsFromSnapshot);
  }

  try {
    await dashboardPerfAsync('meteo.fetchAndRender', async () => {
      const opsPromise =
        hasManodopera && dependencies && !opsFromSnapshot
          ? loadDashboardOperativitaOggiCounts(tenantId, dependencies).catch(() => ({
              programmatiOggi: 0,
              inCorso: 0,
              oreDaValidare: 0,
            }))
          : Promise.resolve(opsFromSnapshot);

      const [result, opsSnapshot] = await Promise.all([
        fetchMeteoSedeWithLocalCache(tenantId, { advanced: hasMeteoModule }),
        opsPromise,
      ]);

      applyMeteoResult(result, opsSnapshot);

      if (hasManodopera) {
        window.addEventListener(ORE_READY_EVENT, () => {
          const snap = getDashboardCountsSnapshot();
          if (!snap || !snap.operativitaOggi || !side) return;
          const inner = side.querySelector('.dashboard-meteo-side__inner');
          if (!inner) return;
          const html = renderSideOperativita(snap.operativitaOggi);
          const existing = inner.querySelector('.dashboard-meteo-side-block--ops');
          if (existing) existing.outerHTML = html;
          else inner.insertAdjacentHTML('beforeend', html);
        });
      }
    });
  } catch (err) {
    const code = err && err.code;
    if (code === 'functions/permission-denied') {
      if (hasMeteoModule) {
        body.innerHTML = renderMeteoMessage(
          'Attiva il modulo Meteo in Abbonamento per previsioni estese e meteo per terreno.'
        );
        if (side) side.innerHTML = '';
        return;
      }
      setRowVisible(false);
      return;
    }
    console.warn('[dashboard-meteo]', err);
    body.innerHTML = renderMeteoMessage('Impossibile caricare il meteo. Riprova tra qualche minuto.');
    if (side) side.innerHTML = '';
  }
}
