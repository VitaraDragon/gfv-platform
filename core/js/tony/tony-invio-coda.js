/**
 * Coda dei messaggi scritti prima che Tony sia pronto.
 * Funzioni pure: niente DOM, niente timer. Il widget le chiama.
 */

export const LIMITE_ATTESA_MS = 45000;
export const TETTO_CODA = 3;

/**
 * @param {Array<{ id?: string, text?: string, ts?: number }>|null|undefined} coda
 * @param {{ id?: string, text?: string, ts?: number }|null|undefined} voce
 * @param {{ max?: number }} [opts]
 * @returns {{ coda: Array<{ id: string, text: string, ts: number }>, scartata: { id: string, text: string, ts: number }|null, duplicata: boolean }}
 */
export function accodaInvio(coda, voce, opts) {
  const list = normalizzaCoda(coda);
  const maxOpt = opts && Number(opts.max);
  const limite = Number.isFinite(maxOpt) && maxOpt > 0 ? Math.floor(maxOpt) : TETTO_CODA;
  const text = voce && voce.text != null ? String(voce.text).trim() : '';
  if (!text) return { coda: list, scartata: null, duplicata: false };
  const ultimo = list.length ? list[list.length - 1] : null;
  if (ultimo && ultimo.text === text) {
    return { coda: list, scartata: null, duplicata: true };
  }
  const ts = Number(voce && voce.ts);
  const quando = Number.isFinite(ts) ? ts : 0;
  const id = voce && voce.id ? String(voce.id) : ('coda-' + String(quando) + '-' + String(list.length));
  const next = list.concat([{ id: id, text: text, ts: quando }]);
  let scartata = null;
  if (next.length > limite) scartata = next.shift() || null;
  return { coda: next, scartata: scartata, duplicata: false };
}

/**
 * Un solo messaggio, e solo se Tony è pronto e non sta già rispondendo.
 * @param {Array<{ id?: string, text?: string, ts?: number }>|null|undefined} coda
 * @param {{ pronto?: boolean, inInvio?: boolean, rispostaInCorso?: boolean }|null|undefined} stato
 * @returns {{ voce: { id: string, text: string, ts: number }|null, coda: Array<{ id: string, text: string, ts: number }> }}
 */
export function prossimoDaInviare(coda, stato) {
  const list = normalizzaCoda(coda);
  const s = stato || {};
  if (!s.pronto || s.inInvio || s.rispostaInCorso) {
    return { voce: null, coda: list };
  }
  if (!list.length) return { voce: null, coda: [] };
  return { voce: list[0], coda: list.slice(1) };
}

/**
 * @param {number} ts
 * @param {number} adesso
 * @param {number} [limiteMs]
 * @returns {boolean}
 */
export function scadutoInAttesa(ts, adesso, limiteMs) {
  const t = Number(ts);
  const now = Number(adesso);
  const limit = limiteMs == null ? LIMITE_ATTESA_MS : Number(limiteMs);
  if (!Number.isFinite(t) || !Number.isFinite(now) || !Number.isFinite(limit) || limit < 0) return false;
  return (now - t) >= limit;
}

/**
 * @param {Array<{ text?: string }>|null|undefined} coda
 * @returns {string}
 */
export function testoDaRimettereNelCampo(coda) {
  const list = normalizzaCoda(coda);
  if (!list.length) return '';
  return list[list.length - 1].text;
}

/**
 * La chat salvata resta davanti. I doppioni solo se sono uno dopo l'altro.
 * @param {Array<object>|null|undefined} vecchia
 * @param {Array<object>|null|undefined} corrente
 * @returns {Array<object>}
 */
export function unisciChatRipristinata(vecchia, corrente) {
  const prima = Array.isArray(vecchia) ? vecchia.filter(Boolean) : [];
  const dopo = Array.isArray(corrente) ? corrente.filter(Boolean) : [];
  const uniti = prima.concat(dopo);
  const out = [];
  for (let i = 0; i < uniti.length; i++) {
    const m = uniti[i];
    const prev = out.length ? out[out.length - 1] : null;
    if (prev && stessoTurno(prev, m)) continue;
    out.push(m);
  }
  return out;
}

function normalizzaCoda(coda) {
  if (!Array.isArray(coda)) return [];
  const out = [];
  for (let i = 0; i < coda.length; i++) {
    const v = coda[i];
    if (!v || v.text == null) continue;
    const text = String(v.text).trim();
    if (!text) continue;
    const ts = Number(v.ts);
    out.push({
      id: v.id ? String(v.id) : ('coda-' + String(i)),
      text: text,
      ts: Number.isFinite(ts) ? ts : 0
    });
  }
  return out;
}

function testoTurno(m) {
  if (!m) return '';
  if (m.parts && m.parts[0] && m.parts[0].text != null) return String(m.parts[0].text).trim();
  if (m.text != null) return String(m.text).trim();
  return '';
}

function stessoTurno(a, b) {
  const ta = testoTurno(a);
  const tb = testoTurno(b);
  if (!ta || ta !== tb) return false;
  return String(a.role || '') === String(b.role || '');
}
