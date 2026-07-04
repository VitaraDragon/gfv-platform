/**
 * Esecuzione completa simulatore (setup + populate + attività + manodopera v2).
 * @module simulator/lib/run-simulation
 */

import { runSetupTenant } from '../phases/01-setup-tenant.js';
import { runPopulateAssets } from '../phases/02-populate-assets.js';
import { runSeedGuasti } from '../phases/02b-seed-guasti.js';
import { runSimulateAttivita } from '../phases/03-simulate-attivita.js';
import { runSimulateMagazzino } from '../phases/04-simulate-magazzino.js';
import { runSimulateVigneto } from '../phases/05-simulate-vigneto.js';
import { runSimulateFrutteto } from '../phases/05-simulate-frutteto.js';
import { runSetupPersonas } from '../phases/06-setup-personas.js';
import { runPopulateManodopera } from '../phases/07-populate-manodopera.js';
import { runSimulateManodoperaOre } from '../phases/08-simulate-manodopera-ore.js';
import { runPopulateContoTerzi } from '../phases/09-populate-conto-terzi.js';
import { isContoTerziTemplate, isManodoperaTemplate, hasFruttetoModule, hasVignetoModule } from './load-template.js';

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
  const guastiSeed = await runSeedGuasti(assets);
  const simulation = await runSimulateAttivita(assets);
  const withVigneto = hasVignetoModule(setup.template);
  const withFrutteto = hasFruttetoModule(setup.template);

  let vigneto = null;
  let frutteto = null;
  if (withVigneto) {
    vigneto = await runSimulateVigneto({
      attivitaIds: simulation.attivitaIds,
      vigneti: assets.vigneti
    });
  }
  if (withFrutteto) {
    frutteto = await runSimulateFrutteto({
      attivitaIds: simulation.attivitaIds,
      frutteti: assets.frutteti
    });
  }

  const colturaSim = frutteto || vigneto;

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

  const magazzino = await runSimulateMagazzino();

  return {
    setup,
    assets,
    guastiSeed,
    simulation,
    magazzino,
    vigneto,
    frutteto,
    colturaSim,
    contoTerzi,
    personas,
    manodopera,
    manodoperaOre
  };
}
