/**
 * Esecuzione completa simulatore (setup + populate + attività + manodopera v2).
 * @module simulator/lib/run-simulation
 */

import { runSetupTenant } from '../phases/01-setup-tenant.js';
import { runPopulateAssets } from '../phases/02-populate-assets.js';
import { runSimulateAttivita } from '../phases/03-simulate-attivita.js';
import { runSimulateMagazzino } from '../phases/04-simulate-magazzino.js';
import { runSimulateVigneto } from '../phases/05-simulate-vigneto.js';
import { runSetupPersonas } from '../phases/06-setup-personas.js';
import { runPopulateManodopera } from '../phases/07-populate-manodopera.js';
import { runSimulateManodoperaOre } from '../phases/08-simulate-manodopera-ore.js';
import { runPopulateContoTerzi } from '../phases/09-populate-conto-terzi.js';
import { isContoTerziTemplate, isManodoperaTemplate } from './load-template.js';

/**
 * @param {{
 *   templateId?: string,
 *   seed?: number,
 *   setupOnly?: boolean,
 *   appendManifest?: boolean,
 *   templateOverrides?: object
 * }} [options]
 */
export async function runFullSimulation(options = {}) {
  const setup = await runSetupTenant({
    templateId: options.templateId || 'solo-titolare-viticola',
    seed: options.seed,
    appendManifest: options.appendManifest,
    templateOverrides: options.templateOverrides
  });

  if (options.setupOnly) {
    return { setup, assets: null, simulation: null };
  }

  const assets = await runPopulateAssets();
  const simulation = await runSimulateAttivita(assets);
  const magazzino = await runSimulateMagazzino({ attivitaIds: simulation.attivitaIds });
  const vigneto = await runSimulateVigneto({
    attivitaIds: simulation.attivitaIds,
    vigneti: assets.vigneti
  });

  let personas = null;
  let manodopera = null;
  let manodoperaOre = null;
  let contoTerzi = null;

  if (isContoTerziTemplate(setup.template)) {
    contoTerzi = await runPopulateContoTerzi();
  }

  if (isManodoperaTemplate(setup.template)) {
    personas = await runSetupPersonas();
    manodopera = await runPopulateManodopera(assets);
    manodoperaOre = await runSimulateManodoperaOre(manodopera);
  }

  return {
    setup,
    assets,
    simulation,
    magazzino,
    vigneto,
    contoTerzi,
    personas,
    manodopera,
    manodoperaOre
  };
}
