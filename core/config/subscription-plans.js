/**
 * Subscription Plans Configuration
 * Configurazione centralizzata per piani abbonamento e moduli
 * 
 * @module core/config/subscription-plans
 */

/**
 * Configurazione piani abbonamento
 * Struttura semplificata: Free (acquisizione) + Base (€5) + Moduli pay-per-use
 *
 * Fatturazione: prezzi espressi al mese (confronto); addebito solo annuale (Stripe).
 */
export const BILLING = {
  /** Unico intervallo di addebito per piani/moduli/bundle a pagamento */
  chargeInterval: 'year',
  monthsPerCharge: 12,
  chargeIntervalLabel: 'anno',
  /** Prezzi in UI = equivalente mensile di riferimento */
  displayUnit: 'month',
  displayUnitLabel: 'mese',
  /** Piano Free: nessun pagamento */
  freeExcluded: true,
  /** Stripe: usare Checkout Sessions + Billing; Price.recurring.interval = 'year' */
  stripe: {
    integration: 'checkout_sessions',
    recurringInterval: 'year',
    /** unit_amount (centesimi) = monthlyReference * monthsPerCharge * 100 */
    unitAmountFromMonthly: (monthly) => Math.round(monthly * 12 * 100)
  },
  note: 'Piani e moduli a pagamento: fatturazione annuale anticipata. Il valore del gestionale si costruisce nel tempo con i dati in piattaforma.'
};

/**
 * Equivalente annuale da prezzo mensile di riferimento.
 * @param {number} monthlyPrice
 * @returns {number}
 */
export function monthlyToAnnual(monthlyPrice) {
  const n = Number(monthlyPrice);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * BILLING.monthsPerCharge * 100) / 100;
}

/**
 * Etichetta prezzo per UI: riferimento mensile + addebito annuale.
 * @param {number} monthlyPrice
 * @returns {{ monthlyReference: number, annualCharge: number, labelShort: string, labelFull: string }}
 */
export function formatBillingDisplay(monthlyPrice) {
  const monthlyReference = Number(monthlyPrice) || 0;
  const annualCharge = monthlyToAnnual(monthlyReference);
  return {
    monthlyReference,
    annualCharge,
    labelShort: `€${monthlyReference}/${BILLING.displayUnitLabel}`,
    labelFull: monthlyReference > 0
      ? `€${monthlyReference}/${BILLING.displayUnitLabel} · fatturato €${annualCharge}/${BILLING.chargeIntervalLabel}`
      : `€0`
  };
}

export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    maxTerreni: 5,
    maxAttivitaMese: 30,
    maxModules: 0, // Solo core base, nessun modulo disponibile
    includedModules: [],
    features: [
      'Terreni (max 5)',
      'Attività (max 30/mese)',
      'Statistiche base',
      'Utenti illimitati',
      'Storage base',
      'Supporto documentazione'
    ],
    support: 'Documentazione',
    badge: '🆓'
  },
  base: {
    id: 'base',
    name: 'Base',
    price: 5,
    maxTerreni: null, // Illimitati
    maxAttivitaMese: null, // Illimitate
    maxModules: null, // Tutti i moduli disponibili (pay-per-use)
    includedModules: [], // Nessun modulo incluso, tutti a pagamento
    features: [
      'Terreni illimitati',
      'Attività illimitate',
      'Utenti illimitati',
      'Moduli pay-per-use',
      'Storage base',
      'Supporto email',
      'Export Excel'
    ],
    support: 'Email',
    badge: '💚',
    /** Prezzo Stripe annuale — v. STRIPE_PRICE_IDS */
    stripePlan: true
  }
};

/**
 * Configurazione moduli disponibili
 */
