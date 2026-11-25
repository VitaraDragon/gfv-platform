/**
 * Riparto provvisorio degli incassi (acconti + saldi) sui campi,
 * in proporzione alla quantità netta delle consegne del conferimento.
 * Funzioni pure — nessuna I/O.
 *
 * @module core/services/conferimenti-riparto
 */

/**
 * Normalizza quantità in quintali (1 q = 100 kg).
 * @param {number|string|null|undefined} quantita
 * @param {string|null|undefined} unita 'kg' | 'q'
 * @returns {number}
 */
export function quantitaInQ(quantita, unita) {
  const q = Number(quantita);
  if (!Number.isFinite(q) || q <= 0) return 0;
  const u = String(unita || 'q').toLowerCase();
  if (u === 'kg') return q / 100;
  return q;
}

/**
 * Chiave campo stabile per raggruppamento.
 * @param {{ terrenoId?: string|null, fruttetoId?: string|null, vignetoId?: string|null }} c
 */
export function campoKeyFromConsegna(c) {
  if (!c) return 'non_attribuito';
  if (c.vignetoId) return `vigneto:${c.vignetoId}`;
  if (c.fruttetoId) return `frutteto:${c.fruttetoId}`;
  if (c.terrenoId) return `terreno:${c.terrenoId}`;
  return 'non_attribuito';
}

/**
 * @param {Array<{ quantitaNetta?: number, unita?: string, terrenoId?: string|null, fruttetoId?: string|null, vignetoId?: string|null, campoLabel?: string }>} consegne
 * @param {Array<{ tipo?: string, importo?: number, conferimentoId?: string|null }>} entrate
 * @param {string} conferimentoId
 * @param {{ labels?: Record<string, string> }} [opts]
 * @returns {{
 *   totaleIncassi: number,
 *   totaleQ: number,
 *   euroPerQ: number|null,
 *   stima: true,
 *   perCampo: Array<{
 *     key: string,
 *     label: string,
 *     quantitaQ: number,
 *     quotaEuro: number,
 *     euroPerQ: number|null,
 *     stato: 'provvisorio',
 *     nonAttribuito: boolean
 *   }>
 * }}
 */
export function ripartoProvvisorioPerCampo(consegne, entrate, conferimentoId, opts = {}) {
  const cid = String(conferimentoId || '');
  const labels = (opts && opts.labels) || {};

  let totaleIncassi = 0;
  for (const e of entrate || []) {
    if (!e) continue;
    if (cid && String(e.conferimentoId || '') !== cid) continue;
    const tipo = String(e.tipo || '');
    if (tipo !== 'acconto' && tipo !== 'saldo') continue;
    const importo = Number(e.importo);
    if (Number.isFinite(importo) && importo > 0) totaleIncassi += importo;
  }
  totaleIncassi = Math.round(totaleIncassi * 100) / 100;

  /** @type {Map<string, { key: string, quantitaQ: number, label: string }>} */
  const byCampo = new Map();
  for (const c of consegne || []) {
    if (!c) continue;
    const key = campoKeyFromConsegna(c);
    const q = quantitaInQ(c.quantitaNetta, c.unita);
    if (q <= 0) continue;
    const prev = byCampo.get(key) || {
      key,
      quantitaQ: 0,
      label:
        labels[key] ||
        c.campoLabel ||
        (key === 'non_attribuito' ? 'Non attribuito' : 'Campo senza nome')
    };
    prev.quantitaQ += q;
    if (c.campoLabel && key !== 'non_attribuito') prev.label = c.campoLabel;
    if (labels[key]) prev.label = labels[key];
    byCampo.set(key, prev);
  }

  let totaleQ = 0;
  for (const row of byCampo.values()) totaleQ += row.quantitaQ;
  totaleQ = Math.round(totaleQ * 1000) / 1000;

  const euroPerQTotale =
    totaleQ > 0 ? Math.round((totaleIncassi / totaleQ) * 100) / 100 : null;

  /** @type {Array<object>} */
  let perCampo = [];

  if (byCampo.size === 0) {
    perCampo = [
      {
        key: 'non_attribuito',
        label: 'Non attribuito',
        quantitaQ: 0,
        quotaEuro: totaleIncassi,
        euroPerQ: null,
        stato: 'provvisorio',
        nonAttribuito: true
      }
    ];
  } else {
    let assegnato = 0;
    const keys = Array.from(byCampo.keys()).sort((a, b) => {
      if (a === 'non_attribuito') return 1;
      if (b === 'non_attribuito') return -1;
      return a.localeCompare(b);
    });
    keys.forEach((key, idx) => {
      const row = byCampo.get(key);
      const isLast = idx === keys.length - 1;
      let quota;
      if (totaleQ <= 0) {
        quota = isLast ? Math.round((totaleIncassi - assegnato) * 100) / 100 : 0;
      } else if (isLast) {
        quota = Math.round((totaleIncassi - assegnato) * 100) / 100;
      } else {
        quota = Math.round(((totaleIncassi * row.quantitaQ) / totaleQ) * 100) / 100;
        assegnato += quota;
      }
      const qRounded = Math.round(row.quantitaQ * 1000) / 1000;
      perCampo.push({
        key,
        label: row.label,
        quantitaQ: qRounded,
        quotaEuro: quota,
        euroPerQ: qRounded > 0 ? Math.round((quota / qRounded) * 100) / 100 : null,
        stato: 'provvisorio',
        nonAttribuito: key === 'non_attribuito'
      });
    });
  }

  return {
    totaleIncassi,
    totaleQ,
    euroPerQ: euroPerQTotale,
    stima: true,
    perCampo
  };
}

export default {
  quantitaInQ,
  campoKeyFromConsegna,
  ripartoProvvisorioPerCampo
};
