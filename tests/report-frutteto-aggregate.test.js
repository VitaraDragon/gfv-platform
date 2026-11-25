/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  chartColorsForItems,
  readReportChartColors,
  isAltriLabel
} from '../modules/report/js/report-chart-colors.js';
import {
  assembleFruttetoReport,
  ricavoFromRaccolta,
  resaQHa,
  scartoPct,
  kgToQ,
  combineSpeseFrutteto,
  aggregateProduzioneForChart,
  prepareFruttetoExportData,
  enrichRaccolta
} from '../modules/report/services/report-frutteto-aggregate.js';

describe('Report Frutteto — aggregazione', () => {
  const frutteti = [
    { id: 'f1', nome: 'Melo Nord', specie: 'Melo', varieta: 'Golden', superficieEttari: 2 },
    { id: 'f2', nome: 'Pesco Sud', specie: 'Pesco', varieta: 'Redhaven', superficieEttari: 1 },
    { id: 'f3', nome: 'Pero Est', specie: 'Pero', varieta: 'Abate', superficieEttari: 3 }
  ];

  it('resa e scarto corretti (q/ha e % sul raccolto)', () => {
    expect(kgToQ(250)).toBe(2.5);
    expect(resaQHa(2000, 2)).toBe(10); // 20 q / 2 ha = 10 q/ha
    expect(scartoPct(50, 1000)).toBe(5);

    const r = enrichRaccolta({
      id: 'r1',
      fruttetoId: 'f1',
      data: '2026-09-01',
      specie: 'Melo',
      varieta: 'Golden',
      quantitaKg: 2000,
      quantitaEttari: 2,
      scartoTotaleKg: 100,
      prezzoVendita: 1.5,
      ricavo: 3000
    }, { fruttetoNome: 'Melo Nord' });
    expect(r.quantitaQ).toBe(20);
    expect(r.scartoPct).toBe(5);
    expect(r.resaQHa).toBe(10);
  });

  it('raccolta senza prezzo → ricavo null e *', () => {
    const info = ricavoFromRaccolta({
      quantitaKg: 100,
      prezzoVendita: null,
      ricavo: 0
    });
    expect(info.ricavo).toBeNull();
    expect(info.senzaPrezzo).toBe(true);

    const report = assembleFruttetoReport({
      frutteti,
      raccolte: [{
        id: 'r2',
        fruttetoId: 'f1',
        data: '2026-09-10',
        specie: 'Melo',
        varieta: 'Golden',
        quantitaKg: 500,
        quantitaEttari: 1,
        scartoTotaleKg: 0,
        ricavo: 0
      }],
      speseByFruttetoId: {
        f1: { costoTotale: 200, speseManodopera: 100, speseMacchine: 50, speseProdotti: 50 }
      }
    });
    expect(report.raccolte[0].ricavo).toBeNull();
    expect(report.raccolte[0].senzaPrezzo).toBe(true);
    expect(report.kpi.ricavi).toBeNull();
    expect(report.byFrutteto[0].partialRicavi || report.byFrutteto[0].ricavi == null).toBe(true);
    expect(report.byFrutteto[0].margine).toBeNull();
    expect(report.notes.some((n) => /senza prezzo/i.test(n))).toBe(true);
  });

  it('costo orario mancante → — / * (partial o null)', () => {
    const onlyMissing = combineSpeseFrutteto({
      speseManodopera: null,
      missingManodopera: true,
      speseMacchine: null,
      missingMacchine: true,
      speseProdotti: null,
      missingProdotti: true
    });
    expect(onlyMissing.value).toBeNull();

    const partial = combineSpeseFrutteto({
      costoTotale: 150,
      speseManodopera: 100,
      speseMacchine: null,
      missingMacchine: true,
      speseProdotti: 50,
      partial: true
    });
    expect(partial.partial).toBe(true);
    expect(partial.value).toBe(150);

    const report = assembleFruttetoReport({
      frutteti,
      raccolte: [{
        id: 'r3',
        fruttetoId: 'f1',
        data: '2026-08-01',
        specie: 'Melo',
        varieta: 'Golden',
        quantitaKg: 1000,
        quantitaEttari: 1,
        prezzoVendita: 2,
        ricavo: 2000
      }],
      speseByFruttetoId: {
        f1: {
          costoTotale: 150,
          speseManodopera: 100,
          speseMacchine: null,
          missingMacchine: true,
          speseProdotti: 50,
          partial: true
        }
      }
    });
    expect(report.byFrutteto[0].costi).toBe(150);
    expect(report.byFrutteto[0].partialCosti).toBe(true);
    expect(report.byFrutteto[0].margine).toBeNull();
    expect(report.kpi.partialCosti).toBe(true);
    expect(report.notes.some((n) => /costi orari mancano/i.test(n))).toBe(true);
  });

  it('totali costi uguali all’aggregazione del modulo Frutteto', () => {
    // Simula output di aggregaSpeseFruttetoAnno passato al report
    const speseModulo = {
      f1: {
        costoTotale: 1234.56,
        speseManodopera: 800,
        speseMacchine: 200,
        speseProdotti: 234.56,
        spesePotatura: 100,
        speseTrattamenti: 50,
        speseRaccolta: 650
      },
      f2: {
        costoTotale: 400,
        speseManodopera: 250,
        speseMacchine: 100,
        speseProdotti: 50
      }
    };
    const report = assembleFruttetoReport({
      frutteti,
      raccolte: [
        {
          id: 'a', fruttetoId: 'f1', data: '2026-09-01', specie: 'Melo', varieta: 'Golden',
          quantitaKg: 1000, quantitaEttari: 1, prezzoVendita: 1, ricavo: 1000
        },
        {
          id: 'b', fruttetoId: 'f2', data: '2026-09-05', specie: 'Pesco', varieta: 'Redhaven',
          quantitaKg: 400, quantitaEttari: 0.5, prezzoVendita: 1.2, ricavo: 480
        }
      ],
      speseByFruttetoId: speseModulo
    });
    expect(report.byFrutteto.find((r) => r.fruttetoId === 'f1').costi).toBe(1234.56);
    expect(report.byFrutteto.find((r) => r.fruttetoId === 'f2').costi).toBe(400);
    expect(report.kpi.costi).toBe(1634.56);
  });

  it('«Altri» in grigio e colori unici per i primi frutteti', () => {
    const byFrutteto = Array.from({ length: 9 }, (_, i) => ({
      fruttetoId: `f${i}`,
      fruttetoNome: `Frutteto ${i}`,
      produzioneQ: 100 - i * 5,
      produzioneKg: (100 - i * 5) * 100
    }));
    const chart = aggregateProduzioneForChart(byFrutteto, [], { topN: 7 });
    expect(chart.length).toBe(8); // 7 + Altri
    expect(chart[chart.length - 1].nome).toBe('Altri');
    expect(isAltriLabel(chart[chart.length - 1].nome)).toBe(true);

    const colors = readReportChartColors(null);
    const cols = chartColorsForItems(chart, colors);
    expect(cols[cols.length - 1]).toBe(colors.altri);
    const named = cols.slice(0, -1);
    expect(new Set(named).size).toBe(named.length);
    expect(named.every((c) => c !== colors.altri)).toBe(true);
  });

  it('filtro su un frutteto: grafico per specie', () => {
    const report = assembleFruttetoReport({
      frutteti,
      raccolte: [
        {
          id: '1', fruttetoId: 'f1', data: '2026-09-01', specie: 'Melo', varieta: 'Golden',
          quantitaKg: 1000, quantitaEttari: 1, prezzoVendita: 1, ricavo: 1000
        },
        {
          id: '2', fruttetoId: 'f1', data: '2026-09-02', specie: 'Pero', varieta: 'Abate',
          quantitaKg: 500, quantitaEttari: 0.5, prezzoVendita: 1, ricavo: 500
        },
        {
          id: '3', fruttetoId: 'f2', data: '2026-09-03', specie: 'Pesco', varieta: 'Redhaven',
          quantitaKg: 800, quantitaEttari: 1, prezzoVendita: 1, ricavo: 800
        }
      ],
      speseByFruttetoId: {}
    }, { fruttetoId: 'f1' });
    expect(report.raccolte).toHaveLength(2);
    expect(report.chartProduzione.map((c) => c.nome).sort()).toEqual(['Melo', 'Pero']);
    expect(report.chartProduzione.find((c) => c.nome === 'Melo').valore).toBe(10);
  });

  it('export uguale alla tabella per frutteto / raccolte', () => {
    const report = assembleFruttetoReport({
      frutteti,
      raccolte: [
        {
          id: 'r1', fruttetoId: 'f1', data: '2026-09-01', specie: 'Melo', varieta: 'Golden',
          quantitaKg: 2000, quantitaEttari: 2, scartoTotaleKg: 40, calibro: 'A',
          prezzoVendita: 1.5, ricavo: 3000, costoTotale: 100
        },
        {
          id: 'r2', fruttetoId: 'f2', data: '2026-09-15', specie: 'Pesco', varieta: 'Redhaven',
          quantitaKg: 800, quantitaEttari: 1, scartoTotaleKg: 20,
          prezzoVendita: 2, ricavo: 1600, costoTotale: 50
        }
      ],
      speseByFruttetoId: {
        f1: { costoTotale: 500, speseManodopera: 300, speseMacchine: 100, speseProdotti: 100 },
        f2: { costoTotale: 200, speseManodopera: 120, speseMacchine: 40, speseProdotti: 40 }
      }
    });

    const exp = prepareFruttetoExportData(report);
    expect(exp.perFrutteto.map((r) => r.frutteto).sort()).toEqual(
      report.byFrutteto.map((r) => r.fruttetoNome).sort()
    );
    expect(exp.perFrutteto.length).toBe(report.byFrutteto.length);
    expect(exp.raccolte.length).toBe(report.raccolte.length);
    expect(exp.raccolte.map((r) => r.ricavo).sort()).toEqual(
      report.raccolte.map((r) => r.ricavo).sort()
    );
    expect(exp.kpi.produzioneQ).toBe(report.kpi.produzioneQ);
    expect(exp.kpi.costi).toBe(report.kpi.costi);
    expect(exp.kpi.nFrutteti).toBe(2);
    expect(exp.perFrutteto.find((r) => r.frutteto === 'Melo Nord').produzioneQ).toBe(20);
    expect(exp.perFrutteto.find((r) => r.frutteto === 'Melo Nord').resaQHa).toBe(10);
  });
});
