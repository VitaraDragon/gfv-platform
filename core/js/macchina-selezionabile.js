/**
 * Quali mezzi si possono scegliere in un form nuovo.
 * Le liste e i dettagli li mostrano comunque: qui si decide solo la selezione.
 *
 * Non esiste un tipo «mietitrebbia». Il modello ammette
 * trattore | attrezzo | automezzo | veicolo | furgone.
 * Un mezzo chiamato Mietitrebbia con tipoMacchina trattore resta tra i trattori.
 *
 * @module core/js/macchina-selezionabile
 */

import { isGuastoAttivo } from '../services/guasto-stati.js';
import { idMezziCoinvolti } from '../services/guasto-ripristino.js';

const STATI_ESCLUSI = new Set(['dismesso', 'guasto', 'guasto-lavoro-in-corso', 'in-manutenzione']);

function statoNorm(macchina) {
  return String((macchina && macchina.stato) || '').toLowerCase().trim().replace(/_/g, '-');
}

/**
 * @param {object|null|undefined} macchina
 * @param {{ contesto?: 'visualizzazione'|'nuovo-lavoro'|'nuove-ore'|'nuovo-guasto', giaAssegnataAlLavoro?: boolean, guastoAperto?: boolean }|string} [contesto]
 * @returns {{ ok: boolean, motivo: string }}
 */
export function macchinaSelezionabile(macchina, contesto) {
  const opzioni = typeof contesto === 'string' ? { contesto } : (contesto || {});
  const ctx = opzioni.contesto || 'visualizzazione';
  if (!macchina) return { ok: false, motivo: 'manca' };
  if (ctx === 'visualizzazione') return { ok: true, motivo: '' };

  const stato = statoNorm(macchina);
  if (stato === 'dismesso') return { ok: false, motivo: 'dismesso' };

  const giaAssegnata = !!opzioni.giaAssegnataAlLavoro && (ctx === 'nuovo-lavoro' || ctx === 'nuove-ore');
  if (giaAssegnata) return { ok: true, motivo: 'gia-assegnata' };

  if (opzioni.guastoAperto || STATI_ESCLUSI.has(stato)) {
    const motivo = opzioni.guastoAperto && !STATI_ESCLUSI.has(stato) ? 'guasto' : (STATI_ESCLUSI.has(stato) ? stato : 'guasto');
    return { ok: false, motivo };
  }
  return { ok: true, motivo: '' };
}

/** Testo da aggiungere all'opzione disabilitata. */
export function suffissoMacchinaNonSelezionabile(esito) {
  if (!esito || esito.ok) return '';
  if (esito.motivo === 'guasto' || esito.motivo === 'guasto-lavoro-in-corso') return ' (già in guasto)';
  if (esito.motivo === 'in-manutenzione') return ' (in manutenzione)';
  if (esito.motivo === 'dismesso') return ' (dismesso)';
  return '';
}

function macchinaDaMappa(macchinePerId, id) {
  if (!macchinePerId || !id) return null;
  if (typeof macchinePerId.get === 'function') return macchinePerId.get(id) || null;
  return macchinePerId[id] || null;
}

function idsConGuastoAperto(guastiAperti) {
  const ids = new Set();
  (Array.isArray(guastiAperti) ? guastiAperti : []).forEach((guasto) => {
    if (!guasto || !isGuastoAttivo(guasto.stato)) return;
    idMezziCoinvolti(guasto).forEach((id) => ids.add(id));
  });
  return ids;
}

/**
 * Opzioni già segnate «già in guasto» che non hanno più un guasto aperto.
 * Ricalcola disabled e suffisso dallo stato aggiornato della macchina.
 * Le altre opzioni restano com'erano: il listener le disabilita quando un guasto si apre.
 *
 * @param {Array<{ value?: string, disabled?: boolean, textContent?: string, dataset?: { giaGuasto?: string, etichettaBase?: string, suffisso?: string } }>} opzioni
 * @param {Array<object>} guastiAperti
 * @param {Record<string, object>|Map<string, object>} macchinePerId
 * @returns {Array<{ value: string, disabled: boolean, giaGuasto: string, suffisso: string, etichettaBase: string, textContent: string, cambiata: boolean }>}
 */
export function aggiornaOpzioniDaGuasti(opzioni, guastiAperti, macchinePerId) {
  const aperti = idsConGuastoAperto(guastiAperti);
  return (Array.isArray(opzioni) ? opzioni : []).map((opt) => {
    const value = String((opt && opt.value) || '');
    const dataset = (opt && opt.dataset) || {};
    const etichettaBase = String(dataset.etichettaBase || '');
    const invariata = {
      value,
      disabled: !!(opt && opt.disabled),
      giaGuasto: String(dataset.giaGuasto || ''),
      suffisso: String(dataset.suffisso || ''),
      etichettaBase,
      textContent: String((opt && opt.textContent) || ''),
      cambiata: false
    };
    if (!value || dataset.giaGuasto !== '1' || aperti.has(value)) return invariata;

    const esito = macchinaSelezionabile(macchinaDaMappa(macchinePerId, value), {
      contesto: 'nuovo-guasto',
      guastoAperto: false
    });
    const suffisso = suffissoMacchinaNonSelezionabile(esito);
    const giaGuasto = suffisso === ' (già in guasto)' ? '1' : '';
    return {
      value,
      disabled: !esito.ok,
      giaGuasto,
      suffisso,
      etichettaBase,
      textContent: etichettaBase + suffisso,
      cambiata: invariata.disabled !== !esito.ok
        || invariata.suffisso !== suffisso
        || invariata.giaGuasto !== giaGuasto
    };
  });
}
