/**
 * Proposta rapida del workspace campo.
 * Il lavoro selezionato vince solo se è in corso o assegnato.
 * Altrimenti il primo in corso, poi il primo assegnato.
 * Mai un lavoro completato, in attesa di approvazione, sospeso o annullato.
 */

const STATI_SUGGERIBILI = new Set(['in_corso', 'assegnato']);

/**
 * @param {{ stato?: string, raw?: { stato?: string } }|null|undefined} work
 * @returns {string}
 */
export function statoPerSuggerimentoRapido(work) {
  if (!work || typeof work !== 'object') return '';
  const raw = work.raw && typeof work.raw === 'object' ? work.raw : null;
  const stato = (raw && raw.stato) || work.stato || '';
  return String(stato).toLowerCase().trim();
}

/**
 * @param {Array<{ id?: string, label?: string, stato?: string, raw?: { stato?: string } }>|null|undefined} works
 * @param {{ selezionatoId?: string }} [opzioni]
 * @returns {object|null}
 */
export function scegliSuggerimentoRapido(works, opzioni) {
  const lista = Array.isArray(works) ? works.filter(Boolean) : [];
  const selezionatoId = opzioni && opzioni.selezionatoId ? String(opzioni.selezionatoId) : '';
  if (selezionatoId) {
    const scelto = lista.find((work) => String(work.id || '') === selezionatoId);
    if (scelto && STATI_SUGGERIBILI.has(statoPerSuggerimentoRapido(scelto))) return scelto;
  }
  const inCorso = lista.find((work) => statoPerSuggerimentoRapido(work) === 'in_corso');
  if (inCorso) return inCorso;
  const assegnato = lista.find((work) => statoPerSuggerimentoRapido(work) === 'assegnato');
  return assegnato || null;
}
