import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  normalizeAddonType,
  expiryTimestampToUnixSeconds,
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
});
