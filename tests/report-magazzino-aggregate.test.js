/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  filterUsciteMagazzinoPerEconomici,
  prodottoCostFromMovimentoUscita,
  sumNullable,
  euro
} from '../modules/report/services/report-economici-aggregate.js';
import {
  assembleMagazzinoReport,
  classifyUscitaOrigine,
  valoreUscitaFromMovimento,
  valoreEntrataFromMovimento,
  valoreGiacenzaProdotto,
  totaleUsciteComeEconomici,
  quotaUsciteEscluseDaEconomici,
  notesUsciteVsEconomici,
  filterProdottiVisibiliTabella,
  aggregateProdottiUsciteForChart,
  prepareMagazzinoExportData,
  labelOrigineUscita
} from '../modules/report/services/report-magazzino-aggregate.js';

describe('Report Magazzino — aggregazione', () => {
  const prodotti = [
    { id: 'p1', nome: 'Rame', categoria: 'fitofarmaci', unitaMisura: 'kg', prezzoUnitario: 10, giacenza: 50, scortaMinima: 20, attivo: true },
    { id: 'p2', nome: 'Gasolio', categoria: 'carburante', unitaMisura: 'L', prezzoUnitario: 1.5, giacenza: 100, scortaMinima: 200, attivo: true },
    { id: 'p3', nome: 'Senza prezzo', categoria: 'altro', unitaMisura: 'kg', prezzoUnitario: null, giacenza: 5, scortaMinima: 0, attivo: true }
  ];

  it('classifica origine uscite', () => {
    expect(classifyUscitaOrigine({ origineTrattamentoId: 't1' })).toBe('trattamento');
    expect(classifyUscitaOrigine({ origineCarburante: 'pieno' })).toBe('carburante');
    expect(classifyUscitaOrigine({})).toBe('manuale');
    expect(labelOrigineUscita('manuale')).toMatch(/manuale/i);
  });

  it('valore entrata: prezzo movimento o anagrafica; mai 0 silenzioso', () => {
    expect(valoreEntrataFromMovimento(
      { quantita: 2, prezzoUnitario: 5 },
      { prezzoUnitario: 9 }
    ).valore).toBe(10);
    expect(valoreEntrataFromMovimento(
      { quantita: 2, prezzoUnitario: null },
      { prezzoUnitario: 9 }
    ).valore).toBe(18);
    const miss = valoreEntrataFromMovimento({ quantita: 2, prezzoUnitario: null }, { prezzoUnitario: null });
    expect(miss.valore).toBeNull();
    expect(miss.missing).toBe(true);
  });

  it('valore uscita riusa prodottoCostFromMovimentoUscita', () => {
    const mov = { quantita: 4, prezzoUnitario: 3, tipo: 'uscita' };
    const anag = { prezzoUnitario: 99, categoria: 'fitofarmaci', nome: 'X' };
    const eco = prodottoCostFromMovimentoUscita(mov, anag);
    const mag = valoreUscitaFromMovimento(mov, anag);
    expect(mag.valore).toBe(euro((eco.costoProdotti || 0) + (eco.costoCarburante || 0)));
    expect(mag.missing).toBe(false);
  });

  it('uscite che Economici conta: stesso totale sulle due pagine', () => {
    const movimenti = [
      { id: 'm1', tipo: 'uscita', quantita: 2, prezzoUnitario: 10, prodottoId: 'p1' },
      { id: 'm2', tipo: 'uscita', quantita: 3, prezzoUnitario: 4, prodottoId: 'p1', origineTrattamentoId: 'tr1' },
      { id: 'm3', tipo: 'uscita', quantita: 5, prezzoUnitario: 1.5, prodottoId: 'p2', origineCarburante: 'pieno' },
      { id: 'm4', tipo: 'uscita', quantita: 1, prezzoUnitario: null, prodottoId: 'p3' },
      { id: 'm5', tipo: 'entrata', quantita: 10, prezzoUnitario: 2, prodottoId: 'p1' }
    ];
    const prodottiById = new Map(prodotti.map((p) => [p.id, p]));

    const usciteEco = filterUsciteMagazzinoPerEconomici(movimenti, []);
    const totEco = sumNullable(usciteEco.map((m) => {
      const p = prodottoCostFromMovimentoUscita(m, prodottiById.get(String(m.prodottoId)));
      if (p.missingProdotti || p.missingCarburante) return null;
      return euro((p.costoProdotti || 0) + (p.costoCarburante || 0));
    }));

    const totMag = totaleUsciteComeEconomici(movimenti, prodottiById, []);
    expect(totMag).toEqual(totEco);
    // solo m1 (manuale senza trattamento/carburante); m4 missing → partial
    expect(totEco.value).toBe(20);
    expect(totEco.partial).toBe(true);
  });

  it('totale uscite Magazzino = Economici + quota esclusa (pieni + trattamenti)', () => {
    const movimenti = [
      { id: 'm1', tipo: 'uscita', quantita: 2, prezzoUnitario: 10, prodottoId: 'p1' }, // 20 eco
      { id: 'm2', tipo: 'uscita', quantita: 3, prezzoUnitario: 4, prodottoId: 'p1', origineTrattamentoId: 'tr1' }, // 12
      { id: 'm3', tipo: 'uscita', quantita: 5, prezzoUnitario: 1.5, prodottoId: 'p2', origineCarburante: 'pieno' } // 7.5
    ];
    const prodottiById = new Map(prodotti.map((p) => [p.id, p]));
    const report = assembleMagazzinoReport({ prodotti, movimenti });
    const eco = totaleUsciteComeEconomici(movimenti, prodottiById, []);
    const quota = quotaUsciteEscluseDaEconomici(movimenti, prodottiById);

    expect(quota.carburante).toBe(7.5);
    expect(quota.trattamento).toBe(12);
    expect(eco.value).toBe(20);
    expect(report.kpi.valoreUscite).toBe(euro(20 + 12 + 7.5));
    expect(report.kpi.valoreUscite).toBe(
      euro((eco.value || 0) + (quota.carburante || 0) + (quota.trattamento || 0))
    );
    expect(report.kpi.usciteEscluseEconomici).toEqual(quota);

    const notes = notesUsciteVsEconomici(quota);
    expect(notes.some((n) => /pieni carburante non conteggiati in Economici/.test(n))).toBe(true);
    expect(notes.some((n) => /trattamenti conteggiati a parte in Economici/.test(n))).toBe(true);
    expect(report.notes).toEqual(expect.arrayContaining(notes));
  });

  it('Excel Per prodotto: stesse righe della tabella pagina (niente solo-giacenza)', () => {
    const prodottiExtra = [
      ...prodotti,
      // KARATE: giacenza > 0, non sotto scorta, zero movimenti → non in tabella
      {
        id: 'p-karate',
        nome: 'KARATE',
        categoria: 'fitofarmaci',
        unitaMisura: 'L',
        prezzoUnitario: 40,
        giacenza: 3,
        scortaMinima: 0,
        attivo: true
      }
    ];
    const report = assembleMagazzinoReport({
      prodotti: prodottiExtra,
      movimenti: [
        { id: 'u1', tipo: 'uscita', data: '2026-02-01', quantita: 2, prezzoUnitario: 10, prodottoId: 'p1' }
      ]
    });
    // byProdotto include KARATE (giacenza !== 0); la tabella no
    expect(report.byProdotto.some((r) => r.nome === 'KARATE')).toBe(true);
    const visible = filterProdottiVisibiliTabella(report.byProdotto);
    expect(visible.some((r) => r.nome === 'KARATE')).toBe(false);
    expect(visible.every((r) => r.nMovimenti > 0 || r.sottoScorta || r.giacenzaNegativa)).toBe(true);

    const exp = prepareMagazzinoExportData(report);
    expect(exp.perProdotto.map((r) => r.nome).sort()).toEqual(
      visible.map((r) => r.nome).sort()
    );
    expect(exp.perProdotto.some((r) => r.nome === 'KARATE')).toBe(false);
  });

  it('giacenza: sotto scorta e prezzo mancante', () => {
    const g = valoreGiacenzaProdotto(prodotti[1]);
    expect(g.sottoScorta).toBe(true);
    expect(g.valore).toBe(150);
    const miss = valoreGiacenzaProdotto(prodotti[2]);
    expect(miss.valore).toBeNull();
    expect(miss.missing).toBe(true);
  });

  it('assembla KPI, grafici e export coerenti', () => {
    const report = assembleMagazzinoReport({
      prodotti,
      movimenti: [
        { id: 'e1', tipo: 'entrata', data: '2026-01-10', quantita: 10, prezzoUnitario: 8, prodottoId: 'p1' },
        { id: 'u1', tipo: 'uscita', data: '2026-02-01', quantita: 2, prezzoUnitario: 10, prodottoId: 'p1' },
        { id: 'u2', tipo: 'uscita', data: '2026-02-15', quantita: 20, prezzoUnitario: 1.5, prodottoId: 'p2', origineCarburante: 'pieno', macchinaId: 'mac1' },
        { id: 'u3', tipo: 'uscita', data: '2026-03-01', quantita: 1, prezzoUnitario: null, prodottoId: 'p3' }
      ]
    });
    expect(report.ready).toBe(true);
    expect(report.kpi.valoreEntrate).toBe(80);
    expect(report.kpi.valoreUscite).toBe(50); // 20 + 30; p3 missing → partial
    expect(report.kpi.partialUscite).toBe(true);
    expect(report.kpi.prodottiSottoScorta).toBeGreaterThanOrEqual(1);
    expect(report.chartTopProdotti.some((r) => r.nome === 'Gasolio' || r.nome === 'Rame')).toBe(true);
    const chart = aggregateProdottiUsciteForChart(report.byProdotto, 1);
    expect(chart.some((r) => r.nome === 'Altri')).toBe(true);

    const exp = prepareMagazzinoExportData(report);
    expect(exp.kpi.valoreEntrate).toBe(report.kpi.valoreEntrate);
    expect(exp.perProdotto.length).toBe(report.byProdotto.length);
    expect(exp.movimenti.length).toBe(report.movimenti.length);
  });
});
