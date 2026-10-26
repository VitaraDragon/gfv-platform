/**
 * Landing passo 2 — pagine tecniche/legali, build, hosting (Vitest puro).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOMINIO_CONFERMATO,
  EMAIL_CONTATTO,
  IVA_CONFERMATA,
  LANDING_ATTIVA,
  OG_IMMAGINE,
  OG_IMMAGINE_PRONTA,
  PAGINE_LEGALI,
  TESTI_LEGALI_PRONTI,
  TESTO_CHI_SIAMO,
  URL_SITO,
} from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';
import { testiPagineTecniche } from '../../landing/src/content/testi-pagine-tecniche.js';
import { cosaMancaPerAccendere } from '../../landing/src/lib/landing-logica.js';
import {
  isPaginaLegaleSegnaposto,
  metaHome,
  pianoBuild,
  testoRobots,
  testoSitemap,
} from '../../landing/src/lib/pagine-tecniche.js';
import { DOCUMENTI_LEGALI } from '../../core/config/accettazione-legale-config.js';
import { raccogliStringhe } from './aiuto-stringhe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function leggiTestoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const PAROLE_VIETATE = [
  /certificat/i,
  /SIAN/i,
  /a norma/i,
  /quaderno di campagna/i,
  /fattur/i,
  /trattament/i,
];

const NIENTE_DA_FUORI = [
  'fonts.googleapis',
  'fonts.gstatic',
  'iubenda.com/',
  'youtube',
  'recaptcha',
  'googletagmanager',
  'gstatic.com/firebasejs',
];

describe('pianoBuild', () => {
  it('con flag spento e production → coming-soon senza legali/robots; 404 = copia home', () => {
    const p = pianoBuild({ landingAttiva: false, modo: 'production' });
    expect(p.piano).toBe('coming-soon');
    expect(p.pagineLegali).toBe(false);
    expect(p.robots).toBe(false);
    expect(p.sitemap).toBe(false);
    expect(p.metaOg).toBe(false);
    expect(p.quattostoquattro).toBe('copia-home');
  });

  it('con landingAttiva true → completa', () => {
    const p = pianoBuild({ landingAttiva: true, modo: 'production' });
    expect(p.piano).toBe('completa');
    expect(p.pagineLegali).toBe(true);
    expect(p.robots).toBe(true);
    expect(p.quattostoquattro).toBe('vera');
  });

  it('con modo anteprima → completa anche a flag spento', () => {
    const p = pianoBuild({ landingAttiva: false, modo: 'anteprima' });
    expect(p.piano).toBe('completa');
  });
});

describe('flag e cosaMancaPerAccendere (passo 2)', () => {
  it('LANDING_ATTIVA, TESTI_LEGALI_PRONTI, DOMINIO_CONFERMATO e OG_IMMAGINE_PRONTA sono false', () => {
    expect(LANDING_ATTIVA).toBe(false);
    expect(TESTI_LEGALI_PRONTI).toBe(false);
    expect(DOMINIO_CONFERMATO).toBe(false);
    expect(OG_IMMAGINE_PRONTA).toBe(false);
  });

  it('con la config vera l’elenco contiene dominio, OG e testi legali mancanti', () => {
    const manca = cosaMancaPerAccendere({
      emailContatto: EMAIL_CONTATTO,
      testoChiSiamo: TESTO_CHI_SIAMO,
      ivaConfermata: IVA_CONFERMATA,
      testiLegaliPronti: TESTI_LEGALI_PRONTI,
      dominioConfermato: DOMINIO_CONFERMATO,
      ogImmaginePronta: OG_IMMAGINE_PRONTA,
      pagineLegali: PAGINE_LEGALI,
    });
    expect(manca).toEqual(expect.arrayContaining(['dominio non confermato']));
    expect(manca).toEqual(expect.arrayContaining(['immagine OG']));
    expect(manca.some((x) => x.startsWith('testo completo mancante:'))).toBe(true);
  });

  it('se LANDING_ATTIVA è true, l’elenco deve essere vuoto', () => {
    const manca = cosaMancaPerAccendere({
      emailContatto: EMAIL_CONTATTO,
      testoChiSiamo: TESTO_CHI_SIAMO,
      ivaConfermata: IVA_CONFERMATA,
      testiLegaliPronti: TESTI_LEGALI_PRONTI,
      dominioConfermato: DOMINIO_CONFERMATO,
      ogImmaginePronta: OG_IMMAGINE_PRONTA,
      pagineLegali: PAGINE_LEGALI,
    });
    if (LANDING_ATTIVA === true) {
      expect(manca).toEqual([]);
    }
  });
});

describe('coerenza con accettazione-legale-config (sola lettura)', () => {
  it('ogni chiaveApp non nulla esiste in DOCUMENTI_LEGALI', () => {
    for (const pagina of Object.values(PAGINE_LEGALI)) {
      if (pagina.chiaveApp == null) continue;
      expect(DOCUMENTI_LEGALI).toHaveProperty(pagina.chiaveApp);
    }
  });

  it('ogni versione ha formato <nome>-AAAA-MM-GG', () => {
    for (const pagina of Object.values(PAGINE_LEGALI)) {
      expect(pagina.versione).toMatch(/^[a-z0-9-]+-\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('PAGINE_LEGALI e footer LandingHome', () => {
  it('percorsi esatti /termini, /privacy, /cookie', () => {
    expect(PAGINE_LEGALI.termini.percorso).toBe('/termini');
    expect(PAGINE_LEGALI.privacy.percorso).toBe('/privacy');
    expect(PAGINE_LEGALI.cookie.percorso).toBe('/cookie');
  });

  it('footer non ha più gli indirizzi scritti a mano; mostra ancora i tre link', () => {
    const vue = leggiTestoFile('landing/src/views/LandingHome.vue');
    expect(vue).not.toMatch(/href="\/termini"/);
    expect(vue).not.toMatch(/href="\/privacy"/);
    expect(vue).not.toMatch(/href="\/cookie"/);
    expect(vue).toContain('PAGINE_LEGALI.termini.percorso');
    expect(vue).toContain('PAGINE_LEGALI.privacy.percorso');
    expect(vue).toContain('PAGINE_LEGALI.cookie.percorso');
    expect(vue).toContain('t.footer.linkTermini');
    expect(vue).toContain('t.footer.linkPrivacy');
    expect(vue).toContain('t.footer.linkCookie');
  });
});

describe('testoRobots', () => {
  it('User-agent e Sitemap senza doppie barre', () => {
    const t = testoRobots({ urlSito: 'https://gfvagri.com' });
    expect(t).toContain('User-agent: *');
    expect(t).toContain('Sitemap: https://gfvagri.com/sitemap.xml');
    expect(t).not.toMatch(/https:\/\/gfvagri\.com\/\/sitemap/);

    const conSlash = testoRobots({ urlSito: 'https://gfvagri.com/' });
    expect(conSlash).toContain('Sitemap: https://gfvagri.com/sitemap.xml');
    expect(conSlash).not.toMatch(/com\/\/sitemap/);
  });
});

describe('testoSitemap', () => {
  it('XML con urlset; oggi solo /; niente 404; include legale non segnaposto', () => {
    const oggi = testoSitemap({
      urlSito: URL_SITO,
      pagine: Object.values(PAGINE_LEGALI).map((p) => ({
        percorso: p.percorso,
        segnaposto: isPaginaLegaleSegnaposto(p),
      })),
    });
    expect(oggi).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(oggi).toContain('<urlset');
    expect(oggi).toContain('<loc>https://gfvagri.com/</loc>');
    expect(oggi).not.toContain('/termini');
    expect(oggi).not.toContain('404');

    const conPrivacy = testoSitemap({
      urlSito: URL_SITO,
      pagine: [
        { percorso: '/privacy', segnaposto: false },
        { percorso: '/termini', segnaposto: true },
      ],
    });
    expect(conPrivacy).toContain('https://gfvagri.com/privacy');
    expect(conPrivacy).not.toContain('/termini');
  });
});

describe('metaHome', () => {
  it('title, description, canonical, OG, twitter; immagine solo se pronta; escape', () => {
    const html = metaHome({
      urlSito: URL_SITO,
      ogImmagine: OG_IMMAGINE,
      ogImmaginePronta: false,
      testi: testiPagineTecniche.metaHome,
    });
    expect(html).toContain(
      '<title>Global Farm View — Tony ti guida dal primo accesso</title>'
    );
    expect(testiPagineTecniche.metaHome.title).toBe(testiLanding.documentTitle);
    expect(html).toContain(
      'content="Il gestionale agricolo semplice: basta uno smartphone o un computer con internet. Tony ti guida dal primo accesso. Gratis per iniziare."'
    );
    expect(html).toContain('href="https://gfvagri.com/"');
    expect(html).toContain('property="og:url" content="https://gfvagri.com/"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toContain('og:image');

    const conImg = metaHome({
      urlSito: URL_SITO,
      ogImmagine: OG_IMMAGINE,
      ogImmaginePronta: true,
      testi: testiPagineTecniche.metaHome,
    });
    expect(conImg).toContain(
      `content="https://gfvagri.com${OG_IMMAGINE}"`
    );
    expect(conImg).toContain('og:image:width" content="1200"');
    expect(conImg).toContain('og:image:height" content="630"');

    const escaped = metaHome({
      urlSito: 'https://example.com',
      ogImmagine: '/x.jpg',
      ogImmaginePronta: false,
      testi: {
        title: 'A & B <C> "D"',
        description: 'Uno "due" & tre',
      },
    });
    expect(escaped).toContain('A &amp; B &lt;C&gt; &quot;D&quot;');
    expect(escaped).toContain('Uno &quot;due&quot; &amp; tre');
  });
});

describe('firebase.json hosting', () => {
  it('blocco hosting come da brief; altri blocchi invariati', () => {
    const raw = leggiTestoFile('firebase.json');
    const conf = JSON.parse(raw);

    expect(conf.hosting.target).toBe('default');
    expect(conf.hosting.public).toBe('landing/dist');
    expect(conf.hosting.ignore).toEqual([
      'firebase.json',
      '**/.*',
      '**/node_modules/**',
      '**/functions/**',
      '**/docs-sviluppo/**',
      '**/documentazione-utente/**',
    ]);
    expect(conf.hosting.cleanUrls).toBe(true);
    expect(conf.hosting.trailingSlash).toBe(false);
    expect(conf.hosting.rewrites).toBeUndefined();
    expect(conf.hosting.headers).toBeUndefined();

    expect(conf.firestore).toEqual({
      rules: 'firestore.rules',
      indexes: 'firestore.indexes.json',
    });
    expect(conf.storage).toEqual({ rules: 'storage.rules' });
    expect(conf.functions).toEqual({
      source: 'functions',
      predeploy: ['node functions/scripts/sync-notification-modules.cjs'],
    });
    expect(conf.emulators).toEqual({
      auth: { port: 9099 },
      firestore: { port: 8080 },
      functions: { port: 5001 },
      storage: { port: 9199 },
      ui: { enabled: true },
    });
  });
});

