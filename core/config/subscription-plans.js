/**
 * Subscription Plans Configuration
 * Configurazione centralizzata per piani abbonamento e moduli
 * 
 * @module core/config/subscription-plans
 */

/**
 * Configurazione piani abbonamento
 * Struttura semplificata: Free (acquisizione) + Base (€5) + Moduli pay-per-use
 */
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
    badge: '💚'
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
    id: 'report',
    name: 'Report/Bilancio',
    icon: '📑',
    description: 'Report unificati e export avanzato',
    price: 5,
    available: false, // Da sviluppare
    category: 'utility',
    badge: 'Prossimamente'
  }
];

/**
 * Bundle strategici - Risparmio + Upsell moderato
 * I bundle devono far risparmiare sui moduli scelti e suggerire moduli aggiuntivi utili
 */
export const BUNDLES = [
  {
    id: 'operativo-vigneto',
    name: 'Operativo Vigneto',
    modules: ['manodopera', 'vigneto', 'parcoMacchine'],
    price: 10, // Manodopera (€6) + Vigneto (€3) + Parco Macchine (€3) = €12 → €10 (sconto €2)
    discount: 17,
    description: 'Perfetto per viticoltori: gestione squadre, vigneti e macchine',
    suggestedFor: ['manodopera', 'vigneto'], // Suggerito se utente ha questi moduli
    upsellModules: ['parcoMacchine'] // Modulo aggiuntivo suggerito
  },
  {
    id: 'operativo-completo',
    name: 'Operativo Completo',
    modules: ['manodopera', 'parcoMacchine', 'report'],
    price: 12, // Manodopera (€6) + Parco Macchine (€3) + Report (€5) = €14 → €12 (sconto €2)
    discount: 14,
    description: 'Gestione completa operazioni quotidiane con report',
    suggestedFor: ['manodopera', 'parcoMacchine'],
    upsellModules: ['report']
  },
  {
    id: 'colture-specializzate',
    name: 'Colture Specializzate',
    modules: ['vigneto', 'frutteto', 'oliveto'],
    price: 8, // Vigneto (€3) + Frutteto (€3) + Oliveto (€3) = €9 → €8 (sconto €1)
    discount: 11,
    description: 'Gestione completa tutte le colture specializzate',
    suggestedFor: ['vigneto', 'frutteto', 'oliveto'],
    upsellModules: [] // Tutti i moduli sono ugualmente importanti
  },
  {
    id: 'business-completo',
    name: 'Business Completo',
    modules: ['contoTerzi', 'report'],
    price: 9, // Conto Terzi (€6) + Report (€5) = €11 → €9 (sconto €2)
    discount: 18,
    description: 'Preventivi, clienti e report costi',
    suggestedFor: ['contoTerzi'],
    upsellModules: ['report']
  },
  {
    id: 'vigneto-completo',
    name: 'Vigneto Completo',
    modules: ['vigneto', 'manodopera'],
    price: 8, // Vigneto (€3) + Manodopera (€6) = €9 → €8 (sconto €1)
    discount: 11,
    description: 'Gestione vigneti e squadre vendemmia',
    suggestedFor: ['vigneto', 'manodopera'],
    upsellModules: []
  }
];

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
    return { canActivate: false, reason: 'Piano Free non include moduli. Upgrade al piano Base (€5/mese) per attivare moduli.' };
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

// Export default
export default {
  SUBSCRIPTION_PLANS,
  AVAILABLE_MODULES,
  BUNDLES,
  getPlanConfig,
  getAllPlans,
  getModuleConfig,
  getAllModules,
  calculateTotalPrice,
  canActivateModule,
  getSuggestedBundles
};
