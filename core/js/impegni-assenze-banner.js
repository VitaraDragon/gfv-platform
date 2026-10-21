/**
 * HTML del banner assenze in Impegni giornalieri: un «Scegli sostituto» per ogni lavoro in standby.
 * @module core/js/impegni-assenze-banner
 */

import { MSG_STANDBY_NON_VERIFICATO } from '../services/assenze-banner-logic.js';

/**
 * @param {{ rows: Object[], standbyVerificato: boolean }} result
 * @param {{ giornoKey: string, nomeOperaio: (id: string) => string, escapeHtml: (s: string) => string, gestioneLavoriHref?: string }} opts
 * @returns {string} '' se non c'è nulla da mostrare
 */
export function htmlBannerAssenzeImpegni(result, opts) {
  const rows = (result && result.rows) || [];
  const avviso = result && result.standbyVerificato === false;
  if (!rows.length && !avviso) return '';
  const esc = opts.escapeHtml;
  const base = opts.gestioneLavoriHref || '../../../core/admin/gestione-lavori-standalone.html';
  const link = (a, lavoro) => {
    const params = [`assenzaId=${encodeURIComponent(a.id)}`];
    if (lavoro) params.push(`sostitutoLavoroId=${encodeURIComponent(lavoro.id)}`);
    params.push(`data=${encodeURIComponent(opts.giornoKey)}`);
    const testo = lavoro && a.lavoriInStandby.length > 1 && lavoro.nome
      ? `Scegli sostituto — ${esc(lavoro.nome)}`
      : 'Scegli sostituto';
    return `<a href="${base}?${params.join('&')}">${testo}</a>`;
  };
  const items = rows.map((a) => {
    const nome = esc(opts.nomeOperaio(a.operaioId));
    const tipo = esc(a.tipoLabel || a.tipo || '');
    const giorno = a.dataInizioGiorno && a.dataInizioGiorno !== opts.giornoKey ? ` (${esc(a.dataInizioGiorno)})` : '';
    const lavori = a.lavoriInStandby || [];
    const azioni = lavori.length ? lavori.map((l) => link(a, l)).join(' · ') : link(a, null);
    return `<li style="margin-top:8px;"><strong>${nome}</strong> — ${tipo}${giorno} · ${azioni}</li>`;
  }).join('');
  const avvisoHtml = avviso
    ? `<p style="margin:6px 0 0;color:#c62828;font-weight:600;">${esc(MSG_STANDBY_NON_VERIFICATO)}</p>`
    : '';
  return `<strong>Assenze da gestire (${rows.length})</strong>${avvisoHtml}${rows.length ? `<ul style="margin:8px 0 0;padding-left:18px;">${items}</ul>` : ''}`;
}
