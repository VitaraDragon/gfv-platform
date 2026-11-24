/**
 * Colori grafici Report — lettura CSS condivisa (report-chart-palette.css).
 * Usato da Macchine e Manodopera: niente palette locale duplicata.
 */

/** @type {string[]} */
export const REPORT_CHART_SERIES_FALLBACK = [
  '#16a34a',
  '#ea580c',
  '#2563eb',
  '#7c3aed',
  '#ca8a04',
  '#b91c1c',
  '#0d9488',
  '#db2777'
];

/**
 * @param {CSSStyleDeclaration} [cs]
 * @returns {{
 *   series: string[],
 *   validate: string,
 *   daValidare: string,
 *   proprietario: string,
 *   nonClassificato: string,
 *   mano: string,
 *   attrezzo: string,
 *   specializzato: string,
 *   trattorista: string,
 *   altroTipo: string,
 *   warn: string
 * }}
 */
export function readReportChartColors(cs) {
  const style = cs || (typeof getComputedStyle === 'function'
    ? getComputedStyle(document.documentElement)
    : null);
  const read = (name, fallback) => {
    if (!style) return fallback;
    return style.getPropertyValue(name).trim() || fallback;
  };
  const series = [1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
    read(`--report-chart-${i}`, REPORT_CHART_SERIES_FALLBACK[i - 1])
  );
  return {
    series,
    validate: read('--report-chart-validate', '#2563eb'),
    daValidare: read('--report-chart-da-validare', read('--warn', '#c2410c')),
    proprietario: read('--report-chart-proprietario', read('--proprietario', '#059669')),
    nonClassificato: read('--report-chart-non-classificato', read('--non-classificato', '#78716c')),
    mano: read('--mano', '#2563eb'),
    attrezzo: read('--attrezzo', '#ea580c'),
    specializzato: read('--specializzato', '#7c3aed'),
    trattorista: read('--trattorista', '#0d9488'),
    altroTipo: read('--altro-tipo', '#ca8a04'),
    warn: read('--warn', '#c2410c')
  };
}

/**
 * @param {number} index
 * @param {{ series?: string[] }} colors
 * @returns {string}
 */
export function seriesColorAt(index, colors) {
  const series = (colors && colors.series && colors.series.length)
    ? colors.series
    : REPORT_CHART_SERIES_FALLBACK;
  const i = Math.abs(Number(index) || 0) % series.length;
  return series[i];
}

/**
 * @param {string} tipo
 * @param {ReturnType<typeof readReportChartColors>} colors
 * @returns {string}
 */
export function colorForTipoMezzo(tipo, colors) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'trattore') return colors.mano;
  if (t === 'attrezzo') return colors.attrezzo;
  if (!t) return colors.nonClassificato;
  return colors.series[2] || colors.mano;
}

/**
 * @param {string} tipo
 * @param {ReturnType<typeof readReportChartColors>} colors
 * @returns {string}
 */
export function colorForTipoOperaio(tipo, colors) {
  const t = String(tipo || '').trim().toLowerCase();
  if (!t) return colors.nonClassificato;
  if (t === 'proprietario') return colors.proprietario;
  if (t === 'semplice') return colors.mano;
  if (t === 'specializzato') return colors.specializzato;
  if (t === 'trattorista') return colors.trattorista;
  return colors.altroTipo;
}
