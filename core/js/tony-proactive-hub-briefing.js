/**
 * Briefing proattivo all’ingresso hub modulo (§15.6).
 * Stesse fasce/delta della dashboard (§15.5); storage per hub; niente idle.
 * @module core/js/tony-proactive-hub-briefing
 */

import {
  getProactiveHub,
  proactiveHubStorageKey,
  buildRawProactiveCounts,
  collectProactiveSignals,
  formatProactiveOpsAttentionSnippet,
  formatProactiveOpenFollowUpOffer,
  pickProactiveOpenFollowUp,
  pickProactiveOpenFollowUpFromDelta,
  createProactiveOpenOffer,
  getProactiveSignalIdsForHub,
} from '../config/tony-proactive-signals.js';
import {
  decideProactiveBriefingAction,
  formatProactiveDeltaMessage,
  loadProactiveBriefingState,
  saveProactiveBriefingState,
} from './tony-proactive-briefing-policy.js';

function hasTonyAdvanced(modules) {
  const mods = Array.isArray(modules) ? modules : [];
  return mods.some(function (m) {
    return String(m).toLowerCase() === 'tony';
  });
}

function isManagerOrAdmin(roles) {
  const r = Array.isArray(roles) ? roles : [];
  return r.some(function (x) {
    const s = String(x || '').toLowerCase();
    return s === 'manager' || s === 'amministratore' || s.indexOf('manager') >= 0 || s.indexOf('amministratore') >= 0;
  });
}

/**
 * @param {string} text
 * @param {boolean} speak
 * @param {object|null} openOffer
 */
function deliverHubBriefing(text, speak, openOffer) {
  const msg = String(text || '').trim();
  if (!msg) return;
  if (openOffer) {
    try {
      window.__tonyProactiveOpenOffer = openOffer;
    } catch (_) { /* ignore */ }
  }
  var attempts = 0;
  function tryDeliver() {
    if (typeof window.__tonyDisplayProactive === 'function') {
      window.__tonyDisplayProactive(msg, {
        speak: !!speak,
        openPanel: !!speak || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
        dashboardBriefing: true,
        proactiveOpenOffer: openOffer || undefined,
      });
      return;
    }
    attempts += 1;
    if (attempts < 40) {
      setTimeout(tryDeliver, 250);
    }
  }
  tryDeliver();
}

/**
 * Esegue briefing hub se policy lo consente.
 * @param {{
 *   hubId: string,
 *   tenantId: string,
 *   roles?: string[],
 *   availableModules?: string[],
 *   counts?: object,
 *   speak?: boolean,
 *   delayMs?: number,
 *   now?: Date,
 *   storage?: Storage|null
 * }} opts
 * @returns {{ action: string, text: string }|null}
 */
export function runTonyProactiveHubBriefing(opts) {
  opts = opts || {};
  const hubId = String(opts.hubId || '').trim();
  const tenantId = String(opts.tenantId || '').trim();
  const hub = getProactiveHub(hubId);
  if (!hub || !tenantId) return null;

  const modules = Array.isArray(opts.availableModules) ? opts.availableModules : [];
  const roles = Array.isArray(opts.roles) ? opts.roles : [];
  if (!isManagerOrAdmin(roles)) return null;
  if (hub.requireTonyAdvanced !== false && !hasTonyAdvanced(modules)) return null;

  const collected = collectProactiveSignals(
    { availableModules: modules, roles: roles, hubId: hubId },
    buildRawProactiveCounts(opts.counts || {})
  );

  // Contesto per RIASSUNTO / «sì» anche da hub.
  try {
    const briefing = Object.assign({}, collected.fingerprint, {
      availableModules: modules.slice(),
      hubId: hubId,
    });
    window.tonyGlobalBriefing = Object.assign({}, window.tonyGlobalBriefing || {}, briefing);
    if (window.Tony && typeof window.Tony.setContext === 'function') {
      window.Tony.setContext('globalStatus', window.tonyGlobalBriefing);
      window.Tony.setContext('hubStatus', { hubId: hubId, fingerprint: collected.fingerprint });
    }
  } catch (_) { /* ignore */ }

  var storage = opts.storage;
  if (storage === undefined) {
    try { storage = window.localStorage; } catch (e) { storage = null; }
  }
  const now = opts.now instanceof Date ? opts.now : new Date();
  const signalIds = getProactiveSignalIdsForHub(hubId);
  const storageKey = proactiveHubStorageKey(tenantId, hubId);
  const prevState = loadProactiveBriefingState(storage, tenantId, now, { storageKey: storageKey });
  const decision = decideProactiveBriefingAction(prevState, now, collected.fingerprint, {
    signalIds: signalIds,
    allowIdle: false,
  });

  if (decision.action === 'silence') {
    return { action: 'silence', text: '' };
  }

  const followUp =
    decision.action === 'delta'
      ? pickProactiveOpenFollowUpFromDelta(decision.worsened)
      : pickProactiveOpenFollowUp(collected.opsActive);

  var briefingText = '';
  if (decision.action === 'delta') {
    briefingText = (
      formatProactiveDeltaMessage(decision.worsened) +
      formatProactiveOpenFollowUpOffer(followUp)
    ).trim();
  } else if (collected.opsActive.length > 0) {
    briefingText = formatProactiveOpsAttentionSnippet(
      collected.opsActive,
      followUp,
      { hubLabel: hub.label, offerRiassunto: false }
    ).trim();
  }

  if (!briefingText) {
    return { action: 'silence', text: '' };
  }

  saveProactiveBriefingState(storage, tenantId, decision.nextState, { storageKey: storageKey });
  const openOffer = createProactiveOpenOffer(followUp);
  const speak = opts.speak !== false;
  const delayMs = typeof opts.delayMs === 'number' ? opts.delayMs : (decision.action === 'delta' ? 2000 : 2800);

  setTimeout(function () {
    deliverHubBriefing(briefingText, speak, openOffer);
  }, delayMs);

  return { action: decision.action, text: briefingText };
}
