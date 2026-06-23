/**
 * Contesto in-memory per il simulatore (equivalente Node di setCurrentTenantId).
 * @module simulator/lib/sim-context
 */

let _tenantId = null;
let _userId = null;
let _runId = null;
let _profile = null;

export function setSimContext({ tenantId, userId, runId, profile } = {}) {
  if (tenantId !== undefined) _tenantId = tenantId;
  if (userId !== undefined) _userId = userId;
  if (runId !== undefined) _runId = runId;
  if (profile !== undefined) _profile = profile;
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
