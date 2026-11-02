/**
 * Funzioni pure della landing (testabili senza browser né rete).
 */

/**
 * Decide quale vista mostrare sulla root.
 * @param {{ landingAttiva: boolean, dev: boolean }} opts
 * @returns {'landing' | 'coming-soon'}
 */
export function scegliVistaHome({ landingAttiva, dev }) {
  if (landingAttiva === true || dev === true) return 'landing';
  return 'coming-soon';
}

/**
 * Elenco di ciò che manca prima di poter accendere la landing pubblicata.
 * @param {{
 *   emailContatto?: string,
 *   testoChiSiamo?: string,
 *   ivaConfermata?: boolean,
 *   testiLegaliPronti?: boolean,
 *   dominioConfermato?: boolean,
 *   ogImmaginePronta?: boolean,
 *   pagineLegali?: Record<string, {
 *     urlTestoCompleto?: string,
 *     testoDefinitivo?: boolean,
 *     titolo?: string,
 *   }>,
 * }} config
 * @returns {string[]}
 */
export function cosaMancaPerAccendere(config = {}) {
  const manca = [];
  if (!String(config.emailContatto || '').trim()) {
    manca.push('email di contatto');
  }
  if (!String(config.testoChiSiamo || '').trim()) {
    manca.push('testo chi siamo');
  }
  if (config.ivaConfermata !== true) {
    manca.push('conferma IVA');
  }
  if (config.testiLegaliPronti !== true) {
    manca.push('testi legali');
  }
  if (config.dominioConfermato !== true) {
    manca.push('dominio non confermato');
  }
  if (config.ogImmaginePronta !== true) {
    manca.push('immagine OG');
  }
  const pagine = config.pagineLegali;
  if (pagine && typeof pagine === 'object') {
    for (const [chiave, pagina] of Object.entries(pagine)) {
      const url = String(pagina?.urlTestoCompleto || '').trim();
      const definitivo = pagina?.testoDefinitivo === true;
      if (!url && !definitivo) {
        const nome = pagina?.titolo || chiave;
        manca.push(`testo completo mancante: ${nome}`);
      }
    }
  }
  return manca;
}

/**
 * Costruisce i due paragrafi della riga prezzi dai piani (senza usare labelFull).
 * @param {{ free?: { maxTerreni?: number }, base?: { price?: number }, monthlyToAnnual?: (n: number) => number, moduli?: Array<{ available?: boolean, price?: number }> }} piani
 * @param {number} giorniGuida
 * @param {{ ivaConfermata?: boolean, emailContatto?: string }} [opzioni]
 * @returns {{ gratis: string, moduli: string }}
 */
export function rigaPrezzi(piani, giorniGuida, opzioni = {}) {
  const maxTerreni = Number(piani?.free?.maxTerreni) || 0;
  const prezzoMese = Number(piani?.base?.price) || 0;
  const toAnnual =
    typeof piani?.monthlyToAnnual === 'function'
      ? piani.monthlyToAnnual
      : (n) => Math.round(Number(n) * 12 * 100) / 100;
  const prezzoAnno = toAnnual(prezzoMese);
  const giorni = Number(giorniGuida) || 0;
  const email = String(opzioni.emailContatto || '').trim();

  let gratis =
    `Provalo gratis: con l'account gratuito puoi gestire fino a ${maxTerreni} terreni` +
    ` e Tony ti guida per ${giorni} giorni dal primo accesso.` +
    ` Se non vuoi limiti passi al Base: ${prezzoAnno} € l'anno, pagati in anticipo.` +
    ` Si rinnova ogni anno;` +
    (email
      ? ` per disdire scrivi a ${email}.`
      : ` per disdire scrivi all'email in fondo alla pagina.`);

  if (opzioni.ivaConfermata === true) {
    // BOZZA: da far rivedere
    gratis += ' Prezzo finale, il venditore non applica IVA.';
  }

  const listaModuli = Array.isArray(piani?.moduli) ? piani.moduli : [];
  const prezziMensili = [];
  for (let i = 0; i < listaModuli.length; i += 1) {
    const m = listaModuli[i];
    if (!m || m.available !== true) continue;
    const p = Number(m.price);
    if (Number.isFinite(p) && p > 0) prezziMensili.push(p);
  }
  let moduli =
    'Moduli specializzati: con il Base puoi aggiungere i moduli per le tue colture' +
    ' e per la tua azienda, compreso il modulo Tony che fa le operazioni al posto tuo.' +
    ' Ogni modulo ha 30 giorni di prova.';
  if (prezziMensili.length > 0) {
    const minAnno = toAnnual(Math.min(...prezziMensili));
    const maxAnno = toAnnual(Math.max(...prezziMensili));
    moduli +=
      ` Ogni modulo si paga una volta l'anno, in anticipo: da ${minAnno} € a ${maxAnno} € l'anno` +
      ` secondo il modulo. Il prezzo preciso di ciascuno lo vedi nella pagina Abbonamento dell'app, prima di pagare.`;
  } else {
    moduli += ' I prezzi li vedi in app prima di pagare.';
  }

  return { gratis, moduli };
}

