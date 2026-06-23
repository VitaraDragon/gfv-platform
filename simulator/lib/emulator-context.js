/**
 * Inizializzazione Firebase Admin + Auth emulator.
 * @module simulator/lib/emulator-context
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { assertSimulatorSafeToRun } from './guard-production.js';
import { getFirestore } from './firestore-write.js';

let _initialized = false;

export function initEmulatorAdmin() {
  if (_initialized) {
    return { db: getFirestore(), auth: getAuth() };
  }

  const { projectId } = assertSimulatorSafeToRun();

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
