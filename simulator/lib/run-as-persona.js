/**
 * Esecuzione simulatore nel contesto di un utente (manager / caposquadra / operaio).
 * v2 manodopera — obbligatorio per ore e validazioni (no Admin write “al posto” del ruolo).
 * @module simulator/lib/run-as-persona
 */

import {
  getSimPersonaUserData,
  setSimPersonaUserData,
  requireSimTenantId
} from './sim-context.js';

/**
 * Normalizza documento users/{uid} per getActingUserData.
 * @param {object} userDoc
 */
export function normalizePersonaUserDoc(userDoc) {
  if (!userDoc?.id && !userDoc?.uid) {
    throw new Error('Persona sim: id/uid mancante');
  }
  const id = userDoc.id || userDoc.uid;
  return {
    ...userDoc,
    id,
    uid: userDoc.uid || id
  };
}

/**
 * Utente “attore” corrente (dentro runAsPersona).
 * @returns {object}
 */
export function getActingUserData() {
  const persona = getSimPersonaUserData();
  if (!persona) {
    throw new Error(
      'Nessuna persona sim attiva — usa runAsPersona() prima di segnare/validare ore'
    );
  }
  return persona;
}

/**
 * Esegue fn impersonando un utente del tenant (ruoli + uid reali).
 * @template T
 * @param {object} personaUserDoc — profilo Firestore users/{uid}
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function runAsPersona(personaUserDoc, fn) {
  requireSimTenantId();
  const prev = getSimPersonaUserData();
  setSimPersonaUserData(normalizePersonaUserDoc(personaUserDoc));
  try {
    return await fn();
  } finally {
    setSimPersonaUserData(prev);
  }
}

export function userHasRole(userData, role) {
  return Array.isArray(userData?.ruoli) && userData.ruoli.includes(role);
}

export function isManagerPersona(userData) {
  return userHasRole(userData, 'amministratore') || userHasRole(userData, 'manager');
}

export function isCaposquadraPersona(userData) {
  return userHasRole(userData, 'caposquadra');
}

export function isOperaioPersona(userData) {
  return userHasRole(userData, 'operaio');
}

/** Può segnare ore proprie (allineato a segnatura-ore: operaio o caposquadra). */
export function canSignOwnHours(userData) {
  return isOperaioPersona(userData) || isCaposquadraPersona(userData);
}
