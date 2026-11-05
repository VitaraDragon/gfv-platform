/**
 * Checkbox «Registra scarico in magazzino» dei form trattamento (vigneto/frutteto, pagina condivisa).
 * Lo stato non si fida solo di `magazzinoMovimentoIds`: se i movimenti collegati non esistono più
 * (stornati da Magazzino → Movimenti) il checkbox resta deselezionato e compare una nota.
 *
 * @module shared/js/scarico-magazzino-ui
 */

export const NOTA_SCARICO_STORNATO = 'Scarico stornato da Movimenti';
const NOTA_ID = 'trattamento-scarico-magazzino-nota';

/**
 * @param {{ magazzinoMovimentoIds?: string[] }|null|undefined} t
 * @returns {Promise<{ checked: boolean, stornato: boolean }>}
 */
export async function risolviStatoScaricoMagazzino(t) {
  const ids = t && Array.isArray(t.magazzinoMovimentoIds) ? t.magazzinoMovimentoIds.filter(Boolean) : [];
  if (!ids.length) {
    return { checked: false, stornato: !!(t && t.magazzinoScaricoStornatoIl) };
  }
  try {
    const { getMovimento } = await import('../../modules/magazzino/services/movimenti-service.js');
    const esistenti = await Promise.all(ids.map((id) => getMovimento(id)));
    const almenoUno = esistenti.some(Boolean);
    return { checked: almenoUno, stornato: !almenoUno };
  } catch (e) {
    // Lettura non riuscita: non so se i movimenti esistono, mantengo lo stato registrato sul trattamento.
    console.warn('[scarico-magazzino-ui] verifica movimenti:', e);
    return { checked: true, stornato: false };
  }
}

/**
 * @param {{ magazzinoMovimentoIds?: string[], magazzinoScaricoStornatoIl?: unknown }|null|undefined} t
 * @param {{ hasMagazzinoModule: boolean, doc?: Document }} opts
 * @returns {Promise<void>}
 */
export async function applyScaricoMagazzinoUi(t, opts) {
  const doc = (opts && opts.doc) || document;
  const scaricoGrp = doc.getElementById('trattamento-scarico-magazzino-group');
  const scaricoCb = doc.getElementById('trattamento-registra-scarico-magazzino');
  if (!scaricoGrp || !scaricoCb) return;
  const attivo = !!(opts && opts.hasMagazzinoModule);
  scaricoGrp.style.display = attivo ? 'block' : 'none';

  let nota = doc.getElementById(NOTA_ID);
  if (nota) nota.style.display = 'none';
  if (!attivo) return;

  const stato = await risolviStatoScaricoMagazzino(t);
  scaricoCb.checked = stato.checked;

  if (stato.stornato) {
    if (!nota) {
      nota = doc.createElement('small');
      nota.id = NOTA_ID;
      nota.style.cssText = 'display:block;color:#b45309;margin-top:6px;margin-left:28px;';
      scaricoGrp.appendChild(nota);
    }
    nota.textContent = NOTA_SCARICO_STORNATO;
    nota.style.display = 'block';
  }
}
