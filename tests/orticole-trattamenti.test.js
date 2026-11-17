/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { ORTICOLE_HUB_CARDS } from '../modules/orticole/config/orticole-hub.js';
import {
  OrticolaTrattamento,
  selezionaRigheTrattamento
} from '../modules/orticole/models/OrticolaTrattamento.js';
import {
  prodottiSchedaDaMiscelaLavoro,
  testoStatoVuotoRegistro
} from '../shared/js/registro-trattamenti.js';

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

  it('Completa precompila la miscela e non sovrascrive una scheda già compilata', () => {
    const lavoro = {
      miscelaPrevista: {
        ettolitriPerEttaro: 4,
        ettolitriTotali: 8,
        prodotti: [{ prodottoId: 'p1', nome: 'Sivanto Prime', unita: 'l', dosePerEttaro: 0.5 }]
      }
    };
    const scheda = prodottiSchedaDaMiscelaLavoro(lavoro, null, 2, [{ id: 'p1', prezzoUnitario: 10 }]);
    expect(scheda.daMiscela).toBe(true);
    expect(scheda.prodotti[0]).toMatchObject({ prodottoId: 'p1', prodotto: 'Sivanto Prime', dosaggio: 0.5, quantita: 1, costo: 10 });
    expect(scheda.acquaEttolitriTotali).toBe(8);
    const senzaSuperficie = prodottiSchedaDaMiscelaLavoro(lavoro, null, null, []);
    expect(senzaSuperficie.prodotti[0].quantita).toBeNull();
    const gia = prodottiSchedaDaMiscelaLavoro(lavoro, {
      prodotti: [{ prodottoId: 'p9', prodotto: 'Rame', dosaggio: 2, quantita: 4, costo: 3 }]
    }, 2, []);
    expect(gia.daMiscela).toBe(false);
    expect(gia.prodotti[0].prodotto).toBe('Rame');
    const vuota = prodottiSchedaDaMiscelaLavoro(lavoro, {
      prodotti: [{ prodottoId: null, prodotto: '', dosaggio: null, costo: 0 }]
    }, 2, []);
    expect(vuota.daMiscela).toBe(true);
    expect(vuota.prodotti[0].prodotto).toBe('Sivanto Prime');
  });

  it('stato vuoto cita Completa e, senza Manodopera, non cita Gestione Lavori', () => {
    const spento = testoStatoVuotoRegistro({ coltura: 'ortive', categoria: 'trattamenti', hasManodopera: false });
    const acceso = testoStatoVuotoRegistro({ coltura: 'ortive', categoria: 'trattamenti', hasManodopera: true });
    const concime = testoStatoVuotoRegistro({ coltura: 'ortive', categoria: 'concimazione', hasManodopera: false });
    expect(spento).toContain('Completa');
    expect(spento).not.toContain('Gestione Lavori');
    expect(acceso).toContain('Nuovo lavoro');
    expect(acceso).toContain('Leggi scheda');
    expect(concime).toContain('Completa');
    expect(concime).toContain('Concimazione');
    expect(concime).not.toContain('Gestione Lavori');
  });
});
