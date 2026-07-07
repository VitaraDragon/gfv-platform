#!/usr/bin/env node
import { chromium } from 'playwright-core';
import matrix from '../tests/e2e/tony/fixtures/scenarios-matrix.json' with { type: 'json' };
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
  waitForTonySimTenantData,
} from '../tests/e2e/tony/helpers/tony-sim-context.js';
import {
  tonySendMessage,
  tonyWaitForReply,
  waitForTonyReady,
  waitForTonyTurnPerf,
} from '../tests/e2e/tony/helpers/tony-widget.js';
import { captureTonyScenarioPerf } from '../tests/e2e/tony/helpers/tony-e2e-scenario-perf.mjs';

const scenario = matrix.scenarios.find((s) => s.id === 'T-PERF-004');
const groups = scenario.expect.responseMustMatchGroups;
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
await runTonySimLogin(page, scenario.login);
await captureTonyTenantSnapshot(page);
await gotoTonyE2ePage(page, scenario.startUrl);
await page.evaluate(() => {
  window.tonyDashboardBriefingFired = true;
  window.tonyMeteoBriefingFired = true;
});
await bootstrapTonyWidgetOnStandalonePage(page);
await waitForTonyReady(page);
await waitForTonySimTenantData(page);
const msg = scenario.messages[0];
const before = await tonySendMessage(page, msg);
await tonyWaitForReply(page, { tonyCountBefore: before, timeoutMs: 60000 });
const perf = await waitForTonyTurnPerf(page, { timeoutMs: 60000 });
await captureTonyScenarioPerf(page, perf);
const snap = await page.evaluate(() => ({
  merged: Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony'))
    .slice(-4)
    .map((n) => (n.textContent || '').trim())
    .join('\n---\n'),
  perf: window.__tonyE2eScenarioPerf || window.__tonyLastPerf,
}));
const low = snap.merged.toLowerCase();
console.log('REPLY:\n', snap.merged);
console.log('PERF:', snap.perf);
for (let i = 0; i < groups.length; i += 1) {
  const hit = groups[i].find((f) => low.includes(String(f).toLowerCase()));
  console.log(`group ${i + 1}:`, hit ? `OK (${hit})` : 'MISS', groups[i].slice(0, 8).join('|'));
}
await browser.close();
