import { describe, it, expect } from 'vitest';
import {
  compactDailyExtendedForContext,
  maxRemainingHourlyPop,
  buildTodayForecastCopy,
  renderHourlyPopBadge,
  formatRainMmShort,
  compactTerrenoMeteoRowFromFetch,
} from '../core/js/meteo-ui-helpers.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { normalizeOpenWeatherExtended } = require('../functions/meteo-service.js');

describe('compactDailyExtendedForContext', () => {
  it('compatta dt, temperature e pop per Tony', () => {
    const out = compactDailyExtendedForContext([
      {
        dt: '2026-05-27T00:00:00.000Z',
        tempMin: 12,
        tempMax: 22,
        pop: 80,
        description: 'pioggia leggera',
      },
    ]);
    expect(out).toEqual([
      {
        dt: '2026-05-27',
        tempMin: 12,
        tempMax: 22,
        pop: 80,
        rainMm: null,
        windSpeedKmh: null,
        humidity: null,
        description: 'pioggia leggera',
      },
    ]);
  });

  it('modalità slim omette description e accorcia dt', () => {
    const out = compactDailyExtendedForContext(
      [{ dt: '2026-05-27T00:00:00.000Z', tempMin: 12, tempMax: 22, pop: 80, rainMm: 6, description: 'x' }],
      { slim: true }
    );
    expect(out[0]).toEqual({
      dt: '2026-05-27',
      tempMin: 12,
      tempMax: 22,
      pop: 80,
      rainMm: 6,
      windSpeedKmh: null,
      humidity: null,
    });
  });

  it('restituisce array vuoto se mancano dati', () => {
    expect(compactDailyExtendedForContext(null)).toEqual([]);
  });
});

describe('compactTerrenoMeteoRowFromFetch', () => {
  it('include previsioniGiornaliere dal meteo esteso', () => {
    const row = compactTerrenoMeteoRowFromFetch({
      terrenoId: 't1',
      nome: 'Sabbie Gialle',
      ok: true,
      meteo: {
        current: { temp: 20, description: 'sereno', windSpeedKmh: 8 },
        today: { pop: 10 },
        tomorrow: { pop: 20 },
        dailyExtended: [{ dt: '2026-05-27T00:00:00.000Z', tempMin: 11, tempMax: 19, pop: 75 }],
        alerts: [],
        minutelySummary: {},
      },
    });
    expect(row.previsioniGiornaliere).toHaveLength(1);
    expect(row.previsioniGiornaliere[0].pop).toBe(75);
  });
});

describe('maxRemainingHourlyPop', () => {
  it('restituisce il massimo pop sulle ore future di oggi', () => {
    const now = new Date('2026-05-21T13:00:00');
    const meteo = {
      hourly: [
        { dt: '2026-05-21T10:00:00', pop: 90 },
        { dt: '2026-05-21T14:00:00', pop: 5 },
        { dt: '2026-05-21T20:00:00', pop: 12 },
        { dt: '2026-05-22T08:00:00', pop: 80 },
      ],
    };
    expect(maxRemainingHourlyPop(meteo, now)).toBe(12);
  });
});

describe('formatRainMmShort', () => {
  it('formatta mm positivi', () => {
    expect(formatRainMmShort(12.56)).toBe('12.6 mm');
    expect(formatRainMmShort(0)).toBe('');
  });
});

describe('normalizeOpenWeatherExtended rainMm', () => {
  it('estrae rainMm da daily.rain e hourly.rain.1h', () => {
    const out = normalizeOpenWeatherExtended(
      {
        current: { temp: 20, weather: [{ description: 'sereno' }] },
        daily: [
          { dt: 1716300000, temp: { min: 14, max: 26 }, pop: 0.8, rain: 12.57, weather: [{ description: 'pioggia' }] },
          { dt: 1716386400, temp: { min: 12, max: 22 }, pop: 0.1, weather: [{ description: 'nuvoloso' }] },
        ],
        hourly: [
          { dt: 1716300000, temp: 18, pop: 0.5, rain: { '1h': 2.5 }, weather: [{ description: 'pioggia' }] },
          { dt: 1716303600, temp: 17, pop: 0.2, rain: { '1h': 1.2 }, weather: [{ description: 'pioggia' }] },
        ],
      },
      { label: 'Test' }
    );
    expect(out.dailyExtended[0].rainMm).toBe(12.57);
    expect(out.today.rainMm).toBe(12.57);
    expect(out.hourly[0].rainMm).toBe(2.5);
  });
});

describe('buildTodayForecastCopy', () => {
  it('usa max ore restanti e nota se daily molto più alto', () => {
    const now = new Date('2026-05-21T13:00:00');
    const copy = buildTodayForecastCopy(
      {
        today: { tempMin: 14, tempMax: 26, pop: 97, description: 'cielo sereno' },
        hourly: [
          { dt: '2026-05-21T14:00:00', pop: 0 },
          { dt: '2026-05-21T18:00:00', pop: 3 },
        ],
      },
      now
    );
    expect(copy.main).toMatch(/prob\. pioggia max \(ore restanti\): 3%/);
    expect(copy.note).toMatch(/Prob\. pioggia in giornata \(modello OpenWeather\): 97%/);
  });

  it('senza hourly mostra prob. in giornata', () => {
    const copy = buildTodayForecastCopy({
      today: { tempMin: 10, tempMax: 24, pop: 40, rainMm: 3.5 },
    });
    expect(copy.main).toBe('Oggi 10–24°C · prob. pioggia in giornata: 40% · 3.5 mm previsti');
    expect(copy.note).toBe('');
  });
});

describe('renderHourlyPopBadge', () => {
  it('non renderizza sotto la soglia', () => {
    expect(renderHourlyPopBadge(0, 'dashboard-meteo')).toBe('');
  });

  it('renderizza percentuale sopra soglia', () => {
    expect(renderHourlyPopBadge(15, 'dashboard-meteo')).toContain('15%');
  });
});
