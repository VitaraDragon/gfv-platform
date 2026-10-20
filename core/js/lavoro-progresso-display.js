/**
 * Etichetta di un lavoro chiuso senza zone tracciate.
 * Non riscrive i 100 già salvati e non cambia l'approvazione.
 */

export const ETICHETTA_COMPLETATO_SENZA_ZONE = '✅ Completato (nessuna zona tracciata)';

function statoChiuso(lavoro) {
  const stato = lavoro && lavoro.stato;
  return stato === 'completato' || stato === 'completato_da_approvare';
}

function numeroPresente(value) {
  if (value == null || value === '') return false;
  const n = Number(value);
  return Number.isFinite(n);
}

function haSuperficie(lavoro) {
  return (
    (numeroPresente(lavoro.superficieTotaleLavorata) && Number(lavoro.superficieTotaleLavorata) > 0) ||
    (numeroPresente(lavoro.superficieLavorata) && Number(lavoro.superficieLavorata) > 0)
  );
}

function haPercentuale(lavoro) {
  return numeroPresente(lavoro.percentualeCompletamento) && Number(lavoro.percentualeCompletamento) > 0;
}

/**
 * @param {object|null|undefined} lavoro
 * @param {{ zoneCount?: number }|null} [opts]
 * @returns {boolean}
 */
export function lavoroCompletatoSenzaZone(lavoro, opts) {
  if (!statoChiuso(lavoro)) return false;
  if (lavoro.completamentoParziale) return false;
  if (opts && opts.zoneCount != null) {
    return Number(opts.zoneCount) <= 0;
  }
  if (numeroPresente(lavoro.percentualeCompletamentoTracciata)) {
    return Number(lavoro.percentualeCompletamentoTracciata) <= 0;
  }
  return !haSuperficie(lavoro) && !haPercentuale(lavoro);
}
