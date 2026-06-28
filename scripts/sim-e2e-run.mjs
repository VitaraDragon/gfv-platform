#!/usr/bin/env node
/**
 * GFV Farm Simulator v4 — runner E2E browser (playwright-core + expect @playwright/test).
 * Prerequisiti: sim:emulators + npm start + tenant in manifest (sim:run).
 * Locale: Chrome di sistema (channel). CI: Chromium bundled (`npm run sim:e2e:install`).
 */
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { expect } from '@playwright/test';
import {
  gotoAttivitaList,
  gotoClientiList,
  gotoConcimazioniList,
  gotoGestioneLavori,
  gotoMovimentiList,
  gotoPotaturaList,
  gotoPreventiviList,
  gotoProdottiList,
  gotoScadenzeList,
  gotoTariffeList,
  gotoTerreniClientiList,
  gotoTerreniList,
  gotoTrattamentiList,
  gotoTrattoriList,
  gotoAttrezziList,
  gotoContoTerziHome,
  gotoFlottaList,
  gotoGestioneOperai,
  gotoGestioneSquadre,
  gotoGuastiList,
  gotoLavoriCaposquadra,
  gotoMacchineDashboard,
  gotoMagazzinoHome,
  gotoManodoperaHome,
  gotoMappaClienti,
  gotoStatisticheManodopera,
  gotoTracciabilitaConsumi,
  gotoValidazioneOre,
  gotoVignetiList,
  gotoVignetoDashboard,
  loginAsCapoForLavoriDesktop,
  loginAsCapoFromDevPage,
  loginAsManagerContoTerzi,
  loginAsManagerFromDevPage,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from '../tests/e2e/sim/helpers/sim-login.js';
import { runAttivitaListAssertions } from '../tests/e2e/sim/scenarios/attivita-list.mjs';
import { runLavoriCaposquadraAssertions } from '../tests/e2e/sim/scenarios/capo-lavori.mjs';
import {
  runContoTerziHomeAssertions,
  runMappaClientiAssertions,
} from '../tests/e2e/sim/scenarios/conto-terzi-hub.mjs';
import {
  runClientiListAssertions,
  runPreventiviListAssertions,
  runTariffeListAssertions,
  runTerreniClientiAssertions,
} from '../tests/e2e/sim/scenarios/conto-terzi.mjs';
import {
  runCapoFieldWorkspaceAssertions,
  runOperaioFieldWorkspaceAssertions,
} from '../tests/e2e/sim/scenarios/field-workspace.mjs';
import {
  runGestioneLavoriAssertions,
  runValidazioneOreAssertions,
} from '../tests/e2e/sim/scenarios/manodopera-admin.mjs';
import { runMovimentiAssertions } from '../tests/e2e/sim/scenarios/movimenti.mjs';
import {
  runGuastiListAssertions,
  runMacchineDashboardAssertions,
} from '../tests/e2e/sim/scenarios/macchine-hub.mjs';
import {
  runMagazzinoHomeAssertions,
  runTracciabilitaConsumiAssertions,
} from '../tests/e2e/sim/scenarios/magazzino-hub.mjs';
import {
  runGestioneOperaiAssertions,
  runGestioneSquadreAssertions,
  runManodoperaHomeAssertions,
  runStatisticheManodoperaAssertions,
} from '../tests/e2e/sim/scenarios/manodopera-team.mjs';
import { runVignetoDashboardAssertions } from '../tests/e2e/sim/scenarios/vigneto-hub.mjs';
import {
  runAttrezziListAssertions,
  runFlottaListAssertions,
  runTrattoriListAssertions,
} from '../tests/e2e/sim/scenarios/parco-macchine.mjs';
import { runProdottiListAssertions } from '../tests/e2e/sim/scenarios/prodotti.mjs';
import { runDashboardDeadlinesAssertions } from '../tests/e2e/sim/scenarios/dashboard-deadlines.mjs';
import { runScadenzeListAssertions } from '../tests/e2e/sim/scenarios/scadenze-list.mjs';
import { runTerreniAffittiAssertions } from '../tests/e2e/sim/scenarios/terreni-affitti.mjs';
import { runVignetiListAssertions } from '../tests/e2e/sim/scenarios/vigneti.mjs';
import {
  runConcimazioniListAssertions,
  runPotaturaListAssertions,
  runTrattamentiListAssertions,
} from '../tests/e2e/sim/scenarios/vigneto.mjs';

const baseURL = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';

async function checkHttp(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(`${label} non raggiungibile (${url}): ${err.message}`);
  }
}

async function checkManifest() {
  let raw;
  try {
    raw = await readFile(new URL('../simulator/manifest.json', import.meta.url), 'utf8');
  } catch {
    throw new Error('simulator/manifest.json assente — esegui npm run sim:run');
  }
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('manifest vuoto — esegui npm run sim:run (con emulator attivo)');
  }
}

function launchOptions() {
  const headless = process.env.GFV_E2E_HEADED !== '1';
  const opts = { headless, timeout: 60_000 };
  if (!headless) {
    opts.slowMo = Number(process.env.GFV_E2E_SLOWMO) || 400;
  }
  if (process.env.GFV_E2E_BROWSER_CHANNEL) {
    opts.channel = process.env.GFV_E2E_BROWSER_CHANNEL;
  } else if (!process.env.CI) {
    opts.channel = 'chrome';
  }
  return opts;
}

