import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TONY_METEO_RULES,
  buildMeteoConsigli,
  computeLookbackRainMm,
  evaluatePraticabilitaTerreno,
  evaluateAsciugaturaLavoroCampo,
  computeDryDaysBeforeTarget,
  evaluateGiornoOperativoCompleto,
} from '../functions/tony-meteo-rules.js';
import { formatMeteoConsigliProactive, buildMeteoProactiveBriefingConsigli } from '../core/config/tony-meteo-rules.js';
import { deriveCondizioniMeteoFromCompactRow } from '../core/js/meteo-ui-helpers.js';

describe('buildMeteoConsigli', () => {
  it('segnala vento alto per trattamento sul terreno', () => {
    const terreni = [
      {
        terrenoId: 't1',
        nome: 'Sangiovese',
        ok: true,
        windSpeedKmh: 22,
        popDomani: 10,
        alertsCount: 0,
        hasRainSoon: false,
      },
    ];
    const consigli = buildMeteoConsigli(DEFAULT_TONY_METEO_RULES, terreni, [], null);
    expect(consigli.some((c) => c.tipo === 'trattamento' && c.esito === 'sconsigliato')).toBe(true);
  });

  it('collega pioggia imminente a lavoro sullo stesso terreno', () => {
    const terreni = [
      {
        terrenoId: 't2',
        nome: 'Pinot',
        ok: true,
        windSpeedKmh: 8,
        hasRainSoon: true,
        alertsCount: 0,
      },
    ];
    const lavori = [{ id: 'l1', nome: 'Potatura', terrenoId: 't2', stato: 'in_corso' }];
    const consigli = buildMeteoConsigli(DEFAULT_TONY_METEO_RULES, terreni, lavori, null);
    expect(
      consigli.some((c) => c.lavoroId === 'l1' && c.esito === 'attenzione' && /Pioggia imminente/i.test(c.motivo))
    ).toBe(true);
  });

  it('formatMeteoConsigliProactive riassume i consigli principali', () => {
    const consigli = buildMeteoProactiveBriefingConsigli({
      label: 'Sede aziendale',
      today: { pop: 85, rainMm: 4 },
    });
    const text = formatMeteoConsigliProactive(consigli);
    expect(text).toMatch(/Meteo sede/i);
    expect(text).toMatch(/85%/);
    expect(text).toMatch(/4 mm/);
  });

  it('buildMeteoProactiveBriefingConsigli ignora campi sotto soglia pop o mm', () => {
    const sottoPop = buildMeteoProactiveBriefingConsigli({
      label: 'Sede',
      tomorrow: { pop: 75, rainMm: 5 },
    });
    expect(sottoPop).toHaveLength(0);

    const sottoMm = buildMeteoProactiveBriefingConsigli({
      label: 'Sede',
      tomorrow: { pop: 90, rainMm: 1.5 },
    });
    expect(sottoMm).toHaveLength(0);

    const ok = buildMeteoProactiveBriefingConsigli({
      label: 'Sede',
      tomorrow: { pop: 81, rainMm: 2.5 },
    });
    expect(ok).toHaveLength(1);
    expect(ok[0].scope).toBe('sede');
    expect(ok[0].motivo).toMatch(/Domani alla Sede/i);
  });
});

