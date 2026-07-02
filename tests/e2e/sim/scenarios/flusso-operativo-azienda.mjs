/**
 * E2E percorso operativo end-to-end — stessa sessione tenant CI.
 * Diario → vigneto catene A+B → manodopera campo → conto terzi (read).
 * @module tests/e2e/sim/scenarios/flusso-operativo-azienda
 */

import {
  gotoAttivitaList,
  gotoMovimentiList,
  gotoPreventiviList,
  loginAsCapoFromDevPage,
  loginAsManagerContoTerzi,
  loginAsManagerFromDevPage,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';
import { runAttivitaListAssertions } from './attivita-list.mjs';
import { runDashboardDeadlinesAssertions } from './dashboard-deadlines.mjs';
import { runMovimentiAssertions } from './movimenti.mjs';
import { runPotaturaCompletaWriteAssertions } from './potatura-completa-write.mjs';
import { runTrattamentoCompletaWriteAssertions } from './trattamento-completa-write.mjs';
import { runVendemmiaCompletaWriteAssertions } from './vendemmia-completa-write.mjs';
import { runCapoFieldWorkspaceAssertions, runOperaioFieldWorkspaceAssertions } from './field-workspace.mjs';
import { runPreventiviListAssertions } from './conto-terzi.mjs';

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runFlussoOperativoAziendaAssertions(page, expect) {
  expect.configure({ timeout: 120_000 });

  // 1 — Manager: cuore viticola (diario + magazzino seed catena B)
  await loginAsManagerFromDevPage(page);
  await runDashboardDeadlinesAssertions(page, expect);
  await gotoAttivitaList(page);
  await runAttivitaListAssertions(page, expect);
  await gotoMovimentiList(page);
  await runMovimentiAssertions(page, expect);

  // 2 — Catene vigneto: stub → completa → effetti (trattamento + scarico magazzino)
  await runTrattamentoCompletaWriteAssertions(page, expect);
  await runVendemmiaCompletaWriteAssertions(page, expect);
  await runPotaturaCompletaWriteAssertions(page, expect);

  // 3 — Manodopera: operaio + capo in campo
  await loginAsOperaioFromDevPage(page);
  await runOperaioFieldWorkspaceAssertions(page, expect);
  await loginAsCapoFromDevPage(page);
  await runCapoFieldWorkspaceAssertions(page, expect);

  // 4 — Conto terzi: preventivi seed navigabili
  await loginAsManagerContoTerzi(page);
  await gotoPreventiviList(page);
  await runPreventiviListAssertions(page, expect);
}
