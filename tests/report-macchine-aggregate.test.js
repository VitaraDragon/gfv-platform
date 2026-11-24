/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateByMezzo,
  aggregateByTipoMezzo,
  aggregateCarburantePienoByMacchina,
  aggregateGuastiByMacchina,
  aggregateMacchineCostoForChart,
  aggregateMonthlyOreMacchina,
  assembleMacchineReport,
  buildMezzoDetailRows,
  ettariLavoratiFromLines,
  hasMacchineCostiDisponibili,
  labelTipoMezzo,
  prepareMacchineExportData,
  sumCostoMacchineLikeEconomici
} from '../modules/report/services/report-macchine-aggregate.js';

describe('Report Macchine — aggregazione', () => {
  const linesBase = [
    {
      macchinaId: 't1',
      nome: 'Fiat 80',
      tipoMezzo: 'trattore',
      ore: 8,
      costoOra: 40,
      costoOraMissing: false,
      costo: 320,
      terrenoId: 'campoA',
      terrenoNome: 'Campo A',
      ettari: 10,
      lavoroId: 'l1',
      dataIso: '2026-03-01',
      tipoLavoro: 'Aratura',
      operaioId: 'o1',
      operaioNome: 'Mario',
      origine: 'lavoro'
    },
    {
      macchinaId: 't1',
      nome: 'Fiat 80',
      tipoMezzo: 'trattore',
      ore: 4,
      costoOra: 40,
      costoOraMissing: false,
      costo: 160,
      terrenoId: 'campoA',
      terrenoNome: 'Campo A',
      ettari: 10,
      lavoroId: 'l2',
      dataIso: '2026-03-15',
      tipoLavoro: 'Erpicatura',
      operaioId: 'o1',
      operaioNome: 'Mario',
      origine: 'lavoro'
    },
    {
      macchinaId: 'a1',
      nome: 'Erpice',
      tipoMezzo: 'attrezzo',
      ore: 4,
      costoOra: null,
      costoOraMissing: true,
      costo: null,
      terrenoId: 'campoB',
      terrenoNome: 'Campo B',
      ettari: 5,
      lavoroId: 'l2',
      dataIso: '2026-03-15',
      tipoLavoro: 'Erpicatura',
      operaioId: 'o1',
      operaioNome: 'Mario',
      origine: 'lavoro'
    }
  ];

  it('aggrega per mezzo con badge costo mancante e €/ha', () => {
    const rows = aggregateByMezzo(linesBase);
    const fiat = rows.find((r) => r.macchinaId === 't1');
    const erpice = rows.find((r) => r.macchinaId === 'a1');
    expect(fiat.ore).toBe(12);
    expect(fiat.costo).toBe(480);
    // stesso terreno su 2 lavori → 10+10
    expect(fiat.ettari).toBe(20);
    expect(fiat.euroHa).toBe(24);
    expect(erpice.costo).toBe(null);
    expect(erpice.costoOraMissing).toBe(true);
    expect(erpice.euroHa).toBe(null);
  });

  it('ettari: ogni terreno una volta per lavoro', () => {
    expect(ettariLavoratiFromLines(linesBase.filter((l) => l.macchinaId === 't1'))).toBe(20);
  });

  it('ciambella trattori vs attrezzi', () => {
    const byTipo = aggregateByTipoMezzo(linesBase.filter((l) => !l.costoOraMissing));
    expect(byTipo.some((r) => r.tipo === 'trattore')).toBe(true);
    expect(labelTipoMezzo('attrezzo')).toBe('Attrezzo');
  });

  it('chart costo: top + Altri', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      macchinaId: `m${i}`,
      nome: `M${i}`,
      tipoMezzo: 'trattore',
      ore: 1,
      costoOra: 10,
      costoOraMissing: false,
      costo: (10 - i) * 10,
      terrenoId: 't',
      terrenoNome: 'T',
      ettari: 1,
      lavoroId: `l${i}`,
      dataIso: '2026-01-01',
      tipoLavoro: 'X',
      origine: 'lavoro'
    }));
    const chart = aggregateMacchineCostoForChart(aggregateByMezzo(many), 8);
    expect(chart).toHaveLength(9);
    expect(chart[8].nome).toBe('Altri');
  });

  it('mensile validate / da validare', () => {
    const monthly = aggregateMonthlyOreMacchina(
      [{ dataIso: '2026-03-01', ore: 5 }],
      [{ dataIso: '2026-03-02', ore: 2 }]
    );
    expect(monthly).toHaveLength(1);
    expect(monthly[0].oreValidate).toBe(5);
    expect(monthly[0].oreDaValidare).toBe(2);
  });

  it('carburante pieno: litri sempre; costo solo con prezzo', () => {
    const map = aggregateCarburantePienoByMacchina(
      [
        {
          id: 'm1',
          tipo: 'uscita',
          origineCarburante: 'pieno',
          macchinaId: 't1',
          quantita: 50,
          prezzoUnitario: 1.4,
          data: '2026-03-01',
          prodottoId: 'gas'
        },
        {
          id: 'm2',
          tipo: 'uscita',
          origineCarburante: 'pieno',
          macchinaId: 't1',
          quantita: 20,
          data: '2026-03-02',
          prodottoId: 'gas2'
        }
      ],
      new Map([
        ['gas', { nome: 'Gasolio', prezzoUnitario: 1.4, categoria: 'carburante' }],
        ['gas2', { nome: 'Gasolio', categoria: 'carburante' }]
      ])
    );
    const row = map.get('t1');
    expect(row.litri).toBe(70);
    expect(row.costo).toBe(70); // solo il pieno con prezzo (50*1.4)
    expect(row.costoMissing).toBe(true);
  });

  it('guasti: segnalati nel periodo + aperti', () => {
    const start = new Date('2026-03-01T00:00:00');
    const end = new Date('2026-03-31T23:59:59');
    const map = aggregateGuastiByMacchina(
      [
        {
          id: 'g1',
          macchinaId: 't1',
          componenteGuasto: 'trattore',
          stato: 'in-attesa',
          segnalatoIl: '2026-03-10',
          dettagli: 'Olio'
        },
        {
          id: 'g2',
          macchinaId: 't1',
          componenteGuasto: 'trattore',
          stato: 'risolto',
          segnalatoIl: '2026-03-12',
          dettagli: 'Filtro'
        },
        {
          id: 'g3',
          macchinaId: 't1',
          componenteGuasto: 'trattore',
          stato: 'in-attesa',
          segnalatoIl: '2025-01-01',
          dettagli: 'Vecchio aperto'
        }
      ],
      { start, end }
    );
    const row = map.get('t1');
    expect(row.segnalati).toBe(2);
    expect(row.aperti).toBe(2); // g1 + g3
  });

  it('assemble: guasti periodo arrivano nella tabella per mezzo', () => {
    const start = new Date('2026-03-01T00:00:00');
    const end = new Date('2026-03-31T23:59:59');
    const guastiByMacchinaId = aggregateGuastiByMacchina(
      [
        {
          id: 'g1',
          macchinaId: 't1',
          componenteGuasto: 'trattore',
          stato: 'risolto',
          segnalatoIl: '2026-03-10',
          dettagli: 'Olio'
        },
        {
          id: 'g2',
          macchinaId: 't1',
          componenteGuasto: 'trattore',
          stato: 'in-attesa',
          segnalatoIl: '2026-03-20',
          dettagli: 'Filtro'
        },
        {
          id: 'g3',
          macchinaId: 'a1',
          componenteGuasto: 'attrezzo',
          stato: 'risolto',
          segnalatoIl: '2026-03-05',
          dettagli: 'Dente'
        }
      ],
      { start, end }
    );
    const report = assembleMacchineReport({
      lines: linesBase,
      linesDaValidare: [],
      guastiByMacchinaId
    });
    const fiat = report.byMezzo.find((r) => r.macchinaId === 't1');
    const erpice = report.byMezzo.find((r) => r.macchinaId === 'a1');
    expect(fiat.guastiSegnalati).toBe(2);
    expect(fiat.guastiAperti).toBe(1);
    expect(erpice.guastiSegnalati).toBe(1);
    expect(erpice.guastiAperti).toBe(0);
    const exp = prepareMacchineExportData(report, { periodoLabel: '2026-03' });
    expect(exp.perMezzo.find((r) => r.nome === 'Fiat 80').guastiSegnalati).toBe(2);
  });

  it('hasMacchineCostiDisponibili: nessun costo → false (niente grafici a zero)', () => {
    const noCost = linesBase.map((l) => ({
      ...l,
      costoOra: null,
      costoOraMissing: true,
      costo: null
    }));
    const report = assembleMacchineReport({ lines: noCost, linesDaValidare: [] });
    expect(hasMacchineCostiDisponibili(report)).toBe(false);
    expect(hasMacchineCostiDisponibili(report.byMezzo)).toBe(false);
  });

  it('hasMacchineCostiDisponibili: costi parziali → true (grafici restano)', () => {
    const report = assembleMacchineReport({ lines: linesBase, linesDaValidare: [] });
    expect(hasMacchineCostiDisponibili(report)).toBe(true);
  });

  it('assemble: periodo vuoto e export tipo etichettato', () => {
    const empty = assembleMacchineReport({ lines: [], linesDaValidare: [] });
    expect(empty.empty).toBe(true);
    const report = assembleMacchineReport({ lines: linesBase, linesDaValidare: [] });
    expect(report.byMezzo.length).toBe(2);
    const exp = prepareMacchineExportData(report, { periodoLabel: '2026' });
    expect(exp.perMezzo[0].tipo).toBeTruthy();
    expect(exp.kpi.oreTotali).toBe(report.kpi.oreTotali);
  });

  it('dettaglio mezzo ordinato per data', () => {
    const detail = buildMezzoDetailRows(linesBase, 't1');
    expect(detail).toHaveLength(2);
    expect(detail[0].dataIso).toBe('2026-03-01');
  });

  it('sumCostoMacchineLikeEconomici: anti-doppio diario', () => {
    const tot = sumCostoMacchineLikeEconomici(
      [{
        terrenoId: 't1',
        dataIso: '2026-01-10',
        tipoLavoro: 'Aratura',
        costoMacchine: 100,
        missingMacchine: false
      }],
      [{
        terrenoId: 't1',
        dataIso: '2026-01-10',
        tipoLavoro: 'Aratura',
        costoMacchine: 50,
        missingMacchine: false
      }]
    );
    expect(tot.value).toBe(100);
  });
});
