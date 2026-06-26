/**
 * Mirror CJS di core/config/meteo-alert-i18n.js (Cloud Functions).
 * @module functions/meteo-alert-i18n
 */

/** @type {Record<string, string>} */
const METEO_ALERT_EVENT_IT = {
  thunderstorm: 'Avviso temporali',
  thunderstorms: 'Avviso temporali',
  rain: 'Avviso pioggia',
  wind: 'Avviso vento',
  snow: 'Avviso neve',
  fog: 'Avviso nebbia',
  flood: 'Avviso alluvioni',
  heat: 'Avviso caldo',
  cold: 'Avviso freddo',
  temperature: 'Avviso temperatura',
  ice: 'Avviso ghiaccio',
  hail: 'Avviso grandine',
  drought: 'Avviso siccità',
  avalanche: 'Avviso valanghe',
  tsunami: 'Avviso tsunami',
  blizzard: 'Avviso bufera di neve',
  'thunderstorm warning': 'Avviso temporali',
  'severe thunderstorm warning': 'Avviso temporali grave',
  'moderate thunderstorm warning': 'Avviso temporali moderato',
  'minor thunderstorm warning': 'Avviso temporali lieve',
  'rain warning': 'Avviso pioggia',
  'heavy rain warning': 'Avviso pioggia intensa',
  'extreme rain warning': 'Avviso pioggia estrema',
  'moderate rain warning': 'Avviso pioggia moderata',
  'minor rain warning': 'Avviso pioggia lieve',
  'wind warning': 'Avviso vento',
  'extreme wind warning': 'Avviso vento estremo',
  'moderate wind warning': 'Avviso vento moderato',
  'minor wind warning': 'Avviso vento lieve',
  'heavy wind warning': 'Avviso vento forte',
  'high wind warning': 'Avviso vento forte',
  'gale warning': 'Avviso burrasca',
  'snow warning': 'Avviso neve',
  'heavy snow warning': 'Avviso neve intensa',
  'extreme snow warning': 'Avviso neve estrema',
  'moderate snow warning': 'Avviso neve moderata',
  'ice warning': 'Avviso ghiaccio',
  'freezing rain warning': 'Avviso pioggia congelantesi',
  'fog warning': 'Avviso nebbia',
  'extreme fog warning': 'Avviso nebbia fitta',
  'heat warning': 'Avviso caldo',
  'extreme heat warning': 'Avviso caldo estremo',
  'moderate heat warning': 'Avviso caldo moderato',
  'minor heat warning': 'Avviso caldo lieve',
  'cold warning': 'Avviso freddo',
  'extreme cold warning': 'Avviso freddo estremo',
  'moderate cold warning': 'Avviso freddo moderato',
  'minor cold warning': 'Avviso freddo lieve',
  'temperature warning': 'Avviso temperatura',
  'high temperature warning': 'Avviso temperature elevate',
  'low temperature warning': 'Avviso temperature basse',
  'extreme high temperature warning': 'Avviso caldo estremo',
  'extreme low temperature warning': 'Avviso freddo estremo',
  'moderate high temperature warning': 'Avviso caldo moderato',
  'moderate low temperature warning': 'Avviso freddo moderato',
  'forest fire warning': 'Avviso incendi boschivi',
  'wildfire warning': 'Avviso incendi boschivi',
  'flood warning': 'Avviso alluvioni',
  'flash flood warning': 'Avviso alluvione improvvisa',
  'coastal event warning': 'Avviso eventi costieri',
  'storm surge warning': 'Avviso mareggiata',
  'avalanche warning': 'Avviso valanghe',
  'drought warning': 'Avviso siccità',
  'dust storm warning': 'Avviso tempesta di polvere',
  'sandstorm warning': 'Avviso tempesta di sabbia',
  'air quality warning': 'Avviso qualità dell\'aria',
  'thunderstorm watch': 'Allerta temporali',
  'rain watch': 'Allerta pioggia',
  'wind watch': 'Allerta vento',
  'heat watch': 'Allerta caldo',
  'cold watch': 'Allerta freddo',
  'weather warning': 'Avviso meteo',
  'weather alert': 'Allerta meteo',
  'weather advisory': 'Avviso meteo',
  advisory: 'Avviso meteo',
};

