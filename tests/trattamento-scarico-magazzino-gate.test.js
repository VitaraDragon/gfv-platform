/**
 * Gate scarico trattamenti: magazzino pagato O trial attivo.
 * Le pagine standalone non devono più leggere solo tenant.modules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

vi.mock('../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn(),
}));
vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(),
  getCurrentUser: vi.fn(() => ({ uid: 'u1' })),
}));
vi.mock('../modules/magazzino/services/prodotti-service.js', () => ({
  getProdotto: vi.fn(),
}));
vi.mock('../modules/magazzino/services/movimenti-service.js', () => ({
  createMovimento: vi.fn(async () => 'mov-1'),
  setMovimentoConId: vi.fn(async (id) => ({ movimentoId: id, created: true, delta: -1 })),
  deleteMovimento: vi.fn(async () => undefined),
}));

import { getDocumentData } from '../core/services/firebase-service.js';
import { getCurrentTenantId } from '../core/services/tenant-service.js';
import { setMovimentoConId } from '../modules/magazzino/services/movimenti-service.js';
import {
  tenantHasMagazzinoModule,
  syncScarichiMagazzinoTrattamento,
} from '../modules/magazzino/services/trattamento-scarico-magazzino-service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const now = new Date('2026-09-18T12:00:00Z');
const trialActive = {
  status: 'active',
  // Fine prova oltre «oggi» del test (fake timers 2026-09-18) e oltre la data reale CI.
  endsAt: new Date('2027-12-31T12:00:00Z'),
};

/** Logica gate: pagine HTML estratte in JS condivisi / per-modulo. */
const SCARICO_PAGES = [
  'shared/js/trattamenti-coltura-page.js',
  'modules/vigneto/js/concimazioni-page.js',
  'modules/frutteto/js/concimazioni-page.js',
];

describe('tenantHasMagazzinoModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
  });

  it('false senza tenant', async () => {
    getCurrentTenantId.mockReturnValue(null);
    expect(await tenantHasMagazzinoModule()).toBe(false);
    expect(getDocumentData).not.toHaveBeenCalled();
  });

  it('false se magazzino non è né pagato né in prova', async () => {
    getDocumentData.mockResolvedValue({ modules: ['vigneto'], moduleTrials: {} });
    expect(await tenantHasMagazzinoModule()).toBe(false);
  });

  it('true se magazzino è nei moduli pagati', async () => {
    getDocumentData.mockResolvedValue({ modules: ['magazzino'], moduleTrials: {} });
    expect(await tenantHasMagazzinoModule()).toBe(true);
  });

  it('true se magazzino è solo in prova attiva', async () => {
    getDocumentData.mockResolvedValue({
      modules: ['vigneto'],
      moduleTrials: { magazzino: trialActive },
    });
    expect(await tenantHasMagazzinoModule()).toBe(true);
  });
});

describe('syncScarichiMagazzinoTrattamento — trial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('non crea movimenti se magazzino è off', async () => {
    getDocumentData.mockResolvedValue({ modules: ['vigneto'], moduleTrials: {} });
    const out = await syncScarichiMagazzinoTrattamento({
      modulo: 'vigneto',
      colturaId: 'v1',
      trattamentoId: 'tr1',
      dataTrattamento: now,
      prodotti: [{ prodottoId: 'p1', quantita: 2 }],
      registraScaricoMagazzino: true,
      previousMovimentoIds: [],
    });
    expect(out.movimentoIds).toEqual([]);
    expect(setMovimentoConId).not.toHaveBeenCalled();
  });

  it('crea movimenti se magazzino è in prova e lo scarico è richiesto', async () => {
    getDocumentData.mockResolvedValue({
      modules: ['vigneto'],
      moduleTrials: { magazzino: trialActive },
    });
    const out = await syncScarichiMagazzinoTrattamento({
      modulo: 'vigneto',
      colturaId: 'v1',
      trattamentoId: 'tr1',
      dataTrattamento: now,
      prodotti: [{ prodottoId: 'p1', quantita: 2, costo: 10 }],
      registraScaricoMagazzino: true,
      previousMovimentoIds: [],
    });
    expect(out.movimentoIds).toEqual(['trattamento_vigneto_v1_tr1_p1']);
    expect(setMovimentoConId).toHaveBeenCalledTimes(1);
  });
});

describe('pagine trattamenti/concimazioni — gate trial', () => {
  it.each(SCARICO_PAGES)('%s usa hasModuleAccess, non solo tenant.modules', (rel) => {
    const src = readFileSync(path.join(root, rel), 'utf8');
    expect(src).toContain("hasModuleAccess('magazzino')");
    expect(src).toContain("hasModuleAccess('manodopera')");
    expect(src).toContain('getAvailableModules()');
    expect(src).not.toMatch(/modules\.includes\(['"]magazzino['"]\)/);
  });
});
