/**
 * Lo script vendorizzato di polygon-clipping è il dist 0.15.7, senza modifiche.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { POLYGON_CLIPPING_VENDOR_PATH } from '../core/services/zone-lavorate-area.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = '7f8619e84a86ce8dd400c9b50430e9c8cf8f26027b19eeb479f109f5c1a9d688';

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

const PAGINE = [
  'core/admin/gestione-lavori-standalone.html',
  'core/admin/lavori-caposquadra-standalone.html',
  'modules/vendemmia-meccanica/views/piano-stagione-standalone.html',
];

describe('vendor polygon-clipping', () => {
  it('lo sha256 del file vendor è quello atteso e coincide con il dist npm', () => {
    const vendor = path.join(root, 'vendor/polygon-clipping-0.15.7.umd.min.js');
    const dist = path.join(root, 'node_modules/polygon-clipping/dist/polygon-clipping.umd.min.js');
    expect(sha256(vendor)).toBe(SHA);
    expect(sha256(dist)).toBe(SHA);
  });

  it('il percorso del modulo punta al file vendor', () => {
    const moduleUrl = pathToFileURL(path.join(root, 'core/services/zone-lavorate-area.js'));
    const resolved = new URL(POLYGON_CLIPPING_VENDOR_PATH, moduleUrl);
    expect(decodeURIComponent(resolved.pathname).replace(/\\/g, '/')).toMatch(
      /\/vendor\/polygon-clipping-0\.15\.7\.umd\.min\.js$/
    );
    expect(sha256(fileURLToPath(resolved))).toBe(SHA);
  });

  it('le tre pagine caricano il file vendor e non node_modules né un CDN', () => {
    for (const rel of PAGINE) {
      const html = readFileSync(path.join(root, rel), 'utf8');
      expect(html, rel).toContain('vendor/polygon-clipping-0.15.7.umd.min.js');
      expect(html, rel).not.toContain('node_modules/polygon-clipping');
      expect(html, rel).not.toMatch(/jsdelivr\.net\/npm\/polygon-clipping|unpkg\.com\/polygon-clipping/);
    }
  });
});
