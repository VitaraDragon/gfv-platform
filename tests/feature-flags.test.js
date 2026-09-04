/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  FEATURE_FLAG_KEYS,
  tenantCanUsePreviewSwitch,
  canShowPreviewSwitch,
  normalizeFeatureFlags,
  isPreviewModeEnabled,
  isFeatureEnabled,
  previewFlagUpdatePayload
} from '../core/config/feature-flags.js';

describe('feature-flags', () => {
  test('allowlist Sabbie Gialle su id e nome', () => {
    expect(tenantCanUsePreviewSwitch('sabbie_gialle')).toBe(true);
    expect(tenantCanUsePreviewSwitch('sabbie_gialle_1')).toBe(true);
    expect(tenantCanUsePreviewSwitch('altro', 'Azienda Sabbie Gialle')).toBe(true);
    expect(tenantCanUsePreviewSwitch('altro', 'Sabbie Giàlle')).toBe(true);
    expect(tenantCanUsePreviewSwitch('altro_tenant', 'Cantina Rossi')).toBe(false);
  });

  test('switch visibile solo a manager/admin del tenant in allowlist', () => {
    expect(canShowPreviewSwitch('sabbie_gialle', 'Sabbie Gialle', ['manager'])).toBe(true);
    expect(canShowPreviewSwitch('sabbie_gialle', 'Sabbie Gialle', ['amministratore'])).toBe(true);
    expect(canShowPreviewSwitch('sabbie_gialle', 'Sabbie Gialle', ['operaio'])).toBe(false);
    expect(canShowPreviewSwitch('altro', 'Cantina', ['manager'])).toBe(false);
  });

  test('normalizeFeatureFlags distingue true / false / assente', () => {
    expect(normalizeFeatureFlags(undefined)).toEqual({ preview: null });
    expect(normalizeFeatureFlags({ preview: true })).toEqual({ preview: true });
    expect(normalizeFeatureFlags({ preview: false })).toEqual({ preview: false });
    expect(normalizeFeatureFlags({ preview: 'yes' })).toEqual({ preview: null });
  });

  test('Sabbie Gialle: preview default on se mai impostato', () => {
    expect(isPreviewModeEnabled(undefined, 'sabbie_gialle', 'Sabbie Gialle')).toBe(true);
    expect(isPreviewModeEnabled({}, 'sabbie_gialle')).toBe(true);
    expect(isPreviewModeEnabled({ preview: false }, 'sabbie_gialle')).toBe(false);
    expect(isPreviewModeEnabled({ preview: true }, 'sabbie_gialle')).toBe(true);
  });

  test('altri tenant: preview off se non esplicito', () => {
    expect(isPreviewModeEnabled(undefined, 'altro', 'Cantina')).toBe(false);
    expect(isPreviewModeEnabled({ preview: true }, 'altro', 'Cantina')).toBe(true);
  });

  test('zona a due punti segue il preview', () => {
    const key = FEATURE_FLAG_KEYS.ZONA_LAVORATA_DUE_PUNTI;
    expect(isFeatureEnabled(key, undefined, 'sabbie_gialle')).toBe(true);
    expect(isFeatureEnabled(key, { preview: false }, 'sabbie_gialle')).toBe(false);
    expect(isFeatureEnabled(key, undefined, 'altro')).toBe(false);
    expect(isFeatureEnabled('flagInesistente', { preview: true }, 'sabbie_gialle')).toBe(false);
  });

  test('payload Firestore tocca solo featureFlags.preview', () => {
    expect(previewFlagUpdatePayload(true)).toEqual({ 'featureFlags.preview': true });
    expect(previewFlagUpdatePayload(false)).toEqual({ 'featureFlags.preview': false });
  });
});
