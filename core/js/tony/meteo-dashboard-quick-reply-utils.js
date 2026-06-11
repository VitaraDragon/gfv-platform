/** Pure helpers — testabili senza Firebase. */

export function normalizeMeteoMsg(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function isDashboardMeteoQuestion(text) {
  var m = normalizeMeteoMsg(text);
  if (!m) return false;
  if (/\b(meteo|tempo|pioggia|piove|piovera|prevision|vento|temperatur|umidit|nuvol|sole|cielo)\b/.test(m)) {
    return true;
  }
  if (/\b(domani|oggi|dopodomani)\b/.test(m) && /\b(com|c'e|che|fa|previst)\b/.test(m)) {
    return true;
  }
  return false;
}

export function isTonyDashboardPagePath(windowRef) {
  try {
    var w = windowRef || (typeof window !== 'undefined' ? window : null);
    var p = w && w.location && w.location.pathname ? String(w.location.pathname).toLowerCase() : '';
    return p.indexOf('dashboard') >= 0;
  } catch (_) {
    return false;
  }
}

export function wantsMeteoDomani(text) {
  return /\bdomani\b/.test(normalizeMeteoMsg(text));
}

export function wantsMeteoOggi(text) {
  return /\boggi\b/.test(normalizeMeteoMsg(text));
}

export function tonyWantsDashboardRiassunto(text, opts) {
  opts = opts || {};
  var m = normalizeMeteoMsg(text).replace(/'/g, '');
  if (!m) return false;
  if (/\b(fammi|dammi|fai|voglio|dimmi|facci)\s+(un\s+)?riassunto\b/.test(m)) return true;
  if (/\b(riassunto|briefing|punto della situazione|cosa devo fare oggi)\b/.test(m)) return true;
  if (opts.allowShortConfirm && (m === 'si' || m === 'sì' || m === 'ok')) return true;
  return false;
}

/**
 * Testo riassunto dashboard: criticità operative + meteo (previsioni + alert proattivi).
 * @param {object|null|undefined} briefing - window.tonyGlobalBriefing
 * @param {string} opsText - output formatFriendlyBriefing
 */
export function buildDashboardRiassuntoText(briefing, opsText) {
  var chunks = [];
  var ops = String(opsText || '').trim();
  if (ops) chunks.push(ops);
  if (briefing && briefing.meteo) {
    var ws = briefing.meteo.weatherSummary ? String(briefing.meteo.weatherSummary).trim() : '';
    if (ws && (!ops || ops.indexOf(ws) === -1)) chunks.push(ws);
    var pt = briefing.meteo.proactiveText ? String(briefing.meteo.proactiveText).trim() : '';
    if (pt && (!ops || ops.indexOf(pt) === -1) && (!ws || pt.indexOf(ws) === -1)) chunks.push(pt);
  }
  return chunks.join(' ') || ops || 'Non ho dati aggiornati al momento.';
}

function stripTempRangeFromMeteoDescription(desc) {
  if (!desc) return '';
  var s = String(desc).trim();
  s = s.replace(/\d+(?:[.,]\d+)?\s*[\u2010-\u2015\-—–]\s*\d+(?:[.,]\d+)?\s*°?\s*C\b/gi, '').trim();
  s = s.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '').trim();
  return s;
}

export function formatMeteoDayBlock(label, day, previsioni, index) {
  var d = day;
  if (!d && previsioni && previsioni[index]) {
    var p = previsioni[index];
    d = {
      tempMin: p.tempMin,
      tempMax: p.tempMax,
      pop: p.pop,
      rainMm: p.rainMm,
      description: p.description || '',
      windSpeedKmh: p.windSpeedKmh,
    };
  }
  if (!d) return null;
  var parts = [];
  var descClean = stripTempRangeFromMeteoDescription(d.description);
  if (descClean) parts.push(descClean);
  if (d.tempMin != null && d.tempMax != null) {
    var tMin = Math.round(Number(d.tempMin));
    var tMax = Math.round(Number(d.tempMax));
    parts.push('temperature da ' + tMin + ' a ' + tMax + ' gradi');
  }
  if (d.pop != null) parts.push('probabilità pioggia ' + Math.round(Number(d.pop)) + '%');
  if (d.rainMm != null && Number(d.rainMm) > 0) {
    parts.push('pioggia prevista ' + Number(d.rainMm) + ' mm');
  }
  if (d.windSpeedKmh != null) parts.push('vento fino a ' + Math.round(Number(d.windSpeedKmh)) + ' km/h');
  if (!parts.length) return null;
  return label + ': ' + parts.join(', ') + '.';
}

export function formatSedeMeteoReply(text, sede) {
  if (!sede) return null;
  var where = sede.label || 'sede aziendale';
  if (wantsMeteoDomani(text)) {
    return formatMeteoDayBlock('Domani a ' + where, sede.tomorrow, sede.previsioniGiornaliere, 1);
  }
  if (wantsMeteoOggi(text)) {
    return formatMeteoDayBlock('Oggi a ' + where, sede.today, sede.previsioniGiornaliere, 0);
  }
  var t = sede.tomorrow || (sede.previsioniGiornaliere && sede.previsioniGiornaliere[1]);
  var o = sede.today || (sede.previsioniGiornaliere && sede.previsioniGiornaliere[0]);
  var chunks = [];
  var oggiLine = formatMeteoDayBlock('Oggi a ' + where, o, sede.previsioniGiornaliere, 0);
  var domaniLine = formatMeteoDayBlock('Domani a ' + where, t, sede.previsioniGiornaliere, 1);
  if (oggiLine) chunks.push(oggiLine);
  if (domaniLine) chunks.push(domaniLine);
  if (sede.alertBreve) chunks.push('Attenzione: ' + sede.alertBreve + '.');
  return chunks.length ? chunks.join(' ') : null;
}