export const AVAILABLE_MODULES = [
  {
    id: 'manodopera',
    name: 'Manodopera',
    icon: '👷',
    description: 'Gestione squadre, operai e lavori',
    price: 6,
    available: true,
    category: 'operativo'
  },
  {
    id: 'parcoMacchine',
    name: 'Parco Macchine',
    icon: '🚜',
    description: 'Gestione macchine, manutenzioni e scadenze',
    price: 3,
    available: true,
    category: 'operativo'
  },
  {
    id: 'contoTerzi',
    name: 'Conto Terzi',
    icon: '🤝',
    description: 'Gestione clienti e lavori esterni',
    price: 6,
    available: true,
    category: 'business'
  },
  {
    id: 'vigneto',
    name: 'Vigneto',
    icon: '🍇',
    description: 'Gestione vigneti e vendemmia',
    price: 3,
    available: true,
    category: 'colture'
  },
  {
    id: 'frutteto',
    name: 'Frutteto',
    icon: '🍎',
    description: 'Gestione frutteti e raccolta',
    price: 3,
      available: true,
      category: 'colture'
  },
  {
    id: 'oliveto',
    name: 'Oliveto',
    icon: '🫒',
    description: 'Gestione oliveti e raccolta',
    price: 3,
    available: false, // Da sviluppare
    category: 'colture',
    badge: 'Prossimamente'
  },
  {
    id: 'magazzino',
    name: 'Prodotti e Magazzino',
    icon: '📦',
    description: 'Anagrafica prodotti, giacenze e movimenti (entrate/uscite)',
    price: 3,
    available: true,
    category: 'utility'
  },
  {
    id: 'tony',
    name: 'Tony Avanzato',
    icon: '🤖',
    description: 'Assistente IA con azioni operative: apri pagine, compila form, mostra grafici',
    price: 5,
    available: true,
    category: 'utility'
  },
  {
    id: 'report',
    name: 'Report/Bilancio',
    icon: '📑',
    description: 'Dashboard report per area (Terreni, Vigneto, …), sintesi ed export dove disponibile',
    price: 5,
    available: true,
    category: 'utility'
  },
  {
    id: 'meteo',
    name: 'Meteo',
    icon: '🌦️',
    description: 'Previsioni per sede e terreni, alert meteo e pagina dedicata',
    price: 1,
    available: true,
    category: 'utility'
  }
];

/**
 * ID di tutti i moduli attualmente acquistabili (esclusi "prossimamente").
 */
export const ALL_AVAILABLE_MODULE_IDS = AVAILABLE_MODULES
  .filter(m => m.available)
  .map(m => m.id);

/**
 * Bundle strategici — allineati alle intersezioni moduli (tony-module-recommendations / intersezioni-moduli).
 * Prezzo singoli, risparmio e sconto %: calcolati con getBundleBreakdown().
 */
export const BUNDLES = [
  {
    id: 'vigneto-operativo',
    name: 'Viticoltore Operativo',
    modules: ['vigneto', 'manodopera', 'magazzino'],
    price: 10, // €3 + €6 + €3 = €12
    description: 'Vigneto, squadre vendemmia e scarico prodotti da trattamenti/concimazioni',
    suggestedFor: ['vigneto', 'manodopera'],
    upsellModules: ['magazzino']
  },
  {
    id: 'operativo-vigneto',
    name: 'Viticoltore Campo',
    modules: ['vigneto', 'manodopera', 'parcoMacchine'],
    price: 10, // €3 + €6 + €3 = €12
    description: 'Vigneto, squadre e parco macchine per lavori in campo',
    suggestedFor: ['vigneto', 'manodopera'],
    upsellModules: ['parcoMacchine']
  },
  {
    id: 'frutteto-operativo',
    name: 'Frutteto Operativo',
    modules: ['frutteto', 'manodopera', 'magazzino'],
    price: 10, // €3 + €6 + €3 = €12
    description: 'Frutteto, squadre raccolta e magazzino prodotti per trattamenti',
    suggestedFor: ['frutteto', 'manodopera'],
    upsellModules: ['magazzino']
  },
  {
    id: 'frutticoltore-campo',
    name: 'Frutticoltore Campo',
    modules: ['frutteto', 'manodopera', 'parcoMacchine'],
    price: 10, // €3 + €6 + €3 = €12
    description: 'Frutteto, squadre e parco macchine per lavori in campo',
    suggestedFor: ['frutteto', 'manodopera'],
    upsellModules: ['parcoMacchine']
  },
  {
    id: 'conto-terzi-operativo',
    name: 'Servizi Conto Terzi',
    modules: ['contoTerzi', 'manodopera', 'report'],
    price: 14, // €6 + €6 + €5 = €17
    description: 'Preventivi e clienti → lavori → ore squadra → report costi',
    suggestedFor: ['contoTerzi'],
    upsellModules: ['manodopera', 'report']
  },
  {
    id: 'business-completo',
    name: 'Business Conto Terzi',
    modules: ['contoTerzi', 'report'],
    price: 9, // €6 + €5 = €11
    description: 'Preventivi, clienti e report costi (senza manodopera)',
    suggestedFor: ['contoTerzi'],
    upsellModules: ['report']
  },
  {
    id: 'operativo-completo',
    name: 'Operativo Completo',
    modules: ['manodopera', 'parcoMacchine', 'report'],
    price: 12, // €6 + €3 + €5 = €14
    description: 'Squadre, macchine e report operativi',
    suggestedFor: ['manodopera', 'parcoMacchine'],
    upsellModules: ['report']
  },
  {
    id: 'coltura-meteo',
    name: 'Colture e Meteo',
    modules: ['vigneto', 'frutteto', 'meteo'],
    price: 6, // €3 + €3 + €1 = €7
    description: 'Vigneto e frutteto con meteo per pianificare trattamenti e lavori',
    suggestedFor: ['vigneto', 'frutteto'],
    upsellModules: ['meteo']
  },
  {
    id: 'gfv-completo',
    name: 'GFV Completo',
    modules: ALL_AVAILABLE_MODULE_IDS,
    price: 30, // singoli €35 → risparmio €5 (~14%)
    isComplete: true,
    description: 'Tutti i moduli disponibili: colture, manodopera, conto terzi, magazzino, meteo, report e Tony Avanzato',
    suggestedFor: ALL_AVAILABLE_MODULE_IDS,
    upsellModules: []
  }
];

