/**
 * UI condivisa meteo: alert in evidenza e strip pioggia minutely (One Call).
 * @module core/js/meteo-ui-helpers
 */

export function escapeMeteoHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMeteoDt(iso, { timeOnly = false } = {}) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    if (timeOnly) {
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
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

/**
 * Banner alert in cima al pannello (stile avviso operativo).
 * @param {object|null|undefined} meteo
 * @param {{ cssPrefix?: string }} [opts] cssPrefix: 'meteo' | 'dashboard-meteo'
 */
export function renderAlertsBanner(meteo, opts = {}) {
  const prefix = opts.cssPrefix || 'meteo';
  const alerts = meteo && Array.isArray(meteo.alerts) ? meteo.alerts : [];
  if (!alerts.length) return '';

  const esc = escapeMeteoHtml;
  const items = alerts
    .map((a) => {
      const desc = (a.description || '').trim();
      const shortDesc = desc.length > 320 ? `${desc.slice(0, 320)}…` : desc;
      return `
      <article class="${prefix}-alert-banner__item" role="alert">
        <p class="${prefix}-alert-banner__title">⚠ ${esc(a.event || 'Avviso meteo')}</p>
        <p class="${prefix}-alert-banner__when">${esc(formatMeteoDt(a.start))}${a.end ? ' → ' + esc(formatMeteoDt(a.end)) : ''}</p>
        ${a.sender ? `<p class="${prefix}-alert-banner__sender">${esc(a.sender)}</p>` : ''}
        ${shortDesc ? `<p class="${prefix}-alert-banner__text">${esc(shortDesc)}</p>` : ''}
      </article>`;
    })
    .join('');

  return `<div class="${prefix}-alert-banner">${items}</div>`;
}

/**
 * Strip/barra pioggia prossimi 60 min (campo minutely One Call).
 * @param {object|null|undefined} meteo
 * @param {{ cssPrefix?: string }} [opts]
 */
export function renderMinutelyPrecipStrip(meteo, opts = {}) {
  const prefix = opts.cssPrefix || 'meteo';
  const esc = escapeMeteoHtml;
  const minutely = meteo && Array.isArray(meteo.minutely) ? meteo.minutely : [];
  if (!minutely.length) {
    return `<section class="${prefix}-minutely" aria-label="Pioggia prossima ora">
      <h3 class="${prefix}-sub">Pioggia prossima ora</h3>
      <p class="${prefix}-muted">Dati minuto per minuto non disponibili.</p>
    </section>`;
  }

  const summary = meteo.minutelySummary || {};
  const maxP =
    summary.maxPrecipitation != null
      ? summary.maxPrecipitation
      : Math.max(...minutely.map((m) => m.precipitation || 0), 0);
  const scaleMax = maxP > 0 ? maxP : 1;

  const bars = minutely
    .map((m, idx) => {
      const p = m.precipitation || 0;
      const h = p > 0 ? Math.max(8, Math.round((p / scaleMax) * 100)) : 4;
      const rainCl = p > 0 ? `${prefix}-minutely__bar-fill--rain` : '';
      const label =
        idx === 0 || idx === minutely.length - 1 || idx % 15 === 0
          ? esc(formatMeteoDt(m.dt, { timeOnly: true }))
          : '';
      return `<div class="${prefix}-minutely__bar" title="${esc(formatMeteoDt(m.dt, { timeOnly: true }))} · ${p} mm/h">
        <div class="${prefix}-minutely__bar-fill ${rainCl}" style="height:${h}%"></div>
        ${label ? `<span class="${prefix}-minutely__bar-label">${label}</span>` : '<span class="' + prefix + '-minutely__bar-label" aria-hidden="true"></span>'}
      </div>`;
    })
    .join('');

  const summaryLine = summary.hasRainSoon
    ? `Pioggia prevista nei prossimi 60 min (max ${maxP} mm/h, ${summary.minutesWithRain || '—'} min con precipitazioni).`
    : 'Nessuna pioggia prevista nell’ora successiva su questo punto.';

  return `<section class="${prefix}-minutely" aria-label="Pioggia prossima ora">
    <h3 class="${prefix}-sub">Pioggia prossima ora</h3>
    <p class="${prefix}-minutely__summary">${esc(summaryLine)}</p>
    <div class="${prefix}-minutely__chart" role="img" aria-label="${esc(summaryLine)}">${bars}</div>
    <p class="${prefix}-minutely__legend">Intensità in mm/h · fonte One Call (punto sul campo)</p>
  </section>`;
}

/** Mostra badge pop sulle chip orarie solo da questo valore in su (percentuale). */
export const METEO_HOURLY_POP_SHOW_MIN = 1;

/** Differenza minima daily vs ore restanti per mostrare nota di disallineamento. */
export const METEO_DAILY_POP_NOTE_DELTA = 15;

/**
 * Etichetta breve mm pioggia per UI (es. "12 mm").
 * @param {number|null|undefined} rainMm
 * @returns {string}
 */
export function formatRainMmShort(rainMm) {
  const v = rainMm != null ? Number(rainMm) : null;
  if (v == null || !Number.isFinite(v) || v <= 0) return '';
  const rounded = Math.round(v * 10) / 10;
  return `${rounded} mm`;
}

/**
 * Compatta previsioni giornaliere (~8 giorni) per contesto Tony / currentTableData.
 * @param {Array<object>|null|undefined} dailyExtended
 * @returns {Array<{ dt: string|null, tempMin: number|null, tempMax: number|null, pop: number|null, rainMm: number|null, description: string }>}
 */
export function compactDailyExtendedForContext(dailyExtended, opts = {}) {
  const slim = !!opts.slim;
  if (!Array.isArray(dailyExtended) || !dailyExtended.length) return [];
  return dailyExtended.map((d) => {
    const dtRaw = d && d.dt ? String(d.dt) : null;
    const dt = dtRaw ? dtRaw.slice(0, 10) : null;
    const base = {
      dt,
      tempMin: d && d.tempMin != null ? d.tempMin : null,
      tempMax: d && d.tempMax != null ? d.tempMax : null,
      pop: d && d.pop != null ? d.pop : null,
      rainMm: d && d.rainMm != null ? d.rainMm : null,
      windSpeedKmh: d && d.windSpeedKmh != null ? d.windSpeedKmh : null,
      humidity: d && d.humidity != null ? d.humidity : null,
    };
    if (slim) return base;
    return Object.assign({}, base, {
      description: d && d.description ? String(d.description) : '',
    });
  });
}

/**
 * Probabilità pioggia massima sulle ore orarie ancora da venire oggi (locale).
 * @param {object|null|undefined} meteo
 * @param {Date} [now]
 * @returns {number|null}
 */
export function maxRemainingHourlyPop(meteo, now = new Date()) {
  const hourly = meteo && Array.isArray(meteo.hourly) ? meteo.hourly : [];
  if (!hourly.length) return null;
  const todayKey = now.toDateString();
  const cutoffMs = now.getTime() - 45 * 60 * 1000;
  let max = null;
  for (const h of hourly) {
    if (!h || !h.dt) continue;
    const d = new Date(h.dt);
    if (Number.isNaN(d.getTime())) continue;
    if (d.toDateString() !== todayKey) continue;
    if (d.getTime() < cutoffMs) continue;
    const pop = h.pop != null ? Number(h.pop) : null;
    if (pop == null || !Number.isFinite(pop)) continue;
    max = max == null ? pop : Math.max(max, pop);
  }
  return max;
}

/**
 * Testi riga previsione "Oggi" (operativo + nota eventuale disallineamento daily OW).
 * @param {object|null|undefined} meteo
 * @param {Date} [now]
 * @returns {{ main: string, note: string }}
 */
export function buildTodayForecastCopy(meteo, now = new Date()) {
  const today = (meteo && meteo.today) || {};
  const tempPart =
    today.tempMin != null && today.tempMax != null
      ? `Oggi ${today.tempMin}–${today.tempMax}°C`
      : '';
  if (!tempPart) return { main: '', note: '' };

  const maxRemaining = maxRemainingHourlyPop(meteo, now);
  const dailyPop = today.pop != null ? Number(today.pop) : null;
  const hasHourly = meteo && Array.isArray(meteo.hourly) && meteo.hourly.length > 0;

  if (hasHourly && maxRemaining != null) {
    let main = `${tempPart} · prob. pioggia max (ore restanti): ${maxRemaining}%`;
    const rainLabel = formatRainMmShort(today.rainMm);
    if (rainLabel) main += ` · ${rainLabel} previsti in giornata`;
    if (today.description) main += ` · ${today.description}`;
    let note = '';
    if (
      dailyPop != null &&
      Number.isFinite(dailyPop) &&
      dailyPop - maxRemaining >= METEO_DAILY_POP_NOTE_DELTA
    ) {
      note =
        `Prob. pioggia in giornata (modello OpenWeather): ${dailyPop}% — ` +
        'può includere ore passate o differire dalle ore mostrate.';
    }
    return { main, note };
  }

  if (dailyPop != null && Number.isFinite(dailyPop)) {
    let main = `${tempPart} · prob. pioggia in giornata: ${dailyPop}%`;
    const rainLabel = formatRainMmShort(today.rainMm);
    if (rainLabel) main += ` · ${rainLabel} previsti`;
    return {
      main,
      note: '',
    };
  }

  if (today.description) {
    return { main: `${tempPart} · ${today.description}`, note: '' };
  }
  return { main: tempPart, note: '' };
}

/**
 * Badge percentuale pioggia su chip oraria.
 * @param {number|null|undefined} pop
 * @param {string} [cssPrefix]
 */
export function renderHourlyPopBadge(pop, cssPrefix = 'meteo') {
  const n = pop != null ? Number(pop) : null;
  if (n == null || !Number.isFinite(n) || n < METEO_HOURLY_POP_SHOW_MIN) return '';
  return `<span class="${cssPrefix}-hour-chip__pop">${escapeMeteoHtml(n)}%</span>`;
}

/**
 * Badge mm pioggia su chip oraria (quando disponibile da One Call).
 * @param {number|null|undefined} rainMm
 * @param {string} [cssPrefix]
 */
export function renderHourlyRainBadge(rainMm, cssPrefix = 'meteo') {
  const label = formatRainMmShort(rainMm);
  if (!label) return '';
  return `<span class="${cssPrefix}-hour-chip__rain">${escapeMeteoHtml(label)}</span>`;
}

/**
 * Compatta riga terreno da risposta getMeteoTerreni (allineato a CF compactTerrenoMeteoRow).
 * @param {object|null} row
 */
export function compactTerrenoMeteoRowFromFetch(row) {
  if (!row) return null;
  const m = row.meteo || {};
  const c = m.current || {};
  const today = m.today || {};
  const tomorrow = m.tomorrow || {};
  const alerts = Array.isArray(m.alerts) ? m.alerts : [];
  const ms = m.minutelySummary || {};
  return {
    terrenoId: row.terrenoId,
    nome: row.nome,
    podere: row.podere || null,
    ok: !!row.ok,
    temp: c.temp != null ? c.temp : null,
    description: c.description || '',
    windSpeedKmh: c.windSpeedKmh != null ? c.windSpeedKmh : null,
    popOggi: today.pop != null ? today.pop : null,
    popDomani: tomorrow.pop != null ? tomorrow.pop : null,
    previsioniGiornaliere: compactDailyExtendedForContext(m.dailyExtended, { slim: true }),
    alertsCount: alerts.length,
    hasRainSoon: !!ms.hasRainSoon,
  };
}

/**
 * Compatta meteo sede da risposta getMeteoTerreni / getMeteoSedeAvanzato.
 * @param {object|null} meteo
 */
export function compactSedeMeteoFromFetch(meteo) {
  if (!meteo) return null;
  const c = meteo.current || {};
  const today = meteo.today || {};
  const tomorrow = meteo.tomorrow || {};
  const alerts = Array.isArray(meteo.alerts) ? meteo.alerts : [];
  const ms = meteo.minutelySummary || {};
  return {
    label: (meteo.location && meteo.location.label) || 'Sede aziendale',
    temp: c.temp != null ? c.temp : null,
    description: c.description || '',
    windSpeedKmh: c.windSpeedKmh != null ? c.windSpeedKmh : null,
    humidity: c.humidity != null ? c.humidity : null,
    today: {
      tempMin: today.tempMin,
      tempMax: today.tempMax,
      pop: today.pop,
    },
    tomorrow: {
      tempMin: tomorrow.tempMin,
      tempMax: tomorrow.tempMax,
      pop: tomorrow.pop,
      description: tomorrow.description || '',
    },
    updatedAt: meteo.updatedAt || null,
    alertsCount: alerts.length,
    alertBreve: alerts[0] ? alerts[0].event || null : null,
    hasRainSoon: !!ms.hasRainSoon,
    previsioniGiornaliere: compactDailyExtendedForContext(meteo.dailyExtended, { slim: true }),
  };
}

/**
 * Deriva valore condizioniMeteo per form trattamento da riga meteo compatta.
 * @param {object|null|undefined} row
 * @param {{ ventoMaxKmh?: number }} [opts]
 * @returns {'sereno'|'nuvoloso'|'pioggia'|'vento forte'|null}
 */
export function deriveCondizioniMeteoFromCompactRow(row, opts = {}) {
  if (!row || !row.ok) return null;
  const ventoMax = opts.ventoMaxKmh != null ? opts.ventoMaxKmh : 15;
  if (row.hasRainSoon || (row.popOggi != null && row.popOggi > 50)) return 'pioggia';
  if (row.windSpeedKmh != null && row.windSpeedKmh > ventoMax) return 'vento forte';
  const desc = String(row.description || '').toLowerCase();
  if (/piogg|rovesc|temporal|grandine|acquazz/.test(desc)) return 'pioggia';
  if (/vent/i.test(desc) && row.windSpeedKmh != null && row.windSpeedKmh > 10) return 'vento forte';
  if (/nuvol|copert|annuv|nebb/.test(desc)) return 'nuvoloso';
  if (/seren|sole|clear|poco nuvol/.test(desc)) return 'sereno';
  if (row.description) return 'nuvoloso';
  return null;
}

/**
 * Mostra hint visivo accanto al campo condizioni meteo (solo suggerimento UI).
 * @param {HTMLElement} selectEl
 * @param {string} suggestedValue
 */
export function showCondizioniMeteoSuggestHint(selectEl, suggestedValue) {
  if (!selectEl || !suggestedValue) return;
  const wrap = selectEl.closest('.form-group') || selectEl.parentElement;
  if (!wrap) return;
  const hintId = 'trattamento-condizioni-meteo-hint';
  let hint = wrap.querySelector('#' + hintId);
  if (!hint) {
    hint = document.createElement('small');
    hint.id = hintId;
    hint.style.display = 'block';
    hint.style.color = '#856404';
    hint.style.marginTop = '6px';
    wrap.appendChild(hint);
  }
  hint.textContent =
    'Suggerimento meteo sul terreno: «' +
    suggestedValue +
    '». Conferma o modifica prima di salvare.';
}

export function renderAlertsList(meteo, opts = {}) {
  const prefix = opts.cssPrefix || 'meteo';
  const esc = escapeMeteoHtml;
  const alerts = meteo && Array.isArray(meteo.alerts) ? meteo.alerts : [];
  if (!alerts.length) {
    return `<p class="${prefix}-muted">Nessun alert meteo attivo per questa zona.</p>`;
  }
  return alerts
    .map(
      (a) => `
    <article class="${prefix}-alert" role="alert">
      <h4>${esc(a.event || 'Avviso')}</h4>
      <p class="${prefix}-alert__when">${esc(formatMeteoDt(a.start))}${a.end ? ' → ' + esc(formatMeteoDt(a.end)) : ''}</p>
      <p class="${prefix}-alert__text">${esc(a.description || '')}</p>
    </article>`
    )
    .join('');
}
