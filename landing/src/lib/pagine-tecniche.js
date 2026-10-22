/**
 * Funzioni pure: piano di build, robots, sitemap, meta home, segnaposto HTML.
 * Nessuna dipendenza da Firebase, rete o browser.
 */

/**
 * @param {{ landingAttiva: boolean, modo: string }} opts
 * @returns {{
 *   piano: 'coming-soon' | 'completa',
 *   pagineLegali: boolean,
 *   robots: boolean,
 *   sitemap: boolean,
 *   metaOg: boolean,
 *   quattostoquattro: 'copia-home' | 'vera',
 * }}
 */
export function pianoBuild({ landingAttiva, modo }) {
  const modoNorm = String(modo || '');
  const completa =
    landingAttiva === true ||
    modoNorm === 'anteprima' ||
    modoNorm === 'development';

  if (completa) {
    return {
      piano: 'completa',
      pagineLegali: true,
      robots: true,
      sitemap: true,
      metaOg: true,
      quattostoquattro: 'vera',
    };
  }

  return {
    piano: 'coming-soon',
    pagineLegali: false,
    robots: false,
    sitemap: false,
    metaOg: false,
    quattostoquattro: 'copia-home',
  };
}

/**
 * Una pagina legale è ancora segnaposto se non c'è link al testo completo
 * né testo definitivo nella nostra pagina.
 * @param {{ urlTestoCompleto?: string, testoDefinitivo?: boolean }} pagina
 */
export function isPaginaLegaleSegnaposto(pagina) {
  const url = String(pagina?.urlTestoCompleto || '').trim();
  if (url) return false;
  if (pagina?.testoDefinitivo === true) return false;
  return true;
}

/**
 * @param {string} urlSito
 * @returns {string} senza slash finale
 */
export function normalizzaUrlSito(urlSito) {
  return String(urlSito || '')
    .trim()
    .replace(/\/+$/, '');
}

/**
 * @param {{ urlSito: string }} opts
 * @returns {string}
 */