/**
 * Somma prezzi mensili dei moduli (solo moduli available).
 * @param {Array<string>} moduleIds
 * @returns {number}
 */
export function sumModulePrices(moduleIds = []) {
  return moduleIds.reduce((sum, moduleId) => {
    const mod = getModuleConfig(moduleId);
    return sum + (mod && mod.available ? mod.price : 0);
  }, 0);
}

/**
 * Dettaglio prezzi bundle: singoli, totale, risparmio, sconto %.
 * @param {Object} bundle - Voce da BUNDLES
 * @returns {Object}
 */
export function getBundleBreakdown(bundle) {
  if (!bundle || !Array.isArray(bundle.modules)) {
    return {
      items: [],
      singlesTotal: 0,
      bundlePrice: 0,
      savings: 0,
      discountPercent: 0,
      allAvailable: false
    };
  }

  const items = bundle.modules.map(moduleId => {
    const mod = getModuleConfig(moduleId);
    if (!mod) return null;
    return {
      id: mod.id,
      name: mod.name,
      icon: mod.icon,
      price: mod.available ? mod.price : 0,
      available: mod.available
    };
  }).filter(Boolean);

  const allAvailable = bundle.modules.every(moduleId => {
    const mod = getModuleConfig(moduleId);
    return mod && mod.available;
  });

  const singlesTotal = sumModulePrices(bundle.modules);
  const bundlePrice = bundle.price || 0;
  const savings = allAvailable ? singlesTotal - bundlePrice : 0;
  const discountPercent = allAvailable && singlesTotal > 0 && savings > 0
    ? Math.round((savings / singlesTotal) * 100)
    : 0;

  return {
    items,
    singlesTotal,
    bundlePrice,
    savings,
    discountPercent,
    allAvailable,
    singlesTotalAnnual: monthlyToAnnual(singlesTotal),
    bundlePriceAnnual: monthlyToAnnual(bundlePrice),
    savingsAnnual: monthlyToAnnual(savings)
  };
}

/**
 * Ottieni configurazione piano per ID
 * @param {string} planId - ID del piano ('free' | 'starter' | 'professional' | 'enterprise')
 * @returns {Object|null} Configurazione piano o null se non trovato
 */
export function getPlanConfig(planId) {
  return SUBSCRIPTION_PLANS[planId] || null;
}

/**
 * Ottieni tutti i piani disponibili
 * @returns {Array<Object>} Array di configurazioni piani
 */
export function getAllPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

/**
 * Ottieni modulo per ID
 * @param {string} moduleId - ID del modulo
 * @returns {Object|null} Configurazione modulo o null se non trovato
 */
export function getModuleConfig(moduleId) {
  return AVAILABLE_MODULES.find(m => m.id === moduleId) || null;
}

/**
 * Ottieni tutti i moduli disponibili
 * @param {boolean} includeUnavailable - Include anche moduli non disponibili
 * @returns {Array<Object>} Array di configurazioni moduli
 */
export function getAllModules(includeUnavailable = true) {
  if (includeUnavailable) {
    return AVAILABLE_MODULES;
  }
  return AVAILABLE_MODULES.filter(m => m.available);
}

