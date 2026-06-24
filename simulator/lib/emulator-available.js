/**
 * Verifica raggiungibilità Firebase Emulator.
 * @module simulator/lib/emulator-available
 */

import { assertSimulatorSafeToRun } from './guard-production.js';
import { initEmulatorAdmin } from './emulator-context.js';

/**
 * @returns {Promise<boolean>}
 */
export async function isEmulatorAvailable() {
  try {
    assertSimulatorSafeToRun();
    const { db } = initEmulatorAdmin();
    const ref = db.collection('_gfv_sim_health').doc('ping');
    await ref.set({ at: new Date().toISOString() }, { merge: true });
    return true;
  } catch {
    return false;
  }
}
