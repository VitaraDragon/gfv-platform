import { describe, it, expect } from 'vitest';
import {
  isLavoroSolaLettura,
  isAttivitaSolaLettura,
  isRegistroSolaLettura,
  htmlAzioniRegistro,
  risolviColturaDaTerreno
} from '../shared/js/storico-sola-lettura.js';
import { lavoroSelezionabilePerOre, impostaDelegaDropdownSegnaOre } from '../core/services/ore-lavoro-selezionabile.js';
import { MESSAGGIO_ORE_SOLA_LETTURA } from '../shared/js/storico-sola-lettura.js';
import { terreniPerTendina, isTerrenoFrutteto } from '../shared/js/coltura-terreno.js';
import {
  preparaEffettiSalvataggioTerreno,
  testoCategoriaColtura,
  superficieCambiata
} from '../shared/js/effetti-salvataggio-terreno.js';

const terrenoAttivo = { id: 't', nome: 'Campo', stato: 'attivo', coltura: 'Vite' };
const terrenoArchiviato = { id: 't', nome: 'Campo', stato: 'archiviato', coltura: 'Vite' };
const terrenoCambio = {
  id: 't',
  nome: 'Campo',
  stato: 'attivo',
  coltura: 'Melo',
  colturaDal: '2026-06-01'
};

describe('isLavoroSolaLettura', () => {
  it('terreno archiviato: sola lettura anche se il lavoro è aperto', () => {
    expect(isLavoroSolaLettura({ stato: 'in_corso', dataInizio: '2026-08-01' }, terrenoArchiviato)).toBe(true);
  });

  it('completato prima del cambio coltura: sola lettura', () => {
    expect(isLavoroSolaLettura({ stato: 'completato', dataInizio: '2026-01-10' }, terrenoCambio)).toBe(true);
    expect(isLavoroSolaLettura({ stato: 'annullato', dataInizio: '2026-01-10' }, terrenoCambio)).toBe(true);
  });

  it('aperto prima del cambio resta modificabile e diventa sola lettura quando è completato', () => {
    const aperto = { stato: 'in_corso', dataInizio: '2026-01-10', coltura: 'Vite' };
    expect(isLavoroSolaLettura(aperto, terrenoCambio)).toBe(false);
    expect(isLavoroSolaLettura({ ...aperto, stato: 'completato' }, terrenoCambio)).toBe(true);
  });

  it('lavoro iniziato dopo il cambio resta modificabile', () => {
    expect(isLavoroSolaLettura({ stato: 'in_corso', dataInizio: '2026-07-01' }, terrenoCambio)).toBe(false);
  });

  it('terreno attivo senza colturaDal: un lavoro di tre anni fa resta modificabile', () => {
    expect(isLavoroSolaLettura({ stato: 'completato', dataInizio: '2023-04-01' }, terrenoAttivo)).toBe(false);
  });
});

describe('righe dei registri', () => {
  it('un impianto chiuso mostra solo consultazione', () => {
    const sola = isRegistroSolaLettura({
      registro: { data: '2026-03-01' },
      impianto: { id: 'v1', statoImpianto: 'chiuso' }
    });
    expect(sola).toBe(true);
    expect(htmlAzioniRegistro(true, '<button>Modifica</button>')).toBe(
      '<span title="Solo consultazione">Solo consultazione</span>'
    );
    expect(htmlAzioniRegistro(false, '<button>Modifica</button>')).toContain('Modifica');
  });
});

describe('diario', () => {
  it('attività prima del cambio senza lavoro è sola lettura', () => {
    expect(isAttivitaSolaLettura({ data: '2026-01-02' }, terrenoCambio, null)).toBe(true);
  });

  it('attività collegata a un lavoro ancora aperto resta modificabile', () => {
    const lavoro = { stato: 'in_corso', dataInizio: '2026-01-10' };
    expect(isAttivitaSolaLettura({ data: '2026-01-02', lavoroId: 'l1' }, terrenoCambio, lavoro)).toBe(false);
  });
});

