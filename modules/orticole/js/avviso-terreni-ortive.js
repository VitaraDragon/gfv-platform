/**
 * Avviso quando l'anagrafica campagne non ha terreni operativi a ortive.
 * Il filtro della tendina non cambia: i terreni non ortivi restano fuori.
 * @module modules/orticole/js/avviso-terreni-ortive
 */

import { terreniPerTendina } from '../../../shared/js/coltura-terreno.js';

export const HREF_TERRENI_DA_ORTICOLE = '../../../core/terreni-standalone.html';

export const TESTO_AVVISO_NESSUN_TERRENO_ORTIVO = 'Nessun terreno con coltura ortiva. In Terreni crea un terreno nuovo oppure imposta una coltura del gruppo Ortive (per esempio pomodoro, melone o zucchina) su un terreno che hai già.';

/** Vero se la tendina operativa è vuota (nessun terreno, oppure solo archiviati). */
export function mancaTerrenoOrtivoOperativo(terreni) {
  return terreniPerTendina(terreni || []).length === 0;
}

export function htmlAvvisoNessunTerrenoOrtivo() {
  return '<p data-avviso-terreni-ortive>Nessun terreno con coltura ortiva. In '
    + `<a href="${HREF_TERRENI_DA_ORTICOLE}">Terreni</a> `
    + 'crea un terreno nuovo oppure imposta una coltura del gruppo Ortive (per esempio pomodoro, melone o zucchina) su un terreno che hai già.</p>';
}

const IDS_AVVISO = ['avviso-terreni-ortive', 'avviso-terreni-ortive-modal'];

/** Mostra o nasconde l'avviso in pagina e nel modal campagna. */
export function applicaAvvisoTerreniOrtive(terreni, root = document) {
  const mostra = mancaTerrenoOrtivoOperativo(terreni);
  const html = mostra ? htmlAvvisoNessunTerrenoOrtivo() : '';
  IDS_AVVISO.forEach((id) => {
    const el = root.getElementById(id);
    if (!el) return;
    el.innerHTML = html;
    if (mostra) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });
  return mostra;
}
