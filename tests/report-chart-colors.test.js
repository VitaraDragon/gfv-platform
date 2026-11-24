/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  REPORT_CHART_SERIES_FALLBACK,
  REPORT_CHART_ALTRI_FALLBACK,
  readReportChartColors,
  seriesColorAt,
  chartColorsForItems,
  isAltriLabel
} from '../modules/report/js/report-chart-colors.js';

describe('report-chart-colors — regola Pier', () => {
  const colors = readReportChartColors(null);

  it('palette di fallback ha colori tutti distinti', () => {
    const set = new Set(REPORT_CHART_SERIES_FALLBACK);
    expect(set.size).toBe(REPORT_CHART_SERIES_FALLBACK.length);
  });

  it('palette: arancio e rosso/marrone non sono adiacenti; grigio solo per Altri', () => {
    const series = REPORT_CHART_SERIES_FALLBACK.map((c) => c.toLowerCase());
    expect(series[0]).toBe('#16a34a'); // verde
    expect(series[1]).toBe('#ea580c'); // arancio
    expect(series[2]).toBe('#2563eb'); // blu
    expect(series[3]).toBe('#db2777'); // magenta (lontano da arancio)
    expect(series[series.length - 1]).toBe('#78350f'); // marrone in fondo
    expect(series).not.toContain('#b91c1c');
    expect(series).not.toContain(REPORT_CHART_ALTRI_FALLBACK.toLowerCase());
  });

  it('per N voci fino alla lunghezza palette i colori sono distinti', () => {
    const n = colors.series.length;
    const labels = Array.from({ length: n }, (_, i) => `Voce ${i + 1}`);
    const cols = chartColorsForItems(labels, colors);
    expect(new Set(cols).size).toBe(n);
    expect(cols.every((c) => c !== colors.altri)).toBe(true);
  });

  it('oltre la palette usa il grigio', () => {
    const n = colors.series.length;
    expect(seriesColorAt(n, colors)).toBe(colors.altri);
    expect(seriesColorAt(n + 3, colors)).toBe(REPORT_CHART_ALTRI_FALLBACK);
    const labels = Array.from({ length: n + 2 }, (_, i) => `Voce ${i + 1}`);
    const cols = chartColorsForItems(labels, colors);
    expect(cols.slice(0, n).every((c) => c !== colors.altri)).toBe(true);
    expect(cols[n]).toBe(colors.altri);
    expect(cols[n + 1]).toBe(colors.altri);
  });

  it('«Altri» è sempre grigio e diverso dalle altre voci', () => {
    expect(isAltriLabel('Altri')).toBe(true);
    const items = [
      { nome: 'A' },
      { nome: 'B' },
      { nome: 'Altri' },
      { nome: 'C' }
    ];
    const cols = chartColorsForItems(items, colors);
    expect(cols[2]).toBe(colors.altri);
    expect(cols[0]).not.toBe(colors.altri);
    expect(cols[1]).not.toBe(colors.altri);
    expect(cols[3]).not.toBe(colors.altri);
    expect(new Set([cols[0], cols[1], cols[3]]).size).toBe(3);
  });

  it('seriesColorAt non wrappa (niente stesso colore della prima voce)', () => {
    expect(seriesColorAt(0, colors)).toBe(colors.series[0]);
    expect(seriesColorAt(colors.series.length, colors)).not.toBe(colors.series[0]);
  });
});
