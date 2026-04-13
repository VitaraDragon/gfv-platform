/**
 * Copia icons/icon-512x512.png (sorgente unica) in landing/public per favicon e build.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const landingRoot = path.join(__dirname, '..');
const repoRoot = path.join(landingRoot, '..');
const src = path.join(repoRoot, 'icons', 'icon-512x512.png');
const publicDir = path.join(landingRoot, 'public');
const destFavicon = path.join(publicDir, 'favicon.png');
const destNamed = path.join(publicDir, 'icon-512x512.png');

if (!fs.existsSync(src)) {
  console.error('Manca il file sorgente:', src);
  process.exit(1);
}
fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(src, destFavicon);
fs.copyFileSync(src, destNamed);
