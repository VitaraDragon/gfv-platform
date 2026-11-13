/**
 * Inizializzazione Firebase Admin + Auth emulator.
 * @module simulator/lib/emulator-context
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { assertSimulatorSafeToRun } from './guard-production.js';
import { getFirestore } from './firestore-write.js';

let _initialized = false;

/**
 * Il gate parallelo passa GFV_SIM_PROJECT_ID quando la CLI dell'emulatore
 * non è gfv-platform. L'Auth emulator mette il login su quel project id:
 * il seed deve scrivere lì, altrimenti «Entra come manager» non trova l'utente.
 * Vale solo se l'host è già un emulatore locale (lo verifica il guard).
 */
function projectIdForSeed(configured) {
  const override = String(process.env.GFV_SIM_PROJECT_ID || '').trim();
  if (!override) return configured;
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(override)) {
    throw new Error(`GFV_SIM_PROJECT_ID non valido: ${override}`);
  }
  return override;
}

export function initEmulatorAdmin() {
  if (_initialized) {
    return { db: getFirestore(), auth: getAuth() };
  }

  const { projectId: configured } = assertSimulatorSafeToRun();
  const projectId = projectIdForSeed(configured);

  if (getApps().length === 0) {
    initializeApp({ projectId });
  }

  _initialized = true;
  return { db: getFirestore(), auth: getAuth() };
}

/**
 * Crea o recupera utente Auth emulator.
 * @param {{ email: string, password: string, displayName?: string }} params
 */
export async function ensureAuthUser({ email, password, displayName }) {
  const { auth } = initEmulatorAdmin();
  try {
    const existing = await auth.getUserByEmail(email);
    return existing;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    return auth.createUser({
      email,
      password,
      displayName: displayName || email,
      emailVerified: true
    });
  }
}

export function getEmulatorDb() {
  return initEmulatorAdmin().db;
}

export function getEmulatorAuth() {
  return initEmulatorAdmin().auth;
}
