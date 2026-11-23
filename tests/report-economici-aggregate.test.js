/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateEconomiciRows,
  buildEconomiciLines,
  companyTotal,
  euroPerHa,
  prodottoCostFromTrattamento,
  totalsByColtura
} from '../modules/report/services/report-economici-aggregate.js';

describe('Report Economici — aggregazione', () => {
  const terreni = [
    { id: 't1', nome: 'Campo A', coltura: 'Grano', superficie: 10 },
    { id: 't2', nome: 'Campo B', coltura: 'Vite', superficie: 5 }
  ];

  it('aggrega per terreno × coltura e calcola €/ha', () => {
    const lines = buildEconomiciLines({
      terreni,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-01-10', tipoLavoro: 'Aratura', ore: 8, costoManodopera: 120, costoMacchine: 40 }
      ],
      attivitaCosti: [
        { terrenoId: 't1', dataIso: '2026-02-01', tipoLavoro: 'Ripuntatura', ore: 2, costoManodopera: 30, costoMacchine: 10 }
      ],
      prodottiCosti: [
        { terrenoId: 't1', costoProdotti: 50 }
      ]
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0].ore).toBe(10);
    expect(rows[0].costoManodopera).toBe(150);
    expect(rows[0].costoMacchine).toBe(50);
    expect(rows[0].costoProdotti).toBe(50);
    expect(rows[0].totale).toBe(250);
    expect(euroPerHa(250, 10)).toBe(25);
    expect(rows[0].euroHa).toBe(25);
  });

  it('non conta due volte diario e lavoro stesso giorno/tipo', () => {
    const lines = buildEconomiciLines({
      terreni,
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

  it('dal trattamento prende solo costo prodotti (niente manodopera/macchine del doc)', () => {
    const p = prodottoCostFromTrattamento({
      costoProdotto: 80,
      costoManodopera: 60,
      costoMacchina: 40,
      prodotti: [{ prodotto: 'Rame', costo: 80, quantita: 2 }]
    });
    expect(p.costoProdotti).toBe(80);
    expect(p.missingProdotti).toBe(false);

    const lines = buildEconomiciLines({
      terreni,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-03-01', tipoLavoro: 'Trattamento', ore: 3, costoManodopera: 45, costoMacchine: 15 }
      ],
      attivitaCosti: [],
      prodottiCosti: [{ terrenoId: 't1', costoProdotti: p.costoProdotti }]
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows[0].costoManodopera).toBe(45);
    expect(rows[0].costoMacchine).toBe(15);
    expect(rows[0].costoProdotti).toBe(80);
    expect(rows[0].totale).toBe(140);
  });

  it('costi mancanti restano null (mostrati come — in UI)', () => {
    const lines = buildEconomiciLines({
      terreni,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-01-01', tipoLavoro: 'Aratura', ore: 2, costoManodopera: null, missingManodopera: true, costoMacchine: 0, notes: ['Tariffa oraria non impostata'] }
      ],
      attivitaCosti: [],
      prodottiCosti: [
        { terrenoId: 't1', costoProdotti: null, missingProdotti: true, notes: ['Prezzo prodotto non in anagrafica (o costo non registrato sul trattamento)'] }
      ]
    });
    const { rows, notes } = aggregateEconomiciRows(lines);
    expect(rows[0].costoManodopera).toBeNull();
    expect(rows[0].costoProdotti).toBeNull();
    expect(rows[0].totale).toBeNull();
    expect(rows[0].euroHa).toBeNull();
    expect(notes.some((n) => /tariffa/i.test(n))).toBe(true);
    expect(notes.some((n) => /prezzo prodotto/i.test(n))).toBe(true);
  });

  it('ignora moduli disattivi a livello linee prodotti (nessuna riga inventata)', () => {
    const lines = buildEconomiciLines({
      terreni,
      lavoriCosti: [
        { terrenoId: 't2', dataIso: '2026-04-01', tipoLavoro: 'Potatura', ore: 5, costoManodopera: 75, costoMacchine: 0 }
      ],
      attivitaCosti: [],
      prodottiCosti: []
    });
    const { rows } = aggregateEconomiciRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0].coltura).toBe('Vite');
    expect(rows[0].costoProdotti).toBe(0);
  });

  it('filtra per terreno e coltura; totali per coltura e azienda', () => {
    const lines = buildEconomiciLines({
      terreni,
      lavoriCosti: [
        { terrenoId: 't1', dataIso: '2026-01-01', tipoLavoro: 'A', ore: 1, costoManodopera: 10, costoMacchine: 0 },
        { terrenoId: 't2', dataIso: '2026-01-02', tipoLavoro: 'B', ore: 2, costoManodopera: 20, costoMacchine: 5 }
      ],
      attivitaCosti: [],
      prodottiCosti: [
        { terrenoId: 't1', costoProdotti: 5 },
        { terrenoId: 't2', costoProdotti: 15 }
      ]
    });
    const all = aggregateEconomiciRows(lines);
    expect(all.rows).toHaveLength(2);

    const onlyGrano = aggregateEconomiciRows(lines, { coltura: 'Grano' });
    expect(onlyGrano.rows).toHaveLength(1);
    expect(onlyGrano.rows[0].terrenoId).toBe('t1');

    const byColtura = totalsByColtura(all.rows);
    expect(byColtura.map((r) => r.coltura).sort()).toEqual(['Grano', 'Vite']);
    const tot = companyTotal(all.rows);
    expect(tot.costoManodopera).toBe(30);
    expect(tot.costoMacchine).toBe(5);
    expect(tot.costoProdotti).toBe(20);
    expect(tot.totale).toBe(55);
  });

  it('prodottoCostFromTrattamento segnala missing se c’è quantità senza prezzo', () => {
    const p = prodottoCostFromTrattamento({
      prodotti: [{ prodotto: 'Urea', quantita: 100, costo: 0 }]
    });
    expect(p.missingProdotti).toBe(true);
    expect(p.costoProdotti).toBeNull();
  });
});
