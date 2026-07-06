/**
 * Test helper PDF calcolo VM (puramente formattazione)
 */

import { describe, test, expect } from 'vitest';
import {
  formatEuroPdf,
  getDestinazioneLabel,
  getMorfologiaLabel
} from '../../modules/vendemmia-meccanica/services/calcolo-vm-pdf-service.js';

describe('calcolo-vm-pdf-service', () => {
  test('formatEuroPdf usa formato italiano', () => {
    expect(formatEuroPdf(1234.5)).toBe('EUR 1234,50');
  });

  test('getDestinazioneLabel risolve preset', () => {
    expect(getDestinazioneLabel('sociale')).toContain('sociale');
  });

  test('getMorfologiaLabel traduce chiavi', () => {
    expect(getMorfologiaLabel('collina')).toBe('Collina');
  });
});
