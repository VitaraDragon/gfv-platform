/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  getManagerHomeHref,
  getManagerHomeLabel
} from '../core/config/manodopera-hub-nav.js';

describe('manodopera-hub-nav labels', () => {
  test('figlia verso hub e pagina core verso home usano ← Dashboard', () => {
    expect(getManagerHomeLabel(true)).toBe('← Dashboard');
    expect(getManagerHomeLabel(false)).toBe('← Dashboard');
  });

  test('con modulo manodopera il link punta all’hub, non alla home app', () => {
    expect(getManagerHomeHref(true, 'core-admin')).toContain('manodopera-home-standalone.html');
    expect(getManagerHomeHref(false, 'core-admin')).toBe('../dashboard-standalone.html');
  });
});
