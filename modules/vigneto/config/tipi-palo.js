/**
 * Lista unica del tipo palo. Anagrafica vigneto, form vigneto in Gestione lavori,
 * vendemmia e tariffa VM leggono da qui. I valori salvati sono chiavi.
 * @module modules/vigneto/config/tipi-palo
 */

export const TIPI_PALO = [
  { chiave: 'acciaio_zincato_caldo', etichetta: 'Acciaio zincato a caldo', famiglia: 'ferro' },
  { chiave: 'acciaio_zincato_freddo', etichetta: 'Acciaio zincato a freddo (pre-zincato)', famiglia: 'ferro' },
  { chiave: 'acciaio_corten', etichetta: 'Acciaio Corten', famiglia: 'ferro' },
  { chiave: 'legno_castagno', etichetta: 'Legno di castagno', famiglia: 'legno' },
  { chiave: 'legno_pino_trattato', etichetta: 'Legno di pino trattato', famiglia: 'legno' },
  { chiave: 'cemento_precompresso', etichetta: 'Cemento precompresso', famiglia: 'cemento' },
  { chiave: 'altro', etichetta: 'Altro (es. plastica)', famiglia: 'personalizzata' }
];

const CHIAVI = new Set(TIPI_PALO.map((tipo) => tipo.chiave));

/** Etichette e chiavi vecchie, confronto senza maiuscole e spazi doppi. */
const ETICHETTE_VECCHIE = [
  ['ferro zincato a freddo', 'acciaio_zincato_freddo'],
  ['acciaio zincato a freddo', 'acciaio_zincato_freddo'],
  ['acciaio zincato a freddo (pre-zincato)', 'acciaio_zincato_freddo'],
  ['acciaio corten', 'acciaio_corten'],
  ['ferro zincato a caldo', 'acciaio_zincato_caldo'],
  ['acciaio zincato a caldo', 'acciaio_zincato_caldo'],
  ['acciaio zincato', 'acciaio_zincato_caldo'],
  ['misto cemento-ferro', 'acciaio_zincato_caldo'],
  ['misto cemento ferro', 'acciaio_zincato_caldo'],
  ['ferro', 'acciaio_zincato_caldo'],
  ['acciaio', 'acciaio_zincato_caldo'],
  ['legno di castagno', 'legno_castagno'],
  ['legno di pino trattato', 'legno_pino_trattato'],
  ['legno trattato', 'legno_pino_trattato'],
  ['legno', 'legno_pino_trattato'],
  ['cemento precompresso', 'cemento_precompresso'],
  ['cemento armato', 'cemento_precompresso'],
  ['cemento', 'cemento_precompresso'],
  ['plastica', 'altro'],
  ['fibra_vetro', 'altro'],
  ['fibra di vetro', 'altro'],
  ['personalizzata', 'altro']
];

function compatta(valore) {
  return String(valore == null ? '' : valore).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function chiaveTipoPaloValida(valore) {
  return CHIAVI.has(String(valore || ''));
}

/**
 * Chiave nuova. Una chiave già valida resta com'è. Un'etichetta vecchia
 * diventa la chiave della lista. Il resto, se c'è un testo, diventa `altro`.
 */
export function normalizzaTipoPalo(valore) {
  const testo = compatta(valore);
  if (!testo) return '';
  if (CHIAVI.has(testo)) return testo;
  const nota = ETICHETTE_VECCHIE.find((voce) => voce[0] === testo);
  return nota ? nota[1] : 'altro';
}

/** Famiglia tariffa VM: ferro, legno, cemento o personalizzata. */
export function famigliaTariffaPalo(valore) {
  const chiave = normalizzaTipoPalo(valore);
  if (!chiave) return '';
  const voce = TIPI_PALO.find((tipo) => tipo.chiave === chiave);
  return voce ? voce.famiglia : 'personalizzata';
}

/** Riempie il select con le chiavi. `valore` è la chiave o l'etichetta già salvata. */
export function riempiSelectTipoPalo(select, valore) {
  if (!select) return;
  const corrente = normalizzaTipoPalo(valore != null ? valore : select.value);
  const placeholder = select.querySelector('option[value=""]');
  const testoPlaceholder = placeholder ? placeholder.textContent : 'Seleziona tipo palo';
  select.innerHTML = '';
  const vuota = document.createElement('option');
  vuota.value = '';
  vuota.textContent = testoPlaceholder || 'Seleziona tipo palo';
  select.appendChild(vuota);
  TIPI_PALO.forEach((tipo) => {
    const opt = document.createElement('option');
    opt.value = tipo.chiave;
    opt.textContent = tipo.etichetta;
    select.appendChild(opt);
  });
  if (corrente) select.value = corrente;
}
