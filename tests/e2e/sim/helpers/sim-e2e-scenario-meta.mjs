/**
 * Inferisce metadati scenario E2E app da nome file spec.
 * @module tests/e2e/sim/helpers/sim-e2e-scenario-meta
 */

/** @type {Record<string, Partial<object>>} */
const OVERRIDES = {
  'mista-azienda-read': {
    mode: 'gate',
    requiresSeedProfile: 'mista-viticola-frutteto-conto-terzi-manodopera',
    contract: {
      invariant: 'Tenant mista → vigneti + frutteti + CT visibili sullo stesso seed',
      primaryAsserts: ['liste non vuote', 'moduli attivi'],
      avoidAsserts: ['conteggi righe fissi'],
    },
  },
  'flusso-operativo-azienda': {
    mode: 'gate',
    category: 'integration',
    contract: {
      invariant: 'Percorso cross-modulo diario → vigneto → manodopera → CT senza errori',
      primaryAsserts: ['pagine raggiungibili', 'form compilabili'],
      avoidAsserts: ['ordine click hardcoded senza wait semantico'],
    },
  },
  'lavori-caposquadra-write': {
    requiresSeedProfile: 'viticola-conto-terzi-manodopera',
    contract: {
      invariant: 'Caposquadra sospende/riprende lavoro da seed manodopera',
      primaryAsserts: ['lavoro sospendibile presente', 'stato aggiornato in UI'],
      avoidAsserts: ['id lavoro hardcoded'],
    },
  },
  'movimenti-uscita-write': {
    contract: {
      invariant: 'Prodotto con giacenza sufficiente → uscita magazzino → riga movimento',
      primaryAsserts: ['prodotto seed con giacenza', 'riga in lista'],
      avoidAsserts: ['nome prodotto fisso senza discovery'],
    },
  },
  'raccolta-completa-write': {
    requiresSeedProfile: 'frutteto-solo-titolare',
  },
  'potatura-frutteto-completa-write': {
    requiresSeedProfile: 'frutteto-solo-titolare',
  },
  'trattamento-frutteto-completa-write': {
    requiresSeedProfile: 'frutteto-solo-titolare',
  },
  'concimazione-frutteto-completa-write': {
    requiresSeedProfile: 'frutteto-solo-titolare',
  },
};

/**
 * @param {string} id
 * @returns {string}
 */
function inferCategory(id) {
  if (/flusso-operativo|mista-azienda/.test(id)) return 'integration';
  if (/-write$|write-/.test(id) || id.includes('-write')) return 'write';
  if (/-read$|read-/.test(id) || id.includes('-read')) return 'read';
  if (id.includes('hub') || id.includes('dashboard')) return 'hub';
  return 'read';
}

/**
 * @param {string} id
 * @param {string} category
 * @returns {string}
 */
function inferInvariant(id, category) {
  if (category === 'write') {
    return `Form write ${id} → save → evidenza in lista o toast successo`;
  }
  if (category === 'integration') {
    return `Flusso integrato ${id} → pagine e dati coerenti cross-modulo`;
  }
  if (category === 'hub') {
    return `Hub ${id} → navigazione e widget/moduli visibili`;
  }
  return `Lista/pagina ${id} → contenuto render da seed sim (non errore auth/empty crash)`;
}

/**
 * @param {string} category
 * @returns {string[]}
 */
function inferPrimaryAsserts(category) {
  if (category === 'write') return ['riga in tabella o redirect post-save', 'nessun toast errore'];
  if (category === 'integration') return ['URL attesi', 'assenza errori console critici'];
  return ['h1/titolo visibile', 'tabella o empty state coerente'];
}

/**
 * @param {string} id
 * @returns {string}
 */
function inferSeedProfile(id) {
  if (/frutteto|raccolta-frutta|frutteti/.test(id)) return 'frutteto-solo-titolare';
  if (/mista-azienda/.test(id)) return 'mista-viticola-frutteto-conto-terzi-manodopera';
  if (/conto-terzi|preventivi|tariffe|clienti|terreni-clienti/.test(id)) {
    return 'viticola-conto-terzi-manodopera';
  }
  return 'viticola-conto-terzi-manodopera';
}

/**
 * @param {string} specBasename es. `trattori-write.spec.js`
 * @returns {object}
 */
export function buildScenarioMetaFromSpec(specBasename) {
  const id = specBasename.replace(/\.spec\.js$/i, '');
  const category = inferCategory(id);
  const base = {
    id,
    specFile: `tests/e2e/sim/${specBasename}`,
    mode: 'gate',
    status: 'ready',
    category,
    requiresSeedProfile: inferSeedProfile(id),
    contract: {
      invariant: inferInvariant(id, category),
      primaryAsserts: inferPrimaryAsserts(category),
      avoidAsserts: ['snapshot testo cella esatto', 'timeout aumentato senza fix root cause'],
    },
  };
  const override = OVERRIDES[id];
  if (!override) return base;
  return {
    ...base,
    ...override,
    contract: { ...base.contract, ...(override.contract || {}) },
  };
}

/**
 * @param {string[]} specBasenames
 * @returns {object[]}
 */
export function buildRegistryFromSpecs(specBasenames) {
  return specBasenames
    .filter((f) => f.endsWith('.spec.js'))
    .sort()
    .map(buildScenarioMetaFromSpec);
}

/**
 * @param {object} scenario
 * @returns {'gate'|'explore'}
 */
export function resolveAppScenarioMode(scenario) {
  if (scenario.mode === 'gate' || scenario.mode === 'explore') return scenario.mode;
  return 'gate';
}
