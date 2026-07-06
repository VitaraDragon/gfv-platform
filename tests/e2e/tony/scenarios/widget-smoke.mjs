/**
 * M-T1 smoke — login manager, dashboard, widget Tony visibile + Tony Avanzato attivo.
 * @module tests/e2e/tony/scenarios/widget-smoke
 */

import {
  assertTonySimTenantReady,
  gotoTonyE2ePage,
  runTonySimLogin,
  waitForTonySimTenantData,
} from '../helpers/tony-sim-context.js';
import { isTonyAdvancedActive, openTonyPanel, waitForTonyReady } from '../helpers/tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} [_scenario]
 */
export async function runWidgetSmokeAssertions(page, expect, _scenario = {}) {
  await runTonySimLogin(page, 'loginAsManagerFromDevPage');
  await gotoTonyE2ePage(page, '/core/dashboard-standalone.html');
  await waitForTonySimTenantData(page);
  await assertTonySimTenantReady(page, expect);
  await waitForTonyReady(page);
  await expect(page.locator('#tony-fab')).toBeVisible();
  await openTonyPanel(page);
  await expect(page.locator('#tony-input')).toBeVisible();
  await expect(page.locator('#tony-send')).toBeVisible();
  const advanced = await isTonyAdvancedActive(page);
  expect(advanced).toBe(true);
}
