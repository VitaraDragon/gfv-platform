/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateEconomiciRows,
  buildEconomiciLines,
  companyTotal,
  euroPerHa,
  filterUsciteMagazzinoPerEconomici,
  prodottoCostFromMovimentoUscita,
  prodottoCostFromTrattamento,
  resolveColturaAtDate,
  sumNullable,
  TERRENO_NON_ATTRIBUITO_ID,
  totalsByColtura
} from '../modules/report/services/report-economici-aggregate.js';

describe('Report Economici — aggregazione', () => {
  const terreni = [
    { id: 't1', nome: 'Campo A', coltura: 'Orzo', superficie: 10 },
    { id: 't2', nome: 'Campo B', coltura: 'Vite', superficie: 5 }
  ];

  const colturaContext = {
    campagneSeminativo: [
      { id: 'c2025', terrenoId: 't1', campagna: '2024/2025', colturaNome: 'Grano' },
      { id: 'c2026', terrenoId: 't1', campagna: '2025/2026', colturaNome: 'Orzo' }
    ],
    campagneOrticole: [],
    vigneti: [{ id: 'v1', terrenoId: 't2', varieta: 'Sangiovese' }],
    frutteti: []
  };

  it('aggrega per terreno × coltura e calcola €/ha', () => {
    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2025-12-10', tipoLavoro: 'Aratura', ore: 8, costoManodopera: 120, costoMacchine: 40 }
      ],
      attivitaCosti: [
        { terrenoId: 't1', dataIso: '2026-02-01', tipoLavoro: 'Ripuntatura', ore: 2, costoManodopera: 30, costoMacchine: 10 }
      ],
      prodottiCosti: [
        { terrenoId: 't1', dataIso: '2026-02-01', costoProdotti: 50 }
      ]
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0].coltura).toBe('Orzo');
    expect(rows[0].ore).toBe(10);
    expect(rows[0].costoManodopera).toBe(150);
    expect(rows[0].costoMacchine).toBe(50);
    expect(rows[0].costoProdotti).toBe(50);
    expect(rows[0].totale).toBe(250);
    expect(euroPerHa(250, 10)).toBe(25);
    expect(rows[0].euroHa).toBe(25);
  });

  it('usa la coltura della campagna alla data, non quella attuale del terreno', () => {
    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2025-03-15', tipoLavoro: 'Aratura', ore: 4, costoManodopera: 60, costoMacchine: 0 }
      ],
      attivitaCosti: [],
      prodottiCosti: []
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0].coltura).toBe('Grano');
    expect(terreni[0].coltura).toBe('Orzo');
  });

  it('resolveColturaAtDate: vigneto/frutteto/seminativo/orticole', () => {
    expect(resolveColturaAtDate({
      terrenoId: 't1',
      dataIso: '2025-01-10',
      campagneSeminativo: colturaContext.campagneSeminativo,
      terrenoColtura: 'Orzo'
    })).toBe('Grano');

    expect(resolveColturaAtDate({
      terrenoId: 't2',
      dataIso: '2026-01-10',
      vigneti: colturaContext.vigneti,
      terrenoColtura: 'Mais'
    })).toBe('Sangiovese');

    expect(resolveColturaAtDate({
      terrenoId: 't3',
      dataIso: '2026-01-10',
      campagneOrticole: [{ id: 'o1', terrenoId: 't3', campagna: '2025/2026', colturaNome: 'Pomodoro' }],
      terrenoColtura: 'X'
    })).toBe('Pomodoro');

    expect(resolveColturaAtDate({
      terrenoId: 't4',
      dataIso: '2026-01-10',
      frutteti: [{ terrenoId: 't4', specie: 'Melo' }],
      terrenoColtura: 'X'
    })).toBe('Melo');

    expect(resolveColturaAtDate({
      explicitColtura: 'Dal documento',
      terrenoColtura: 'Orzo'
    })).toBe('Dal documento');
  });

  it('non conta due volte diario e lavoro stesso giorno/tipo', () => {
    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-01-10', tipoLavoro: 'Erpicatura', ore: 4, costoManodopera: 60, costoMacchine: 20 }
      ],
      attivitaCosti: [
        { terrenoId: 't1', dataIso: '2026-01-10', tipoLavoro: 'Erpicatura', ore: 4, costoManodopera: 60, costoMacchine: 20 }
      ],
      prodottiCosti: []
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows[0].costoManodopera).toBe(60);
    expect(rows[0].costoMacchine).toBe(20);
    expect(rows[0].ore).toBe(4);
  });

  it('dal trattamento prende solo costo prodotti', () => {
    const p = prodottoCostFromTrattamento({
      costoProdotto: 80,
      costoManodopera: 60,
      costoMacchina: 40,
      prodotti: [{ prodotto: 'Rame', costo: 80, quantita: 2 }]
    });
    expect(p.costoProdotti).toBe(80);

    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-03-01', tipoLavoro: 'Trattamento', ore: 3, costoManodopera: 45, costoMacchine: 15 }
      ],
      attivitaCosti: [],
      prodottiCosti: [{ terrenoId: 't1', dataIso: '2026-03-01', costoProdotti: p.costoProdotti }]
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows[0].totale).toBe(140);
  });

  it('sumNullable e totali parziali: somma noti + partial, — solo senza noti', () => {
    expect(sumNullable([10, 20], { anyMissing: false })).toEqual({ value: 30, partial: false });
    expect(sumNullable([10, null], { anyMissing: true })).toEqual({ value: 10, partial: true });
    expect(sumNullable([null, null], { anyMissing: true })).toEqual({ value: null, partial: false });
    expect(sumNullable([], { anyMissing: false })).toEqual({ value: 0, partial: false });

    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-01-01', tipoLavoro: 'A', ore: 2, costoManodopera: 40, costoMacchine: 0 },
        {
          terrenoId: 't1',
          dataIso: '2026-01-02',
          tipoLavoro: 'B',
          ore: 1,
          costoManodopera: null,
          missingManodopera: true,
          costoMacchine: 0,
          notes: ['Tariffa oraria non impostata']
        }
      ],
      attivitaCosti: [],
      prodottiCosti: [
        { terrenoId: 't1', dataIso: '2026-01-01', costoProdotti: 25 },
        {
          terrenoId: 't1',
          dataIso: '2026-01-03',
          costoProdotti: null,
          missingProdotti: true,
          notes: ['Prezzo prodotto non in anagrafica (o costo non registrato sul trattamento)']
        }
      ]
    });
    const { rows, notes } = aggregateEconomiciRows(lines);
    expect(rows[0].costoManodopera).toBe(40);
    expect(rows[0].partialManodopera).toBe(true);
    expect(rows[0].costoProdotti).toBe(25);
    expect(rows[0].partialProdotti).toBe(true);
    expect(rows[0].totale).toBe(65);
    expect(rows[0].partialTotale).toBe(true);
    expect(rows[0].euroHa).toBe(6.5);
    expect(rows[0].partialEuroHa).toBe(true);
    expect(notes.some((n) => /parziale/i.test(n))).toBe(true);

    const tot = companyTotal(rows);
    expect(tot.costoManodopera).toBe(40);
    expect(tot.partialManodopera).toBe(true);
    expect(tot.totale).toBe(65);
    expect(tot.partialTotale).toBe(true);
  });

  it('— solo quando non c’è nessun valore noto', () => {
    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        {
          terrenoId: 't1',
          dataIso: '2026-01-01',
          tipoLavoro: 'Aratura',
          ore: 2,
          costoManodopera: null,
          missingManodopera: true,
          costoMacchine: 0
        }
      ],
      attivitaCosti: [],
      prodottiCosti: []
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows[0].costoManodopera).toBeNull();
    expect(rows[0].partialManodopera).toBe(false);
    expect(rows[0].costoMacchine).toBe(0);
    expect(rows[0].totale).toBe(0);
    expect(rows[0].partialTotale).toBe(true);
  });

  it('magazzino: esclude scarichi trattamento e somma uscita concime separata', () => {
    const uscite = filterUsciteMagazzinoPerEconomici(
      [
        { id: 'mov-trat', tipo: 'uscita', quantita: 2, prezzoUnitario: 10 },
        { id: 'mov-concime', tipo: 'uscita', quantita: 5, prezzoUnitario: 4 },
        { id: 'mov-fuel', tipo: 'uscita', quantita: 1, prezzoUnitario: 1.5, origineCarburante: 'pieno' },
        { id: 'mov-linked', tipo: 'uscita', quantita: 1, prezzoUnitario: 9, origineTrattamentoId: 'tr1' }
      ],
      ['mov-trat']
    );
    expect(uscite.map((m) => m.id)).toEqual(['mov-concime']);

    const pTrat = prodottoCostFromTrattamento({
      costoProdotto: 20,
      magazzinoMovimentoIds: ['mov-trat'],
      prodotti: [{ prodotto: 'Rame', costo: 20, quantita: 2 }]
    });
    const pConc = prodottoCostFromMovimentoUscita({ quantita: 5, prezzoUnitario: 4 });
    expect(pConc.costoProdotti).toBe(20);

    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [],
      attivitaCosti: [],
      prodottiCosti: [
        { terrenoId: 't1', dataIso: '2026-04-01', costoProdotti: pTrat.costoProdotti },
        { terrenoId: 't1', dataIso: '2026-04-02', costoProdotti: pConc.costoProdotti }
      ]
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows[0].costoProdotti).toBe(40);
  });

  it('uscita senza terreno → Non attribuito (in azienda, fuori totali coltura)', () => {
    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-01-01', tipoLavoro: 'A', ore: 1, costoManodopera: 10, costoMacchine: 0 }
      ],
      attivitaCosti: [],
      prodottiCosti: [
        { nonAttribuito: true, costoProdotti: 33 }
      ]
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows.some((r) => r.terrenoId === TERRENO_NON_ATTRIBUITO_ID)).toBe(true);
    expect(rows.find((r) => r.nonAttribuito).costoProdotti).toBe(33);

    const byColtura = totalsByColtura(rows);
    expect(byColtura.every((r) => r.coltura !== 'Senza coltura' || r.costoProdotti !== 33)).toBe(true);
    expect(byColtura.reduce((s, r) => s + (r.costoProdotti || 0), 0)).toBe(0);

    const tot = companyTotal(rows);
    expect(tot.costoProdotti).toBe(33);
    expect(tot.costoManodopera).toBe(10);
    expect(tot.totale).toBe(43);
  });

  it('filtra per terreno e coltura storica', () => {
    const lines = buildEconomiciLines({
      terreni,
      colturaContext,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2025-03-01', tipoLavoro: 'A', ore: 1, costoManodopera: 10, costoMacchine: 0 },
        { terrenoId: 't2', dataIso: '2026-01-02', tipoLavoro: 'B', ore: 2, costoManodopera: 20, costoMacchine: 5 }
      ],
      attivitaCosti: [],
      prodottiCosti: []
    });
    const onlyGrano = aggregateEconomiciRows(lines, { coltura: 'Grano' });
    expect(onlyGrano.rows).toHaveLength(1);
    expect(onlyGrano.rows[0].coltura).toBe('Grano');
  });
});
