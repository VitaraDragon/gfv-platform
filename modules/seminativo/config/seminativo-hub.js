/**
 * Catalogo hub Seminativo — card e rotte Tony.
 * Nuova sottocategoria = voce qui, non if nel widget Tony.
 * @module modules/seminativo/config/seminativo-hub
 */

export const SEMINATIVO_MODULE_ID = 'seminativo';

export const SEMINATIVO_ACCENT = '#C9A227';
export const SEMINATIVO_ACCENT_DARK = '#8D6E00';

/** Collezione Firestore prevista: tenants/{tenantId}/seminativi (record per campagna). */
export const SEMINATIVO_COLLECTION = 'seminativi';

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
    description: 'Rotazioni e coltura prevista per campagna.',
    icon: '🗓️',
    href: 'piano-colturale-standalone.html',
    tonyTarget: 'piano colturale',
    pageType: 'piano_colturale_seminativo',
    placeholder: true
  },
  {
    id: 'semina',
    title: 'Semina',
    description: 'Registra semine, varietà e dosi seme.',
    icon: '🌱',
    href: 'semina-standalone.html',
    tonyTarget: 'semina seminativo',
    pageType: 'semina_seminativo',
    placeholder: true
  },
  {
    id: 'lavorazioni',
    title: 'Lavorazioni terreno',
    description: 'Aratura, erpicatura e altre lavorazioni del seminativo.',
    icon: '🚜',
    href: 'lavorazioni-standalone.html',
    tonyTarget: 'lavorazioni seminativo',
    pageType: 'lavorazioni_seminativo',
    placeholder: true
  },
  {
    id: 'trattamenti',
    title: 'Trattamenti',
    description: 'Trattamenti fitosanitari sul seminativo.',
    icon: '🧪',
    href: 'trattamenti-standalone.html',
    tonyTarget: 'trattamenti seminativo',
    pageType: 'trattamenti_seminativo',
    placeholder: true
  },
  {
    id: 'concimazioni',
    title: 'Concimazioni',
    description: 'Concimazioni di campo sul seminativo.',
    icon: '🌿',
    href: 'concimazioni-standalone.html',
    tonyTarget: 'concimazioni seminativo',
    pageType: 'concimazioni_seminativo',
    placeholder: true
  },
  {
    id: 'raccolta',
    title: 'Raccolta / mietitura',
    description: 'Rese, quantità e destinazione del raccolto.',
    icon: '📦',
    href: 'raccolta-standalone.html',
    tonyTarget: 'raccolta seminativo',
    pageType: 'raccolta_seminativo',
    placeholder: true
  },
  {
    id: 'statistiche',
    title: 'Statistiche e grafici',
    description: 'KPI di campagna, rese e costi.',
    icon: '📊',
    href: 'seminativo-statistiche-standalone.html',
    tonyTarget: 'statistiche seminativo',
    pageType: 'statistiche_seminativo',
    placeholder: true
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
