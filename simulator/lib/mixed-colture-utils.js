/**
 * Helper condivisi per template con vigneto + frutteto attivi insieme.
 * @module simulator/lib/mixed-colture-utils
 */

import { isTipoRaccolta, TIPI_POTATURA as TIPI_POTATURA_FR, TIPI_TRATTAMENTO as TIPI_TRATT_FR } from './frutteto-stub-from-trigger.js';
import {
  isTipoVendemmia,
  TIPI_POTATURA as TIPI_POTATURA_VIG,
  TIPI_TRATTAMENTO as TIPI_TRATT_VIG
} from './vigneto-stub-from-trigger.js';
import { raccoltaDayIndexFromTemplate } from '../phases/05-simulate-frutteto.js';
import { vendemmiaDayIndexFromTemplate } from '../phases/05-simulate-vigneto.js';
import { hasFruttetoModule, hasVignetoModule, isMistoColtureTemplate } from './load-template.js';

export const COLTURE_FRUTTETO = new Set([
  'melo',
  'pesco',
  'pero',
  'ciliegio',
  'albicocco',
  'susino',
  'kiwi'
]);

export function isColturaFrutteto(coltura) {
  return COLTURE_FRUTTETO.has(String(coltura || '').toLowerCase());
}

/**
 * @param {object} template
 * @returns {{ nVine: number, nFruit: number, total: number } | null}
 */
export function splitTerreniCountsFromTemplate(template) {
  if (!isMistoColtureTemplate(template)) return null;
  const q = template?.quantities || {};
  const total = q.terreni || 6;
  const nVine = q.terreniVigneto ?? Math.ceil(total / 2);
  const nFruit = q.terreniFrutteto ?? Math.max(0, total - nVine);
  return { nVine, nFruit, total: nVine + nFruit };
}

/**
 * Conteggi attesi attività diario ripartiti per coltura (ordine terreni: vite poi frutto).
 * @param {object} template
 */
export function expectedMixedColtureCountsFromTemplate(template) {
  const split = splitTerreniCountsFromTemplate(template);
  if (!split) return null;

  const tipi = template?.attivita?.tipiLavoro || [];
  const n = template?.quantities?.attivitaGiorniLavorativi || 20;
  const harvestIdx = vendemmiaDayIndexFromTemplate(template);

  const vigneto = { potature: 0, trattamenti: 0, vendemmie: 0 };
  const frutteto = { potature: 0, trattamenti: 0, raccolte: 0 };

  for (let i = 0; i < n; i++) {
    const terrenoIndex = i % split.total;
    const isFruitTerreno = terrenoIndex >= split.nVine;
    const tipoBase = tipi[i % Math.max(tipi.length, 1)];
    const tipo = i === harvestIdx
      ? (isFruitTerreno ? 'Raccolta' : 'Vendemmia Manuale')
      : tipoBase;

    if (isFruitTerreno) {
      if (isTipoRaccolta(tipo)) {
        frutteto.raccolte += 1;
        continue;
      }
      if (TIPI_POTATURA_FR.has(tipo)) frutteto.potature += 1;
      if (TIPI_TRATT_FR.has(tipo)) frutteto.trattamenti += 1;
    } else {
      if (isTipoVendemmia(tipo)) {
        vigneto.vendemmie += 1;
        continue;
      }
      if (TIPI_POTATURA_VIG.has(tipo)) vigneto.potature += 1;
      if (TIPI_TRATT_VIG.has(tipo)) vigneto.trattamenti += 1;
    }
  }

  return { vigneto, frutteto, harvestIdx };
}

/** @param {object} template */
export function harvestDayIndexForTemplate(template) {
  if (hasFruttetoModule(template) && !hasVignetoModule(template)) {
    return raccoltaDayIndexFromTemplate(template);
  }
  return vendemmiaDayIndexFromTemplate(template);
}
