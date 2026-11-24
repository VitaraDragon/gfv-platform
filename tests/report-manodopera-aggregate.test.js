/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateByCaposquadra,
  aggregateByOperaio,
  aggregateByTerreno,
  assembleManodoperaReport,
  buildChiaviLavoroDiario,
  buildManodoperaKpi,
  buildProprietarioLines,
  filterManodoperaLines,
  isManodoperaDataReady,
  prepareManodoperaExportData,
  sumCostoManodoperaLines,
  PROPRIETARIO_ID,
  PROPRIETARIO_NOME
} from '../modules/report/services/report-manodopera-aggregate.js';
import { chiaveLavoroDiario, euro } from '../modules/report/services/report-economici-aggregate.js';

describe('Report Manodopera — aggregazione', () => {
  const linesBase = [
    {
      operaioId: 'o1',
      nome: 'Mario Rossi',
      tipo: 'semplice',
      isProprietario: false,
      ore: 8,
      tariffa: 10,
      tariffaMissing: false,
      costo: 80,
      terrenoId: 't1',
      terrenoNome: 'Campo A',
      ettari: 10,
      lavoroId: 'l1',
      caposquadraId: 'c1',
      caposquadraNome: 'Capo Uno'
    },
    {
      operaioId: 'o1',
      nome: 'Mario Rossi',
      tipo: 'semplice',
      isProprietario: false,
      ore: 4,
      tariffa: 10,
      tariffaMissing: false,
      costo: 40,
      terrenoId: 't2',
      terrenoNome: 'Campo B',
      ettari: 5,
      lavoroId: 'l2',
      caposquadraId: 'c1',
      caposquadraNome: 'Capo Uno'
    },
    {
      operaioId: 'o2',
      nome: 'Luigi Bianchi',
      tipo: 'trattorista',
      isProprietario: false,
      ore: 6,
      tariffa: 15,
      tariffaMissing: false,
      costo: 90,
      terrenoId: 't1',
      terrenoNome: 'Campo A',
      ettari: 10,
      lavoroId: 'l1',
      caposquadraId: null,
      caposquadraNome: null
    },
    {
      operaioId: PROPRIETARIO_ID,
      nome: PROPRIETARIO_NOME,
      tipo: 'proprietario',
      isProprietario: true,
      ore: 3,
      tariffa: 15,
      tariffaMissing: false,
      costo: 45,
      terrenoId: 't1',
      terrenoNome: 'Campo A',
      ettari: 10,
      lavoroId: null,
      caposquadraId: null,
      caposquadraNome: null
    }
  ];

  it('aggrega per operaio con n. lavori e terreni', () => {
    const rows = aggregateByOperaio(linesBase);
    expect(rows).toHaveLength(3);
    const mario = rows.find((r) => r.operaioId === 'o1');
    expect(mario.ore).toBe(12);
    expect(mario.costo).toBe(120);
    expect(mario.nLavori).toBe(2);
    expect(mario.nTerreni).toBe(2);
    const prop = rows.find((r) => r.isProprietario);
    expect(prop.nome).toBe(PROPRIETARIO_NOME);
    expect(prop.ore).toBe(3);
    expect(prop.nLavori).toBeNull(); // «—» in UI, non «0 lavori»
  });

  it('ignora ore non validate a monte (solo linee validate in input)', () => {
    // Le non validate non devono arrivare come linee di costo: il service le conta a parte.
    const rows = aggregateByOperaio([
      ...linesBase,
      // se per errore arrivasse una linea "fantasma" a 0 ore, non altera
      {
        operaioId: 'o3',
        nome: 'Ghost',
        tipo: 'semplice',
        isProprietario: false,
        ore: 0,
        tariffa: 10,
        tariffaMissing: false,
        costo: 0,
        terrenoId: 't1',
        terrenoNome: 'Campo A',
        ettari: 10,
        lavoroId: 'l9',
        caposquadraId: null,
        caposquadraNome: null
      }
    ]);
    expect(rows.find((r) => r.operaioId === 'o3')).toBeUndefined();
  });

  it('tariffa mancante: costo null / parziale, mai zero silenzioso', () => {
    const rows = aggregateByOperaio([
      {
        operaioId: 'ox',
        nome: 'Senza Tariffa',
        tipo: '',
        isProprietario: false,
        ore: 5,
        tariffa: null,
        tariffaMissing: true,
        costo: null,
        terrenoId: 't1',
        terrenoNome: 'Campo A',
        ettari: 10,
        lavoroId: 'l3',
        caposquadraId: null,
        caposquadraNome: null
      },
      {
        operaioId: 'oy',
        nome: 'Misto',
        tipo: 'semplice',
        isProprietario: false,
        ore: 2,
        tariffa: 10,
        tariffaMissing: false,
        costo: 20,
        terrenoId: 't1',
        terrenoNome: 'Campo A',
        ettari: 10,
        lavoroId: 'l4',
        caposquadraId: null,
        caposquadraNome: null
      },
      {
        operaioId: 'oy',
        nome: 'Misto',
        tipo: 'semplice',
        isProprietario: false,
        ore: 3,
        tariffa: null,
        tariffaMissing: true,
        costo: null,
        terrenoId: 't1',
        terrenoNome: 'Campo A',
        ettari: 10,
        lavoroId: 'l5',
        caposquadraId: null,
        caposquadraNome: null
      }
    ]);
    const sx = rows.find((r) => r.operaioId === 'ox');
    expect(sx.costo).toBeNull();
    expect(sx.tariffaMissing).toBe(true);
    expect(sx.note).toMatch(/Tariffa/);

    const sy = rows.find((r) => r.operaioId === 'oy');
    expect(sy.costo).toBe(20);
    expect(sy.partialCosto).toBe(true);
    expect(sy.tariffaMissing).toBe(true);
  });

  it('aggrega per caposquadra (campo caposquadraId)', () => {
    const rows = aggregateByCaposquadra(linesBase);
    expect(rows).toHaveLength(1);
    expect(rows[0].caposquadraId).toBe('c1');
    expect(rows[0].ore).toBe(12);
    expect(rows[0].costo).toBe(120);
    expect(rows[0].nOperai).toBe(1);
    expect(rows[0].nLavori).toBe(2);
  });

  it('aggrega per terreno con €/ha', () => {
    const rows = aggregateByTerreno(linesBase);
    const t1 = rows.find((r) => r.terrenoId === 't1');
    expect(t1.ore).toBe(17); // 8+6+3
    expect(t1.costo).toBe(215); // 80+90+45
    expect(t1.euroHa).toBe(21.5);
  });

  it('KPI: n. operai esclude proprietario; €/ora su costi completi', () => {
    const byOp = aggregateByOperaio(linesBase);
    const kpi = buildManodoperaKpi(byOp);
    expect(kpi.oreTotali).toBe(21);
    expect(kpi.costoTotale).toBe(255);
    expect(kpi.nOperai).toBe(2);
    expect(kpi.euroOraMedio).toBe(12.14);
  });

  it('filtra per terreno / operaio / caposquadra', () => {
    expect(filterManodoperaLines(linesBase, { terrenoId: 't2' })).toHaveLength(1);
    expect(filterManodoperaLines(linesBase, { operaioId: 'o2' })).toHaveLength(1);
    expect(filterManodoperaLines(linesBase, { operaioId: PROPRIETARIO_ID })).toHaveLength(1);
    expect(filterManodoperaLines(linesBase, { caposquadraId: 'c1' })).toHaveLength(2);
  });

  it('assemble: nota ore da validare + export', () => {
    const report = assembleManodoperaReport({
      lines: linesBase,
      oreDaValidare: 7.5,
      hasCaposquadraData: true
    }, {});
    expect(isManodoperaDataReady(report)).toBe(true);
    expect(report.notes.some((n) => n.includes('7,5') && n.includes('da validare') && n.includes('non incluse'))).toBe(true);

    const exp = prepareManodoperaExportData(report, {
      periodoLabel: '2025',
      terrenoNome: 'Tutti'
    });
    expect(exp.perOperaio.length).toBe(3);
    expect(exp.perCaposquadra.length).toBe(1);
    expect(exp.perTerreno.length).toBe(2);
    expect(exp.kpi.nOperai).toBe(2);
  });

  it('periodo vuoto → empty + messaggio', () => {
    const report = assembleManodoperaReport({ lines: [], oreDaValidare: 0 }, {});
    expect(report.empty).toBe(true);
    expect(report.kpi.oreTotali).toBe(0);
  });

  it('dedup diario vs lavoro (chiave Economici): toglie i 120 € di doppio conteggio', () => {
    // Scenario ritest: 8 h diario proprietario (15 €/h = 120 €) stesso terreno|data|tipo di un lavoro già contato.
    const lavori = [
      { id: 'l1', terrenoId: 't1', dataInizio: '2025-12-10', tipoLavoro: 'Aratura', stato: 'completato' }
    ];
    const chiavi = buildChiaviLavoroDiario(lavori);
    expect(chiavi.has(chiaveLavoroDiario('t1', '2025-12-10', 'Aratura'))).toBe(true);

    const terrenoById = new Map([['t1', { id: 't1', nome: 'Campo A', superficie: 10 }]]);
    const tariffe = { tariffaProprietario: 15, tariffaProprietarioConfigurata: true };
    const attivita = [
      { id: 'a-dup', terrenoId: 't1', data: '2025-12-10', tipoLavoro: 'Aratura', oreNette: 8 },
      { id: 'a-ok', terrenoId: 't1', data: '2025-12-11', tipoLavoro: 'Aratura', oreNette: 2 }
    ];
    const prop = buildProprietarioLines(attivita, terrenoById, tariffe, chiavi);
    expect(prop).toHaveLength(1);
    expect(prop[0].attivitaId).toBe('a-ok');
    expect(prop[0].costo).toBe(30);

    const oreLines = [
      {
        operaioId: 'o1',
        nome: 'Mario',
        tipo: 'semplice',
        isProprietario: false,
        ore: 10,
        tariffa: 10,
        tariffaMissing: false,
        costo: 100,
        terrenoId: 't1',
        terrenoNome: 'Campo A',
        ettari: 10,
        dataIso: '2025-12-10',
        tipoLavoro: 'Aratura',
        lavoroId: 'l1',
        caposquadraId: null,
        caposquadraNome: null
      }
    ];
    const withoutDedup = sumCostoManodoperaLines([
      ...oreLines,
      {
        operaioId: PROPRIETARIO_ID,
        nome: PROPRIETARIO_NOME,
        tipo: 'proprietario',
        isProprietario: true,
        ore: 8,
        tariffa: 15,
        tariffaMissing: false,
        costo: 120,
        terrenoId: 't1',
        terrenoNome: 'Campo A',
        ettari: 10,
        dataIso: '2025-12-10',
        tipoLavoro: 'Aratura',
        lavoroId: null,
        caposquadraId: null,
        caposquadraNome: null
      },
      ...prop
    ]);
    const withDedup = sumCostoManodoperaLines([...oreLines, ...prop]);
    expect(withoutDedup.value).toBe(euro(100 + 120 + 30));
    expect(withDedup.value).toBe(euro(100 + 30));
    expect(withoutDedup.value - withDedup.value).toBe(120);
  });

  it('proprietario con tariffa non configurata → costo null', () => {
    const rows = aggregateByOperaio([
      {
        operaioId: PROPRIETARIO_ID,
        nome: PROPRIETARIO_NOME,
        tipo: 'proprietario',
        isProprietario: true,
        ore: 2,
        tariffa: null,
        tariffaMissing: true,
        costo: null,
        terrenoId: 't1',
        terrenoNome: 'Campo A',
        ettari: 4,
        lavoroId: null,
        caposquadraId: null,
        caposquadraNome: null
      }
    ]);
    expect(rows[0].costo).toBeNull();
    expect(rows[0].tariffaMissing).toBe(true);
    const kpi = buildManodoperaKpi(rows);
    expect(kpi.costoTotale).toBeNull();
    expect(kpi.nOperai).toBe(0);
  });
});
