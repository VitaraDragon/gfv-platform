/**
 * Contesto in-memory per il simulatore (equivalente Node di setCurrentTenantId).
 * @module simulator/lib/sim-context
 */

let _tenantId = null;
let _userId = null;
let _runId = null;
let _profile = null;
/** @type {object | null} Persona corrente in runAsPersona (shape users/{uid}). */
let _personaUserData = null;

export function setSimContext({ tenantId, userId, runId, profile } = {}) {
  if (tenantId !== undefined) _tenantId = tenantId;
  if (userId !== undefined) _userId = userId;
  if (runId !== undefined) _runId = runId;
  if (profile !== undefined) _profile = profile;
}

export function setSimPersonaUserData(userData) {
  _personaUserData = userData;
}

export function getSimPersonaUserData() {
  return _personaUserData;
}

export function getSimTenantId() {
  return _tenantId;
}

export function getSimUserId() {
  return _userId;
}

export function getSimRunId() {
  return _runId;
}

export function getSimProfile() {
  return _profile;
}

export function requireSimTenantId() {
  if (!_tenantId) {
    throw new Error('Contesto simulatore: tenantId non impostato');
  }
  return _tenantId;
}

export function requireSimUserId() {
  if (!_userId) {
    throw new Error('Contesto simulatore: userId non impostato');
  }
  return _userId;
}

/** Alias per allineamento concettuale con tenant-service browser */
export function getCurrentTenantId() {
  return getSimTenantId();
}

export function setCurrentTenantId(tenantId) {
  setSimContext({ tenantId });
}

/** Reset completo — usare tra test integrazione/emulator. */
export function resetSimContext() {
  _tenantId = null;
  _userId = null;
  _runId = null;
  _profile = null;
  _personaUserData = null;
}
