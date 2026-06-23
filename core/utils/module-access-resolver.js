/**
 * Risoluzione accesso moduli: pagati + trial attivi (30 giorni, scelta utente).
 * @module core/utils/module-access-resolver
 */

export const MODULE_TRIAL_DAYS = 30;

const TRIAL_STATUS_ACTIVE = 'active';
const TRIAL_STATUS_EXPIRED = 'expired';
const TRIAL_STATUS_CONVERTED = 'converted';

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * @param {object|null|undefined} record
 * @param {Date} [now]
 */
export function isTrialRecordActive(record, now = new Date()) {
  if (!record || record.status !== TRIAL_STATUS_ACTIVE) return false;
  const endsAt = toDate(record.endsAt);
  if (!endsAt) return false;
  return endsAt > now;
}

/**
 * @param {object|null|undefined} tenant
 */
export function getPaidModuleIds(tenant) {
  return Array.isArray(tenant?.modules) ? [...tenant.modules] : [];
}

/**
 * Moduli coperti da bundle attivi (ids catalogo bundle).
 * @param {object|null|undefined} tenant
 * @param {Array<{ id: string, modules: string[] }>} [bundleCatalog]
 */
export function getModulesCoveredByActiveBundles(tenant, bundleCatalog = []) {
  const activeBundles = Array.isArray(tenant?.activeBundles) ? tenant.activeBundles : [];
  const covered = new Set();
  activeBundles.forEach((bundleId) => {
    const bundle = bundleCatalog.find((b) => b.id === bundleId);
    if (bundle && Array.isArray(bundle.modules)) {
      bundle.modules.forEach((m) => covered.add(m));
    }
  });
  return covered;
}

/**
 * @param {object|null|undefined} moduleTrials
 * @param {Date} [now]
 */
export function getActiveTrialModuleIds(moduleTrials, now = new Date()) {
  const trials = moduleTrials && typeof moduleTrials === 'object' ? moduleTrials : {};
  return Object.keys(trials).filter((id) => isTrialRecordActive(trials[id], now));
}

/**
 * Moduli effettivi per UI, Tony e gating client.
 * @param {object|null|undefined} tenant
 * @param {Date} [now]
 */
export function resolveEffectiveModules(tenant, now = new Date()) {
  const paid = getPaidModuleIds(tenant);
  const trialIds = getActiveTrialModuleIds(tenant?.moduleTrials, now);
  return Array.from(new Set([...paid, ...trialIds]));
}

/**
 * @param {object|null|undefined} tenant
 * @param {string} moduleId
 * @param {Date} [now]
 */
export function isModuleOnTrial(tenant, moduleId, now = new Date()) {
  const paid = getPaidModuleIds(tenant);
  if (paid.includes(moduleId)) return false;
  const trials = tenant?.moduleTrials || {};
  return isTrialRecordActive(trials[moduleId], now);
}

/**
 * @param {object|null|undefined} tenant
 * @param {string} moduleName
 * @param {Date} [now]
 */
export function hasModuleAccessFromTenant(tenant, moduleName, now = new Date()) {
  if (moduleName === 'core') return true;
  return resolveEffectiveModules(tenant, now).includes(moduleName);
}

/**
 * @param {object|null|undefined} tenant
 * @param {string} moduleId
 * @param {{ availableModuleIds?: string[], bundleCatalog?: Array<{ id: string, modules: string[] }> }} [options]
 * @param {Date} [now]
 * @returns {{ canStart: boolean, reason: string }}
 */
export function canStartModuleTrial(tenant, moduleId, options = {}, now = new Date()) {
  const availableModuleIds = options.availableModuleIds || [];
  const bundleCatalog = options.bundleCatalog || [];

  if (!moduleId || typeof moduleId !== 'string') {
    return { canStart: false, reason: 'Modulo non valido.' };
  }
  if (availableModuleIds.length > 0 && !availableModuleIds.includes(moduleId)) {
    return { canStart: false, reason: 'Modulo non disponibile per la prova.' };
  }

  const paid = getPaidModuleIds(tenant);
  if (paid.includes(moduleId)) {
    return { canStart: false, reason: 'Modulo già attivo.' };
  }

  const coveredByBundle = getModulesCoveredByActiveBundles(tenant, bundleCatalog);
  if (coveredByBundle.has(moduleId)) {
    return { canStart: false, reason: 'Modulo già incluso in un bundle attivo.' };
  }

  const trials = tenant?.moduleTrials || {};
  if (trials[moduleId]) {
    return { canStart: false, reason: 'Hai già usato la prova gratuita per questo modulo.' };
  }

  const activeTrialIds = getActiveTrialModuleIds(trials, now);
  if (activeTrialIds.length > 0 && !activeTrialIds.includes(moduleId)) {
    return {
      canStart: false,
      reason: 'Puoi avere un solo modulo in prova alla volta. Attendi la scadenza o attiva l\'abbonamento.'
    };
  }

  return { canStart: true, reason: '' };
}

/**
 * @param {object|null|undefined} record
 */
export function formatTrialEndDate(record) {
  const endsAt = toDate(record?.endsAt);
  if (!endsAt) return '';
  return endsAt.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export const MODULE_TRIAL_STATUSES = {
  ACTIVE: TRIAL_STATUS_ACTIVE,
  EXPIRED: TRIAL_STATUS_EXPIRED,
  CONVERTED: TRIAL_STATUS_CONVERTED
};
