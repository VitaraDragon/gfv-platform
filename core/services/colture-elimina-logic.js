/**
 * Decisioni pure sull'eliminazione coltura (niente Firebase).
 * «attività» = Diario (`attivita`), non Gestione lavori.
 * I terreni contano anche se archiviati.
 */

export const MESSAGGIO_VERIFICA_USO_COLTURA =
  'Non riesco a verificare dove è usata questa coltura. Riprova; non la elimino.';

/**
 * @param {{ predefinito?: boolean, numAttivita?: number, numTerreni?: number, verificaOk?: boolean }} input
 * @returns {{ ok: boolean, messaggio: string }}
 */
export function decidiEliminazioneColtura(input = {}) {
  if (input.predefinito) {
    return { ok: false, messaggio: 'Non è possibile eliminare colture predefinite del sistema' };
  }
  if (input.verificaOk === false) {
    return { ok: false, messaggio: MESSAGGIO_VERIFICA_USO_COLTURA };
  }
  const numAttivita = Number(input.numAttivita) || 0;
  const numTerreni = Number(input.numTerreni) || 0;
  if (numAttivita > 0 || numTerreni > 0) {
    return {
      ok: false,
      messaggio:
        `Impossibile eliminare: la coltura è utilizzata da ${numAttivita} attività del diario e ${numTerreni} terreni ` +
        `(anche archiviati). Rimuovi o cambia i riferimenti prima.`
    };
  }
  return { ok: true, messaggio: '' };
}
