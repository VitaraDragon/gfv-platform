/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import {
  calcolaBloccoManodoperaAnnata,
  calcolaLavoriAnnata,
  calcolaMediaOreGiornoMeseCorrente
} from '../core/js/statistiche-manodopera-blocco.js';

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
});
