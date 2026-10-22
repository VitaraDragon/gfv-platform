import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

import {
  EMAIL_CONTATTO,
  LANDING_ATTIVA,
  OG_IMMAGINE,
  OG_IMMAGINE_PRONTA,
  PAGINE_LEGALI,
  PEC_CONTATTO,
  URL_SITO,
} from './src/config/landing-config.js';
import { testiPagineTecniche } from './src/content/testi-pagine-tecniche.js';
import {
  applicaSegnaposto,
  isPaginaLegaleSegnaposto,
  mappaSegnaposto404,
  mappaSegnapostoPaginaLegale,
  metaHome,
  pianoBuild,
  testoRobots,
  testoSitemap,
} from './src/lib/pagine-tecniche.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function nomePaginaDaHtml(filename: string): string | null {
  const base = path.basename(filename).replace(/\.html$/i, '');
  if (base === 'termini' || base === 'privacy' || base === 'cookie' || base === '404') {
    return base;
  }
  return null;
}

function isHomeHtml(filename: string, urlPath: string): boolean {
  if (/index\.html$/i.test(filename)) return true;
  if (urlPath === '/' || urlPath === '/index.html') return true;
  return false;
}

function pluginPagineTecniche(piano: ReturnType<typeof pianoBuild>): Plugin {
  return {
    name: 'gfv-pagine-tecniche',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const filename = ctx.filename || '';
        const urlPath = ctx.path || '';
        const nome = nomePaginaDaHtml(filename);

        if (nome === 'termini' || nome === 'privacy' || nome === 'cookie') {
          const pagina = PAGINE_LEGALI[nome];
          const mappa = mappaSegnapostoPaginaLegale({
            pagina,
            pagineLegali: PAGINE_LEGALI,
            testi: testiPagineTecniche,
            urlSito: URL_SITO,
            emailContatto: EMAIL_CONTATTO,
            pecContatto: PEC_CONTATTO,
            // #tony è già nel sorgente privacy.html (senza JS)
            conSezioneTony: false,
          });
          return applicaSegnaposto(html, mappa);
        }

        if (nome === '404') {
          const mappa = mappaSegnaposto404({
            pagineLegali: PAGINE_LEGALI,
            testi: testiPagineTecniche,
            urlSito: URL_SITO,
          });
          return applicaSegnaposto(html, mappa);
        }

        if (piano.metaOg && isHomeHtml(filename, urlPath)) {
          const tags = metaHome({
            urlSito: URL_SITO,
            ogImmagine: OG_IMMAGINE,
            ogImmaginePronta: OG_IMMAGINE_PRONTA,
            testi: testiPagineTecniche.metaHome,
          });
          let out = html.replace(/<title>[^<]*<\/title>\s*/i, '');
          out = out.replace(/<meta\s+name="description"[^>]*>\s*/i, '');
          out = out.replace(/<\/head>/i, `    ${tags}\n  </head>`);
          return out;
        }

        return html;
      },
    },
    writeBundle(options) {
      const outDir = options.dir || path.resolve(__dirname, 'dist');

      if (piano.quattostoquattro === 'copia-home') {
        const indexPath = path.join(outDir, 'index.html');
        const notFoundPath = path.join(outDir, '404.html');
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, notFoundPath);
        }
        return;
      }

      if (piano.robots) {
        fs.writeFileSync(
          path.join(outDir, 'robots.txt'),
          testoRobots({ urlSito: URL_SITO }),
          'utf8'
        );
      }

      if (piano.sitemap) {
        const pagine = Object.values(PAGINE_LEGALI).map((p) => ({
          percorso: p.percorso,
          segnaposto: isPaginaLegaleSegnaposto(p),
        }));
        const lastmod = new Date().toISOString().slice(0, 10);
        fs.writeFileSync(
          path.join(outDir, 'sitemap.xml'),
          testoSitemap({ urlSito: URL_SITO, pagine, lastmod }),
          'utf8'
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const piano = pianoBuild({ landingAttiva: LANDING_ATTIVA, modo: mode });

  const input: Record<string, string> = {
    main: path.resolve(__dirname, 'index.html'),
  };

  if (piano.pagineLegali) {
    input.termini = path.resolve(__dirname, 'termini.html');
    input.privacy = path.resolve(__dirname, 'privacy.html');
    input.cookie = path.resolve(__dirname, 'cookie.html');
    input.notFound = path.resolve(__dirname, '404.html');
  }

  return {
    plugins: [vue(), pluginPagineTecniche(piano)],
    base: '/',
    server: {
      fs: {
        allow: [repoRoot],
      },
    },
    build: {
      rollupOptions: {
        input,
      },
    },
  };
});