/** Fenomeno (EN) → etichetta IT per fallback composito. */
const PHENOMENON_IT = {
  'high temperature': 'temperature elevate',
  'low temperature': 'temperature basse',
  temperature: 'temperatura',
  heat: 'caldo',
  cold: 'freddo',
  thunderstorm: 'temporali',
  thunderstorms: 'temporali',
  rain: 'pioggia',
  wind: 'vento',
  snow: 'neve',
  fog: 'nebbia',
  flood: 'alluvioni',
  'flash flood': 'alluvione improvvisa',
  ice: 'ghiaccio',
  hail: 'grandine',
  drought: 'siccità',
  avalanche: 'valanghe',
  'forest fire': 'incendi boschivi',
  wildfire: 'incendi boschivi',
  fire: 'incendi',
  coastal: 'eventi costieri',
  'coastal event': 'eventi costieri',
  'storm surge': 'mareggiata',
  blizzard: 'bufera di neve',
  'freezing rain': 'pioggia congelantesi',
  'dust storm': 'tempesta di polvere',
  sandstorm: 'tempesta di sabbia',
  tsunami: 'tsunami',
  gale: 'burrasca',
  storm: 'temporale',
};

const SEVERITY_IT = {
  extreme: 'estremo',
  severe: 'grave',
  moderate: 'moderato',
  minor: 'lieve',
  heavy: 'intenso',
  high: 'elevato',
  low: 'basso',
};

/** @type {Record<string, string>} */
const METEO_ALERT_TAG_IT = {
  thunderstorm: 'Avviso temporali',
  rain: 'Avviso pioggia',
  wind: 'Avviso vento',
  snow: 'Avviso neve',
  fog: 'Avviso nebbia',
  flood: 'Avviso alluvioni',
  hail: 'Avviso grandine',
  tornado: 'Avviso tornado',
  fire: 'Avviso incendi',
  heat: 'Avviso caldo',
  cold: 'Avviso freddo',
  temperature: 'Avviso temperatura',
  ice: 'Avviso ghiaccio',
  drought: 'Avviso siccità',
  avalanche: 'Avviso valanghe',
  coastal: 'Avviso eventi costieri',
  tsunami: 'Avviso tsunami',
};

/** @type {Record<string, string>} */
const METEO_ALERT_SENDER_IT = {
  'italian meteorological service': 'Servizio Meteorologico Italiano',
  'italian air force national meteorological service':
    'Servizio Meteorologico Aeronautica Militare',
  'servizio meteorologico aeronautica militare': 'Servizio Meteorologico Aeronautica Militare',
  meteoalarm: 'MeteoAlarm',
  'protezione civile': 'Protezione Civile',
};

/** @type {Record<string, string>} */
const METEOALARM_REGION_IT = {
  'emilian apennines': 'Appennino emiliano',
  'tuscan apennines': 'Appennino toscano',
  'ligurian apennines': 'Appennino ligure',
  'central apennines': 'Appennino centrale',
  'northern apennines': 'Appennino settentrionale',
  'southern apennines': 'Appennino meridionale',
  'marche apennines': 'Appennino marchigiano',
  'abruzzese apennines': 'Appennino abruzzese',
  romagna: 'Romagna',
  'emilia romagna': 'Emilia-Romagna',
};

const METEOALARM_COLOR_PREFIX = /^(yellow|orange|red|amber|green|level\s*[123])\s+/;

const METEOALARM_INTENSITY_PHRASES = [
  [/moderate intensity weather phenomena expected/gi, 'Previsti fenomeni meteo di intensità moderata'],
  [/minor intensity weather phenomena expected/gi, 'Previsti fenomeni meteo di lieve intensità'],
  [/severe intensity weather phenomena expected/gi, 'Previsti fenomeni meteo di grave intensità'],
  [/high intensity weather phenomena expected/gi, 'Previsti fenomeni meteo di elevata intensità'],
  [/low intensity weather phenomena expected/gi, 'Previsti fenomeni meteo di bassa intensità'],
  [/weather phenomena expected/gi, 'Previsti fenomeni meteo'],
];

const METEOALARM_DISCLAIMER_IT =
  'Nota MeteoAlarm: le informazioni per l\'Italia riguardano esclusivamente intensità e ricorrenza dei fenomeni meteo; ulteriori dettagli operativi su www.meteoam.it. I dati MeteoAlarm non forniscono una valutazione dell\'impatto sul territorio né indicazioni precise su inizio e fine dei fenomeni.';

