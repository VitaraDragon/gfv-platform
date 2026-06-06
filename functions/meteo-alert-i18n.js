/**
 * Mirror CJS di core/config/meteo-alert-i18n.js (Cloud Functions).
 * @module functions/meteo-alert-i18n
 */

const METEO_ALERT_EVENT_IT = {
  "thunderstorm warning": "Avviso temporali",
  "severe thunderstorm warning": "Avviso temporali grave",
  "moderate thunderstorm warning": "Avviso temporali moderato",
  "minor thunderstorm warning": "Avviso temporali lieve",
  "rain warning": "Avviso pioggia",
  "heavy rain warning": "Avviso pioggia intensa",
  "extreme rain warning": "Avviso pioggia estrema",
  "moderate rain warning": "Avviso pioggia moderata",
  "wind warning": "Avviso vento",
  "extreme wind warning": "Avviso vento estremo",
  "moderate wind warning": "Avviso vento moderato",
  "snow warning": "Avviso neve",
  "ice warning": "Avviso ghiaccio",
  "fog warning": "Avviso nebbia",
  "heat warning": "Avviso caldo",
  "extreme heat warning": "Avviso caldo estremo",
  "cold warning": "Avviso freddo",
  "extreme cold warning": "Avviso freddo estremo",
  "forest fire warning": "Avviso incendi boschivi",
  "flood warning": "Avviso alluvioni",
  "coastal event warning": "Avviso eventi costieri",
  "avalanche warning": "Avviso valanghe",
  "thunderstorm watch": "Allerta temporali",
  "rain watch": "Allerta pioggia",
  "wind watch": "Allerta vento",
};

const DESC_PHRASES = [
  [/be aware of (?:the )?possibility of ([^.]+)\./gi, "Possibilità di $1."],
  [/be prepared for ([^.]+)\./gi, "Prepararsi a $1."],
  [/take action(?: immediately)?(?: against)? ([^.]+)\./gi, "Intervenire: $1."],
  [/thunderstorms?/gi, "temporali"],
  [/heavy rain/gi, "pioggia intensa"],
  [/extreme rain/gi, "pioggia estrema"],
  [/hail/gi, "grandine"],
  [/lightning/gi, "fulmini"],
  [/strong wind/gi, "vento forte"],
  [/gusts/gi, "raffiche"],
  [/flooding/gi, "allagamenti"],
  [/flash flood/gi, "alluvione improvvisa"],
];

function normalizeAlertKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksItalian(text) {
  const t = normalizeAlertKey(text);
  return /\b(avviso|allerta|temporali|pioggia|vento|neve|nebbia|alluvion|caldo|freddo|valanghe|incendi|protezione civile|meteoalarm)\b/.test(
    t
  );
}

function translateMeteoAlertEvent(event) {
  const raw = String(event || "").trim();
  if (!raw) return "Avviso meteo";
  if (looksItalian(raw)) return raw;

  const key = normalizeAlertKey(raw);
  if (METEO_ALERT_EVENT_IT[key]) return METEO_ALERT_EVENT_IT[key];

  const warningMatch = key.match(/^(.+?)\s+(warning|watch|advisory)$/);
  if (warningMatch) {
    const typeKey = warningMatch[1];
    const kind = warningMatch[2];
    const typeIt = METEO_ALERT_EVENT_IT[`${typeKey} warning`] || null;
    if (typeIt) return typeIt.replace(/^Avviso /, kind === "watch" ? "Allerta " : "Avviso ");
  }

  return raw;
}

function translateMeteoAlertDescription(description) {
  const raw = String(description || "").trim();
  if (!raw) return "";
  if (looksItalian(raw)) return raw;

  let out = raw;
  for (const [pattern, replacement] of DESC_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function localizeMeteoAlert(alert) {
  if (!alert || typeof alert !== "object") return alert;
  const event = translateMeteoAlertEvent(alert.event);
  const description = translateMeteoAlertDescription(alert.description);
  return Object.assign({}, alert, {
    event,
    description,
    eventOriginal: alert.eventOriginal || alert.event || "",
    descriptionOriginal: alert.descriptionOriginal || alert.description || "",
  });
}

function localizeMeteoAlerts(alerts) {
  if (!Array.isArray(alerts) || !alerts.length) return [];
  return alerts.map((a) => localizeMeteoAlert(a));
}

module.exports = {
  translateMeteoAlertEvent,
  translateMeteoAlertDescription,
  localizeMeteoAlert,
  localizeMeteoAlerts,
};
