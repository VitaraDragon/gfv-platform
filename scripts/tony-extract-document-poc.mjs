#!/usr/bin/env node
/**
 * PoC manuale Tony Occhi — estrazione documento via Gemini vision (senza Firebase).
 *
 * Uso:
 *   set GEMINI_API_KEY=...
 *   node scripts/tony-extract-document-poc.mjs path/to/bolla.jpg
 *   node scripts/tony-extract-document-poc.mjs pagina1.jpg pagina2.pdf
 *
 * Opzionale: GEMINI_MODEL=gemini-2.5-flash
 */

import { readFileSync } from 'fs';
import { basename, extname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  validateDocumentPages,
} = require('../functions/config/tony-document-schemas.js');
const { extractDocumentWithGemini } = require('../functions/tony-extract-document.js');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function mimeFromPath(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(`Estensione non supportata: ${ext} (${filePath})`);
  }
  return mime;
}

async function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (!files.length) {
    console.error('Uso: node scripts/tony-extract-document-poc.mjs <file1> [file2 ...]');
    process.exit(1);
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Imposta GEMINI_API_KEY (stessa chiave di tonyAsk).');
    process.exit(1);
  }

  const pagesInput = files.map((filePath, idx) => {
    const buf = readFileSync(filePath);
    return {
      mimeType: mimeFromPath(filePath),
      data: buf.toString('base64'),
      indice: idx + 1,
    };
  });

  const pages = validateDocumentPages(pagesInput);
  console.log(`[PoC] ${pages.length} pagina/e — ${files.map(basename).join(', ')}`);
  console.log('[PoC] Chiamata Gemini vision…');

  const stats = {};
  const t0 = Date.now();
  const estrazione = await extractDocumentWithGemini(apiKey, pages, stats);
  const ms = Date.now() - t0;

  console.log(`[PoC] OK in ${ms}ms (retry Gemini: ${stats.retryCount || 0})`);
  console.log(JSON.stringify({ estrazione }, null, 2));
}

main().catch((err) => {
  console.error('[PoC] Errore:', err.message || err);
  process.exit(1);
});
