/**
 * @vitest-environment node
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  ORTICOLE_HUB_CARDS,
  ORTICOLE_EXCLUDED_FROM_VIGNETO,
  ORTICOLE_COLLECTION,
  ORTICOLE_ACCENT,
  IRRIGAZIONI_ORTICOLE_COLLECTION
} from '../modules/orticole/config/orticole-hub.js';
import { OrticolaCampagna } from '../modules/orticole/models/OrticolaCampagna.js';
import { AVAILABLE_MODULES, BUNDLES } from '../core/config/subscription-plans.js';
import { moduleFromPath, PELLE_ACCENT } from '../core/js/ui-pelle-state.js';
import { iconNameForModule, iconNameForEmoji } from '../core/js/ui-pelle-icons.js';
import { isApriPaginaTargetAllowed } from '../core/config/tony-module-gate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readUtf8(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Modulo Orticole — scheletro Fase 1', () => {
  it('catalogo hub: irrigazione sì, piano/rotazione no', () => {
    const ids = ORTICOLE_HUB_CARDS.map((c) => c.id);
    expect(ids).toEqual([
      'anagrafica',
      'impianto',
      'lavorazioni',
      'irrigazione',
      'trattamenti',
      'concimazioni',
      'raccolta',
      'statistiche'
    ]);
    const blob = JSON.stringify(ORTICOLE_HUB_CARDS).toLowerCase();
    expect(blob).not.toContain('piano colturale');
    expect(blob).not.toContain('rotazione');
    ORTICOLE_EXCLUDED_FROM_VIGNETO.forEach((word) => {
      expect(blob).not.toContain(word);
    });
    expect(ORTICOLE_COLLECTION).toBe('orticole');
    expect(IRRIGAZIONI_ORTICOLE_COLLECTION).toBe('irrigazioniOrticole');
    expect(ORTICOLE_ACCENT).toBe('#E65100');
  });

  it('anagrafica: terreno + campagna + coltura + ciclo', () => {
    const empty = new OrticolaCampagna();
    expect(empty.validate().valid).toBe(false);

    const ok = new OrticolaCampagna({
      terrenoId: 't1',
      campagna: '2025/2026',
      ciclo: 1,
      colturaNome: 'Pomodoro',
      superficieEttari: 2.5,
      tipoImpianto: 'trapianto',
      destinazionePrevista: 'industria',
      stato: 'pianificato'
    });
    expect(ok.validate()).toEqual({ valid: true, errors: [] });
    expect(ok.toFirestore().ciclo).toBe(1);
    expect(ok.toFirestore().tipoImpianto).toBe('trapianto');
  });

  it('abbonamento: 3 €, available, fuori dai 9 bundle; Completo congelato a 11 id', () => {
    const plan = AVAILABLE_MODULES.find((m) => m.id === 'orticole');
    expect(plan).toBeTruthy();
    expect(plan.available).toBe(true);
    expect(plan.price).toBe(3);
    const bundles = BUNDLES.filter((b) => Array.isArray(b.modules) && b.modules.includes('orticole'));
    expect(bundles).toEqual([]);
    const completo = BUNDLES.find((b) => b.id === 'gfv-completo');
    expect(completo.price).toBe(30);
    expect(completo.modules).toEqual([
      'manodopera', 'parcoMacchine', 'contoTerzi', 'vendemmiaMeccanica',
      'vigneto', 'frutteto', 'seminativo', 'magazzino', 'tony', 'report', 'meteo'
    ]);
    expect(completo.modules).not.toContain('orticole');
    expect(readUtf8('core/js/dashboard-hub.js')).toContain('orticole-dashboard-standalone.html');
    expect(readUtf8('core/js/dashboard-sections.js')).toContain('createOrticoleCard');
  });

  it('pagine hub esistono', () => {
    const files = [
      'modules/orticole/views/orticole-dashboard-standalone.html',
      ...ORTICOLE_HUB_CARDS.map((c) => 'modules/orticole/views/' + c.href)
    ];
    files.forEach((rel) => {
      expect(existsSync(join(root, rel))).toBe(true);
    });
  });

  it('Tony: rotte, label e gate sul modulo', () => {
    const engine = readUtf8('core/js/tony/engine.js');
    expect(engine).toContain("'orticole': 'modules/orticole/views/orticole-dashboard-standalone.html'");
    ORTICOLE_HUB_CARDS.forEach((card) => {
      expect(engine).toContain("'" + card.tonyTarget + "'");
    });
    expect(isApriPaginaTargetAllowed('orticole', ['tony'])).toBe(false);
    expect(isApriPaginaTargetAllowed('orticole', ['tony', 'orticole'])).toBe(true);
    expect(isApriPaginaTargetAllowed('irrigazione orticole', ['orticole'])).toBe(true);
  });

  it('pelle, icone e quick bar', () => {
    expect(PELLE_ACCENT.orticole).toBe('#E65100');
    expect(moduleFromPath('/modules/orticole/views/orticole-dashboard-standalone.html')).toBe('orticole');
    expect(iconNameForModule('orticole')).toBe('sprout');
    expect(iconNameForEmoji('🥬')).toBe('sprout');
    const quickBar = readUtf8('core/js/dashboard-quick-bar.js');
    expect(quickBar).toContain("id: 'orticole'");
    expect(quickBar).toContain('orticole-dashboard-standalone.html');
    expect(quickBar).toContain('irrigazione-standalone.html');
  });

  it('tony-routes.json elenca hub e sottopagine', () => {
    const routes = JSON.parse(readUtf8('core/config/tony-routes.json'));
    const targets = routes.routes.filter((r) => r.module === 'orticole').map((r) => r.target);
    expect(targets).toContain('orticole');
    expect(targets).toContain('orticole anagrafica');
    expect(targets).toContain('irrigazione orticole');
    expect(targets).toContain('raccolta orticole');
  });
});
