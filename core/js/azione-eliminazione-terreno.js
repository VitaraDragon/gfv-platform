/**
 * Elimina solo se non ci sono collegamenti. Altrimenti archivia.
 * Le dipendenze si iniettano così i test non toccano Firestore.
 *
 * @module core/js/azione-eliminazione-terreno
 */

import { decidiAzioneTerreno, motivoDaScelta } from '../../shared/js/terreno-archivio.js';

const PROMPT_MOTIVO = 'Perché archivi il terreno?\n1 = fine affitto\n2 = vendita\n3 = altro';

/**
 * @param {object} terreno
 * @param {{
 *   getCollegamentiTerreno: Function,
 *   archiviaTerreno: Function,
 *   eliminaTerreno: Function,
 *   confirm: Function,
 *   chiediMotivo: Function,
 *   chiediNota?: Function,
 *   avvisa: Function
 * }} deps
 */
export async function eseguiEliminazioneOArchiviazione(terreno, deps) {
  if (!terreno || !terreno.id) {
    return { azione: 'errore', messaggio: 'Terreno non trovato' };
  }
  let verifica;
  try {
    const collegamenti = await deps.getCollegamentiTerreno(terreno.id);
    verifica = { ok: true, nome: terreno.nome, collegamenti };
  } catch (error) {
    verifica = { ok: false };
  }
  const decisione = decidiAzioneTerreno(verifica);
  if (decisione.azione === 'errore') {
    if (deps.avvisa) deps.avvisa(decisione.messaggio, 'error');
    return decisione;
  }
  const conferma = deps.confirm ? deps.confirm(decisione.messaggio) : false;
  if (!conferma) return { azione: 'annullata' };

  if (decisione.azione === 'elimina') {
    await deps.eliminaTerreno(terreno.id);
    return { azione: 'eliminato' };
  }

  const scelta = deps.chiediMotivo ? deps.chiediMotivo(PROMPT_MOTIVO) : '3';
  const motivo = motivoDaScelta(scelta);
  if (!motivo) {
    if (deps.avvisa) deps.avvisa('Scegli un motivo: fine affitto, vendita o altro.', 'error');
    return { azione: 'annullata' };
  }
  let nota = null;
  if (motivo === 'altro' && deps.chiediNota) {
    nota = deps.chiediNota('Nota (facoltativa)') || null;
  }
  await deps.archiviaTerreno(terreno.id, { motivo, nota });
  return { azione: 'archiviato', motivo };
}
