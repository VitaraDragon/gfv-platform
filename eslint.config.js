/**
 * ESLint flat minimale: solo no-undef su app, script e test.
 * Non sostituisce tests/relative-imports-resolve.test.js (import risolvibili).
 * Esclusi: functions/, landing/, simulator/, docs, artifact di build.
 */
import globals from 'globals';

/**
 * Globali CDN / widget sicuri su tutta l'app.
 * NON includere db/auth/storage/firebaseConfig/currentTenant*:
 * un modulo ESM che li usa senza import deve fallire no-undef.
 * Handler onclick (closeAddModal, …) stanno in preesistentiPerFile per file.
 */
const browserAppGlobals = {
  ...globals.browser,
  firebase: 'readonly',
  google: 'readonly',
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
};

/**
 * Eccezioni per file: bug storici PREESISTENTI + handler assegnati a window
 * e richiamati a bare name (onclick / stesso file). Non globali su tutta l'app.
 */
const preesistentiPerFile = [
  {
    files: ['core/js/dashboard-data.js'],
    languageOptions: { globals: { caposquadraId: 'readonly' } }, // PREESISTENTE: usato senza dich.
  },
  {
    files: ['core/js/attivita-events.js'],
    languageOptions: { globals: { params: 'readonly' } }, // PREESISTENTE: params.db senza param
  },
  {
    files: ['core/services/tipi-lavoro-service.js'],
    languageOptions: { globals: { sottocategoria: 'readonly' } }, // PREESISTENTE
  },
  // Usati prima della dichiarazione nested nello stesso file; non refactor Tony qui.
  {
    files: ['core/js/tony/main.js'],
    languageOptions: {
      globals: {
        normalizeTonyPlanClient: 'readonly',
        cancelTonyEarlyTyping: 'readonly',
      },
    },
  },

  // Handler window.* (stesso modulo assegna window.fn e chiama fn())
  {
    files: ['modules/frutteto/js/frutteti-page.js'],
    languageOptions: {
      globals: {
        editFrutteto: 'writable',
        applyFilters: 'writable',
        closeAddModal: 'writable',
        closeFruttetoModal: 'writable',
        loadDettaglioSpese: 'writable',
      },
    },
  },
  {
    files: ['modules/frutteto/js/raccolta-page.js'],
    languageOptions: { globals: { aggiornaScartoCategorie: 'writable' } },
  },
  {
    files: ['modules/frutteto/js/potatura-page.js'],
    languageOptions: {
      globals: {
        caricaTerrenoSullaMappaPotaturaFrutteto: 'writable',
        chiudiMappaTracciamentoPotaturaFrutteto: 'writable',
      },
    },
  },
  {
    files: ['modules/frutteto/js/concimazioni-page.js'],
    languageOptions: { globals: { chiudiMappaTracciamentoTrattamento: 'writable' } },
  },
  {
    files: ['modules/vigneto/js/vigneti-page.js'],
    languageOptions: {
      globals: {
        closeAddModal: 'writable',
        editVigneto: 'writable',
        applyFilters: 'writable',
        closeModal: 'writable',
        loadDettaglioSpese: 'writable',
      },
    },
  },
  {
    files: ['modules/vigneto/js/vendemmia-page.js'],
    languageOptions: {
      globals: {
        applyFilters: 'writable',
        aggiungiRigaOperaio: 'writable',
        onVignetoChange: 'writable',
        calcolaResa: 'writable',
        aggiornaTotaleOreOperai: 'writable',
        closeModal: 'writable',
        chiudiMappaTracciamento: 'writable',
      },
    },
  },
  {
    files: ['modules/vigneto/js/potatura-page.js'],
    languageOptions: { globals: { chiudiMappaTracciamentoPotatura: 'writable' } },
  },
  {
    files: ['modules/vigneto/js/concimazioni-page.js'],
    languageOptions: { globals: { chiudiMappaTracciamentoTrattamento: 'writable' } },
  },
  {
    // Undef reale L824/L1046 (bare name, non window.*); fix fuori da questa PR.
    files: ['modules/vigneto/js/pianifica-impianto-page.js'],
    languageOptions: { globals: { angoloReticolato: 'readonly' } },
  },
  {
    files: ['shared/js/trattamenti-coltura-page.js'],
    languageOptions: { globals: { chiudiMappaTracciamentoTrattamento: 'writable' } },
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
