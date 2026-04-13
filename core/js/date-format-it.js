/**
 * Date in italiano per contesto Tony (chat/TTS), allineato a functions/index.js formatDataItaliana.
 * @module core/js/date-format-it
 */

const MONTHS_IT = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

const GIORNI_SETTIMANA = [
  'domenica',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
];

/**
 * ISO YYYY-MM-DD → "10 aprile 2026"
 * @param {string} isoDateStr
 * @returns {string}
 */
export function formatIsoDateToItalianLong(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return '';
  const m = isoDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(isoDateStr);
  const day = parseInt(m[3], 10);
  const monthIdx = parseInt(m[2], 10) - 1;
  const year = m[1];
  if (!Number.isFinite(day) || monthIdx < 0 || monthIdx > 11) return isoDateStr;
  return `${day} ${MONTHS_IT[monthIdx]} ${year}`;
}

/**
 * Timestamp Firestore, Date, ISO string, ecc. → YYYY-MM-DD (UTC via toISOString, come nel resto del progetto).
 * @param {*} val
 * @returns {string}
 */
export function dateLikeToIsoDateString(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    } catch (e) {
      return '';
    }
  }
  if (typeof val === 'object' && val.seconds != null) {
    const d = new Date(val.seconds * 1000);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().slice(0, 10);
  }
  const s = String(val);
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * @param {*} val
 * @returns {string}
 */
export function formatDateLikeToItalianLong(val) {
  const iso = dateLikeToIsoDateString(val);
  return iso ? formatIsoDateToItalianLong(iso) : '';
}

/**
 * Calendario locale YYYY-MM-DD (stesso giorno che l’utente vede in UI, non UTC).
 * @param {*} val
 * @returns {string}
 */
export function dateLikeToLocalCalendarIso(val) {
  if (val == null || val === '') return '';
  let d;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      d = val.toDate();
    } catch (e) {
      return '';
    }
  } else if (typeof val === 'object' && val != null && val.seconds != null) {
    d = new Date(val.seconds * 1000);
  } else if (val instanceof Date) {
    d = val;
  } else {
    d = new Date(val);
  }
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Data “solo calendario” in italiano per tabelle/dashboard (locale utente).
 * @param {*} val
 * @returns {string}
 */
export function formatDateLikeToItalianLongLocal(val) {
  const iso = dateLikeToLocalCalendarIso(val);
  return iso ? formatIsoDateToItalianLong(iso) : '';
}

/**
 * Es. "sabato 10 aprile 2026" (utile per intestazioni/dettaglio giornaliero).
 * @param {*} val
 * @returns {string}
 */
export function formatDateLikeToItalianLongWeekday(val) {
  const iso = dateLikeToLocalCalendarIso(val);
  if (!iso) return '';
  const parts = iso.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return '';
  const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  if (isNaN(dt.getTime())) return '';
  const w = GIORNI_SETTIMANA[dt.getDay()];
  return `${w} ${formatIsoDateToItalianLong(iso)}`;
}

/**
 * Data/ora per elenchi (es. guasti): "10 aprile 2026, ore 14:30"
 * @param {*} val
 * @returns {string}
 */
export function formatDateTimeItalianReadable(val) {
  if (val == null || val === '') return '—';
  let d;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      d = val.toDate();
    } catch (e) {
      return '—';
    }
  } else if (typeof val === 'object' && val != null && val.seconds != null) {
    d = new Date(val.seconds * 1000);
  } else if (val instanceof Date) {
    d = val;
  } else {
    d = new Date(val);
  }
  if (!d || isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const datePart = formatIsoDateToItalianLong(`${y}-${mo}-${day}`);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}, ore ${hh}:${mm}`;
}
