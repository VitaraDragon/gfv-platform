import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  timestampToDate: vi.fn((value) => value),
  dateToTimestamp: vi.fn((value) => value)
}));

import { TrattamentoVigneto } from '../modules/vigneto/models/TrattamentoVigneto.js';
import { TrattamentoFrutteto } from '../modules/frutteto/models/TrattamentoFrutteto.js';

describe('A4 — superficie trattamento finita', () => {
  it.each([null, '', Number.NaN, 'abc'])(
    'Vigneto normalizza %s a null',
    (value) => expect(new TrattamentoVigneto({ superficieTrattata: value }).superficieTrattata).toBeNull()
  );

  it.each([null, '', Number.NaN, 'abc'])(
    'Frutteto normalizza %s a null',
    (value) => expect(new TrattamentoFrutteto({ superficieTrattata: value }).superficieTrattata).toBeNull()
  );

  it('mantiene una superficie valida', () => {
    expect(new TrattamentoVigneto({ superficieTrattata: '1,5' }).superficieTrattata).toBe(1.5);
    expect(new TrattamentoFrutteto({ superficieTrattata: 1.5 }).superficieTrattata).toBe(1.5);
  });
});