describe('praticabilitaTerreno', () => {
  const previsioni = [
    { dt: '2026-05-21', rainMm: 0 },
    { dt: '2026-05-22', rainMm: 2 },
    { dt: '2026-05-23', rainMm: 2 },
  ];

  it('somma mm su lookback collina (D-1 + D)', () => {
    const lb = computeLookbackRainMm(previsioni, '2026-05-23', 'collina');
    expect(lb.total).toBe(4);
  });

  it('collina oltre 10 mm lookback è impraticabile', () => {
    expect(evaluatePraticabilitaTerreno('collina', 11, DEFAULT_TONY_METEO_RULES).esito).toBe('impraticabile');
  });

  it('pianura 15 mm lookback è ok', () => {
    expect(evaluatePraticabilitaTerreno('pianura', 15, DEFAULT_TONY_METEO_RULES).esito).toBe('ok');
  });

  it('collina esattamente 10 mm lookback è impraticabile', () => {
    expect(evaluatePraticabilitaTerreno('collina', 10, DEFAULT_TONY_METEO_RULES, 'lavoroCampo').esito).toBe(
      'impraticabile'
    );
  });

  it('collina 5 mm è fascia chiedi', () => {
    expect(evaluatePraticabilitaTerreno('collina', 5, DEFAULT_TONY_METEO_RULES).esito).toBe('chiedi');
  });

  it('lavoroCampo ignora vento forte ma valuta pioggia', () => {
    const { evaluateMeteoOperativoGiorno } = require('../functions/tony-meteo-rules.js');
    const ev = evaluateMeteoOperativoGiorno(
      { pop: 10, windSpeedKmh: 22, rainMm: 0 },
      'lavoroCampo',
      DEFAULT_TONY_METEO_RULES
    );
    expect(ev.esito).toBe('ok');
    expect(ev.motivi.join(' ')).not.toMatch(/vento/i);
  });

  it('venerdì impraticabile in collina dopo 20 mm giovedì (lavoroCampo)', () => {
    const previsioni = [
      { dt: '2026-05-28', pop: 80, windSpeedKmh: 10, rainMm: 20 },
      { dt: '2026-05-29', pop: 5, windSpeedKmh: 8, rainMm: 0 },
    ];
    const ev = evaluateGiornoOperativoCompleto(
      previsioni[1],
      previsioni,
      '2026-05-29',
      'collina',
      'lavoroCampo',
      DEFAULT_TONY_METEO_RULES
    );
    expect(ev.esito).toBe('sconsigliato');
    expect(ev.motivi.join(' ')).toMatch(/bagnato|asciutte|mm/i);
  });

  it('sabato ancora sconsigliato in collina dopo 10 mm giovedì (asciugatura)', () => {
    const previsioni = [
      { dt: '2026-05-28', pop: 90, windSpeedKmh: 10, rainMm: 10 },
      { dt: '2026-05-29', pop: 5, windSpeedKmh: 8, rainMm: 0 },
      { dt: '2026-05-30', pop: 5, windSpeedKmh: 8, rainMm: 0 },
    ];
    const ev = evaluateGiornoOperativoCompleto(
      previsioni[2],
      previsioni,
      '2026-05-30',
      'collina',
      'lavoroCampo',
      DEFAULT_TONY_METEO_RULES
    );
    expect(ev.esito).toBe('sconsigliato');
    expect(ev.motivi.join(' ')).toMatch(/asciutte|2 giornate/i);
  });

  it('domenica ok in collina dopo 10 mm giovedì e due giorni asciutti', () => {
    const previsioni = [
      { dt: '2026-05-28', pop: 90, windSpeedKmh: 10, rainMm: 10 },
      { dt: '2026-05-29', pop: 5, windSpeedKmh: 8, rainMm: 0 },
      { dt: '2026-05-30', pop: 5, windSpeedKmh: 8, rainMm: 0 },
      { dt: '2026-05-31', pop: 5, windSpeedKmh: 8, rainMm: 0 },
    ];
    const ev = evaluateGiornoOperativoCompleto(
      previsioni[3],
      previsioni,
      '2026-05-31',
      'collina',
      'lavoroCampo',
      DEFAULT_TONY_METEO_RULES
    );
    expect(ev.esito).toBe('ok');
  });

  it('combina meteo ok e praticabilità chiedi', () => {
    const ev = evaluateGiornoOperativoCompleto(
      { dt: '2026-05-23', pop: 5, windSpeedKmh: 8, rainMm: 2 },
      previsioni,
      '2026-05-23',
      'collina',
      'trattamento',
      DEFAULT_TONY_METEO_RULES
    );
    expect(ev.esito).toBe('chiedi_trattore');
  });
});

describe('deriveCondizioniMeteoFromCompactRow', () => {
  it('restituisce pioggia con hasRainSoon', () => {
    expect(
      deriveCondizioniMeteoFromCompactRow({
        ok: true,
        hasRainSoon: true,
        description: 'nuvoloso',
      })
    ).toBe('pioggia');
  });

  it('restituisce vento forte oltre soglia trattamento', () => {
    expect(
      deriveCondizioniMeteoFromCompactRow(
        { ok: true, windSpeedKmh: 18, description: 'variabile' },
        { ventoMaxKmh: 15 }
      )
    ).toBe('vento forte');
  });
});
