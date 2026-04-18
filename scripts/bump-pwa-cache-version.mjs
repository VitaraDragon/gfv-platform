/**
 * Aggiorna SW_CACHE_BUILD_ID in service-worker.js (timestamp ms, univoco a ogni esecuzione).
 * Chiamato dall'hook .githooks/pre-commit così ogni commit include un nuovo nome cache PWA.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const swPath = join(root, 'service-worker.js');

let content = readFileSync(swPath, 'utf8');
const buildId = `t${Date.now()}`;
if (!/const SW_CACHE_BUILD_ID = '[^']*';/.test(content)) {
    console.error('[bump-pwa-cache] Pattern SW_CACHE_BUILD_ID non trovato in service-worker.js');
    process.exit(1);
}
content = content.replace(/const SW_CACHE_BUILD_ID = '[^']*';/, `const SW_CACHE_BUILD_ID = '${buildId}';`);
writeFileSync(swPath, content, 'utf8');
console.log('[bump-pwa-cache] SW_CACHE_BUILD_ID ->', buildId);