describe('ore', () => {
  it('un lavoro in sola lettura non accetta ore', () => {
    const esito = lavoroSelezionabilePerOre({
      ruolo: 'operaio',
      lavoro: { stato: 'in_corso', dataInizio: '2026-08-01' },
      terreno: terrenoArchiviato
    });
    expect(esito.ok).toBe(false);
    expect(esito.motivo).toBe(MESSAGGIO_ORE_SOLA_LETTURA);
  });

  it('un lavoro normale resta selezionabile', () => {
    impostaDelegaDropdownSegnaOre(() => true);
    const esito = lavoroSelezionabilePerOre({
      ruolo: 'operaio',
      lavoro: { stato: 'in_corso', dataInizio: '2026-08-01' },
      terreno: terrenoAttivo
    });
    expect(esito.ok).toBe(true);
  });
});

describe('coltura bloccata sul terreno', () => {
  it('in salvataggio vince la coltura del terreno', () => {
    const esito = risolviColturaDaTerreno({
      terreno: terrenoAttivo,
      colturaForm: 'Grano',
      isNuovo: true
    });
    expect(esito.libera).toBe(false);
    expect(esito.coltura).toBe('Vite');
  });

  it('un lavoro aperto iniziato prima del cambio tiene la coltura salvata', () => {
    const esito = risolviColturaDaTerreno({
      terreno: terrenoCambio,
      colturaForm: 'Melo',
      recordEsistente: { stato: 'in_corso', dataInizio: '2026-01-10', coltura: 'Vite' },
      isNuovo: false
    });
    expect(esito.coltura).toBe('Vite');
  });

  it('terreno senza coltura: il campo resta libero', () => {
    const esito = risolviColturaDaTerreno({
      terreno: { stato: 'attivo' },
      colturaForm: 'Grano',
      isNuovo: true
    });
    expect(esito.libera).toBe(true);
    expect(esito.coltura).toBe('Grano');
  });
});

describe('tendina frutteto', () => {
  const terreni = [
    { id: 'vite', nome: 'Vigna', coltura: 'Vite', stato: 'attivo' },
    { id: 'grano', nome: 'Campo grano', coltura: 'Grano', stato: 'attivo' },
    { id: 'melo', nome: 'Meleto', coltura: 'Melo', stato: 'attivo' },
    { id: 'vecchio', nome: 'Vecchio melo', coltura: 'Melo', stato: 'archiviato' }
  ];

  it('non contiene vite né grano, e in modifica tiene il terreno corrente', () => {
    const nuovo = terreniPerTendina(terreni, { filtro: isTerrenoFrutteto });
    expect(nuovo.map((t) => t.id)).toEqual(['melo']);
    const modifica = terreniPerTendina(terreni, { filtro: isTerrenoFrutteto, idCorrente: 'vite' });
    expect(modifica.map((t) => t.id)).toEqual(['vite', 'melo']);
  });
});

