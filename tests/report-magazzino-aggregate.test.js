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
