/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { ORTICOLE_HUB_CARDS } from '../modules/orticole/config/orticole-hub.js';
import {
  OrticolaTrattamento,
  selezionaRigheTrattamento
} from '../modules/orticole/models/OrticolaTrattamento.js';

describe('Orticole — trattamenti', () => {
  it('hub trattamenti non è placeholder', () => {
    const card = ORTICOLE_HUB_CARDS.find((item) => item.id === 'trattamenti');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('trattamenti_orticole');
  });

  it('seleziona solo tipi trattamento sulla campagna del terreno', () => {
    const righe = selezionaRigheTrattamento({
      terreni: [{ id: 't-pom' }],
      nomiTipi: ['trattamento meccanico'],
      campagne: [{ id: 'c1', terrenoId: 't-pom', campagna: '2025/2026', ciclo: 1, colturaNome: 'Pomodoro' }],
      lavori: [
        { id: 'l1', terrenoId: 't-pom', stato: 'completato', tipoLavoro: 'Trattamento Meccanico', dataInizio: '2026-05-04' },
        { id: 'l2', terrenoId: 't-pom', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2026-05-04' }
      ],
      attivita: [
        { id: 'a2', terrenoId: 't-pom', tipoLavoro: 'Trattamento Meccanico', data: '2026-06-02' }
      ],
      trattamenti: [{ id: 't1', lavoroId: 'l1', prodotto: 'Rame' }]
    });
    expect(righe.map((row) => row.lavoroId || row.attivitaId)).toEqual(['a2', 'l1']);
    expect(righe[1].trattamento.prodotto).toBe('Rame');
  });

  it('validate prodotti e costi', () => {
    const ok = new OrticolaTrattamento({
      campagnaId: 'c1',
      lavoroId: 'l1',
      data: '2026-05-04',
      prodotti: [
        { prodottoId: 'p1', prodotto: 'Rame', dosaggio: 4, quantita: 12, costo: 12.5 }
      ],
      costoManodopera: 20,
      costoMacchina: 5
    });
    expect(ok.validate().valid).toBe(true);
    expect(ok.toFirestore().costoTotale).toBe(37.5);
  });
});
