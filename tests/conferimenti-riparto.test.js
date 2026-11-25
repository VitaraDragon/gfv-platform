/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  quantitaInQ,
  ripartoProvvisorioPerCampo
} from '../core/services/conferimenti-riparto.js';

describe('conferimenti riparto provvisorio', () => {
  it('normalizza kg e q', () => {
    expect(quantitaInQ(200, 'kg')).toBe(2);
    expect(quantitaInQ(3.5, 'q')).toBe(3.5);
  });

  it('un solo campo prende tutto', () => {
    const r = ripartoProvvisorioPerCampo(
      [{ quantitaNetta: 100, unita: 'q', terrenoId: 't1', campoLabel: 'Campo A' }],
      [
        { tipo: 'acconto', importo: 3000, conferimentoId: 'c1' },
        { tipo: 'saldo', importo: 1200, conferimentoId: 'c1' }
      ],
      'c1'
    );
    expect(r.stima).toBe(true);
    expect(r.totaleIncassi).toBe(4200);
    expect(r.perCampo).toHaveLength(1);
    expect(r.perCampo[0].quotaEuro).toBe(4200);
    expect(r.perCampo[0].euroPerQ).toBe(42);
    expect(r.perCampo[0].stato).toBe('provvisorio');
  });

  it('tre campi con quantità diverse', () => {
    const r = ripartoProvvisorioPerCampo(
      [
        { quantitaNetta: 50, unita: 'q', terrenoId: 'a', campoLabel: 'A' },
        { quantitaNetta: 30, unita: 'q', terrenoId: 'b', campoLabel: 'B' },
        { quantitaNetta: 20, unita: 'q', terrenoId: 'c', campoLabel: 'C' }
      ],
      [{ tipo: 'acconto', importo: 1000, conferimentoId: 'c1' }],
      'c1'
    );
    expect(r.totaleQ).toBe(100);
    const byLabel = Object.fromEntries(r.perCampo.map((p) => [p.label, p.quotaEuro]));
    expect(byLabel.A).toBe(500);
    expect(byLabel.B).toBe(300);
    expect(byLabel.C).toBe(200);
  });

  it('consegna senza campo va in non attribuito', () => {
    const r = ripartoProvvisorioPerCampo(
      [
        { quantitaNetta: 40, unita: 'q', terrenoId: 'a', campoLabel: 'A' },
        { quantitaNetta: 10, unita: 'q' }
      ],
      [{ tipo: 'acconto', importo: 500, conferimentoId: 'c1' }],
      'c1'
    );
    const na = r.perCampo.find((p) => p.nonAttribuito);
    expect(na).toBeTruthy();
    expect(na.quantitaQ).toBe(10);
    expect(na.quotaEuro).toBe(100);
  });

  it('nessuna consegna: tutto non attribuito', () => {
    const r = ripartoProvvisorioPerCampo(
      [],
      [{ tipo: 'acconto', importo: 800, conferimentoId: 'c1' }],
      'c1'
    );
    expect(r.perCampo).toHaveLength(1);
    expect(r.perCampo[0].nonAttribuito).toBe(true);
    expect(r.perCampo[0].quotaEuro).toBe(800);
    expect(r.perCampo[0].quantitaQ).toBe(0);
  });

  it('unità miste kg/q normalizzate', () => {
    const r = ripartoProvvisorioPerCampo(
      [
        { quantitaNetta: 1000, unita: 'kg', terrenoId: 'a', campoLabel: 'A' },
        { quantitaNetta: 10, unita: 'q', terrenoId: 'b', campoLabel: 'B' }
      ],
      [{ tipo: 'acconto', importo: 200, conferimentoId: 'c1' }],
      'c1'
    );
    expect(r.totaleQ).toBe(20);
    const byLabel = Object.fromEntries(r.perCampo.map((p) => [p.label, p.quotaEuro]));
    expect(byLabel.A).toBe(100);
    expect(byLabel.B).toBe(100);
  });

  it('opts.labels e fallback «Campo senza nome» (mai chiave grezza)', () => {
    const r = ripartoProvvisorioPerCampo(
      [
        { quantitaNetta: 40, unita: 'q', vignetoId: 'n3T7abc' },
        { quantitaNetta: 10, unita: 'q', terrenoId: 't9' }
      ],
      [{ tipo: 'acconto', importo: 500, conferimentoId: 'c1' }],
      'c1',
      { labels: { 'vigneto:n3T7abc': 'Vigneto · Sangiovese' } }
    );
    const byKey = Object.fromEntries(r.perCampo.map((p) => [p.key, p]));
    expect(byKey['vigneto:n3T7abc'].label).toBe('Vigneto · Sangiovese');
    expect(byKey['terreno:t9'].label).toBe('Campo senza nome');
    expect(r.perCampo.every((p) => !/^vigneto:|^frutteto:|^terreno:/.test(p.label))).toBe(true);
  });
});
