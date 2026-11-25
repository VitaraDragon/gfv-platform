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
  assembleContoTerziReport,
  ricavoFromPreventivoAccettato,
  findPreventivoAccettatoForLavoro,
  isPreventivoAccettato,
  combineCostiLavoro,
  aggregateRicaviClientiForChart,
  prepareContoTerziExportData,
  enrichLavoroCt
} from '../modules/report/services/report-conto-terzi-aggregate.js';

describe('Report Conto terzi — aggregazione', () => {
  const clienti = [
    { id: 'c1', ragioneSociale: 'Rossi Agricoltura' },
    { id: 'c2', ragioneSociale: 'Bianchi Srl' },
    { id: 'c3', ragioneSociale: 'Verdi Coop' }
  ];
  const terreni = [
    { id: 't1', nome: 'Campo Nord', superficie: 4, clienteId: 'c1' },
    { id: 't2', nome: 'Campo Sud', superficie: 2, clienteId: 'c2' }
  ];

  it('lavoro con preventivo accettato: ricavo = totale senza IVA', () => {
    const prev = {
      id: 'p1',
      numero: 'PREV-1',
      clienteId: 'c1',
      lavoroId: 'l1',
      stato: 'accettato_manager',
      totale: 1000,
      totaleConIva: 1220,
      superficie: 4,
      tipoLavoro: 'Aratura'
    };
    const info = ricavoFromPreventivoAccettato(prev);
    expect(info.ricavo).toBe(1000);
    expect(info.senzaPreventivo).toBe(false);
    expect(isPreventivoAccettato('pianificato')).toBe(true);

    const report = assembleContoTerziReport({
      clienti,
      terreni,
      preventivi: [prev],
      lavori: [{
        id: 'l1',
        clienteId: 'c1',
        terrenoId: 't1',
        tipoLavoro: 'Aratura',
        dataInizio: '2026-03-01',
        preventivoId: 'p1',
        superficieTotaleLavorata: 4,
        stato: 'completato'
      }],
      costiByLavoroId: new Map([
        ['l1', {
          ore: 10,
          costoManodopera: 100,
          missingManodopera: false,
          costoMacchine: 50,
          missingMacchine: false
        }]
      ]),
      movimenti: [],
      prodotti: []
    });
    expect(report.lavori[0].ricavo).toBe(1000);
    expect(report.lavori[0].costo).toBe(150);
    expect(report.lavori[0].margine).toBe(850);
    expect(report.kpi.ricavi).toBe(1000);
  });

  it('lavoro senza preventivo: ricavo null e *', () => {
    const report = assembleContoTerziReport({
      clienti,
      terreni,
      preventivi: [],
      lavori: [{
        id: 'l2',
        clienteId: 'c1',
        terrenoId: 't1',
        tipoLavoro: 'Potatura',
        dataInizio: '2026-04-01',
        stato: 'completato'
      }],
      costiByLavoroId: {
        l2: {
          ore: 5,
          costoManodopera: 50,
          missingManodopera: false,
          costoMacchine: 0,
          missingMacchine: false
        }
      }
    });
    expect(report.lavori[0].ricavo).toBeNull();
    expect(report.lavori[0].senzaPreventivo).toBe(true);
    expect(report.kpi.ricavi).toBeNull();
    expect(report.byCliente[0].partialRicavi || report.byCliente[0].ricavi == null).toBe(true);
    expect(report.notes.some((n) => /senza preventivo/i.test(n))).toBe(true);
  });

  it('preventivo rifiutato non conta come ricavo', () => {
    const rifiutato = {
      id: 'p-r',
      numero: 'PREV-R',
      clienteId: 'c1',
      lavoroId: 'l3',
      stato: 'rifiutato',
      totale: 999,
      tipoLavoro: 'Aratura'
    };
    expect(findPreventivoAccettatoForLavoro([rifiutato], {
      id: 'l3',
      preventivoId: 'p-r'
    })).toBeNull();

    const report = assembleContoTerziReport({
      clienti,
      terreni,
      preventivi: [rifiutato],
      lavori: [{
        id: 'l3',
        clienteId: 'c1',
        terrenoId: 't1',
        tipoLavoro: 'Aratura',
        dataInizio: '2026-05-01',
        preventivoId: 'p-r',
        stato: 'completato'
      }],
      costiByLavoroId: {
        l3: { ore: 1, costoManodopera: 10, missingManodopera: false, costoMacchine: 0, missingMacchine: false }
      }
    });
    expect(report.lavori[0].ricavo).toBeNull();
    expect(report.lavori[0].senzaPreventivo).toBe(true);
    expect(report.kpi.preventiviRifiutatiOScaduti).toBe(1);
    expect(report.kpi.preventiviAccettati).toBe(0);
  });

  it('costo orario mancante → — / * (partial o null)', () => {
    const onlyMissing = combineCostiLavoro({
      costoManodopera: null,
      missingManodopera: true,
      costoMacchine: null,
      missingMacchine: true,
      costoProdotti: null,
      missingProdotti: true
    });
    expect(onlyMissing.value).toBeNull();

    const partial = combineCostiLavoro({
      costoManodopera: 10,
      missingManodopera: false,
      costoMacchine: null,
      missingMacchine: true,
      costoProdotti: 5,
      missingProdotti: false
    });
    expect(partial.partial).toBe(true);
    expect(partial.value).toBe(15);

    const row = enrichLavoroCt({
      id: 'l4',
      clienteId: 'c1',
      terrenoId: 't1',
      tipoLavoro: 'Aratura',
      dataInizio: '2026-06-01'
    }, {
      clientiById: new Map([['c1', clienti[0]]]),
      terrenoById: new Map([['t1', terreni[0]]]),
      preventivi: [{
        id: 'p4', lavoroId: 'l4', stato: 'accettato_email', totale: 200, numero: 'P4'
      }],
      costi: {
        ore: 3,
        costoManodopera: null,
        missingManodopera: true,
        costoMacchine: 20,
        missingMacchine: false,
        costoProdotti: 0,
        missingProdotti: false
      }
    });
    expect(row.costo).toBe(20);
    expect(row.partialCosto).toBe(true);
    expect(row.missingManodopera).toBe(true);
    expect(row.ricavo).toBe(200);
  });

  it('«Altri» in grigio e colori unici per i primi clienti', () => {
    const byCliente = Array.from({ length: 9 }, (_, i) => ({
      clienteId: `c${i}`,
      clienteNome: `Cliente ${i}`,
      ricavi: 1000 - i * 10,
      partialRicavi: false,
      nLavori: 1
    }));
    const chart = aggregateRicaviClientiForChart(byCliente, 7);
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

  it('preventivo su due lavori con ettari: quote proporzionali, somma = totale, KPI = somma preventivi distinti', () => {
    const prevShared = {
      id: 'p-shared',
      numero: 'PREV-2026-005',
      clienteId: 'c1',
      stato: 'pianificato',
      totale: 210.7,
      superficie: 4.21,
      tipoLavoro: 'Aratura'
    };
    const prevOther = {
      id: 'p-other',
      numero: 'PREV-2026-003',
      clienteId: 'c1',
      stato: 'accettato_manager',
      totale: 330,
      superficie: 2,
      tipoLavoro: 'Potatura'
    };
    const report = assembleContoTerziReport({
      clienti,
      terreni,
      preventivi: [prevShared, prevOther],
      lavori: [
        {
          id: 'l-a',
          clienteId: 'c1',
          terrenoId: 't1',
          tipoLavoro: 'Aratura',
          dataInizio: '2025-10-12',
          preventivoId: 'p-shared',
          superficieTotaleLavorata: 1.2,
          stato: 'completato'
        },
        {
          id: 'l-b',
          clienteId: 'c1',
          terrenoId: 't1',
          tipoLavoro: 'Aratura',
          dataInizio: '2025-10-20',
          preventivoId: 'p-shared',
          superficieTotaleLavorata: 3.01,
          stato: 'completato'
        },
        {
          id: 'l-c',
          clienteId: 'c1',
          terrenoId: 't1',
          tipoLavoro: 'Potatura',
          dataInizio: '2025-11-01',
          preventivoId: 'p-other',
          superficieTotaleLavorata: 2,
          stato: 'completato'
        }
      ],
      costiByLavoroId: {
        'l-a': { ore: 0, costoManodopera: 0, missingManodopera: false, costoMacchine: 0, missingMacchine: false },
        'l-b': { ore: 2, costoManodopera: 20, missingManodopera: false, costoMacchine: 10, missingMacchine: false },
        'l-c': { ore: 4, costoManodopera: 40, missingManodopera: false, costoMacchine: 0, missingMacchine: false }
      }
    });

    const sharedRows = report.lavori
      .filter((l) => l.preventivoId === 'p-shared')
      .sort((a, b) => String(a.dataIso).localeCompare(String(b.dataIso)));
    expect(sharedRows).toHaveLength(2);
    expect(sharedRows[0].ricavo + sharedRows[1].ricavo).toBe(210.7);
    // 1.2 / 4.21 * 210.70 → primo (per data); resto sull'ultimo
    expect(sharedRows[0].ricavo).toBe(60.06);
    expect(sharedRows[1].ricavo).toBe(150.64);
    expect(sharedRows[0].ettari).toBe(1.2);
    expect(sharedRows[1].ettari).toBe(3.01);
    expect(sharedRows[0].preventivoRifLabel).toMatch(/quota di PREV-2026-005 \(2 lavori\)/);
    expect(sharedRows[0].preventivoStato).toBe('pianificato');
    expect(report.kpi.ricavi).toBe(540.7);
    expect(report.notes.some((n) => /ripartito in quota/i.test(n))).toBe(true);

    const exp = prepareContoTerziExportData(report);
    const expShared = exp.lavori.filter((l) => /quota di PREV-2026-005/.test(l.preventivo));
    expect(expShared).toHaveLength(2);
    expect(expShared[0].statoPreventivo).toBe('Pianificato');
    for (const l of exp.lavori) {
      expect(l.ettari).toBe(Math.round(Number(l.ettari) * 100) / 100);
    }
  });

  it('preventivo su due lavori senza ettari: divisione a metà', () => {
    const prev = {
      id: 'p-eq',
      numero: 'PREV-EQ',
      clienteId: 'c1',
      stato: 'accettato_email',
      totale: 210.7,
      tipoLavoro: 'Aratura'
    };
    const report = assembleContoTerziReport({
      clienti,
      terreni: [{ id: 't0', nome: 'Senza ha', superficie: 0, clienteId: 'c1' }],
      preventivi: [prev],
      lavori: [
        {
          id: 'l-x',
          clienteId: 'c1',
          terrenoId: 't0',
          tipoLavoro: 'Aratura',
          dataInizio: '2026-01-01',
          preventivoId: 'p-eq',
          stato: 'completato'
        },
        {
          id: 'l-y',
          clienteId: 'c1',
          terrenoId: 't0',
          tipoLavoro: 'Aratura',
          dataInizio: '2026-01-02',
          preventivoId: 'p-eq',
          stato: 'completato'
        }
      ],
      costiByLavoroId: {
        'l-x': { ore: 0, costoManodopera: 0, missingManodopera: false, costoMacchine: 0, missingMacchine: false },
        'l-y': { ore: 0, costoManodopera: 0, missingManodopera: false, costoMacchine: 0, missingMacchine: false }
      }
    });
    const rows = report.lavori.sort((a, b) => String(a.dataIso).localeCompare(String(b.dataIso)));
    expect(rows[0].ricavo + rows[1].ricavo).toBe(210.7);
    expect(rows[0].ricavo).toBe(105.35);
    expect(rows[1].ricavo).toBe(105.35);
    expect(report.kpi.ricavi).toBe(210.7);
  });

  it('export uguale alla tabella per cliente / lavori', () => {
    const report = assembleContoTerziReport({
      clienti,
      terreni,
      preventivi: [
        {
          id: 'p1', numero: 'PREV-1', clienteId: 'c1', lavoroId: 'l1',
          stato: 'pianificato', totale: 500, superficie: 4, tipoLavoro: 'Aratura',
          dataInvio: '2026-02-01'
        },
        {
          id: 'p2', numero: 'PREV-2', clienteId: 'c2', lavoroId: 'l5',
          stato: 'accettato_manager', totale: 300, superficie: 2, tipoLavoro: 'Potatura',
          dataInvio: '2026-02-10'
        }
      ],
      lavori: [
        {
          id: 'l1', clienteId: 'c1', terrenoId: 't1', tipoLavoro: 'Aratura',
          dataInizio: '2026-03-01', preventivoId: 'p1', superficieTotaleLavorata: 4, stato: 'completato'
        },
        {
          id: 'l5', clienteId: 'c2', terrenoId: 't2', tipoLavoro: 'Potatura',
          dataInizio: '2026-03-15', preventivoId: 'p2', superficieTotaleLavorata: 2, stato: 'completato'
        }
      ],
      costiByLavoroId: {
        l1: { ore: 8, costoManodopera: 80, missingManodopera: false, costoMacchine: 40, missingMacchine: false },
        l5: { ore: 4, costoManodopera: 40, missingManodopera: false, costoMacchine: 10, missingMacchine: false }
      }
    });

    const exp = prepareContoTerziExportData(report);
    expect(exp.kpi.annotazione).toBe('Ricavi senza IVA');
    expect(exp.perCliente.map((r) => r.cliente).sort()).toEqual(
      report.byCliente.map((r) => r.clienteNome).sort()
    );
    expect(exp.perCliente.length).toBe(report.byCliente.length);
    expect(exp.lavori.length).toBe(report.lavori.length);
    expect(exp.lavori.map((r) => r.ricavo).sort()).toEqual(
      report.lavori.map((r) => r.ricavo).sort()
    );
    expect(exp.kpi.ricavi).toBe(report.kpi.ricavi);
    expect(exp.kpi.nClienti).toBe(2);
  });
});
