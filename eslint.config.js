/**
 * ESLint flat minimale: solo no-undef su app, script e test.
 * Non sostituisce tests/relative-imports-resolve.test.js (import risolvibili).
 * Esclusi: functions/, landing/, simulator/, docs, artifact di build.
 */
import globals from 'globals';

/** Globali CDN / assegnati su window e usati a bare name nel codice browser. */
const browserAppGlobals = {
  ...globals.browser,
  firebase: 'readonly',
  firebaseConfig: 'readonly',
  db: 'readonly',
  auth: 'readonly',
  storage: 'readonly',
  google: 'readonly',
  currentTenantId: 'writable',
  currentUser: 'writable',
  currentUserData: 'writable',
  Tony: 'readonly',
  Chart: 'readonly',
  // Mapping / filler / tour (script tag o file che assegnano su window)
  TONY_FORM_MAPPING: 'readonly',
  SmartFormFiller: 'readonly',
  TonyFormInjector: 'readonly',
  GFVDashboardSections: 'readonly',
  introJs: 'readonly',
  // Fallback Node-ish in browser (document-archive / document-capture)
  Buffer: 'readonly',
  // Handler HTML/onclick: spesso `window.fn = …` e chiamata bare `fn()`
  closeAddModal: 'writable',
  closeModal: 'writable',
  closeFruttetoModal: 'writable',
  applyFilters: 'writable',
  editFrutteto: 'writable',
  editVigneto: 'writable',
  loadDettaglioSpese: 'writable',
  aggiungiRigaOperaio: 'writable',
  calcolaResa: 'writable',
  aggiornaTotaleOreOperai: 'writable',
  aggiornaScartoCategorie: 'writable',
  onVignetoChange: 'writable',
  angoloReticolato: 'writable',
  chiudiMappaTracciamento: 'writable',
  chiudiMappaTracciamentoPotatura: 'writable',
  chiudiMappaTracciamentoPotaturaFrutteto: 'writable',
  chiudiMappaTracciamentoTrattamento: 'writable',
  caricaTerrenoSullaMappaPotaturaFrutteto: 'writable',
  loadProdotti: 'writable',
  loadMovimenti: 'writable',
  renderMovimenti: 'writable',
};

/**
 * Identificatori già noti come bug/storici (whitelist mirror di
 * tests/moduli-identificatori-definiti.test.js PREESISTENTI).
 * Non mascherati in silenzio: restano documentati qui finché non c’è fix dedicato.
 */
const preesistentiPerFile = [
  {
    files: ['core/js/dashboard-data.js'],
    languageOptions: { globals: { caposquadraId: 'readonly' } },
  },
  {
    files: ['core/js/attivita-events.js'],
    languageOptions: { globals: { params: 'readonly' } },
  },
  {
    files: ['core/services/tipi-lavoro-service.js'],
    languageOptions: { globals: { sottocategoria: 'readonly' } },
  },
  // Usati prima della dichiarazione nested nello stesso file (scope runtime ok
  // o debito da chiarire); non refactor Tony in questa PR.
  {
    files: ['core/js/tony/main.js'],
    languageOptions: {
      globals: {
        normalizeTonyPlanClient: 'readonly',
        cancelTonyEarlyTyping: 'readonly',
      },
    },
  },
];

export default [
  {
    ignores: [
      'functions/**',
      'landing/**',
      'simulator/**',
      'node_modules/**',
      'test-results/**',
      'docs-sviluppo/**',
      'dist-app/**',
      'landing/dist/**',
      'GUIDA/**',
      'core/GUIDA/**',
    ],
  },

  // App browser (ESM)
  {
    files: ['core/**/*.js', 'modules/**/*.js', 'shared/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserAppGlobals,
    },
    rules: {
      'no-undef': 'error',
    },
  },

  ...preesistentiPerFile,

  // Service worker (script classici + importScripts)
  {
    files: ['service-worker.js', 'sw-strategy.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.serviceworker,
        importScripts: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },

  // Script Node (canary/e2e spesso iniettano callback browser in page.evaluate)
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  // Test + vitest config (jsdom / page.evaluate → anche browser)
  {
    files: ['tests/**/*.{js,mjs,cjs}', 'vitest.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.vitest,
        ...globals.browser,
        google: 'readonly',
        loadProdotti: 'writable',
        loadMovimenti: 'writable',
        renderMovimenti: 'writable',
        applyFilters: 'writable',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
];
