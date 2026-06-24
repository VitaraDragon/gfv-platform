#!/usr/bin/env node
/**
 * Entry point GFV Farm Simulator.
 * @module simulator/orchestrator
 */

import { runSetupTenant } from './phases/01-setup-tenant.js';
import { runPopulateAssets } from './phases/02-populate-assets.js';
import { runSimulateAttivita } from './phases/03-simulate-attivita.js';
import { runSimulateMagazzino } from './phases/04-simulate-magazzino.js';
import { formatErrorReport, formatSuccessReport, printReport } from './lib/report.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const setupOnly = args.includes('--setup-only');
const templateArg = args.find((a) => a.startsWith('--template='));
const templateId = templateArg ? templateArg.split('=')[1] : 'solo-titolare-viticola';

async function main() {
  const started = Date.now();
  let phase = 'setup';

  try {
    if (verbose) console.log(`[sim] Template: ${templateId}`);

    phase = '01-setup-tenant';
    const setup = await runSetupTenant({ templateId });
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

    phase = '03-simulate-attivita';
    const simulation = await runSimulateAttivita(assets);
    if (verbose) console.log(`[sim] Attività create: ${simulation.counts.attivita}`);

    phase = '04-simulate-magazzino';
    const magazzino = await runSimulateMagazzino({ attivitaIds: simulation.attivitaIds });
    if (verbose) console.log(`[sim] Movimenti magazzino: ${magazzino.counts.movimenti}, sotto scorta: ${magazzino.sottoScorta}`);

    printReport(formatSuccessReport({
      templateId: setup.templateId,
      runId: setup.runId,
      aziendaNome: setup.aziendaNome,
      tenantId: setup.tenantId,
      userId: setup.userId,
      email: setup.email,
      password: setup.password,
      counts: {
        ...assets.counts,
        attivita: simulation.counts.attivita,
        movimentiMagazzino: magazzino.counts.movimenti,
        prodottiSottoScorta: magazzino.sottoScorta
      },
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
