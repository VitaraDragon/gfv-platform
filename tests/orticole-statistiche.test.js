/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { riepilogoCampagne, totaliStatistiche } from '../modules/orticole/models/OrticolaStatistiche.js';

describe('Orticole — acqua in riepilogo campagne', () => {
  it('300 m³ su 1 ha diventano acquaM3 e acquaM3Ha', () => {
    const righe = riepilogoCampagne({
      campagne: [{
        id: 'c1',
        terrenoId: 't1',
        campagna: '2026',
        colturaNome: 'Pomodoro',
        superficieEttari: 1
      }],
      irrigazioni: [
        { campagnaId: 'c1', volumeM3: 200 },
        { campagnaId: 'c1', volumeM3: 100 },
        { campagnaId: 'altra', volumeM3: 50 }
      ]
    });
    expect(righe[0].acquaM3).toBe(300);
    expect(righe[0].acquaM3Ha).toBe(300);
    expect(righe[0].costoTotale).toBe(0);
    expect(totaliStatistiche(righe).acquaM3).toBe(300);
  });
});