/**
 * Formato video in base alla larghezza viewport.
 * @param {number} larghezzaPx
 * @returns {'16x9' | '4x5'}
 */
export function formatoVideo(larghezzaPx) {
  const w = Number(larghezzaPx);
  if (!Number.isFinite(w) || w < 768) return '4x5';
  return '16x9';
}

/**
 * Sorgenti e poster per un formato (WebM prima di MP4). Un solo formato per volta.
 * @param {'16x9' | '4x5'} formato
 * @param {string} [basePath='/video']
 * @returns {{ poster: string, sources: Array<{ src: string, type: string }>, track: string }}
 */
export function sorgentiVideo(formato, basePath = '/video') {
  const base = String(basePath || '/video').replace(/\/$/, '');
  const key = formato === '4x5' ? '4x5' : '16x9';
  return {
    poster: `${base}/tony-landing-v2-${key}-poster.jpg`,
    sources: [
      { src: `${base}/tony-landing-v2-${key}.webm`, type: 'video/webm' },
      { src: `${base}/tony-landing-v2-${key}.mp4`, type: 'video/mp4' },
    ],
    track: `${base}/tony-landing-v2-vo-v3.vtt`,
  };
}

/**
 * Voci «Cosa gestisci» per piano gratuito e Base (limiti da LIMITI_LANDING).
 * @param {{
 *   maxTerreniFree: number,
 *   maxAttivitaMeseFree: number,
 *   giorniGuidaTony: number,
 *   domandeGuidaGiorno: number,
 *   prezzoBaseMese: number,
 * }} limiti
 * @returns {{
 *   gratisTitolo: string,
 *   baseTitolo: string,
 *   gratis: Array<{ id: string, nome: string, dettaglio: string | null }>,
 *   base: Array<{ id: string, nome: string, dettaglio: string | null }>,
 * }}
 */
export function vociPianiCosaGestisci(limiti) {
  const maxTerreni = Number(limiti.maxTerreniFree);
  const maxAttivita = Number(limiti.maxAttivitaMeseFree);
  const giorni = Number(limiti.giorniGuidaTony);
  const domande = Number(limiti.domandeGuidaGiorno);
  const prezzo = Number(limiti.prezzoBaseMese);

  const toAnnual =
    typeof limiti.monthlyToAnnual === 'function'
      ? limiti.monthlyToAnnual
      : (n) => Math.round(Number(n) * 12 * 100) / 100;
  const prezzoAnno = Number.isFinite(prezzo) ? toAnnual(prezzo) : prezzo;

  return {
    gratisTitolo: "Con l'account gratuito",
    baseTitolo: `Con il piano Base — ${prezzoAnno} € l'anno`,
    gratis: [
      { id: 'terreni', nome: 'Terreni', dettaglio: `fino a ${maxTerreni}` },
      { id: 'poderi', nome: 'Poderi', dettaglio: null },
      {
        id: 'diario',
        nome: 'Diario attività',
        dettaglio: `fino a ${maxAttivita} al mese`,
      },
      { id: 'statistiche', nome: 'Statistiche', dettaglio: null },
      {
        id: 'tony-guida',
        nome: 'Tony Guida',
        dettaglio: `nell'app: i primi ${giorni} giorni, fino a ${domande} domande al giorno`,
      },
    ],
    base: [
      { id: 'terreni', nome: 'Terreni illimitati', dettaglio: null },
      { id: 'poderi', nome: 'Poderi', dettaglio: null },
      { id: 'diario', nome: 'Diario attività illimitato', dettaglio: null },
      { id: 'statistiche', nome: 'Statistiche', dettaglio: null },
      { id: 'tony-guida', nome: 'Tony Guida, sempre con te', dettaglio: null },
    ],
  };
}

/**
 * Alza i sottotitoli (line:-3) perché la didascalia IA occupa la fascia bassa.
 * Idempotente: applicata due volte non raddoppia line:-3.
 * @param {string} testoVtt
 * @returns {string}
 */
export function alzaSottotitoli(testoVtt) {
  const testo = String(testoVtt ?? '');
  return testo.replace(
    /^(\d{2}:\d{2}:\d{2}\.\d{3}\s-->\s\d{2}:\d{2}:\d{2}\.\d{3})(.*)$/gm,
    (match, timing, rest) => {
      if (/\bline:-3\b/.test(rest)) return match;
      return `${timing} line:-3`;
    }
  );
}