describe('pagine statiche HTML', () => {
  const pages = [
    'landing/termini.html',
    'landing/privacy.html',
    'landing/cookie.html',
    'landing/404.html',
  ];

  it('lang=it, niente script http esterni, privacy ha #tony, niente nomi/P.IVA vietati', () => {
    for (const rel of pages) {
      const t = leggiTestoFile(rel);
      expect(t).toContain('lang="it"');
      expect(t.toLowerCase()).not.toMatch(/<script[^>]+src=["']http/);
      expect(t).not.toContain('GFV Platform');
      expect(t).not.toContain('GFVagri');
      expect(t).not.toMatch(/P\.IVA|Partita IVA|codice fiscale/i);
      for (const re of PAROLE_VIETATE) {
        expect(t).not.toMatch(re);
      }
    }
    const privacy = leggiTestoFile('landing/privacy.html');
    expect(privacy).toContain('id="tony"');
    expect(privacy).toContain("Tony, l'assistente virtuale");
    expect(privacy).toContain('Sezione in preparazione.');
  });

  it('dopo sostituzione di prova non restano {{gfv: e c’è il riquadro in preparazione', async () => {
    const { mappaSegnapostoPaginaLegale, applicaSegnaposto } = await import(
      '../../landing/src/lib/pagine-tecniche.js'
    );
    const src = leggiTestoFile('landing/privacy.html');
    const mappa = mappaSegnapostoPaginaLegale({
      pagina: PAGINE_LEGALI.privacy,
      pagineLegali: PAGINE_LEGALI,
      testi: testiPagineTecniche,
      urlSito: URL_SITO,
      conSezioneTony: false,
    });
    const out = applicaSegnaposto(src, mappa);
    expect(out).toContain('id="tony"');
    expect(out).toContain('Testo in preparazione');
    expect(out).not.toContain('{{gfv:');
  });
});

describe('parole vietate in testi-pagine-tecniche', () => {
  it('nessuna parola vietata nelle stringhe', () => {
    const tutto = raccogliStringhe(testiPagineTecniche).join('\n');
    for (const re of PAROLE_VIETATE) {
      expect(tutto).not.toMatch(re);
    }
    expect(tutto).not.toContain('GFV Platform');
    expect(tutto).not.toContain('GFVagri');
  });

  it('segnaposto non sembrano definitivi; riquadro presente se url vuoto', () => {
    const tutto = raccogliStringhe(testiPagineTecniche).join('\n').toLowerCase();
    expect(tutto).not.toContain('versione definitiva');
    expect(tutto).not.toContain('in vigore dal');
    for (const p of Object.values(PAGINE_LEGALI)) {
      if (!String(p.urlTestoCompleto || '').trim() && p.testoDefinitivo !== true) {
        expect(testiPagineTecniche.riquadroInPreparazione).toMatch(/Testo in preparazione/);
      }
    }
  });
});

describe('niente da fuori (file nuovi del passo 2)', () => {
  it('nessun font Google, iubenda in script, youtube, recaptcha, GTM, firebase js', () => {
    const files = [
      'landing/termini.html',
      'landing/privacy.html',
      'landing/cookie.html',
      'landing/404.html',
      'landing/src/styles/pagine-tecniche.css',
      'landing/vite.config.ts',
      'landing/src/lib/pagine-tecniche.js',
      'landing/src/content/testi-pagine-tecniche.js',
      'landing/src/config/landing-config.js',
      'landing/src/lib/landing-logica.js',
      'landing/src/router/index.ts',
      'landing/src/views/LandingHome.vue',
    ];
    for (const rel of files) {
      const testo = leggiTestoFile(rel).toLowerCase();
      for (const v of NIENTE_DA_FUORI) {
        if (v === 'iubenda.com/') {
          // vietato solo dentro uno <script
          const scriptChunks = testo.split(/<script/);
          for (let i = 1; i < scriptChunks.length; i += 1) {
            const chunk = scriptChunks[i].split('</script>')[0] || '';
            expect(chunk, `${rel} script non deve contenere iubenda`).not.toContain(
              'iubenda.com/'
            );
          }
          continue;
        }
        expect(testo, `${rel} non deve contenere ${v}`).not.toContain(v);
      }
    }
  });
});

describe('root e Coming soon intatti', () => {
  it('root index.html ha ancora Stiamo arrivando; ComingSoon e landing/index senza OG nuovi', () => {
    expect(leggiTestoFile('index.html')).toContain('Stiamo arrivando');
    const coming = leggiTestoFile('landing/src/views/ComingSoon.vue');
    const landingIndex = leggiTestoFile('landing/index.html');
    expect(coming).not.toMatch(/og:/i);
    expect(landingIndex).not.toMatch(/property=["']og:/i);
    expect(landingIndex).toContain(
      'Global Farm View — La tua azienda, una nuova prospettiva'
    );
  });
});
