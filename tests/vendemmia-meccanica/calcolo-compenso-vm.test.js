/**
 * Test calcolo compenso e ettari netti VM
 */

import { describe, test, expect } from 'vitest';
import {
  getEttariEffettivi,
  validateTerrenoForCalcolo,
  calcolaCompensoVendemmia
} from '../../modules/vendemmia-meccanica/services/calcolo-compenso-vm-service.js';
import { computeEttariVendemmiati, buildStagioneWithNetArea } from '../../modules/vendemmia-meccanica/services/zone-escluse-service.js';
import { summarizePianoStagione } from '../../modules/vendemmia-meccanica/services/piano-stagione-kpi.js';

const terrenoBase = {
  id: 't1',
  nome: 'Barbera Nord',
  superficie: 2.5,
  tipoCampo: 'collina',
  tipoPalo: 'ferro',
  sestoImpianto: { distanzaFile: 2.5, distanzaCeppo: 1.0 },
  clienteId: 'c1'
};

const tariffe = {
  tariffeVendemmia: { 'collina-ferro': 100 },
  coefficientiSesto: { standard: 1, stretto: 1.1, largo: 0.95 },
  tariffeTrasporto: { sociale: 0.15 }
};

describe('Vendemmia Meccanica — calcolo compenso', () => {
  test('getEttariEffettivi usa vendemmiaMeccanica[anno].ettariVendemmiati', () => {
    const t = {
      ...terrenoBase,
      vendemmiaMeccanica: { '2026': { ettariVendemmiati: 1.85 } }
    };
    expect(getEttariEffettivi(t, 2026).ettari).toBe(1.85);
  });

  test('validateTerrenoForCalcolo segnala campi mancanti', () => {
    const errs = validateTerrenoForCalcolo({ nome: 'X' });
    expect(errs.length).toBeGreaterThan(0);
    expect(validateTerrenoForCalcolo(terrenoBase)).toEqual([]);
  });

  test('calcolaCompensoVendemmia — formula piano §6.1', () => {
    const t = {
      ...terrenoBase,
      vendemmiaMeccanica: { '2026': { ettariVendemmiati: 2.0 } }
    };
    const res = calcolaCompensoVendemmia({
      clienteId: 'c1',
      clienteNome: 'Cliente Test',
      terreni: [t],
      quintali: 100,
      destinazioneTrasporto: 'sociale',
      scontoMaggiorazione: -10,
      anno: 2026,
      tariffeConfig: tariffe
    });

    expect(res.valid).toBe(true);
    expect(res.breakdown.totaleVendemmia).toBe(200); // 2 ha × 100 €/ha
    expect(res.breakdown.totaleTrasporto).toBe(15); // 100 qli × 0.15
    expect(res.breakdown.totaleFinale).toBe(205); // 200 + 15 - 10
  });

  test('calcolaCompensoVendemmia rifiuta senza terreni', () => {
    const res = calcolaCompensoVendemmia({
      clienteId: 'c1',
      terreni: [],
      quintali: 0,
      destinazioneTrasporto: 'sociale',
      tariffeConfig: tariffe
    });
    expect(res.valid).toBe(false);
  });
});

describe('Vendemmia Meccanica — ettari netti', () => {
  test('computeEttariVendemmiati sottrae area esclusa', () => {
    expect(computeEttariVendemmiati(2.5, { ettariEsclusi: 0.65 })).toBe(1.85);
  });

  test('computeEttariVendemmiati rispetta override manuale', () => {
    expect(computeEttariVendemmiati(2.5, { ettariEsclusi: 1, ettariVendemmiatiManuali: 1.9 })).toBe(1.9);
  });

  test('buildStagioneWithNetArea aggiorna ettariVendemmiati', () => {
    const stato = buildStagioneWithNetArea({ inPiano: true, ettariEsclusi: 0.5 }, 2.0);
    expect(stato.ettariVendemmiati).toBe(1.5);
  });
});

describe('Vendemmia Meccanica — piano stagione KPI', () => {
  test('summarizePianoStagione calcola percentuale', () => {
    const kpi = summarizePianoStagione([
      { inPiano: true, vendemmiato: true, ettariEffettivi: 1 },
      { inPiano: true, vendemmiato: false, ettariEffettivi: 2 },
      { inPiano: false, vendemmiato: false, ettariEffettivi: 3 }
    ]);
    expect(kpi.inPiano).toBe(2);
    expect(kpi.vendemmiati).toBe(1);
    expect(kpi.percentualeCompletata).toBe(50);
    expect(kpi.ettariInPiano).toBe(3);
    expect(kpi.ettariResidui).toBe(2);
    expect(kpi.terreniResidui).toBe(1);
  });
});
