#!/usr/bin/env node
import { chromium } from 'playwright-core';
import { expect } from '@playwright/test';
import { loginAsManagerManodopera } from '../tests/e2e/sim/helpers/sim-login.js';
import { runFlowLavoro013 } from '../tests/e2e/tony/scenarios/flow-lavoro-013.mjs';

const baseURL = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
try {
  await loginAsManagerManodopera(page);
  await runFlowLavoro013(page, expect, {
    login: 'loginAsManagerManodopera',
    expect: { cfCallsMax: 0, usedGemini: false },
  });
  console.log('FULL FLOW OK');
} catch (err) {
  const snap = await page.evaluate(() => ({
    lastTony: Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony, #tony-messages .tony-msg.error'))
      .slice(-3)
      .map((n) => n.textContent.trim()),
    nome: document.getElementById('lavoro-nome')?.value,
    note: document.getElementById('lavoro-note')?.value,
    terreno: document.getElementById('lavoro-terreno')?.value,
    tipo: document.getElementById('lavoro-tipo-lavoro')?.value,
    trattore: document.getElementById('lavoro-trattore')?.value,
    attrezzo: document.getElementById('lavoro-attrezzo')?.value,
    operaio: document.getElementById('lavoro-operaio')?.value,
    data: document.getElementById('lavoro-data-inizio')?.value,
    durata: document.getElementById('lavoro-durata')?.value,
  }));
  console.error('snap', JSON.stringify(snap, null, 2));
  console.error('FAIL', err.message);
  process.exit(1);
} finally {
  await browser.close();
}
