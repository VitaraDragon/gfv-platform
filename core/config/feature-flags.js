/**
 * Flag di prova per tenant — NON è il gating dei moduli a pagamento (`moduliAttivi`).
 *
 * `preview: true` = versione di prova (develop): novelty accese.
 * `preview: false` = versione pubblicata (main): comportamento stabile.
 *
 * Lo switch in dashboard è visibile solo ai tenant in allowlist (Sabbie Gialle).
 * Non mescolare con abbonamento / moduliAttivi.
 * Non cambia il branch Git: stesso bundle JS, comportamento diverso.
 *
 * @module core/config/feature-flags
 */

export const FEATURE_FLAG_KEYS = {
  PREVIEW: 'preview',
  ZONA_LAVORATA_DUE_PUNTI: 'zonaLavorataDuePunti'
};

/** Catalogo novelty accese quando preview è on. */
export const PREVIEW_FLAG_CATALOG = {
  zonaLavorataDuePunti: {
    id: 'zonaLavorataDuePunti',
    label: 'Zona lavorata a due punti (inizio/fine sul perimetro)',
    enabledWhenPreview: true,
    /** Promossa su main: resta accesa anche con switch «Pubblicata». */
    enabledAlways: true
  }
};

/**
 * Tenant che possono vedere lo switch Prova/Pubblicata.
 * Match su id (`sabbie_gialle`, `sabbie_gialle_1`, …) o nome.
 */
export const PREVIEW_SWITCH_TENANT_IDS = ['sabbie_gialle'];

const PREVIEW_SWITCH_ROLES = ['manager', 'amministratore'];

/**
 * @param {string|null|undefined} tenantId
 * @param {string|null|undefined} [tenantNome]
 * @returns {boolean}
 */
export function tenantCanUsePreviewSwitch(tenantId, tenantNome) {
  const id = String(tenantId || '').trim().toLowerCase();
  if (id === 'sabbie_gialle' || id.startsWith('sabbie_gialle_')) return true;
  const nome = String(tenantNome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return nome.includes('sabbie gialle');
}

/**
 * Switch visibile solo a manager/admin dei tenant in allowlist.
 * @param {string|null|undefined} tenantId
 * @param {string|null|undefined} tenantNome
 * @param {string[]|null|undefined} roles
 * @returns {boolean}
 */
export function canShowPreviewSwitch(tenantId, tenantNome, roles) {
  if (!tenantCanUsePreviewSwitch(tenantId, tenantNome)) return false;
  const list = Array.isArray(roles) ? roles : [];
  return list.some((role) => PREVIEW_SWITCH_ROLES.includes(String(role || '').toLowerCase()));
}

/**
 * @param {Object|null|undefined} raw
 * @returns {{ preview: boolean|null }}
 */
export function normalizeFeatureFlags(raw) {
  if (!raw || typeof raw !== 'object') return { preview: null };
  if (raw.preview === true) return { preview: true };
  if (raw.preview === false) return { preview: false };
  return { preview: null };
}

/**
 * Preview on: campo esplicito, oppure default acceso su Sabbie Gialle se mai impostato.
 *
 * @param {Object|null|undefined} featureFlags
 * @param {string|null|undefined} tenantId
 * @param {string|null|undefined} [tenantNome]
 * @returns {boolean}
 */
export function isPreviewModeEnabled(featureFlags, tenantId, tenantNome) {
  const flags = normalizeFeatureFlags(featureFlags);
  if (flags.preview === true) return true;
  if (flags.preview === false) return false;
  return tenantCanUsePreviewSwitch(tenantId, tenantNome);
}

/**
 * @param {string} flagId
 * @param {Object|null|undefined} featureFlags
 * @param {string|null|undefined} tenantId
 * @param {string|null|undefined} [tenantNome]
 * @returns {boolean}
 */
export function isFeatureEnabled(flagId, featureFlags, tenantId, tenantNome) {
  const spec = PREVIEW_FLAG_CATALOG[flagId];
  if (!spec) return false;
  if (spec.enabledAlways) return true;
  if (!isPreviewModeEnabled(featureFlags, tenantId, tenantNome)) {
    return !!spec.enabledWhenPublished;
  }
  return !!spec.enabledWhenPreview;
}

/**
 * Legge i flag già pubblicati su window, con fallback al tenant in memoria.
 * @param {string} flagId
 * @returns {boolean}
 */
export function isFeatureEnabledFromWindow(flagId) {
  if (typeof window === 'undefined') return false;
  const spec = PREVIEW_FLAG_CATALOG[flagId];
  if (!spec) return false;
  if (spec.enabledAlways) return true;
  const published = window.__gfvFeatureFlags;
  if (published && typeof published.preview === 'boolean') {
    return published.preview === true;
  }
  const tenant = window.__gfvTenantData || {};
  const id = tenant.id || tenant.tenantId || null;
  return isFeatureEnabled(flagId, tenant.featureFlags, id, tenant.nome || tenant.name);
}

/**
 * Payload Firestore (`featureFlags.preview`) senza toccare altri campi.
 * @param {boolean} preview
 * @returns {{ 'featureFlags.preview': boolean }}
 */
export function previewFlagUpdatePayload(preview) {
  return { 'featureFlags.preview': preview === true };
}

/**
 * Pubblica i flag sul window (stesso schema di moduli, lista separata).
 * @param {Object|null|undefined} tenant
 * @param {string|null|undefined} tenantId
 */
export function publishFeatureFlags(tenant, tenantId) {
  if (typeof window === 'undefined') return;
  const id = tenantId || tenant?.id || null;
  const nome = tenant?.nome || tenant?.name || '';
  const flags = normalizeFeatureFlags(tenant && tenant.featureFlags);
  const preview = isPreviewModeEnabled(tenant && tenant.featureFlags, id, nome);
  window.__gfvFeatureFlags = {
    preview,
    storedPreview: flags.preview,
    tenantId: id
  };
  try {
    sessionStorage.setItem(
      'gfv_feature_flags',
      JSON.stringify({ preview, tenantId: id })
    );
  } catch (e) { /* ignore */ }
  try {
    window.dispatchEvent(
      new CustomEvent('gfv-feature-flags', { detail: { preview, tenantId: id } })
    );
  } catch (e2) { /* ignore */ }
}
