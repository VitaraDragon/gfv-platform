#!/usr/bin/env node
import { chromium } from 'playwright-core';
import { expect } from '@playwright/test';
import matrix from '../tests/e2e/tony/fixtures/scenarios-matrix.json' with { type: 'json' };
import { loadPreventivoFlowPlan } from '../tests/e2e/tony/helpers/tony-preventivo-flow-discover.js';
import { runPreventivoCfDialog } from '../tests/e2e/tony/helpers/tony-preventivo-live.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../tests/e2e/tony/helpers/tony-sim-context.js';
import { waitForTonyReady } from '../tests/e2e/tony/helpers/tony-widget.js';

const scenario = matrix.scenarios.find((s) => s.id === 'T-FLOW-014-LIVE');
const baseURL = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ baseURL });
await context.addInitScript(() => {
  window.__GFV_TONY_E2E_LIVE = true;
  const projectId =
    (window.firebaseConfig && window.firebaseConfig.projectId) || 'gfv-platform';
  window.__gfvTonyCfEmulatorBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
});
const page = await context.newPage();
try {
  await runTonySimLogin(page, scenario.login);
  await captureTonyTenantSnapshot(page);
  const { ctx, messages } = await loadPreventivoFlowPlan(page);
  console.log('messages', messages);
  await gotoTonyE2ePage(page, scenario.startUrl);
  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });
  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
  const cfTurn = await runPreventivoCfDialog(page, messages, {
    replyTimeoutMs: scenario.expect?.replyTimeoutMs ?? 90_000,
    ctx,
  });
  console.log('perfTurns', JSON.stringify(cfTurn.perfTurns, null, 2));
  const snap = await page.evaluate(() => ({
    cliente: document.getElementById('cliente-id')?.value,
    terreno: document.getElementById('terreno-id')?.value,
    dataPrev: document.getElementById('data-prevista')?.value,
    lastTony: Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony'))
      .slice(-8)
      .map((n) => n.textContent.trim()),
  }));
  console.log('form', JSON.stringify(snap, null, 2));
} catch (err) {
  const snap = await page.evaluate(() => ({
    lastPerf: window.__tonyLastPerf,
    lastTony: Array.from(
      document.querySelectorAll('#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error')
    )
      .slice(-8)
      .map((n) => n.textContent.trim()),
    cliente: document.getElementById('cliente-id')?.value,
    terreno: document.getElementById('terreno-id')?.value,
  }));
  console.error('snap', JSON.stringify(snap, null, 2));
  console.error('FAIL', err.message);
  process.exit(1);
} finally {
  await browser.close();
}
