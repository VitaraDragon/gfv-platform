/**
 * Default trattamenti fitosanitari (lavori + scheda coltura).
 * Usato da: Gestione lavori, servizi trattamenti vigneto/frutteto, pagine standalone, Tony (istruzioni allineate al nome).
 *
 * @module core/config/trattamenti-lavoro-defaults
 */

/** Nome tipo lavoro predefinito se l'utente sceglie solo "Trattamenti" senza specificare altro (catalogo tipi-lavoro-service). */
export const DEFAULT_TIPO_LAVORO_TRATTAMENTO_GENERICO = 'Trattamento Anticrittogamico Meccanico';

/** Nome sottocategoria predefinita (Tony / UX) quando l'utente dice solo "trattamento": abbinata al tipo anticrittogamico meccanico. */
export const DEFAULT_SOTTOCATEGORIA_TRATTAMENTI_TONY = 'Meccanico';

/**
 * Tipi lavoro generici da non mostrare nel dropdown Gestione lavori (restano Anticrittogamico, Insetticida, ecc.).
 * Nomi confrontati in modo case-insensitive.
 */
export const TIPI_LAVORO_TRATTAMENTI_NASCONDI_IN_DROPDOWN = [
  'Trattamento',
  'Trattamento Manuale',
  'Trattamento Meccanico'
];

/**
 * Mappa il nome del tipo lavoro sul campo `tipoTrattamento` del modello (antifungino = uso agricolo anticrittogamico).
 * @param {string} tipoLavoroNome
 * @returns {'antifungino'|'insetticida'|'acaricida'|'fertilizzante'|'altro'}
 */
export function inferTipoTrattamentoColturaFromTipoLavoroNome(tipoLavoroNome) {
  const n = (tipoLavoroNome || '').toLowerCase();
  if (!n) return 'antifungino';
  if (n.includes('concimaz')) return 'fertilizzante';
  if (n.includes('insetticida')) return 'insetticida';
  if (n.includes('acaricida')) return 'acaricida';
  if (n.includes('fertilizz')) return 'fertilizzante';
  if (n.includes('anticrittogamico') || n.includes('antifungino') || n.includes('fungino')) return 'antifungino';
  return 'antifungino';
}

/**
 * True se la categoria/sottocategoria selezionata nel form lavori è il blocco fitosanitari (Trattamenti).
 * @param {string|null|undefined} categoriaId
 * @param {Array<{id?: string, codice?: string, parentId?: string}>} categorieLavoriPrincipali
 * @param {Map<string, Array<{id?: string, codice?: string, parentId?: string}>>} sottocategorieLavoriMap
 */
export function isCategoriaTrattamentiFitosanitari(categoriaId, categorieLavoriPrincipali, sottocategorieLavoriMap) {
  if (!categoriaId) return false;
  const flat = [
    ...(categorieLavoriPrincipali || []),
    ...Array.from(sottocategorieLavoriMap?.values() || []).flat()
  ];
  const cat = flat.find(c => c && c.id === categoriaId);
  if (!cat) return false;
  const cod = (cat.codice || '').toLowerCase();
  if (cod === 'trattamenti') return true;
  if (cat.parentId) {
    const parent = (categorieLavoriPrincipali || []).find(c => c && c.id === cat.parentId);
    if (parent && (parent.codice || '').toLowerCase() === 'trattamenti') return true;
  }
  return false;
}

/**
 * Rimuove dall'elenco i tipi generici "Trattamento" / "Trattamento Manuale" / "Trattamento Meccanico"
 * quando si è nel ramo Trattamenti (categoria o sottocategoria sotto Trattamenti).
 * Anticrittogamico e Insetticida restano disponibili sia in sottocategoria Manuale che Meccanico.
 * @param {Array<{nome?: string}>} tipiFiltrati
 */
export function filterTipiLavoroNascondiTipiGenericiTrattamenti(
  tipiFiltrati,
  categoriaIdSelezionata,
  categorieLavoriPrincipali,
  sottocategorieLavoriMap
) {
  if (!Array.isArray(tipiFiltrati)) return tipiFiltrati;
  if (
    !isCategoriaTrattamentiFitosanitari(
      categoriaIdSelezionata,
      categorieLavoriPrincipali,
      sottocategorieLavoriMap
    )
  ) {
    return tipiFiltrati;
  }
  const banned = new Set(
    TIPI_LAVORO_TRATTAMENTI_NASCONDI_IN_DROPDOWN.map(s => s.trim().toLowerCase())
  );
  return tipiFiltrati.filter(t => {
    const key = (t.nome || '').trim().toLowerCase();
    return !banned.has(key);
  });
}
