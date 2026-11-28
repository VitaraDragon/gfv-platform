/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import {
  calcolaBloccoManodoperaAnnata,
  calcolaLavoriAnnata,
  calcolaMediaOreGiornoMeseCorrente,
  calcolaMediaOreGiornoPerAnnata
} from '../core/js/statistiche-manodopera-blocco.js';
import { monthTickLabelsForOreMese } from '../core/js/statistiche-charts.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('statistiche-manodopera-blocco', () => {
  test('KPI annata: validate anno, da_validare esclude sola lettura, annullati fuori', () => {
    const oggi = new Date(2026, 10, 15); // 15 nov 2026
    const result = calcolaBloccoManodoperaAnnata({
      anno: 2026,
      oggi,
      oreRows: [
        { operaioId: 'a', lavoroId: 'l1', oreNette: 100, stato: 'validate', data: new Date(2026, 2, 10) },
        { operaioId: 'a', lavoroId: 'l1', oreNette: 8, stato: 'validate', data: new Date(2026, 10, 5) },
        { operaioId: 'b', lavoroId: 'l2', oreNette: 4, stato: 'da_validare', data: new Date(2026, 5, 1) },
        { operaioId: 'c', lavoroId: 'l3', oreNette: 20, stato: 'da_validare', data: new Date(2026, 4, 1) },
        { operaioId: 'a', lavoroId: 'l1', oreNette: 50, stato: 'validate', data: new Date(2025, 2, 10) }
      ],
      lavori: [
        { id: 'l1', stato: 'completato', dataInizio: new Date(2026, 2, 1), terrenoId: 't1' },
        { id: 'l2', stato: 'in_corso', dataInizio: new Date(2026, 5, 1), terrenoId: 't1' },
        { id: 'l3', stato: 'assegnato', dataInizio: new Date(2026, 4, 1), terrenoId: 't-arch' },
        { id: 'l4', stato: 'annullato', dataInizio: new Date(2026, 1, 1), terrenoId: 't1' },
        { id: 'l5', stato: 'completato', dataInizio: new Date(2025, 1, 1), terrenoId: 't1' }
      ],
      terreniById: {
        t1: { nome: 'Campo' },
        't-arch': { nome: 'Vecchio', archiviato: true }
      },
      usersById: {
        a: { nome: 'Mario', cognome: 'Rossi', tipoOperaio: '', ruoli: ['operaio'] },
        b: { nome: 'Luigi', cognome: 'Verdi', tipoOperaio: 'trattorista', ruoli: ['operaio'] },
        c: { nome: 'Anna', cognome: 'Neri', tipoOperaio: 'semplice', ruoli: ['operaio'] }
      },
      isLavoroSolaLettura: (lavoro) => String(lavoro.terrenoId) === 't-arch'
    });

    expect(result.oreValidateAnno).toBe(108);
    expect(result.oreDaValidare).toBe(4);
    expect(result.lavoriAttiviAnno).toBe(2);
    expect(result.lavoriCompletatiAnno).toBe(1);
    expect(result.lavoriAnnullatiAnno).toBe(1);
    expect(result.orePerTipo.some((t) => t.tipo === 'Non specificato' && t.ore === 108)).toBe(true);
    expect(result.topOperai[0].operaioId).toBe('a');
    expect(result.orePerMese[2].ore).toBe(100);
    expect(result.orePerMese[10].ore).toBe(8);
  });

  test('annullati esclusi dai considerati; media mese in corso etichettata', () => {
    const lavori = calcolaLavoriAnnata([
      { stato: 'annullato', dataInizio: new Date(2026, 3, 1) },
      { stato: 'completato', dataInizio: new Date(2026, 3, 2) },
      { stato: 'in_corso', dataInizio: new Date(2026, 3, 3) }
    ], 2026);
    expect(lavori.annullati).toBe(1);
    expect(lavori.completati).toBe(1);
    expect(lavori.attivi).toBe(1);
    expect(lavori.considerati).toBe(2);

    const media = calcolaMediaOreGiornoMeseCorrente([
      { stato: 'validate', oreNette: 8, data: new Date(2026, 10, 1) },
      { stato: 'validate', oreNette: 4, data: new Date(2026, 10, 2) },
      { stato: 'validate', oreNette: 10, data: new Date(2026, 9, 30) }
    ], new Date(2026, 10, 15));
    expect(media.oreValidateMese).toBe(12);
    expect(media.giorniConOre).toBe(2);
    expect(media.mediaOreGiorno).toBe(6);
    expect(media.etichettaMese).toBe('Nov 2026');
  });

  test('media ore/giorno segue l\'annata scelta (mese corrente solo se anno attuale)', () => {
    const oreRows = [
      { stato: 'validate', oreNette: 8, data: new Date(2025, 2, 1) },
      { stato: 'validate', oreNette: 4, data: new Date(2025, 5, 2) },
      { stato: 'validate', oreNette: 10, data: new Date(2026, 10, 5) }
    ];
    const oggi = new Date(2026, 10, 15);

    const mediaAnnataPassata = calcolaMediaOreGiornoPerAnnata(oreRows, 2025, oggi);
    expect(mediaAnnataPassata.etichettaMese).toBe('annata 2025');
    expect(mediaAnnataPassata.oreValidateMese).toBe(12);
    expect(mediaAnnataPassata.giorniConOre).toBe(2);
    expect(mediaAnnataPassata.mediaOreGiorno).toBe(6);

    const mediaAnnoCorrente = calcolaMediaOreGiornoPerAnnata(oreRows, 2026, oggi);
    expect(mediaAnnoCorrente.etichettaMese).toBe('Nov 2026');
    expect(mediaAnnoCorrente.oreValidateMese).toBe(10);

    const blocco = calcolaBloccoManodoperaAnnata({
      anno: 2025,
      oggi,
      oreRows,
      lavori: []
    });
    expect(blocco.mediaOreGiornoEtichetta).toBe('annata 2025');
    expect(blocco.mediaOreGiornoMeseCorrente).toBe(6);
  });

  test('desktop: tutti i mesi etichettati; mobile: solo mesi con ore', () => {
    const rows = [
      { mese: 1, label: 'Gen', ore: 0 },
      { mese: 2, label: 'Feb', ore: 0 },
      { mese: 3, label: 'Mar', ore: 0 },
      { mese: 4, label: 'Apr', ore: 0 },
      { mese: 5, label: 'Mag', ore: 0 },
      { mese: 6, label: 'Giu', ore: 0 },
      { mese: 7, label: 'Lug', ore: 0 },
      { mese: 8, label: 'Ago', ore: 0 },
      { mese: 9, label: 'Set', ore: 0 },
      { mese: 10, label: 'Ott', ore: 12 },
      { mese: 11, label: 'Nov', ore: 8 },
      { mese: 12, label: 'Dic', ore: 0 }
    ];
    const desktop = monthTickLabelsForOreMese(rows, { mobile: false });
    expect(desktop).toHaveLength(12);
    expect(desktop[0]).toBe('Gen');
    expect(desktop[9]).toBe('Ott');
    expect(desktop.filter(Boolean)).toHaveLength(12);

    const mobile = monthTickLabelsForOreMese(rows, { mobile: true });
    expect(mobile[9]).toBe('Ott');
    expect(mobile[10]).toBe('Nov');
    expect(mobile.filter(Boolean)).toEqual(['Ott', 'Nov']);
  });

  test('KPI da-validare e lavori completati usano tinte CSS distinte', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'core/statistiche-standalone.html'),
      'utf8'
    );
    const block = html.slice(
      html.indexOf('id="statistiche-manodopera-section"'),
      html.indexOf('id="statistiche-conto-terzi-section"')
    );
    const cards = [...block.matchAll(/metric-card" style="background:\s*([^;"]+)/g)].map((m) => m[1].trim());
    expect(cards.length).toBeGreaterThanOrEqual(4);
    const daValidareBg = cards[1];
    const completatiBg = cards[3];
    expect(daValidareBg).toMatch(/report-chart-da-validare/);
    expect(completatiBg).toMatch(/report-chart-4/);
    expect(completatiBg).not.toMatch(/report-chart-2/);
    expect(daValidareBg).not.toBe(completatiBg);
  });
});
