import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  timestampToDate: vi.fn((value) => value),
  dateToTimestamp: vi.fn((value) => value)
}));

import { Vendemmia } from '../modules/vigneto/models/Vendemmia.js';
import {
  getDestinazioneLabel,
  normalizzaDestinazioneVendemmia
} from '../shared/js/destinazione-vendemmia.js';

describe('A3 — destinazione vendemmia', () => {
  it.each([null, undefined, '', 'null', ' NULL '])(
    'mostra "-" per il valore vuoto %s',
    (value) => expect(getDestinazioneLabel(value)).toBe('-')
  );

  it('mantiene le etichette delle destinazioni valide', () => {
    expect(getDestinazioneLabel('vino')).toBe('🍷 Vino');
    expect(normalizzaDestinazioneVendemmia('vendita_uva')).toBe('vendita_uva');
  });

  it('il modello non serializza mai la stringa "null"', () => {
    const fromNull = new Vendemmia({ destinazione: null }).toFirestore();
    const fromString = new Vendemmia({ destinazione: 'null' }).toFirestore();
    expect(fromNull.destinazione).toBeNull();
    expect(fromString.destinazione).toBeNull();
  });
});
