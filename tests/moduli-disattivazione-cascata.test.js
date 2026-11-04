/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  moduliDaDisattivareInsieme,
  testoConfermaDisattivazioneCascata,
  canActivateModule
} from '../core/config/subscription-plans.js';
import { moduleLabel } from '../core/config/tony-module-gate.js';

describe('moduliDaDisattivareInsieme (#33)', () => {
  it('contoTerzi con VM attiva → entrambi', () => {
    expect(
      moduliDaDisattivareInsieme('contoTerzi', ['contoTerzi', 'vendemmiaMeccanica', 'vigneto'])
    ).toEqual(['contoTerzi', 'vendemmiaMeccanica']);
  });

  it('senza VM → solo contoTerzi', () => {
    expect(moduliDaDisattivareInsieme('contoTerzi', ['contoTerzi', 'manodopera'])).toEqual([
      'contoTerzi'
    ]);
  });
});

describe('testoConfermaDisattivazioneCascata', () => {
  it('contiene il nome leggibile Vendemmia Meccanica e Conto Terzi', () => {
    const msg = testoConfermaDisattivazioneCascata('contoTerzi', [
      'contoTerzi',
      'vendemmiaMeccanica'
    ]);
    expect(msg).toMatch(/Vendemmia Meccanica/);
    expect(msg).toMatch(/Conto Terzi/);
    expect(msg).not.toMatch(/contoTerzi/);
    expect(msg).not.toMatch(/vendemmiaMeccanica/);
  });
});

describe('pagina Abbonamento: ritento cascata incompleta', () => {
  const html = readFileSync('core/admin/abbonamento-standalone.html', 'utf8');

  it('se un dipendente è ancora attivo offre Riprova che richiama cancelStripeAddon', () => {
    expect(html).toMatch(/function dipendentiCascataAncoraAttivi/);
    expect(html).toMatch(/riprovaDisattivazioneModulo\('\$\{mod\.id\}'\)/);
    expect(html).toMatch(/window\.riprovaDisattivazioneModulo/);
    const fn = html.slice(html.indexOf('async function completaDisattivazioneModulo'));
    expect(fn).toMatch(/getHttpsCallable\('cancelStripeAddon'\)/);
    expect(html).toMatch(/ricaricaAbbonamentoDopoErrore/);
  });
});

describe('canActivateModule VM senza CT', () => {
  it('blocca con Prima riattiva Conto Terzi', () => {
    const r = canActivateModule('base', 'vendemmiaMeccanica', []);
    expect(r.canActivate).toBe(false);
    expect(r.reason).toMatch(/Prima riattiva Conto Terzi/);
  });
});

describe('vm-page-auth messaggio leggibile', () => {
  it('moduleLabel Conto Terzi non è l’id tecnico', () => {
    expect(moduleLabel('contoTerzi')).toBe('Conto Terzi');
    expect(moduleLabel('vendemmiaMeccanica')).toMatch(/Vendemmia/i);
  });
});
