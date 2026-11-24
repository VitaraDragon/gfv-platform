/**
 * Colori grafici Report — lettura CSS condivisa (report-chart-palette.css).
 * Usato da Economici, Macchine, Manodopera, Magazzino: niente palette locale duplicata.
 *
 * Regola: N voci fino a lunghezza palette → colori tutti distinti;
 * oltre → grigio; «Altri» è sempre grigio e diverso dalle altre voci.
 */

/** @type {string[]} */
export const REPORT_CHART_SERIES_FALLBACK = [
  '#16a34a',
  '#ea580c',
  '#2563eb',
  '#7c3aed',
  '#b91c1c',
  '#0d9488',
  '#ca8a04',
  '#db2777'
];

export const REPORT_CHART_ALTRI_FALLBACK = '#94a3b8';

/**
 * @param {CSSStyleDeclaration} [cs]
 * @returns {{
 *   series: string[],
 *   altri: string,
 *   validate: string,
 *   daValidare: string,
 *   proprietario: string,
 *   nonClassificato: string,
 *   mano: string,
 *   mac: string,
 *   prod: string,
 *   carb: string,
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
    altri: read('--report-chart-altri', REPORT_CHART_ALTRI_FALLBACK),
    validate: read('--report-chart-validate', '#2563eb'),
    daValidare: read('--report-chart-da-validare', read('--warn', '#c2410c')),
    proprietario: read('--report-chart-proprietario', read('--proprietario', '#059669')),
    nonClassificato: read('--report-chart-non-classificato', read('--non-classificato', '#78716c')),
    mano: read('--mano', '#2563eb'),
    mac: read('--mac', '#ea580c'),
    prod: read('--prod', '#16a34a'),
    carb: read('--carb', '#ca8a04'),
    attrezzo: read('--attrezzo', '#ea580c'),
    specializzato: read('--specializzato', '#7c3aed'),
    trattorista: read('--trattorista', '#0d9488'),
    altroTipo: read('--altro-tipo', '#ca8a04'),
    warn: read('--warn', '#c2410c')
  };
}

/**
 * Colore di serie per indice: oltre la palette → grigio (niente wrap).
 * @param {number} index
 * @param {{ series?: string[], altri?: string }} colors
 * @returns {string}
 */
export function seriesColorAt(index, colors) {
  const series = (colors && colors.series && colors.series.length)
    ? colors.series
    : REPORT_CHART_SERIES_FALLBACK;
  const grey = (colors && colors.altri) || REPORT_CHART_ALTRI_FALLBACK;
  const i = Math.abs(Number(index) || 0);
  if (i >= series.length) return grey;
  return series[i];
}

/**
 * True se la voce è il bucket aggregato «Altri».
 * @param {string|null|undefined} label
 */
export function isAltriLabel(label) {
  return String(label || '').trim().toLowerCase() === 'altri';
}

/**
 * Assegna un colore a ogni etichetta dello stesso grafico.
 * «Altri» → sempre grigio; le altre voci usano la palette in ordine;
 * se le tinte finiscono, le rimanenti (oltre «Altri») vanno in grigio.
 *
 * @param {Array<string|{ nome?: string, label?: string, terrenoNome?: string }>} items
 * @param {{ series?: string[], altri?: string }} colors
 * @returns {string[]}
 */
export function chartColorsForItems(items, colors) {
  const series = (colors && colors.series && colors.series.length)
    ? colors.series
    : REPORT_CHART_SERIES_FALLBACK;
  const grey = (colors && colors.altri) || REPORT_CHART_ALTRI_FALLBACK;
  const list = items || [];
  let paletteIdx = 0;
  return list.map((item) => {
    const label = typeof item === 'string'
      ? item
      : (item && (item.nome || item.label || item.terrenoNome || ''));
    if (isAltriLabel(label)) return grey;
    if (paletteIdx >= series.length) return grey;
    const c = series[paletteIdx];
    paletteIdx += 1;
    return c;
  });
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