const DESC_PHRASES = [
  [/be aware and be prepared for/gi, 'Attenzione e prepararsi a'],
  [/be aware of (?:the )?possibility of/gi, 'Possibilità di'],
  [/be aware of/gi, 'Attenzione:'],
  [/be prepared for/gi, 'Prepararsi a'],
  [/take action(?: immediately)?(?: against)?/gi, 'Intervenire:'],
  [/\bthere is a risk of\b/gi, 'C\'è il rischio di'],
  [/\bare forecast\b/gi, 'sono previsti'],
  [/\bis forecast\b/gi, 'è previsto'],
  [/\bare expected\b/gi, 'sono previsti'],
  [/\bis expected\b/gi, 'è previsto'],
  [/\bthis weather alert is in effect from\b/gi, 'Allerta meteo in vigore dal'],
  [/\bthis warning is in effect from\b/gi, 'Avviso in vigore dal'],
  [/\bin effect from\b/gi, 'in vigore dal'],
  [/\buntil\b/gi, 'fino al'],
  [/\bsource:\s*/gi, 'Fonte: '],
  [/\bsevere thunderstorms?\b/gi, 'temporali forti'],
  [/\bmoderate thunderstorms?\b/gi, 'temporali moderati'],
  [/\bthunderstorms?\b/gi, 'temporali'],
  [/\bheavy rain and\/or hail\b/gi, 'pioggia intensa e/o grandine'],
  [/\bheavy rain\b/gi, 'pioggia intensa'],
  [/\bextreme rain\b/gi, 'pioggia estrema'],
  [/\baccompanied by\b/gi, 'accompagnati da'],
  [/\bthese may be\b/gi, 'potrebbero essere'],
  [/\blocal flooding\b/gi, 'allagamenti locali'],
  [/\bhail\b/gi, 'grandine'],
  [/\blightning\b/gi, 'fulmini'],
  [/\bstrong wind\b/gi, 'vento forte'],
  [/\bhigh wind\b/gi, 'vento forte'],
  [/\bgusts\b/gi, 'raffiche'],
  [/\bflooding\b/gi, 'allagamenti'],
  [/\bflash flood\b/gi, 'alluvione improvvisa'],
  [/\bhigh temperatures?\b/gi, 'temperature elevate'],
  [/\blow temperatures?\b/gi, 'temperature basse'],
  [/\btemperatures\b/gi, 'temperature'],
  [/\btemperature\b(?! elevate| basse)/gi, 'temperatura'],
  [/\bextreme heat\b/gi, 'caldo estremo'],
  [/\bextreme cold\b/gi, 'freddo estremo'],
  [/\bheat wave\b/gi, 'ondata di caldo'],
  [/\bcold spell\b/gi, 'ondata di freddo'],
  [/\bfreezing conditions\b/gi, 'condizioni di gelo'],
  [/\bfrost\b/gi, 'gelate'],
  [/\bfreezing rain\b/gi, 'pioggia congelantesi'],
  [/\bice accumulation\b/gi, 'accumulo di ghiaccio'],
  [/\bdense fog\b/gi, 'nebbia fitta'],
  [/\bvisibility\b/gi, 'visibilità'],
  [/\bheavy snowfall\b/gi, 'forti nevicate'],
  [/\bsnowfall\b/gi, 'nevicate'],
  [/\bstorm surge\b/gi, 'mareggiata'],
  [/\bhigh waves\b/gi, 'onde alte'],
  [/\bhigh fire danger\b/gi, 'elevato rischio incendi'],
  [/\bdry conditions\b/gi, 'condizioni di secca'],
  [/\bavalanche risk\b/gi, 'rischio valanghe'],
  [/\bmountain areas\b/gi, 'zone montane'],
  [/\blow-lying areas\b/gi, 'zone basse'],
  [/\bduring the afternoon\b/gi, 'nel pomeriggio'],
  [/\bovernight\b/gi, 'nella notte'],
  [/\balong the coast\b/gi, 'lungo la costa'],
  [/\bat higher elevations\b/gi, 'ad altitudini elevate'],
  [/\bon roads\b/gi, 'sulle strade'],
  [/\bmay reduce\b/gi, 'può ridurre'],
  [/\bare possible\b/gi, 'sono possibili'],
  [/\bis possible\b/gi, 'è possibile'],
  [/\bdue to\b/gi, 'a causa di'],
];

/** Sostituzioni finali su descrizioni ancora in inglese (ordine: frasi lunghe prima). */
const DESC_TERM_REPLACEMENTS = [
  [/information provided on meteoalarm for italy regard only the intensity and recurrence of the phenomena/gi,
    'informazioni MeteoAlarm per l\'Italia riguardano solo intensità e ricorrenza dei fenomeni'],
  [/further details can be found at www\.meteoam\.it/gi,
    'ulteriori dettagli su www.meteoam.it'],
  [/meteoalarm information do not provide the assessment of impact on the territory/gi,
    'i dati MeteoAlarm non valutano l\'impatto sul territorio'],
];

