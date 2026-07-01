/**
 * E2E read — KPI numerici dashboard parco macchine (§11.3 scen. 47).
 * @module tests/e2e/sim/scenarios/macchine-dashboard-read
 */

import { gotoMacchineDashboard, loginAsManagerFromDevPage } from '../helpers/sim-login.js';
import { runMacchineDashboardAssertions } from './macchine-hub.mjs';

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMacchineDashboardReadAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await loginAsManagerFromDevPage(page);
  await gotoMacchineDashboard(page);
  await runMacchineDashboardAssertions(page, expect);
}
