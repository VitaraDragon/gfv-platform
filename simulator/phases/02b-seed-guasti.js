/**
 * Fase 2b — Seed guasti parco macchine (template con quantities.guasti > 0).
 * @module simulator/phases/02b-seed-guasti
 */

import { getEmulatorDb } from '../lib/emulator-context.js';
import { seedGuastiDemo } from '../lib/seed-guasti.js';
import { requireSimUserId, getSimProfile } from '../lib/sim-context.js';

/**
 * @param {{ trattori?: Array, attrezzi?: Array }} assets
 */
export async function runSeedGuasti(assets = {}) {
  const profile = getSimProfile();
  const q = profile?.template?.quantities || {};
  if ((q.guasti ?? 0) <= 0) {
    return { guasti: [], counts: { guasti: 0, guastiAperti: 0 } };
  }

  const db = getEmulatorDb();
  const userId = requireSimUserId();
  return seedGuastiDemo(db, {
    trattori: assets.trattori,
    attrezzi: assets.attrezzi,
    userId,
    count: q.guasti
  });
}