const ENGLISH_ALERT_HINT =
  /\b(warning|watch|advisory|thunderstorm|temperature|flooding|expected|aware|prepared|forecast|disclaimer|information provided|intensity weather|heavy rain|strong wind|heat wave|cold spell|gusts|lightning|hail|snowfall|drought|avalanche|coastal|forest fire|sandstorm|blizzard|freezing rain|overnight|afternoon|visibility|phenomena)\b/i;

function normalizeAlertKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksItalian(text) {
  const t = normalizeAlertKey(text);
  if (/\b(avviso|allerta|temporali|pioggia|vento|neve|nebbia|alluvion|caldo|freddo|temperatur|valanghe|incendi|protezione civile|attenzione|possibilita|rischio|vigore|previsti|previsto|previste|fenomeni|intensita|appennino|nota meteoalarm|gelate|raffiche|grandine|mareggiata|burrasca|siccita|ghiaccio|nebbia fitta|ondata|nevicate|pomeriggio|visibilit|strade|costa|montane|secca)\b/.test(
    t
  )) {
    return true;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && !ENGLISH_ALERT_HINT.test(t)) return true;
  return false;
}

/**
 * True se il testo sembra ancora contenere inglese meteo (per test e fallback).
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
function alertTextLooksEnglish(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  if (looksItalian(raw)) return false;
  return ENGLISH_ALERT_HINT.test(raw);
}

function sanitizeEventRaw(event) {
  let raw = String(event || '').trim();
  if (!raw) return '';
  raw = raw.split(/\r?\n/)[0].trim();
  raw = raw.replace(/\s+in effect\b.*/i, '').trim();
  return raw;
}

function stripEventPrefixes(key) {
  let k = key;
  let prev;
  do {
    prev = k;
    k = k.replace(METEOALARM_COLOR_PREFIX, '');
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
    if (typeIt) return typeIt.replace(/^Avviso /, kind === 'watch' ? 'Allerta ' : 'Avviso ');
  }

  return null;
}

/**
 * Costruisce titolo IT da chiave normalizzata non in dizionario (es. "moderate heat warning").
 * @param {string} key
 * @returns {string|null}
 */
function translateEventFallback(key) {
  let k = stripEventPrefixes(key);
  if (!k) return null;

  let kind = 'warning';
  const kindMatch = k.match(/\s+(warning|watch|advisory|alert)$/);
  if (kindMatch) {
    kind = kindMatch[1];
    k = k.slice(0, -kindMatch[0].length).trim();
  }

  let severity = null;
  for (const s of ['extreme', 'severe', 'moderate', 'minor', 'heavy']) {
    if (k === s || k.startsWith(`${s} `)) {
      severity = s;
      k = k === s ? '' : k.slice(s.length + 1).trim();
      break;
    }
  }

  let phenomenonKey = k;
  let phenomenonIt = PHENOMENON_IT[phenomenonKey] || null;
  if (!phenomenonIt) {
    const sorted = Object.keys(PHENOMENON_IT).sort((a, b) => b.length - a.length);
    for (const pk of sorted) {
      if (phenomenonKey === pk || phenomenonKey.endsWith(` ${pk}`) || phenomenonKey.startsWith(`${pk} `)) {
        phenomenonIt = PHENOMENON_IT[pk];
        break;
      }
    }
  }
  if (!phenomenonIt) return null;

  const prefix = kind === 'watch' || kind === 'alert' ? 'Allerta' : 'Avviso';
  const severityIt = severity ? SEVERITY_IT[severity] : null;
  if (severityIt) {
    return `${prefix} ${phenomenonIt} ${severityIt}`.replace(/\s+/g, ' ').trim();
  }
  return `${prefix} ${phenomenonIt}`;
}

