/**
 * Esecuzione completa simulatore (setup + populate + attività).
 * @module simulator/lib/run-simulation
 */

import { runSetupTenant } from '../phases/01-setup-tenant.js';
import { runPopulateAssets } from '../phases/02-populate-assets.js';
import { runSimulateAttivita } from '../phases/03-simulate-attivita.js';
import { runSimulateMagazzino } from '../phases/04-simulate-magazzino.js';

/**
 * @param {{ templateId?: string, seed?: number, setupOnly?: boolean, appendManifest?: boolean }} [options]
 */
export async function runFullSimulation(options = {}) {
  const setup = await runSetupTenant({
    templateId: options.templateId || 'solo-titolare-viticola',
    seed: options.seed,
    appendManifest: options.appendManifest
  });

  if (options.setupOnly) {
    return { setup, assets: null, simulation: null };
  }

  const assets = await runPopulateAssets();
  const simulation = await runSimulateAttivita(assets);
  const magazzino = await runSimulateMagazzino({ attivitaIds: simulation.attivitaIds });

  return { setup, assets, simulation, magazzino };
}
