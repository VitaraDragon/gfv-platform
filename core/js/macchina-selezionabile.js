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