describe('effetti del salvataggio terreno', () => {
  const oggi = new Date('2026-11-03T12:00:00');

  it('categoria vuota e coltura invariata non propone la chiusura', () => {
    expect(testoCategoriaColtura({
      value: '',
      selectedOptions: [{ textContent: '-- Seleziona categoria --' }]
    })).toBeNull();
    const effetti = preparaEffettiSalvataggioTerreno({
      esistente: { coltura: 'Vite', colturaCategoria: 'Vite', superficie: 2 },
      nuovo: { coltura: 'Vite', colturaCategoria: null, superficie: 2 },
      vigneti: [{ id: 'v1', nome: 'Sangiovese', statoImpianto: 'attivo' }],
      conferma: () => {
        throw new Error('non doveva chiedere di chiudere');
      },
      oggi
    });
    expect(effetti.procedi).toBe(true);
    expect(effetti.chiudi).toEqual([]);
  });

  it('cambio coltura con vigneto attivo chiede conferma e lo chiude', () => {
    const effetti = preparaEffettiSalvataggioTerreno({
      esistente: { coltura: 'Vite', colturaCategoria: 'vite', superficie: 2 },
      nuovo: { coltura: 'Melo', colturaCategoria: 'frutteto', superficie: 2 },
      vigneti: [{ id: 'v1', nome: 'Sangiovese', statoImpianto: 'attivo' }],
      frutteti: [],
      lavori: [],
      campagne: [],
      conferma: (messaggio) => {
        expect(messaggio).toMatch(/chiud/i);
        return true;
      },
      now: '2026-11-03T12:00:00.000Z',
      oggi
    });
    expect(effetti.procedi).toBe(true);
    expect(effetti.chiudi).toEqual([expect.objectContaining({ id: 'v1', tipo: 'vigneto' })]);
    expect(effetti.storico.storicoColture[0].coltura).toBe('Vite');
    expect(effetti.storico.colturaDal).toBe('2026-11-03T12:00:00.000Z');
  });

  it('con lavori aperti il messaggio li elenca e il salvataggio procede se si conferma', () => {
    let visto = '';
    const effetti = preparaEffettiSalvataggioTerreno({
      esistente: { coltura: 'Vite', superficie: 1 },
      nuovo: { coltura: 'Melo', superficie: 1 },
      vigneti: [{ id: 'v1', nome: 'Vigna', statoImpianto: 'attivo' }],
      lavori: [{ id: 'l1', nome: 'Potatura', stato: 'in_corso', dataInizio: '2026-03-02' }],
      conferma: (messaggio) => { visto = messaggio; return true; },
      now: '2026-11-03',
      oggi
    });
    expect(effetti.procedi).toBe(true);
    expect(visto).toMatch(/Potatura/);
    expect(visto).toMatch(/02\/03/);
  });

  it('senza lavori aperti l\'avviso sui lavori non c\'è', () => {
    let visto = '';
    preparaEffettiSalvataggioTerreno({
      esistente: { coltura: 'Vite', superficie: 1 },
      nuovo: { coltura: 'Melo', superficie: 1 },
      vigneti: [{ id: 'v1', nome: 'Vigna', statoImpianto: 'attivo' }],
      lavori: [],
      conferma: (messaggio) => { visto = messaggio; return true; },
      now: '2026-11-03',
      oggi
    });
    expect(visto).not.toMatch(/lavori ancora aperti/i);
  });

  it('superficie: aggiorna il vigneto attivo, non il chiuso e non la campagna passata', () => {
    const effetti = preparaEffettiSalvataggioTerreno({
      esistente: { coltura: 'Vite', superficie: 2 },
      nuovo: { coltura: 'Vite', superficie: 3 },
      vigneti: [
        { id: 'aperto', nome: 'Sangiovese', statoImpianto: 'attivo' },
        { id: 'chiuso', nome: 'Vecchio', statoImpianto: 'chiuso' }
      ],
      campagne: [
        { id: 'passata', campagna: '2024/2025' },
        { id: 'corrente', campagna: '2026/2027' }
      ],
      conferma: () => true,
      oggi
    });
    expect(effetti.superfici.map((s) => s.id).sort()).toEqual(['aperto', 'corrente']);
    expect(effetti.messaggioSuperficie).toMatch(/Sangiovese/);
  });

  it('superficie invariata non scrive nulla', () => {
    expect(superficieCambiata(2, 2)).toBe(false);
    expect(superficieCambiata(2, null)).toBe(false);
    const effetti = preparaEffettiSalvataggioTerreno({
      esistente: { coltura: 'Vite', superficie: 2 },
      nuovo: { coltura: 'Vite', superficie: 2 },
      vigneti: [{ id: 'aperto', nome: 'Sangiovese', statoImpianto: 'attivo' }],
      conferma: () => true,
      oggi
    });
    expect(effetti.superfici).toEqual([]);
  });
});
