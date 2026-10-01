/**
 * Catalogo hub Seminativo — card e rotte Tony.
 * Nuova sottocategoria = voce qui, non if nel widget Tony.
 * @module modules/seminativo/config/seminativo-hub
 */

export const SEMINATIVO_MODULE_ID = 'seminativo';

export const SEMINATIVO_ACCENT = '#C9A227';
export const SEMINATIVO_ACCENT_DARK = '#8D6E00';

/** Collezione Firestore: tenants/{tenantId}/seminativi (record per campagna). */
export const SEMINATIVO_COLLECTION = 'seminativi';

/** Collezione Firestore: tenants/{tenantId}/semineSeminativo (eventi di semina). */
export const SEMINE_SEMINATIVO_COLLECTION = 'semineSeminativo';

/** Collezione Firestore: tenants/{tenantId}/trattamentiSeminativo (dati prodotto su lavoro o diario). */
export const TRATTAMENTI_SEMINATIVO_COLLECTION = 'trattamentiSeminativo';

/** Collezione Firestore: tenants/{tenantId}/raccolteSeminativo (quintali su lavoro o diario). */
export const RACCOLTE_SEMINATIVO_COLLECTION = 'raccolteSeminativo';

/**
 * @typedef {Object} SeminativoHubCard
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} icon
 * @property {string} href
 * @property {string} tonyTarget
 * @property {string} pageType
 * @property {boolean} [placeholder]
 */

/** @type {SeminativoHubCard[]} */
export const SEMINATIVO_HUB_CARDS = [
  {
    id: 'anagrafica',
    title: 'Anagrafica appezzamenti',
    description: 'Campagne seminativo collegate ai terreni: coltura e varietà per anno.',
    icon: '🌾',
    href: 'seminativi-standalone.html',
    tonyTarget: 'seminativi',
    pageType: 'seminativi',
    placeholder: false
  },
  {
    id: 'piano',
    title: 'Piano colturale',
    description: 'Propone la coltura della campagna successiva a partire da quella in campo.',
    icon: '🗓️',
    href: 'piano-colturale-standalone.html',
    tonyTarget: 'piano colturale',
    pageType: 'piano_colturale_seminativo',
    placeholder: false
  },
  {
    id: 'semina',
    title: 'Semina',
    description: 'Registra semine, varietà e dosi seme.',
    icon: '🌱',
    href: 'semina-standalone.html',
    tonyTarget: 'semina seminativo',
    pageType: 'semina_seminativo',
    placeholder: false
  },
  {
    id: 'lavorazioni',
    title: 'Lavorazioni terreno',
    description: 'Arature ed erpicature lette dal diario e, con Manodopera, dai lavori.',
    icon: '🚜',
    href: 'lavorazioni-standalone.html',
    tonyTarget: 'lavorazioni seminativo',
    pageType: 'lavorazioni_seminativo',
    placeholder: false
  },
  {
    id: 'trattamenti',
    title: 'Trattamenti',
    description: 'Trattamenti fitosanitari dal diario e, con Manodopera, dai lavori. Stesso completamento del vigneto: prodotti, dose, costi e scarico magazzino.',
    icon: '🧪',
    href: 'trattamenti-standalone.html',
    tonyTarget: 'trattamenti seminativo',
    pageType: 'trattamenti_seminativo',
    placeholder: false
  },
  {
    id: 'concimazioni',
    title: 'Concimazioni',
    description: 'Concimazioni a pieno campo dal diario e, con Manodopera, dai lavori. Stesso completamento dei trattamenti.',
    icon: '🌿',
    href: 'concimazioni-standalone.html',
    tonyTarget: 'concimazioni seminativo',
    pageType: 'concimazioni_seminativo',
    placeholder: false
  },
  {
    id: 'raccolta',
    title: 'Raccolta / mietitura',
    description: 'Mietitura a pieno campo dal diario e, con Manodopera, dai lavori. Quintali, superficie e costi sulla campagna.',
    icon: '📦',
    href: 'raccolta-standalone.html',
    tonyTarget: 'raccolta seminativo',
    pageType: 'raccolta_seminativo',
    placeholder: false
  },
  {
    id: 'statistiche',
    title: 'Statistiche e grafici',
    description: 'Quintali, resa effettiva e costi di campagna. La resa prevista dell’anagrafica resta a parte.',
    icon: '📊',
    href: 'seminativo-statistiche-standalone.html',
    tonyTarget: 'statistiche seminativo',
    pageType: 'statistiche_seminativo',
    placeholder: false
  }
];

export const SEMINATIVO_EXCLUDED_FROM_VIGNETO = [
  'potatura',
  'pianifica impianto',
  'calcolo materiali'
];

export function getSeminativoHubCard(id) {
  return SEMINATIVO_HUB_CARDS.find((card) => card.id === id) || null;
}
