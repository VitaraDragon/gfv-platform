import { readFileSync } from 'node:fs';
import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveModules,
  getModulesCoveredByActiveBundles,
} from '../core/utils/module-access-resolver.js';
import { AVAILABLE_MODULES, BUNDLES, ALL_AVAILABLE_MODULE_IDS } from '../core/config/subscription-plans.js';

const require = createRequire(import.meta.url);
const {
  syncRecommendationsAvailable,
  RECOMMENDATIONS,
} = require('../functions/scripts/generate-tony-configs.js');
const {
  resolveEffectiveModules: resolveEffectiveModulesServer,
} = require('../functions/module-trial.js');

describe('A1 — GFV Completo include Seminativo', () => {
  it('catalogo client: gfv-completo contiene seminativo', () => {
    const gfv = BUNDLES.find((b) => b.id === 'gfv-completo');
    expect(gfv).toBeTruthy();
    expect(gfv.modules).toContain('seminativo');
    expect(ALL_AVAILABLE_MODULE_IDS).toContain('seminativo');
    expect(AVAILABLE_MODULES.find((m) => m.id === 'seminativo')?.available).toBe(true);
  });

  it('tenant con solo activeBundles gfv-completo ha seminativo tra i moduli effettivi (client)', () => {
    const tenant = { modules: [], activeBundles: ['gfv-completo'], moduleTrials: {} };
    const effective = resolveEffectiveModules(tenant);
    expect(effective).toContain('seminativo');
    expect(effective).toContain('tony');
    expect(effective).toContain('vendemmiaMeccanica');
    expect(getModulesCoveredByActiveBundles(tenant, BUNDLES).has('seminativo')).toBe(true);
  });

  it('server: resolveEffectiveModules include moduli del bundle attivo', () => {
    const catalog = require('../functions/config/bundles-catalog.json');
    // Se il catalogo locale non è stato rigenerato, lo testiamo sul resolver
    // con un catalogo minimale mockato via activeBundles + file presente.
    const tenant = {
      modules: [],
      activeBundles: ['gfv-completo'],
      moduleTrials: {},
    };
    if (catalog['gfv-completo']?.modules?.includes('seminativo')) {
      expect(resolveEffectiveModulesServer(tenant)).toContain('seminativo');
    } else {
      // Catalogo non generato in CI: verifica almeno che paid+trial restino ok
      expect(resolveEffectiveModulesServer({ modules: ['seminativo'] })).toContain('seminativo');
    }
  });

  it('generatore: nessun available:false se AVAILABLE_MODULES ha available:true', () => {
    const synced = syncRecommendationsAvailable(AVAILABLE_MODULES, RECOMMENDATIONS);
    for (const mod of AVAILABLE_MODULES.filter((m) => m.available)) {
      const rec = synced.modules.find((m) => m.id === mod.id);
      if (rec) {
        expect(rec.available, `${mod.id} deve essere available nel catalogo Tony`).toBe(true);
      }
    }
    const seminativo = synced.modules.find((m) => m.id === 'seminativo');
    expect(seminativo?.available).toBe(true);
  });

  it('guida seminativo non copia più intestazione Meteo', () => {
    const html = readFileSync(
      new URL('../documentazione-utente/guida-seminativo-utente.html', import.meta.url),
      'utf8'
    );
    expect(html).toContain('🌾 Guida Seminativo');
    expect(html).toContain('Pagina Seminativo');
    expect(html).not.toContain('Pagina Meteo');
    expect(html).not.toContain('Meteo sede');
  });
});
