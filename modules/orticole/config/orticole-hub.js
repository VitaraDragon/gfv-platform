/**
 * Catalogo hub Orticole — card e rotte Tony.
 * Nuova sottocategoria = voce qui, non if nel widget Tony.
 * Fase 1: pieno campo (niente piano colturale/rotazione; sì irrigazione).
 * @module modules/orticole/config/orticole-hub
 */

export const ORTICOLE_MODULE_ID = 'orticole';

export const ORTICOLE_ACCENT = '#E65100';
export const ORTICOLE_ACCENT_DARK = '#BF360C';

/** Collezione Firestore: tenants/{tenantId}/orticole (record per campagna/ciclo). */
export const ORTICOLE_COLLECTION = 'orticole';

/** Collezione Firestore: tenants/{tenantId}/semineOrticole (semina o trapianto). */
export const SEMINE_ORTICOLE_COLLECTION = 'semineOrticole';

/** Collezione Firestore: tenants/{tenantId}/trattamentiOrticole. */
export const TRATTAMENTI_ORTICOLE_COLLECTION = 'trattamentiOrticole';

/** Collezione Firestore: tenants/{tenantId}/raccolteOrticole. */
export const RACCOLTE_ORTICOLE_COLLECTION = 'raccolteOrticole';

/** Collezione Firestore: tenants/{tenantId}/irrigazioniOrticole. */
export const IRRIGAZIONI_ORTICOLE_COLLECTION = 'irrigazioniOrticole';

/**
 * @typedef {Object} OrticoleHubCard
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} icon
 * @property {string} href
 * @property {string} tonyTarget
 * @property {string} pageType
 * @property {boolean} [placeholder]
 */

/** @type {OrticoleHubCard[]} */
export const ORTICOLE_HUB_CARDS = [
  {
    id: 'anagrafica',
    title: 'Anagrafica campagne',
    description: 'Campagne orticole sui terreni Ortive: coltura, varietà e fino a due cicli per annata.',
    icon: '🥬',
    href: 'orticole-anagrafica-standalone.html',
    tonyTarget: 'orticole anagrafica',
    pageType: 'orticole',
    placeholder: false
  },
  {
    id: 'impianto',
    title: 'Semina e trapianto',
    description: 'Registra semine o trapianti, varietà e dosi o densità piante.',
    icon: '🌱',
    href: 'impianto-standalone.html',
    tonyTarget: 'semina orticole',
    pageType: 'impianto_orticole',
    placeholder: false
  },
  {
    id: 'lavorazioni',
    title: 'Lavorazioni terreno',
    description: 'Arature ed erpicature lette dal diario e, con Manodopera, dai lavori.',
    icon: '🚜',
    href: 'lavorazioni-standalone.html',
    tonyTarget: 'lavorazioni orticole',
    pageType: 'lavorazioni_orticole',
    placeholder: false
  },
  {
    id: 'irrigazione',
    title: 'Irrigazione',
    description: 'Interventi di irrigazione dal diario e dai lavori. Volume in m³ e metodo a tendina.',
    icon: '💧',
    href: 'irrigazione-standalone.html',
    tonyTarget: 'irrigazione orticole',
    pageType: 'irrigazione_orticole',
    placeholder: false
  },
  {
    id: 'trattamenti',
    title: 'Trattamenti',
    description: 'Trattamenti fitosanitari dal diario e, con Manodopera, dai lavori. Prodotti, dose a ettaro e scarico magazzino.',
    icon: '🧪',
    href: 'trattamenti-standalone.html',
    tonyTarget: 'trattamenti orticole',
    pageType: 'trattamenti_orticole',
    placeholder: false
  },
  {
    id: 'concimazioni',
    title: 'Concimazioni',
    description: 'Concimazioni a pieno campo dal diario e, con Manodopera, dai lavori.',
    icon: '🌿',
    href: 'concimazioni-standalone.html',
    tonyTarget: 'concimazioni orticole',
    pageType: 'concimazioni_orticole',
    placeholder: false
  },
  {
    id: 'raccolta',
    title: 'Raccolta',
    description: 'Raccolta a pieno campo: quintali, superficie, resa q/ha e destinazione a tendina.',
    icon: '📦',
    href: 'raccolta-standalone.html',
    tonyTarget: 'raccolta orticole',
    pageType: 'raccolta_orticole',
    placeholder: false
  },
  {
    id: 'statistiche',
    title: 'Statistiche e grafici',
    description: 'Quintali, resa effettiva e costi di campagna. La resa prevista dell’anagrafica resta a parte.',
    icon: '📊',
    href: 'orticole-statistiche-standalone.html',
    tonyTarget: 'statistiche orticole',
    pageType: 'statistiche_orticole',
    placeholder: false
  }
];

export const ORTICOLE_EXCLUDED_FROM_VIGNETO = [
  'potatura',
  'pianifica impianto',
  'calcolo materiali',
  'piano colturale',
  'rotazione'
];

export function getOrticoleHubCard(id) {
  return ORTICOLE_HUB_CARDS.find((card) => card.id === id) || null;
}
