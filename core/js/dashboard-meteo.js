/**
 * Widget meteo in dashboard (base sede; espanso con modulo meteo).
 * @module core/js/dashboard-meteo
 */

import { fetchMeteoSede, fetchMeteoSedeAvanzato } from '../services/meteo-service.js';
import {
  buildTodayForecastCopy,
  renderAlertsBanner,
  renderHourlyPopBadge,
  renderMinutelyPrecipStrip,
} from './meteo-ui-helpers.js';

const OW_ICON_BASE = 'https://openweathermap.org/img/wn/';
const METEO_MODULE_HREF = '../modules/meteo/views/meteo-dashboard-standalone.html';

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

function renderAttribution() {
  return `<p class="dashboard-meteo__attribution">
      Dati meteo by <a href="https://openweathermap.org" target="_blank" rel="noopener noreferrer">OpenWeather</a>
    </p>`;
}

function renderMeteoContent(meteo, cached, { expanded = false } = {}) {
  const c = meteo.current || {};
  const tomorrow = meteo.tomorrow || {};
  const iconUrl = c.icon ? `${OW_ICON_BASE}${c.icon}@2x.png` : '';
  const label = (meteo.location && meteo.location.label) || 'Sede aziendale';
  const updated = formatUpdatedAt(meteo.updatedAt);
  const cacheNote = cached ? ' · dati in cache' : '';

  const todayCopy = buildTodayForecastCopy(meteo);
  const tomorrowLine =
    tomorrow.tempMin != null && tomorrow.tempMax != null
      ? `Domani ${tomorrow.tempMin}–${tomorrow.tempMax}°C${tomorrow.description ? ' · ' + tomorrow.description : ''}`
      : '';

  const alertsBanner =
    expanded ? renderAlertsBanner(meteo, { cssPrefix: 'dashboard-meteo' }) : '';

  const minutelyHtml =
    expanded ? renderMinutelyPrecipStrip(meteo, { cssPrefix: 'dashboard-meteo' }) : '';

  const hourly = Array.isArray(meteo.hourly) ? meteo.hourly.slice(0, 12) : [];
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

  const moduleLink = expanded
    ? `<p class="dashboard-meteo__module-link"><a href="${escapeHtml(METEO_MODULE_HREF)}" class="dashboard-meteo__link">Apri modulo Meteo →</a></p>`
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
        ${tomorrowLine ? `<p class="dashboard-meteo__forecast dashboard-meteo__forecast--muted">${escapeHtml(tomorrowLine)}</p>` : ''}
        ${alertsBanner}
        ${minutelyHtml}
        ${hourlyHtml}
        ${updated ? `<p class="dashboard-meteo__updated">Aggiornato ${escapeHtml(updated)}${cacheNote}</p>` : ''}
        ${moduleLink}
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
 * Carica e renderizza il widget meteo (#dashboard-meteo-widget).
 * @param {{ tenantId?: string|null, planId?: string, hasMeteoModule?: boolean }} options
 */
export async function initDashboardMeteo(options = {}) {
  const section = document.getElementById('dashboard-meteo-widget');
  if (!section) return;

  const planId = options.planId || window.__gfvSubscriptionPlanId || 'base';
  const tenantId = options.tenantId || null;
  const hasMeteoModule = !!options.hasMeteoModule;

  if (planId === 'free') {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  section.classList.toggle('dashboard-meteo-widget--expanded', hasMeteoModule);

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
    return;
  }

  body.innerHTML = renderMeteoMessage('Caricamento meteo…');

  try {
    const result = hasMeteoModule
      ? await fetchMeteoSedeAvanzato(tenantId)
      : await fetchMeteoSede(tenantId);

    if (!result.ok && result.code === 'SEDE_NOT_SET') {
      body.innerHTML = renderMeteoMessage(result.message || 'Sede non impostata.', {
        linkHref: './admin/impostazioni-standalone.html',
        linkLabel: 'Imposta in Impostazioni →',
      });
      return;
    }

    if (!result.ok || !result.meteo) {
      body.innerHTML = renderMeteoMessage(result.message || 'Meteo non disponibile al momento.');
      return;
    }

    body.innerHTML = renderMeteoContent(result.meteo, !!result.cached, { expanded: hasMeteoModule });
  } catch (err) {
    const code = err && err.code;
    if (code === 'functions/permission-denied') {
      if (hasMeteoModule) {
        body.innerHTML = renderMeteoMessage(
          'Attiva il modulo Meteo in Abbonamento per previsioni estese e meteo per terreno.'
        );
        return;
      }
      section.hidden = true;
      return;
    }
    console.warn('[dashboard-meteo]', err);
    body.innerHTML = renderMeteoMessage('Impossibile caricare il meteo. Riprova tra qualche minuto.');
  }
}