export function testoRobots({ urlSito }) {
  const base = normalizzaUrlSito(urlSito);
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * @param {{
 *   urlSito: string,
 *   pagine: Array<{ percorso: string, segnaposto?: boolean }>,
 *   lastmod?: string,
 * }} opts
 * @returns {string}
 */
export function testoSitemap({ urlSito, pagine, lastmod }) {
  const base = normalizzaUrlSito(urlSito);
  const urls = [`${base}/`];

  for (const p of pagine || []) {
    if (p.segnaposto === true) continue;
    const percorso = String(p.percorso || '');
    if (!percorso || percorso === '/' || percorso === '/404') continue;
    const path = percorso.startsWith('/') ? percorso : `/${percorso}`;
    urls.push(`${base}${path}`);
  }

  const lastmodTag =
    lastmod && String(lastmod).trim()
      ? `\n    <lastmod>${escapeXml(String(lastmod).trim())}</lastmod>`
      : '';

  const blocchi = urls
    .map(
      (loc) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmodTag}
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blocchi}
</urlset>
`;
}

/**
 * @param {string} s
 */
function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} s
 */
function escapeXml(s) {
  return escapeHtmlAttr(s);
}

/**
 * Costruisce i tag title/description/canonical/OG/Twitter per la home (modo completo).
 * @param {{
 *   urlSito: string,
 *   ogImmagine: string,
 *   ogImmaginePronta: boolean,
 *   testi: { title: string, description: string, ogImageAlt?: string },
 * }} opts
 * @returns {string} frammento HTML (senza wrapper)
 */
export function metaHome({ urlSito, ogImmagine, ogImmaginePronta, testi }) {
  const base = normalizzaUrlSito(urlSito);
  const title = escapeHtmlAttr(testi.title);
  const description = escapeHtmlAttr(testi.description);
  const canonical = escapeHtmlAttr(`${base}/`);
  const ogAlt = escapeHtmlAttr(
    testi.ogImageAlt || 'Global Farm View: Tony ti guida dal primo accesso'
  );

  const righe = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Global Farm View" />`,
    `<meta property="og:locale" content="it_IT" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];

  if (ogImmaginePronta === true) {
    const imgPath = String(ogImmagine || '').startsWith('/')
      ? String(ogImmagine)
      : `/${String(ogImmagine || '')}`;
    const imgAbs = escapeHtmlAttr(`${base}${imgPath}`);
    righe.push(`<meta property="og:image" content="${imgAbs}" />`);
    righe.push(`<meta property="og:image:width" content="1200" />`);
    righe.push(`<meta property="og:image:height" content="630" />`);
    righe.push(`<meta property="og:image:alt" content="${ogAlt}" />`);
  }

  return righe.join('\n    ');
}

/**
 * Sostituisce {{gfv:chiave}} nel HTML. Alla fine non deve restare nessun {{gfv:.
 * @param {string} html
 * @param {Record<string, string>} mappa
 * @returns {string}
 */
export function applicaSegnaposto(html, mappa) {
  let out = String(html);
  out = out.replace(/\{\{gfv:([a-zA-Z0-9_.-]+)\}\}/g, (match, chiave) => {
    if (!Object.prototype.hasOwnProperty.call(mappa, chiave)) {
      throw new Error(`Segnaposto sconosciuto: ${chiave}`);
    }
    return mappa[chiave];
  });
  if (out.includes('{{gfv:')) {
    throw new Error('Restano segnaposto {{gfv: non sostituiti');
  }
  return out;
}

/**
 * Contesto HTML per una pagina legale (o pezzi condivisi).
 * @param {{
 *   pagina: { percorso: string, titolo: string, urlTestoCompleto?: string, testoDefinitivo?: boolean },
 *   pagineLegali: Record<string, { percorso: string, titolo: string }>,
 *   testi: typeof import('../content/testi-pagine-tecniche.js').testiPagineTecniche,
 *   urlSito: string,
 *   emailContatto?: string,
 *   pecContatto?: string,
 *   conSezioneTony?: boolean,
 * }} opts
 * @returns {Record<string, string>}
 */
export function mappaSegnapostoPaginaLegale(opts) {
  const {
    pagina,
    pagineLegali,
    testi,
    urlSito,
    emailContatto = '',
    pecContatto = '',
    conSezioneTony = false,
  } = opts;

  const base = normalizzaUrlSito(urlSito);
  const percorso = pagina.percorso;
  const segnaposto = isPaginaLegaleSegnaposto(pagina);
  const urlCompleto = String(pagina.urlTestoCompleto || '').trim();

  const titlePage = escapeHtmlAttr(`${pagina.titolo} — ${testi.brand}`);
  const canonical = `<link rel="canonical" href="${escapeHtmlAttr(`${base}${percorso}`)}" />`;
  const robotsMeta = segnaposto
    ? '<meta name="robots" content="noindex" />'
    : '';

  let contenuto = '';
  if (urlCompleto) {
    contenuto += `<p class="link-completo"><a href="${escapeHtmlAttr(urlCompleto)}" rel="noopener" target="_blank">${escapeHtmlAttr(testi.linkTestoCompleto)}</a></p>\n`;
  } else {
    // BOZZA: da far rivedere — riquadro solo se manca il testo completo
    contenuto += `<aside class="riquadro-preparazione" role="note"><p>${escapeHtmlAttr(testi.riquadroInPreparazione)}</p></aside>\n`;
  }

  if (conSezioneTony) {
    contenuto += `<section id="tony" class="sezione-tony">
      <h2>${escapeHtmlAttr(testi.sezioneTony.titolo)}</h2>
      <p>${escapeHtmlAttr(testi.sezioneTony.testo)}</p>
    </section>\n`;
  }

  const contatti = [];
  if (String(emailContatto || '').trim()) {
    const em = String(emailContatto).trim();
    contatti.push(
      `<a href="mailto:${escapeHtmlAttr(em)}">${escapeHtmlAttr(em)}</a>`
    );
  }
  if (String(pecContatto || '').trim()) {
    const pec = String(pecContatto).trim();
    contatti.push(
      `<a href="mailto:${escapeHtmlAttr(pec)}">${escapeHtmlAttr(pec)}</a> (PEC)`
    );
  }
  const rigaOfferto =
    contatti.length > 0
      ? `${escapeHtmlAttr(testi.offertoDa)} — ${contatti.join(' · ')}`
      : escapeHtmlAttr(testi.offertoDa);

  const altre = Object.values(pagineLegali)
    .filter((p) => p.percorso !== percorso)
    .map(
      (p) =>
        `<a href="${escapeHtmlAttr(p.percorso)}">${escapeHtmlAttr(p.titolo)}</a>`
    );
  altre.push(`<a href="/">${escapeHtmlAttr(testi.linkHome)}</a>`);

  return {
    title: titlePage,
    robotsMeta,
    canonical,
    h1: escapeHtmlAttr(pagina.titolo),
    contenuto,
    offertoDa: rigaOfferto,
    navLegale: altre.join('\n        '),
    brand: escapeHtmlAttr(testi.brand),
  };
}

/**
 * Contesto HTML per la 404 vera.
 * @param {{
 *   pagineLegali: Record<string, { percorso: string, titolo: string }>,
 *   testi: typeof import('../content/testi-pagine-tecniche.js').testiPagineTecniche,
 *   urlSito: string,
 * }} opts
 */
export function mappaSegnaposto404(opts) {
  const { pagineLegali, testi, urlSito } = opts;
  const base = normalizzaUrlSito(urlSito);
  const titlePage = escapeHtmlAttr(
    `${testi.nonTrovata.titolo} — ${testi.brand}`
  );

  const nav = Object.values(pagineLegali)
    .map(
      (p) =>
        `<a href="${escapeHtmlAttr(p.percorso)}">${escapeHtmlAttr(p.titolo)}</a>`
    )
    .join('\n        ');

  return {
    title: titlePage,
    robotsMeta: '<meta name="robots" content="noindex" />',
    canonical: `<link rel="canonical" href="${escapeHtmlAttr(`${base}/`)}" />`,
    h1: escapeHtmlAttr(testi.nonTrovata.titolo),
    testo: escapeHtmlAttr(testi.nonTrovata.testo),
    cta: escapeHtmlAttr(testi.nonTrovata.cta),
    navLegale: nav,
    brand: escapeHtmlAttr(testi.brand),
  };
}
