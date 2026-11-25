/**
 * Helper UI per Vendite ed entrate: cascate acconto/consegna e vista riparto.
 * @module core/admin/js/entrate-page-controllers
 */

import {
  CATEGORIE_PRODOTTO,
  CATEGORIA_PRODOTTO_LABELS,
  ACQUIRENTE_TIPI,
  ACQUIRENTE_TIPO_LABELS
} from '../../models/Acquirente.js';
import { annataCorrente } from '../../services/conferimenti-service.js';
import { ripartoProvvisorioPerCampo } from '../../services/conferimenti-riparto.js';
import { REPORT_CHART_SERIES_FALLBACK, REPORT_CHART_ALTRI_FALLBACK } from '../../../modules/report/js/report-chart-colors.js';

export {
  CATEGORIE_PRODOTTO,
  CATEGORIA_PRODOTTO_LABELS,
  ACQUIRENTE_TIPI,
  ACQUIRENTE_TIPO_LABELS,
  annataCorrente,
  ripartoProvvisorioPerCampo,
  REPORT_CHART_SERIES_FALLBACK,
  REPORT_CHART_ALTRI_FALLBACK
};

/**
 * Filtra acquirenti per categoria; auto-seleziona se uno solo.
 * @returns {{ list: object[], selectedId: string }}
 */
export function cascadeAcquirenti(acquirenti, categoria, preferredId) {
  const cat = String(categoria || '');
  let list = (acquirenti || []).slice();
  if (cat) {
    list = list.filter(
      (a) =>
        !a.categorieProdotto ||
        !a.categorieProdotto.length ||
        a.categorieProdotto.includes(cat)
    );
  }
  let selectedId = preferredId && list.some((a) => a.id === preferredId) ? preferredId : '';
  if (!selectedId && list.length === 1) selectedId = list[0].id;
  return { list, selectedId };
}

/**
 * Conferimenti aperti per acquirente/categoria; auto-seleziona se uno solo.
 */
export function cascadeConferimenti(conferimenti, { acquirenteId, categoria, preferredId }) {
  let list = (conferimenti || []).filter((c) => !c.stato || c.stato === 'aperto');
  if (acquirenteId) list = list.filter((c) => String(c.acquirenteId) === String(acquirenteId));
  if (categoria) list = list.filter((c) => c.categoriaProdotto === categoria);
  let selectedId = preferredId && list.some((c) => c.id === preferredId) ? preferredId : '';
  if (!selectedId && list.length === 1) selectedId = list[0].id;
  return { list, selectedId };
}

/**
 * Colore serie report per indice riga (grigio solo per non attribuito / Altri).
 */
export function coloreRigaCampo(index, nonAttribuito) {
  if (nonAttribuito) return REPORT_CHART_ALTRI_FALLBACK;
  if (index >= REPORT_CHART_SERIES_FALLBACK.length) return REPORT_CHART_ALTRI_FALLBACK;
  return REPORT_CHART_SERIES_FALLBACK[index];
}

/**
 * Propone collegamento anagrafica se entrata ha solo testo acquirente.
 * @returns {'skip'|'link'|'create'|null}
 */
export function decideMigrazioneAcquirenteTesto(testo, esistenti) {
  const nome = String(testo || '').trim();
  if (!nome) return null;
  const hit = (esistenti || []).find(
    (a) => String(a.nome || '').trim().toLowerCase() === nome.toLowerCase()
  );
  return hit ? { action: 'link', acquirente: hit } : { action: 'create', nome };
}