function translateRegionName(regionRaw) {
  const trimmed = String(regionRaw || '').trim();
  if (!trimmed) return '';
  const key = normalizeAlertKey(trimmed);
  if (METEOALARM_REGION_IT[key]) return METEOALARM_REGION_IT[key];
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function stripMeteoAlarmDisclaimer(raw) {
  const match = raw.match(/\(?\s*DISCLAIMER\s*:/i);
  if (!match || match.index == null) return raw.trim();
  return raw.slice(0, match.index).replace(/\(\s*$/, '').trim();
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
  if (out && !/[.!?]$/.test(out)) out += '.';
  return out ? `${out} ${METEOALARM_DISCLAIMER_IT}` : METEOALARM_DISCLAIMER_IT;
}

function applyDescriptionPhrases(raw) {
  let out = raw;
  for (const [pattern, replacement] of DESC_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of DESC_TERM_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of METEOALARM_INTENSITY_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * @param {Array<string>|null|undefined} tags
 * @returns {string|null}
 */
function translateMeteoAlertEventFromTags(tags) {
  if (!Array.isArray(tags) || !tags.length) return null;
  for (const tag of tags) {
    const key = normalizeAlertKey(tag);
    if (METEO_ALERT_TAG_IT[key]) return METEO_ALERT_TAG_IT[key];
  }
  return null;
}

/**
 * @param {string|null|undefined} sender
 * @returns {string}
 */
function translateMeteoAlertSender(sender) {
  const raw = String(sender || '').trim();
  if (!raw) return '';
  const key = normalizeAlertKey(raw);
  if (METEO_ALERT_SENDER_IT[key]) return METEO_ALERT_SENDER_IT[key];
  if (key.includes('italian air force') || key.includes('aeronautica militare')) {
    return 'Servizio Meteorologico Aeronautica Militare';
  }
  if (key.includes('meteoalarm')) return 'MeteoAlarm';
  if (key.includes('protezione civile')) return 'Protezione Civile';
  if (key.includes('italian meteorological')) return 'Servizio Meteorologico Italiano';
  return raw;
}

/**
 * @param {string|null|undefined} event
 * @param {Array<string>|null|undefined} [tags]
 * @returns {string}
 */
function translateMeteoAlertEvent(event, tags) {
  const raw = sanitizeEventRaw(event);
  if (!raw) return 'Avviso meteo';
  if (looksItalian(raw)) return raw;

  const key = normalizeAlertKey(raw);
  const stripped = stripEventPrefixes(key);

  const genericEventKeys = new Set([
    'weather alert',
    'weather warning',
    'weather advisory',
    'advisory',
  ]);
  if (genericEventKeys.has(key) || genericEventKeys.has(stripped)) {
    const fromTagsEarly = translateMeteoAlertEventFromTags(tags);
    if (fromTagsEarly) return fromTagsEarly;
  }

  let hit = lookupEventTranslation(key);
  if (hit) return hit;

  if (stripped !== key) {
    hit = lookupEventTranslation(stripped);
    if (hit) return hit;
    if (METEO_ALERT_EVENT_IT[stripped]) return METEO_ALERT_EVENT_IT[stripped];
  }

  const fromTags = translateMeteoAlertEventFromTags(tags);
  if (fromTags) return fromTags;

  const fallback = translateEventFallback(stripped !== key ? stripped : key);
  if (fallback) return fallback;

  return 'Avviso meteo';
}

/**
 * Sostituzioni lessicali su descrizioni (MeteoAlarm IT / OpenWeather EN).
 * @param {string|null|undefined} description
 * @returns {string}
 */
function translateMeteoAlertDescription(description) {
  const raw = String(description || '').trim();
  if (!raw) return '';

  if (isMeteoAlarmItalyDescription(raw)) {
    return translateMeteoAlarmItalyDescription(raw);
  }

  if (looksItalian(raw) && !alertTextLooksEnglish(raw)) return raw;

  return applyDescriptionPhrases(raw);
}

/**
 * @param {object|null|undefined} alert
 * @returns {object|null}
 */
function localizeMeteoAlert(alert) {
  if (!alert || typeof alert !== 'object') return alert;
  const tags = Array.isArray(alert.tags) ? alert.tags : [];
  let event = translateMeteoAlertEvent(alert.event, tags);
  let description = translateMeteoAlertDescription(alert.description);
  const sender = translateMeteoAlertSender(alert.sender);

  if (alertTextLooksEnglish(event)) {
    const fb = translateEventFallback(stripEventPrefixes(normalizeAlertKey(sanitizeEventRaw(alert.event))));
    event = fb || translateMeteoAlertEventFromTags(tags) || 'Avviso meteo';
  }
  if (alertTextLooksEnglish(description)) {
    description = applyDescriptionPhrases(description);
  }
  if (alertTextLooksEnglish(description) && isMeteoAlarmItalyDescription(alert.description || '')) {
    description = translateMeteoAlarmItalyDescription(alert.description);
  }

  return Object.assign({}, alert, {
    event,
    description,
    sender,
    eventOriginal: alert.eventOriginal || alert.event || '',
    descriptionOriginal: alert.descriptionOriginal || alert.description || '',
    senderOriginal: alert.senderOriginal || alert.sender || '',
  });
}

/**
 * @param {Array<object>|null|undefined} alerts
 * @returns {Array<object>}
 */
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
  alertTextLooksEnglish,
};