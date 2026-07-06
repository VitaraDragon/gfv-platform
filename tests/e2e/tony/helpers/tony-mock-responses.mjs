/**
 * Risposte mock CF per scenari Tony E2E tier 2 (Node — allineate a functions/* quick reply).
 * @module tests/e2e/tony/helpers/tony-mock-responses
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { tryTonyNavQuickReply } = require('../../../../functions/tony-nav-quick-reply.js');

const MODULI_CTX = {
  moduli_attivi: ['tony', 'contoTerzi', 'magazzino', 'manodopera', 'meteo', 'vigneto'],
  dashboard: {
    moduli_attivi: ['tony', 'contoTerzi', 'magazzino', 'manodopera', 'meteo', 'vigneto'],
  },
};

/** @param {object|null|undefined} command */
function toMockCommand(command) {
  if (!command || !command.type) return null;
  return {
    type: String(command.type),
    target: command.target || command.params?.target || null,
    formId: command.formId || null,
    formData: command.formData || null,
    params: command.params || null,
  };
}

/**
 * Payload serializzabile per il resolver lato browser (page.evaluate).
 * @param {object} scenario — voce matrice
 * @returns {object}
 */
export function buildMockCfBundle(scenario) {
  const id = scenario.id;
  const bundle = { scenarioId: id, staticResponses: {} };

  if (id === 'T-PERF-001') {
    const hit = tryTonyNavQuickReply({ message: 'portami alle tariffe', ctx: MODULI_CTX });
    if (hit) {
      bundle.staticResponses['portami alle tariffe'] = {
        text: hit.text,
        command: toMockCommand(hit.command),
      };
    }
    return bundle;
  }

  if (id === 'T-DENY-001') {
    bundle.staticResponses['apri gestione utenti'] = {
      text: 'Ti porto alla gestione utenti.',
      command: { type: 'APRI_PAGINA', target: 'utenti', params: { target: 'utenti' } },
    };
    return bundle;
  }

  if (id === 'T-CONCEPT-001') {
    bundle.staticResponses['registra trattamento sul terreno XYZ999'] = {
      text: 'Non trovo il terreno XYZ999 nel tuo elenco. Verifica il nome o crea prima il terreno.',
      command: null,
    };
    return bundle;
  }

  if (id === 'T-INJECT-001') {
    bundle.staticResponses['crea lavoro potatura vigneto nord domani'] = {
      text: 'Ho impostato il lavoro nel form. Controlla i dati e salva quando sei pronto.',
      command: {
        type: 'INJECT_FORM_DATA',
        formId: 'lavoro-form',
        formData: {
          'lavoro-terreno': 'Vigneto Nord',
          'lavoro-tipo-lavoro': 'Potatura',
          'lavoro-data-inizio': '2026-07-06',
        },
      },
    };
    return bundle;
  }

  if (id === 'T-PERF-002') {
    bundle.dynamic = 'riassunto_tabella';
    return bundle;
  }

  return bundle;
}
