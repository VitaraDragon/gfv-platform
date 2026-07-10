/**
 * Cattura stato osservabile al momento di un fallimento scenario Tony E2E.
 * @module tests/e2e/tony/helpers/tony-e2e-failure-context
 */

import { readTonyScenarioPerf } from './tony-e2e-scenario-perf.mjs';
import {
  tonyGetExecutedCommands,
  tonyGetLastPerfMetrics,
  tonyGetLastReplyText,
} from './tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {object} scenario
 * @returns {Promise<object>}
 */
export async function captureTonyFailureContext(page, scenario) {
  const messages = Array.isArray(scenario.messages) ? scenario.messages : [];
  const lastMessage = messages.length ? messages[messages.length - 1] : '';

  let reply = '';
  let commands = [];
  let perf = null;
  let scenarioPerf = null;

  try {
    [reply, commands, perf, scenarioPerf] = await Promise.all([
      tonyGetLastReplyText(page),
      tonyGetExecutedCommands(page),
      tonyGetLastPerfMetrics(page),
      readTonyScenarioPerf(page),
    ]);
  } catch {
    /* pagina chiusa o widget assente */
  }

  const effective = scenarioPerf || perf;
  /** @type {object} */
  const observed = {
    message: lastMessage,
    reply: String(reply || '').slice(0, 600),
    commands: Array.isArray(commands) ? commands.slice() : [],
    url: page.url(),
  };

  if (effective && typeof effective === 'object') {
    observed.perf = {
      latencyMs: typeof effective.latencyMs === 'number' ? effective.latencyMs : null,
      usedGemini: typeof effective.usedGemini === 'boolean' ? effective.usedGemini : null,
      cfCalled: effective.cfCalled === true,
      localIntercept: effective.localIntercept === true,
    };
  }

  return observed;
}

/**
 * Estrae hint strutturati dal messaggio di errore Playwright/assert.
 * @param {Error|string} error
 * @returns {object}
 */
export function parseFailureError(error) {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();

  /** @type {object} */
  const hints = {
    raw: message.slice(0, 800),
    assertField: null,
    expected: null,
    received: null,
  };

  const fieldMatch = message.match(/campo inject (\S+)/i);
  if (fieldMatch) hints.assertField = fieldMatch[1];

  const expectMatch = message.match(/Expected:\s*(.+?)\s*Received:\s*(.+?)(?:\n|$)/s);
  if (expectMatch) {
    hints.expected = expectMatch[1].trim();
    hints.received = expectMatch[2].trim();
  }

  if (/timeout/i.test(message)) hints.assertField = hints.assertField || 'timeout';
  if (/discovery:/i.test(message)) hints.assertField = 'discovery';
  if (/manifest/i.test(message)) hints.assertField = 'manifest';
  if (/seed/i.test(message)) hints.assertField = hints.assertField || 'seed';
  if (/usedgemini|quickreply|cfCalled/i.test(message)) hints.assertField = 'intercept';
  if (/latency|latenza|ms\)/i.test(message)) hints.assertField = 'latency';
  if (/responsemustmatch|toContain/i.test(lower)) hints.assertField = hints.assertField || 'response_text';
  if (/inject|getelementbyid|locator/i.test(lower)) hints.assertField = hints.assertField || 'dom_inject';
  if (/commands/i.test(lower)) hints.assertField = hints.assertField || 'commands';
  if (/navigation|url/i.test(lower)) hints.assertField = hints.assertField || 'navigation';
  if (/tobvisible|row|save|lista/i.test(lower)) hints.assertField = hints.assertField || 'save_verify';

  return hints;
}
