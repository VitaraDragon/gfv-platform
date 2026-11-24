/**
 * @vitest-environment node
 *
 * Guarda il caricamento del modulo service (non solo aggregate):
 * un `export { X }` senza import/from di X rompe la pagina in produzione.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  getCollectionData: vi.fn(async () => []),
  dateToTimestamp: vi.fn((d) => d)
}));

vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => null),
  getCurrentTenant: vi.fn(async () => null)
}));

vi.mock('../core/utils/module-access-resolver.js', () => ({
  resolveEffectiveModules: vi.fn(() => [])
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_PATH = join(__dirname, '../modules/report/services/report-magazzino-service.js');

/** Nomi in `export { a, b }` senza `from '...'` (binding locali obbligatori). */
function localReexportNames(source) {
  const names = [];
  const re = /export\s*\{([^}]+)\}\s*;/g;
  let m;
  while ((m = re.exec(source))) {
    const body = m[1];
    const after = source.slice(m.index + m[0].length, m.index + m[0].length + 80);
    if (/^\s*from\s+['"]/.test(after) || /\}\s*from\s+['"]/.test(m[0])) continue;
    for (const part of body.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

function importedBindingNames(source) {
  const names = new Set();
  const re = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g;
  let m;
  while ((m = re.exec(source))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

describe('report-magazzino-service — caricamento modulo', () => {
  it('non riesporta binding locali mancanti', () => {
    const source = readFileSync(SERVICE_PATH, 'utf8');
    const localExports = localReexportNames(source);
    const imported = importedBindingNames(source);
    const missing = localExports.filter((n) => !imported.has(n));
    expect(missing, `binding riesportati senza import: ${missing.join(', ')}`).toEqual([]);
  });

  it('importa il service intero e espone gli helper UI', async () => {
    const mod = await import('../modules/report/services/report-magazzino-service.js');
    expect(typeof mod.assembleMagazzinoReport).toBe('function');
    expect(typeof mod.buildReportMagazzino).toBe('function');
    expect(typeof mod.loadMagazzinoPeriodBundle).toBe('function');
    expect(typeof mod.assembleMagazzinoFromBundle).toBe('function');
    expect(typeof mod.prepareMagazzinoExportData).toBe('function');
    expect(typeof mod.buildProdottoDetailRows).toBe('function');
    expect(typeof mod.formatEuroPrefixCompact).toBe('function');
    expect(typeof mod.labelCategoria).toBe('function');
    expect(typeof mod.labelOrigineUscita).toBe('function');
    expect(typeof mod.getMagazzinoFilterOptions).toBe('function');
    expect(typeof mod.totaleUsciteComeEconomici).toBe('function');
  });
});