/**
 * Calcola prezzo totale mensile (piano + moduli/bundle)
 * Logica: piano base + bundle attivi + moduli singoli non coperti da bundle
 * @param {string} planId - ID del piano ('free' | 'base')
 * @param {Array<string>} activeModules - Array di ID moduli attivi
 * @param {Array<string>} activeBundles - Array di ID bundle attivi (opzionale)
 * @returns {number} Prezzo totale in euro
 */
export function calculateTotalPrice(planId, activeModules = [], activeBundles = []) {
  const plan = getPlanConfig(planId);
  if (!plan) return 0;
  
  let total = plan.price;
  
  // Piano Free: nessun modulo disponibile
  if (planId === 'free') {
    return total; // €0
  }
  
  // Se ci sono bundle attivi, calcola prezzo bundle + moduli non coperti
  if (activeBundles && activeBundles.length > 0) {
    // Aggiungi prezzo dei bundle
    activeBundles.forEach(bundleId => {
      const bundle = BUNDLES.find(b => b.id === bundleId);
      if (bundle) {
        total += bundle.price;
      }
    });
    
    // Trova moduli coperti dai bundle
    const modulesCoveredByBundles = new Set();
    activeBundles.forEach(bundleId => {
      const bundle = BUNDLES.find(b => b.id === bundleId);
      if (bundle) {
        bundle.modules.forEach(modId => modulesCoveredByBundles.add(modId));
      }
    });
    
    // Aggiungi prezzo solo dei moduli NON coperti da bundle
    activeModules.forEach(moduleId => {
      if (!modulesCoveredByBundles.has(moduleId)) {
        const module = getModuleConfig(moduleId);
        if (module && module.available) {
          total += module.price;
        }
      }
    });
  } else {
    // Nessun bundle: calcola prezzo moduli singoli
    activeModules.forEach(moduleId => {
      const module = getModuleConfig(moduleId);
      if (module && module.available) {
        total += module.price;
      }
    });
  }
  
  return total;
}

/**
 * Verifica se un modulo può essere attivato per un piano
 * @param {string} planId - ID del piano ('free' | 'base')
 * @param {string} moduleId - ID del modulo
 * @param {Array<string>} currentModules - Moduli attualmente attivi
 * @returns {Object} { canActivate: boolean, reason: string }
 */
export function canActivateModule(planId, moduleId, currentModules = []) {
  const plan = getPlanConfig(planId);
  const module = getModuleConfig(moduleId);
  
  if (!plan || !module) {
    return { canActivate: false, reason: 'Piano o modulo non trovato' };
  }
  
  // Modulo non disponibile
  if (!module.available) {
    return { canActivate: false, reason: 'Modulo non ancora disponibile' };
  }
  
  // Piano Free: nessun modulo disponibile
  if (planId === 'free') {
    return { canActivate: false, reason: 'Piano Free non include moduli. Passa al piano Base (€5/mese, fatturato €60/anno) per attivare moduli.' };
  }
  
  // Piano Base: tutti i moduli disponibili (pay-per-use)
  if (planId === 'base') {
    return { canActivate: true, reason: '' };
  }
  
  return { canActivate: true, reason: '' };
}

/**
 * Trova bundle suggeriti in base ai moduli selezionati
 * @param {Array<string>} selectedModules - Array di ID moduli selezionati
 * @returns {Array<Object>} Array di bundle suggeriti con calcolo risparmio
 */