const SCENARIOS = [
  {
    name: 'dashboard-deadlines',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await runDashboardDeadlinesAssertions(page, expect);
    },
  },
  {
    name: 'scadenze-list',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoScadenzeList(page);
      await runScadenzeListAssertions(page, expect);
    },
  },
  {
    name: 'terreni-affitti',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoTerreniList(page);
      await runTerreniAffittiAssertions(page, expect);
    },
  },
  {
    name: 'attivita-list',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoAttivitaList(page);
      await runAttivitaListAssertions(page, expect);
    },
  },
  {
    name: 'movimenti',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoMovimentiList(page);
      await runMovimentiAssertions(page, expect);
    },
  },
  {
    name: 'vigneto',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoPotaturaList(page);
      await runPotaturaListAssertions(page, expect);
      await gotoTrattamentiList(page);
      await runTrattamentiListAssertions(page, expect);
      await gotoConcimazioniList(page);
      await runConcimazioniListAssertions(page, expect);
    },
  },
  {
    name: 'conto-terzi',
    run: async (page) => {
      await loginAsManagerContoTerzi(page);
      await gotoClientiList(page);
      await runClientiListAssertions(page, expect);
      await gotoTariffeList(page);
      await runTariffeListAssertions(page, expect);
      await gotoPreventiviList(page);
      await runPreventiviListAssertions(page, expect);
      await gotoTerreniClientiList(page);
      await runTerreniClientiAssertions(page, expect);
    },
  },
  {
    name: 'field-workspace',
    run: async (page) => {
      await loginAsOperaioFromDevPage(page);
      await runOperaioFieldWorkspaceAssertions(page, expect);
      await loginAsCapoFromDevPage(page);
      await runCapoFieldWorkspaceAssertions(page, expect);
    },
  },
  {
    name: 'parco-macchine',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoTrattoriList(page);
      await runTrattoriListAssertions(page, expect);
      await gotoAttrezziList(page);
      await runAttrezziListAssertions(page, expect);
      await gotoFlottaList(page);
      await runFlottaListAssertions(page, expect);
    },
  },
  {
    name: 'prodotti',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoProdottiList(page);
      await runProdottiListAssertions(page, expect);
    },
  },
  {
    name: 'vigneti',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoVignetiList(page);
      await runVignetiListAssertions(page, expect);
    },
  },
  {
    name: 'manodopera-admin',
    run: async (page) => {
      await loginAsManagerManodopera(page);
      await gotoGestioneLavori(page);
      await runGestioneLavoriAssertions(page, expect);
      await gotoValidazioneOre(page);
      await runValidazioneOreAssertions(page, expect);
    },
  },
  {
    name: 'macchine-hub',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoMacchineDashboard(page);
      await runMacchineDashboardAssertions(page, expect);
      await gotoGuastiList(page);
      await runGuastiListAssertions(page, expect);
    },
  },
  {
    name: 'magazzino-hub',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoMagazzinoHome(page);
      await runMagazzinoHomeAssertions(page, expect);
      await gotoTracciabilitaConsumi(page);
      await runTracciabilitaConsumiAssertions(page, expect);
    },
  },
  {
    name: 'vigneto-hub',
    run: async (page) => {
      await loginAsManagerFromDevPage(page);
      await gotoVignetoDashboard(page);
      await runVignetoDashboardAssertions(page, expect);
    },
  },
  {
    name: 'conto-terzi-hub',
    run: async (page) => {
      await loginAsManagerContoTerzi(page);
      await gotoContoTerziHome(page);
      await runContoTerziHomeAssertions(page, expect);
      await gotoMappaClienti(page);
      await runMappaClientiAssertions(page, expect);
    },
  },
  {
    name: 'manodopera-team',
    run: async (page) => {
      await loginAsManagerManodopera(page);
      await gotoManodoperaHome(page);
      await runManodoperaHomeAssertions(page, expect);
      await gotoGestioneOperai(page);
      await runGestioneOperaiAssertions(page, expect);
      await gotoGestioneSquadre(page);
      await runGestioneSquadreAssertions(page, expect);
      await gotoStatisticheManodopera(page);
      await runStatisticheManodoperaAssertions(page, expect);
    },
  },
  {
    name: 'capo-lavori',
    run: async (page) => {
      await loginAsCapoForLavoriDesktop(page);
      await runLavoriCaposquadraAssertions(page, expect);
    },
  },
];

async function main() {
  console.log('[sim:e2e] prerequisiti…');
  await checkHttp(`${baseURL}/`, 'http-server (npm start)');
  await checkHttp('http://127.0.0.1:8080/', 'Firestore emulator (sim:emulators)');
  await checkManifest();

  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  let passed = 0;
  const failures = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`[sim:e2e] ${scenario.name} … `);
    try {
      await scenario.run(page);
      passed += 1;
      console.log('OK');
    } catch (err) {
      console.log('FAIL');
      failures.push({ name: scenario.name, error: err });
    }
  }

  await browser.close();

  if (failures.length) {
    console.error('\n[sim:e2e] Falliti:');
    for (const f of failures) {
      console.error(`  • ${f.name}: ${f.error.message || f.error}`);
    }
    process.exit(1);
  }

  console.log(`\n[sim:e2e] ${passed}/${SCENARIOS.length} scenari OK`);
}

main().catch((err) => {
  console.error('[sim:e2e] ERRORE:', err.message || err);
  process.exit(1);
});
