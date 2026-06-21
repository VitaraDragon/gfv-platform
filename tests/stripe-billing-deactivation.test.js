import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  normalizeAddonType,
  expiryTimestampToUnixSeconds,
  computeAccessAfterRevokeAddon,
  computeAccessAfterRestoreAddon,
} = require('../functions/stripe-billing.js');

describe('stripe-billing deactivation helpers', () => {
  it('normalizeAddonType default module', () => {
    expect(normalizeAddonType(undefined)).toBe('module');
    expect(normalizeAddonType('bundle')).toBe('bundle');
  });

  it('expiryTimestampToUnixSeconds from millis number', () => {
    const ms = Date.UTC(2026, 5, 15);
    expect(expiryTimestampToUnixSeconds(ms)).toBe(Math.floor(ms / 1000));
  });

  it('expiryTimestampToUnixSeconds from Firestore-like object', () => {
    const date = new Date(Date.UTC(2026, 0, 1));
    const ts = { toDate: () => date };
    expect(expiryTimestampToUnixSeconds(ts)).toBe(Math.floor(date.getTime() / 1000));
  });

  it('computeAccessAfterRevokeAddon removes single module', () => {
    const existing = {
      modules: ['tony', 'manodopera'],
      activeBundles: [],
      stripeAddons: { tony: { type: 'module', pendingDeactivation: true } },
    };
    const result = computeAccessAfterRevokeAddon(existing, 'tony', 'module');
    expect(result.modules).toEqual(['manodopera']);
    expect(result.activeBundles).toEqual([]);
  });

  it('computeAccessAfterRestoreAddon restores single module', () => {
    const existing = {
      modules: ['manodopera'],
      activeBundles: [],
      stripeAddons: { tony: { type: 'module', pendingDeactivation: true } },
    };
    const result = computeAccessAfterRestoreAddon(existing, 'tony', 'module');
    expect(result.modules).toContain('tony');
    expect(result.modules).toContain('manodopera');
  });

  it('computeAccessAfterRevokeAddon removes bundle modules unless covered elsewhere', () => {
    const existing = {
      modules: ['vigneto', 'manodopera', 'magazzino', 'tony'],
      activeBundles: ['vigneto-operativo'],
      stripeAddons: {
        'vigneto-operativo': { type: 'bundle' },
        tony: { type: 'module' },
      },
    };
    const result = computeAccessAfterRevokeAddon(existing, 'vigneto-operativo', 'bundle');
    expect(result.activeBundles).toEqual([]);
    expect(result.modules).toEqual(['tony']);
  });

  it('computeAccessAfterRestoreAddon restores bundle and modules', () => {
    const existing = {
      modules: ['tony'],
      activeBundles: [],
      stripeAddons: { 'vigneto-operativo': { type: 'bundle', pendingDeactivation: true } },
    };
    const result = computeAccessAfterRestoreAddon(existing, 'vigneto-operativo', 'bundle');
    expect(result.activeBundles).toEqual(['vigneto-operativo']);
    expect(result.modules).toEqual(expect.arrayContaining(['vigneto', 'manodopera', 'magazzino', 'tony']));
  });
});
