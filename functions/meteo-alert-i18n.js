/**
 * Mirror CJS di core/config/meteo-alert-i18n.js (Cloud Functions).
 * @module functions/meteo-alert-i18n
 */

const METEO_ALERT_EVENT_IT = {
  thunderstorm: "Avviso temporali",
  thunderstorms: "Avviso temporali",
  rain: "Avviso pioggia",
  wind: "Avviso vento",
  snow: "Avviso neve",
  fog: "Avviso nebbia",
  flood: "Avviso alluvioni",
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

const METEO_ALERT_TAG_IT = {
  thunderstorm: "Avviso temporali",
  rain: "Avviso pioggia",
  wind: "Avviso vento",
  snow: "Avviso neve",
  fog: "Avviso nebbia",
  flood: "Avviso alluvioni",
  hail: "Avviso grandine",
  tornado: "Avviso tornado",
  fire: "Avviso incendi",
};

const METEO_ALERT_SENDER_IT = {
  "italian meteorological service": "Servizio Meteorologico Italiano",
  "italian air force national meteorological service":
    "Servizio Meteorologico Aeronautica Militare",
  "servizio meteorologico aeronautica militare": "Servizio Meteorologico Aeronautica Militare",
  meteoalarm: "MeteoAlarm",
  "protezione civile": "Protezione Civile",
};

const METEOALARM_REGION_IT = {
  "emilian apennines": "Appennino emiliano",
  "tuscan apennines": "Appennino toscano",
  "ligurian apennines": "Appennino ligure",
  "central apennines": "Appennino centrale",
  "northern apennines": "Appennino settentrionale",
  "southern apennines": "Appennino meridionale",
  "marche apennines": "Appennino marchigiano",
  "abruzzese apennines": "Appennino abruzzese",
  romagna: "Romagna",
  "emilia romagna": "Emilia-Romagna",
};

const METEOALARM_COLOR_PREFIX = /^(yellow|orange|red|amber|green|level\s*[123])\s+/;

const METEOALARM_INTENSITY_PHRASES = [
  [/moderate intensity weather phenomena expected/gi, "Previsti fenomeni meteo di intensità moderata"],
  [/minor intensity weather phenomena expected/gi, "Previsti fenomeni meteo di lieve intensità"],
  [/severe intensity weather phenomena expected/gi, "Previsti fenomeni meteo di grave intensità"],
  [/high intensity weather phenomena expected/gi, "Previsti fenomeni meteo di elevata intensità"],
  [/low intensity weather phenomena expected/gi, "Previsti fenomeni meteo di bassa intensità"],
  [/weather phenomena expected/gi, "Previsti fenomeni meteo"],
];

const METEOALARM_DISCLAIMER_IT =
  "Nota MeteoAlarm: le informazioni per l'Italia riguardano esclusivamente intensità e ricorrenza dei fenomeni meteo; ulteriori dettagli operativi su www.meteoam.it. I dati MeteoAlarm non forniscono una valutazione dell'impatto sul territorio né indicazioni precise su inizio e fine dei fenomeni.";

const DESC_PHRASES = [
  [/be aware and be prepared for/gi, "Attenzione e prepararsi a"],
  [/be aware of (?:the )?possibility of/gi, "Possibilità di"],
  [/be aware of/gi, "Attenzione:"],
  [/be prepared for/gi, "Prepararsi a"],
  [/take action(?: immediately)?(?: against)?/gi, "Intervenire:"],
  [/\bthere is a risk of\b/gi, "C'è il rischio di"],
  [/\bare forecast\b/gi, "sono previsti"],
  [/\bthis weather alert is in effect from\b/gi, "Allerta meteo in vigore dal"],
  [/\bthis warning is in effect from\b/gi, "Avviso in vigore dal"],
  [/\bin effect from\b/gi, "in vigore dal"],
  [/\buntil\b/gi, "fino al"],
  [/\bsource:\s*/gi, "Fonte: "],
  [/\bsevere thunderstorms?\b/gi, "temporali forti"],
  [/\bmoderate thunderstorms?\b/gi, "temporali moderati"],
  [/\bthunderstorms?\b/gi, "temporali"],
  [/\bheavy rain and\/or hail\b/gi, "pioggia intensa e/o grandine"],
  [/\bheavy rain\b/gi, "pioggia intensa"],
  [/\bextreme rain\b/gi, "pioggia estrema"],
  [/\baccompanied by\b/gi, "accompagnati da"],
  [/\bthese may be\b/gi, "potrebbero essere"],
  [/\blocal flooding\b/gi, "allagamenti locali"],
  [/\bhail\b/gi, "grandine"],
  [/\blightning\b/gi, "fulmini"],
  [/\bstrong wind\b/gi, "vento forte"],
  [/\bgusts\b/gi, "raffiche"],
  [/\bflooding\b/gi, "allagamenti"],
  [/\bflash flood\b/gi, "alluvione improvvisa"],
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
  return /\b(avviso|allerta|temporali|pioggia|vento|neve|nebbia|alluvion|caldo|freddo|valanghe|incendi|protezione civile|attenzione|possibilita|rischio|vigore|previsti|fenomeni|intensita|appennino|nota meteoalarm)\b/.test(
    t
  );
}

function sanitizeEventRaw(event) {
  let raw = String(event || "").trim();
  if (!raw) return "";
  raw = raw.split(/\r?\n/)[0].trim();
  raw = raw.replace(/\s+in effect\b.*/i, "").trim();
  return raw;
}

function stripEventPrefixes(key) {
  let k = key;
  let prev;
  do {
    prev = k;
    k = k.replace(METEOALARM_COLOR_PREFIX, "");
  } while (k !== prev);
  return k.trim();
}

function lookupEventTranslation(key) {
  if (METEO_ALERT_EVENT_IT[key]) return METEO_ALERT_EVENT_IT[key];

  const warningMatch = key.match(/^(.+?)\s+(warning|watch|advisory)$/);
  if (warningMatch) {
    const typeKey = warningMatch[1];
    const kind = warningMatch[2];
    const typeIt = METEO_ALERT_EVENT_IT[`${typeKey} warning`];
    if (typeIt) return typeIt.replace(/^Avviso /, kind === "watch" ? "Allerta " : "Avviso ");
  }

  return null;
}

function translateRegionName(regionRaw) {
  const trimmed = String(regionRaw || "").trim();
  if (!trimmed) return "";
  const key = normalizeAlertKey(trimmed);
  if (METEOALARM_REGION_IT[key]) return METEOALARM_REGION_IT[key];
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function stripMeteoAlarmDisclaimer(raw) {
  const match = raw.match(/\(?\s*DISCLAIMER\s*:/i);
  if (!match || match.index == null) return raw.trim();
  return raw.slice(0, match.index).replace(/\(\s*$/, "").trim();
}

function appendRegionToCore(core) {
  let out = core;
  out = out.replace(
    /\s+([A-Z]{2,}(?:\s+[A-Z]{2,})*)\s*$/,
    (_, region) => ` — ${translateRegionName(region.trim())}`
  );
  out = out.replace(
    /expected\s+([A-Z]{2,}(?:\s+[A-Z]{2,})*)/,
    (_, region) => ` — ${translateRegionName(region.trim())}`
  );
  return out.trim();
}

function isMeteoAlarmItalyDescription(raw) {
  return /\bDISCLAIMER\s*:|METEOALARM for Italy|weather phenomena expected/i.test(raw);
}

function translateMeteoAlarmItalyDescription(raw) {
  let core = stripMeteoAlarmDisclaimer(raw);
  let out = core;
  for (const [pattern, replacement] of DESC_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of METEOALARM_INTENSITY_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  out = appendRegionToCore(out);
  if (out && !/[.!?]$/.test(out)) out += ".";
  return out ? `${out} ${METEOALARM_DISCLAIMER_IT}` : METEOALARM_DISCLAIMER_IT;
}

function translateMeteoAlertEventFromTags(tags) {
  if (!Array.isArray(tags) || !tags.length) return null;
  for (const tag of tags) {
    const key = normalizeAlertKey(tag);
    if (METEO_ALERT_TAG_IT[key]) return METEO_ALERT_TAG_IT[key];
  }
  return null;
}

function translateMeteoAlertSender(sender) {
  const raw = String(sender || "").trim();
  if (!raw) return "";
  const key = normalizeAlertKey(raw);
  if (METEO_ALERT_SENDER_IT[key]) return METEO_ALERT_SENDER_IT[key];
  if (key.includes("italian air force") || key.includes("aeronautica militare")) {
    return "Servizio Meteorologico Aeronautica Militare";
  }
  if (key.includes("meteoalarm")) return "MeteoAlarm";
  if (key.includes("protezione civile")) return "Protezione Civile";
  if (key.includes("italian meteorological")) return "Servizio Meteorologico Italiano";
  return raw;
}

function translateMeteoAlertEvent(event, tags) {
  const raw = sanitizeEventRaw(event);
  if (!raw) return "Avviso meteo";
  if (looksItalian(raw)) return raw;

  const key = normalizeAlertKey(raw);
  let hit = lookupEventTranslation(key);
  if (hit) return hit;

  const stripped = stripEventPrefixes(key);
  if (stripped !== key) {
    hit = lookupEventTranslation(stripped);
    if (hit) return hit;
    if (METEO_ALERT_EVENT_IT[stripped]) return METEO_ALERT_EVENT_IT[stripped];
  }

  const fromTags = translateMeteoAlertEventFromTags(tags);
  if (fromTags) return fromTags;

  return raw;
}

function translateMeteoAlertDescription(description) {
  const raw = String(description || "").trim();
  if (!raw) return "";

  if (isMeteoAlarmItalyDescription(raw)) {
    return translateMeteoAlarmItalyDescription(raw);
  }

  if (looksItalian(raw)) return raw;

  let out = raw;
  for (const [pattern, replacement] of DESC_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function localizeMeteoAlert(alert) {
  if (!alert || typeof alert !== "object") return alert;
  const tags = Array.isArray(alert.tags) ? alert.tags : [];
  const event = translateMeteoAlertEvent(alert.event, tags);
  const description = translateMeteoAlertDescription(alert.description);
  const sender = translateMeteoAlertSender(alert.sender);
  return Object.assign({}, alert, {
    event,
    description,
    sender,
    eventOriginal: alert.eventOriginal || alert.event || "",
    descriptionOriginal: alert.descriptionOriginal || alert.description || "",
    senderOriginal: alert.senderOriginal || alert.sender || "",
  });
}

function localizeMeteoAlerts(alerts) {
  if (!Array.isArray(alerts) || !alerts.length) return [];
  return alerts.map((a) => localizeMeteoAlert(a));
}

module.exports = {
  translateMeteoAlertEvent,
  translateMeteoAlertEventFromTags,
  translateMeteoAlertSender,
  translateMeteoAlertDescription,
  localizeMeteoAlert,
  localizeMeteoAlerts,
};