export function getSuggestedBundles(selectedModules = []) {
  if (!selectedModules || selectedModules.length === 0) {
    return [];
  }
  
  const suggestions = [];
  
  BUNDLES.forEach(bundle => {
    // Verifica se l'utente ha selezionato moduli che fanno parte del bundle
    const selectedInBundle = selectedModules.filter(modId => bundle.modules.includes(modId));
    const notSelectedInBundle = bundle.modules.filter(modId => !selectedModules.includes(modId));
    
    // Se ha selezionato almeno 2 moduli del bundle, suggerisci
    if (selectedInBundle.length >= 2) {
      // Calcola prezzo moduli selezionati come singoli
      const selectedModulesPrice = selectedInBundle.reduce((sum, modId) => {
        const mod = getModuleConfig(modId);
        return sum + (mod && mod.available ? mod.price : 0);
      }, 0);
      
      // Calcola prezzo moduli non selezionati (upsell)
      const upsellModulesPrice = notSelectedInBundle.reduce((sum, modId) => {
        const mod = getModuleConfig(modId);
        return sum + (mod && mod.available ? mod.price : 0);
      }, 0);
      
      // Prezzo totale se comprasse tutti i moduli singolarmente
      const totalSinglesPrice = selectedModulesPrice + upsellModulesPrice;
      
      // Risparmio con bundle
      const savings = totalSinglesPrice - bundle.price;
      
      // Solo suggerisci se c'è un risparmio reale
      if (savings > 0) {
        suggestions.push({
          bundle,
          selectedModules: selectedInBundle,
          upsellModules: notSelectedInBundle,
          selectedModulesPrice,
          upsellModulesPrice,
          totalSinglesPrice,
          bundlePrice: bundle.price,
          savings,
          savingsPercent: Math.round((savings / totalSinglesPrice) * 100)
        });
      }
    }
  });
  
  // Ordina per risparmio (maggiore prima)
  return suggestions.sort((a, b) => b.savings - a.savings);
}

/**
 * Price ID Stripe per piano (allineare a functions/config/stripe-prices.json).
 * @type {Record<string, Record<string, string>>}
 */
export const STRIPE_PRICE_IDS = {
  test: {
    base: 'price_1TkUNZ3nOKBd0FguKWYZhq1R',
    manodopera: 'price_1Tkf0L3nOKBd0FguETZtJzOD',
    parcoMacchine: 'price_1Tkf0L3nOKBd0FguPAhLJ6a8',
    contoTerzi: 'price_1Tkf0M3nOKBd0FguQGTqs7f2',
    vigneto: 'price_1Tkf0M3nOKBd0FguugiLQvPB',
    frutteto: 'price_1Tkf0N3nOKBd0FgucJZM0u4U',
    magazzino: 'price_1Tkf0N3nOKBd0Fgu7GJL6cXm',
    tony: 'price_1Tkf0O3nOKBd0FguXdsS260m',
    report: 'price_1Tkf0O3nOKBd0FgutP7Cv0kt',
    meteo: 'price_1Tkf0P3nOKBd0Fgu3CsFEIfx',
    'vigneto-operativo': 'price_1Tkf0P3nOKBd0FguXw5iE6Qf',
    'operativo-vigneto': 'price_1Tkf0Q3nOKBd0FguAqHLXltB',
    'frutteto-operativo': 'price_1Tkf0R3nOKBd0FguaTNuwJa6',
    'frutticoltore-campo': 'price_1Tkf0R3nOKBd0Fguw2lEffqg',
    'conto-terzi-operativo': 'price_1Tkf0S3nOKBd0Fgut46XUrnM',
    'business-completo': 'price_1Tkf0S3nOKBd0FgudtZoUkW4',
    'operativo-completo': 'price_1Tkf0T3nOKBd0FguXHtxN18H',
    'coltura-meteo': 'price_1Tkf0T3nOKBd0FguKK9mtdQb',
    'gfv-completo': 'price_1Tkf0U3nOKBd0Fgu6SKqV78F'
  },
  live: {}
};

/**
 * @param {string} catalogId — piano, modulo o bundle (chiave STRIPE_PRICE_IDS)
 * @param {'test'|'live'} [env='test']
 * @returns {string|null}
 */
export function getStripePriceId(catalogId, env = 'test') {
  const map = STRIPE_PRICE_IDS[env] || {};
  const id = map[catalogId];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Piano a pagamento con checkout Stripe configurato.
 * @param {string} planId
 * @param {'test'|'live'} [env='test']
 * @returns {boolean}
 */
export function planRequiresStripePayment(planId, env = 'test') {
  const plan = getPlanConfig(planId);
  return !!(plan && plan.price > 0 && getStripePriceId(planId, env));
}

// Export default
export default {
  BILLING,
  SUBSCRIPTION_PLANS,
  AVAILABLE_MODULES,
  ALL_AVAILABLE_MODULE_IDS,
  BUNDLES,
  STRIPE_PRICE_IDS,
  getPlanConfig,
  getAllPlans,
  getModuleConfig,
  getAllModules,
  calculateTotalPrice,
  canActivateModule,
  getSuggestedBundles,
  sumModulePrices,
  getBundleBreakdown,
  monthlyToAnnual,
  formatBillingDisplay,
  getStripePriceId,
  planRequiresStripePayment
};
