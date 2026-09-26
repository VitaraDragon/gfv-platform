/**
 * @vitest-environment node
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  SEMINATIVO_HUB_CARDS,
  SEMINATIVO_EXCLUDED_FROM_VIGNETO,
  SEMINATIVO_COLLECTION,
  SEMINATIVO_ACCENT
} from '../modules/seminativo/config/seminativo-hub.js';
import { SeminativoCampagna } from '../modules/seminativo/models/SeminativoCampagna.js';
import { AVAILABLE_MODULES } from '../core/config/subscription-plans.js';
import { moduleFromPath, PELLE_ACCENT } from '../core/js/ui-pelle-state.js';
import { iconNameForModule, iconNameForEmoji } from '../core/js/ui-pelle-icons.js';
import { isApriPaginaTargetAllowed } from '../core/config/tony-module-gate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readUtf8(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Modulo Seminativo — scheletro', () => {
  it('catalogo hub: sottocategorie scelte, niente impianto/potatura', () => {
    const ids = SEMINATIVO_HUB_CARDS.map((c) => c.id);
    expect(ids).toEqual([
      'anagrafica',
      'piano',
      'semina',
      'lavorazioni',
      'trattamenti',
      'concimazioni',
      'raccolta',
      'statistiche'
    ]);
    const blob = JSON.stringify(SEMINATIVO_HUB_CARDS).toLowerCase();
    SEMINATIVO_EXCLUDED_FROM_VIGNETO.forEach((word) => {
      expect(blob).not.toContain(word);
    });
    expect(SEMINATIVO_COLLECTION).toBe('seminativi');
    expect(SEMINATIVO_ACCENT).toBe('#C9A227');
  });

  it('anagrafica per campagna: terreno + campagna + coltura', () => {
    const empty = new SeminativoCampagna();
    expect(empty.validate().valid).toBe(false);

    const ok = new SeminativoCampagna({
      terrenoId: 't1',
      campagna: '2025/2026',
      colturaNome: 'Grano',
      superficieEttari: 4.2,
      stato: 'pianificato'
    });
    expect(ok.validate()).toEqual({ valid: true, errors: [] });
    expect(ok.toFirestore().campagna).toBe('2025/2026');
  });

  it('abbonamento Prossimamente come oliveto e catalogo dashboard', () => {
    const plan = AVAILABLE_MODULES.find((m) => m.id === 'seminativo');
    expect(plan).toBeTruthy();
    expect(plan.available).toBe(false);
    expect(plan.badge).toBe('Prossimamente');
    expect(readUtf8('core/js/dashboard-hub.js')).toContain('seminativo-dashboard-standalone.html');
    expect(readUtf8('core/js/dashboard-sections.js')).toContain('createSeminativoCard');
  });

  it('pagine placeholder e hub esistono', () => {
    const files = [
      'modules/seminativo/views/seminativo-dashboard-standalone.html',
      ...SEMINATIVO_HUB_CARDS.map((c) => 'modules/seminativo/views/' + c.href)
    ];
    files.forEach((rel) => {
      expect(existsSync(join(root, rel))).toBe(true);
    });
  });

  it('Tony: rotte, label e gate sul modulo', () => {
    const engine = readUtf8('core/js/tony/engine.js');
    expect(engine).toContain("'seminativo': 'modules/seminativo/views/seminativo-dashboard-standalone.html'");
    SEMINATIVO_HUB_CARDS.forEach((card) => {
      expect(engine).toContain("'" + card.tonyTarget + "'");
    });
    expect(isApriPaginaTargetAllowed('seminativo', ['tony'])).toBe(false);
    expect(isApriPaginaTargetAllowed('seminativo', ['tony', 'seminativo'])).toBe(true);
    expect(isApriPaginaTargetAllowed('piano colturale', ['seminativo'])).toBe(true);
  });

  it('pelle, icone e quick bar', () => {
    expect(PELLE_ACCENT.seminativo).toBe('#C9A227');
    expect(moduleFromPath('/modules/seminativo/views/seminativo-dashboard-standalone.html')).toBe('seminativo');
    expect(iconNameForModule('seminativo')).toBe('wheat');
    expect(iconNameForEmoji('🌾')).toBe('wheat');
    const quickBar = readUtf8('core/js/dashboard-quick-bar.js');
    expect(quickBar).toContain("id: 'seminativo'");
    expect(quickBar).toContain('seminativo-dashboard-standalone.html');
  });

  it('tony-routes.json elenca hub e sottopagine', () => {
    const routes = JSON.parse(readUtf8('core/config/tony-routes.json'));
    const targets = routes.routes.filter((r) => r.module === 'seminativo').map((r) => r.target);
    expect(targets).toContain('seminativo');
    expect(targets).toContain('piano colturale');
    expect(targets).toContain('raccolta seminativo');
  });
});
