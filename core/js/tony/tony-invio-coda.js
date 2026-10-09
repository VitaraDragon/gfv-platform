/**
 * Coda dei messaggi scritti prima che Tony sia pronto.
 * Funzioni pure: il widget le chiama, non decide da solo.
 */

/**
 * @param {Array<{ text?: string, opts?: object, ts?: number }>|null|undefined} coda
 * @param {{ text?: string, opts?: object, ts?: number }|null|undefined} voce
 * @param {number} [max]
 * @returns {Array<{ text: string, opts: object, ts: number }>}
 */
export function accodaInvio(coda, voce, max) {
  const list = Array.isArray(coda) ? coda.map(normalizzaVoce).filter(Boolean) : [];
  const cap = Number(max);
  const limite = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 5;
  const prossima = normalizzaVoce(voce);
  if (prossima) list.push(prossima);
  while (list.length > limite) list.shift();
  return list;
}

/**
 * @param {Array<{ text?: string, opts?: object, ts?: number }>|null|undefined} coda
 * @returns {{ voce: { text: string, opts: object, ts: number }|null, coda: Array<{ text: string, opts: object, ts: number }> }}
 */
export function prossimoDaInviare(coda) {
  const list = Array.isArray(coda) ? coda.map(normalizzaVoce).filter(Boolean) : [];
  if (!list.length) return { voce: null, coda: [] };
  const voce = list.shift();
  return { voce, coda: list };
}

/**
 * @param {number} ts
 * @param {number} adesso
 * @param {number} limiteMs
 * @returns {boolean}
 */
export function scadutoInAttesa(ts, adesso, limiteMs) {
  const t = Number(ts);
  const now = Number(adesso);
  const limit = Number(limiteMs);
  if (!Number.isFinite(t) || !Number.isFinite(now) || !Number.isFinite(limit) || limit < 0) return false;
  return (now - t) >= limit;
}

function normalizzaVoce(voce) {
  if (!voce || typeof voce !== 'object') return null;
  const text = String(voce.text || '');
  if (!text.trim()) return null;
  return {
    text,
    opts: voce.opts && typeof voce.opts === 'object' ? voce.opts : {},
    ts: Number(voce.ts) || 0
  };
}

function chiaveTurno(m) {
  if (!m) return '';
  const ruolo = m.role || '';
  let testo = '';
  if (m.parts && m.parts[0] && m.parts[0].text != null) testo = String(m.parts[0].text);
  else if (m.text != null) testo = String(m.text);
  return ruolo + '\n' + testo;
}

/**
 * Unisce la chat già in memoria con quella salvata, senza sostituire la prima.
 * @param {Array<object>|null|undefined} corrente
 * @param {Array<object>|null|undefined} salvata
 * @returns {Array<object>}
 */
export function unisciCronologiaChat(corrente, salvata) {
  const cur = Array.isArray(corrente) ? corrente.filter(Boolean) : [];
  const saved = Array.isArray(salvata) ? salvata.filter(Boolean) : [];
  if (!saved.length) return cur.slice();
  if (!cur.length) return saved.slice();
  const gia = new Set(saved.map(chiaveTurno));
  const out = saved.slice();
  cur.forEach((m) => {
    const key = chiaveTurno(m);
    if (gia.has(key)) return;
    gia.add(key);
    out.push(m);
  });
  return out;
}
