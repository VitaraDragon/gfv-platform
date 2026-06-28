#!/usr/bin/env node
/**
 * Entry point GFV Farm Simulator.
 * @module simulator/orchestrator
 */

import { runSetupTenant } from './phases/01-setup-tenant.js';
import { runPopulateAssets } from './phases/02-populate-assets.js';
import { runSeedGuasti } from './phases/02b-seed-guasti.js';
import { runSimulateAttivita } from './phases/03-simulate-attivita.js';
import { runSimulateMagazzino } from './phases/04-simulate-magazzino.js';
import { runSimulateVigneto } from './phases/05-simulate-vigneto.js';
import { runSetupPersonas } from './phases/06-setup-personas.js';
import { runPopulateManodopera } from './phases/07-populate-manodopera.js';
import { runSimulateManodoperaOre } from './phases/08-simulate-manodopera-ore.js';
import { runPopulateContoTerzi } from './phases/09-populate-conto-terzi.js';
import { formatErrorReport, formatSuccessReport, printReport } from './lib/report.js';
import { isContoTerziTemplate, isManodoperaTemplate, parseQuantityOverrides } from './lib/load-template.js';
import { resetSimContext } from './lib/sim-context.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const setupOnly = args.includes('--setup-only');
const templateArg = args.find((a) => a.startsWith('--template='));
const templateId = templateArg ? templateArg.split('=')[1] : 'solo-titolare-viticola';
const templateOverrides = parseQuantityOverrides(args);

async function main() {
  resetSimContext();
  const started = Date.now();
  let phase = 'setup';

  try {
    if (verbose) console.log(`[sim] Template: ${templateId}`);

    phase = '01-setup-tenant';
    const setup = await runSetupTenant({ templateId, templateOverrides });
    const withManodopera = isManodoperaTemplate(setup.template);
    const withContoTerzi = isContoTerziTemplate(setup.template);
    if (verbose) console.log(`[sim] Tenant creato: ${setup.tenantId}`);

    if (setupOnly) {
      printReport(formatSuccessReport({
        ...setup,
        counts: { terreni: 0, trattori: 0, attrezzi: 0, vigneti: 0, prodotti: 0, attivita: 0 },
        durationMs: Date.now() - started
      }));
      process.exit(0);
    }

    phase = '02-populate-assets';
    const assets = await runPopulateAssets();
    if (verbose) console.log('[sim] Asset popolati:', assets.counts);

    phase = '02b-seed-guasti';
    const guastiSeed = await runSeedGuasti(assets);
    if (verbose && guastiSeed.counts.guasti) {
      console.log('[sim] Guasti seed:', guastiSeed.counts);
    }

    phase = '03-simulate-attivita';
    const simulation = await runSimulateAttivita(assets);
    if (verbose) console.log(`[sim] Attività create: ${simulation.counts.attivita}`);

    phase = '04-simulate-magazzino';
    const magazzino = await runSimulateMagazzino({ attivitaIds: simulation.attivitaIds });
    if (verbose) {
      console.log(`[sim] Movimenti magazzino: ${magazzino.counts.movimenti}, sotto scorta: ${magazzino.sottoScorta}`);
    }

    phase = '05-simulate-vigneto';
    const vigneto = await runSimulateVigneto({
      attivitaIds: simulation.attivitaIds,
      vigneti: assets.vigneti
    });
    if (verbose) {
      console.log(`[sim] Vigneto: ${vigneto.counts.potature} potature, ${vigneto.counts.trattamenti} trattamenti`);
    }

    let personas = null;
    let manodopera = null;
    let manodoperaOre = null;
    let contoTerzi = null;

    if (withContoTerzi) {
      phase = '09-populate-conto-terzi';
      contoTerzi = await runPopulateContoTerzi();
      if (verbose) console.log('[sim] Conto Terzi:', contoTerzi.counts);
    }

    if (withManodopera) {
      phase = '06-setup-personas';
      personas = await runSetupPersonas();
      if (verbose) console.log('[sim] Personas:', personas.counts);

      phase = '07-populate-manodopera';
      manodopera = await runPopulateManodopera(assets);
      if (verbose) console.log('[sim] Manodopera:', manodopera.counts);

      phase = '08-simulate-manodopera-ore';
      manodoperaOre = await runSimulateManodoperaOre(manodopera);
      if (verbose) console.log('[sim] Ore manodopera:', manodoperaOre.counts);
    }

    const counts = {
      ...assets.counts,
      guasti: guastiSeed.counts.guasti,
      guastiAperti: guastiSeed.counts.guastiAperti,
      attivita: simulation.counts.attivita,
      movimentiMagazzino: magazzino.counts.movimenti,
      prodottiSottoScorta: magazzino.sottoScorta,
      potatureVigneto: vigneto.counts.potature,
      trattamentiVigneto: vigneto.counts.trattamenti
    };

    if (personas) {
      counts.personas = personas.counts.totalPersonas;
      counts.caposquadra = personas.counts.caposquadra;
      counts.operai = personas.counts.operai;
    }
    if (manodopera) {
      counts.squadre = manodopera.counts.squadre;
      counts.lavoriSquadra = manodopera.counts.lavoriSquadra;
      counts.lavoriAutonomi = manodopera.counts.lavoriAutonomi;
    }
    if (manodoperaOre) {
      counts.oreSegnate = manodoperaOre.counts.oreSegnate;
      counts.oreValidate = manodoperaOre.counts.oreValidate;
      counts.oreDaValidare = manodoperaOre.counts.oreDaValidare;
      counts.comunicazioniInviate = manodoperaOre.counts.comunicazioniInviate;
      counts.comunicazioniConfermate = manodoperaOre.counts.comunicazioniConfermate;
      counts.assenzeMalattiaSegnalate = manodoperaOre.counts.assenzeMalattiaSegnalate;
      counts.assenzeMalattiaConfermate = manodoperaOre.counts.assenzeMalattiaConfermate;
      counts.lavoriStandbyAssenza = manodoperaOre.counts.lavoriStandbyAssenza;
    }
    if (contoTerzi) {
      counts.clienti = contoTerzi.counts.clienti;
      counts.poderiClienti = contoTerzi.counts.poderiClienti;
      counts.terreniClienti = contoTerzi.counts.terreniClienti;
      counts.tariffe = contoTerzi.counts.tariffe;
      counts.preventivi = contoTerzi.counts.preventivi;
      counts.preventiviInviati = contoTerzi.counts.preventiviInviati;
      counts.preventiviAccettati = contoTerzi.counts.preventiviAccettati;
      counts.terreni = (counts.terreni || 0) + contoTerzi.counts.terreniClienti;
    }

    printReport(formatSuccessReport({
      templateId: setup.templateId,
      runId: setup.runId,
      aziendaNome: setup.aziendaNome,
      tenantId: setup.tenantId,
      userId: setup.userId,
      email: setup.email,
      password: setup.password,
      counts,
      dateRange: simulation.dateRange,
      durationMs: Date.now() - started
    }));

    process.exit(0);
  } catch (error) {
    printReport(formatErrorReport(error, phase));
    process.exit(1);
  }
}

main();
