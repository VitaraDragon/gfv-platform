import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decidiSalutoLanding,
  costruisciMessaggioSaluto,
  haPinSede,
} from '../../core/js/tony/tony-landing-saluto.js';

/** Quando mostrare il saluto: solo da dati tenant + stato locale, indipendente dalle guide caricate. */
export function deveMostrareSalutoSenzaGuide(args) {
  const d = decidiSalutoLanding(args || {});
  return d.tipo === 'saluto' || d.tipo === 'riprendi';
}

const NOW = new Date('2026-11-02T10:00:00Z');
const FUTURO = new Date('2026-11-09T10:00:00Z').toISOString();
const PASSATO = new Date('2026-10-01T10:00:00Z').toISOString();

describe('decidiSalutoLanding', () => {
  it('primo accesso con marcatore → saluto', () => {
    const d = decidiSalutoLanding({
      tonyLandingSetupCompletatoIl: '2026-11-01T12:00:00Z',
      tonyGuidaOnboardingEndsAt: FUTURO,
      statoLocale: { salutoFatto: false },
      now: NOW,
    });
    expect(d.tipo).toBe('saluto');
  });

  it('secondo accesso (saluto già fatto) → riprendi o niente se già oggi', () => {
    const riprendi = decidiSalutoLanding({
      tonyLandingSetupCompletatoIl: '2026-11-01T12:00:00Z',
      tonyGuidaOnboardingEndsAt: FUTURO,
      statoLocale: { salutoFatto: true, ultimoRiprendiGiorno: '' },
      now: NOW,
    });
    expect(riprendi.tipo).toBe('riprendi');

    const niente = decidiSalutoLanding({
      tonyLandingSetupCompletatoIl: '2026-11-01T12:00:00Z',
      tonyGuidaOnboardingEndsAt: FUTURO,
      statoLocale: { salutoFatto: true, ultimoRiprendiGiorno: '2026-11-02' },
      now: NOW,
    });
    expect(niente.tipo).toBe('niente');
  });

  it('onboarding scaduto → no', () => {
    expect(
      decidiSalutoLanding({
        tonyLandingSetupCompletatoIl: '2026-10-01',
        tonyGuidaOnboardingEndsAt: PASSATO,
        now: NOW,
      }).tipo
    ).toBe('niente');
  });

  it('tenant senza marcatore → no', () => {
    expect(
      decidiSalutoLanding({
        tonyGuidaOnboardingEndsAt: FUTURO,
        now: NOW,
      }).tipo
    ).toBe('niente');
  });

  it('percorso chiuso → no', () => {
    expect(
      decidiSalutoLanding({
        tonyLandingSetupCompletatoIl: '2026-11-01',
        tonyGuidaOnboardingEndsAt: FUTURO,
        statoLocale: { salutoFatto: false, percorsoChiuso: true },
        now: NOW,
      }).tipo
    ).toBe('niente');
  });

  it('piano Base da landing (stesso marcatore + onboarding) → saluto', () => {
    expect(
      decidiSalutoLanding({
        tonyLandingSetupCompletatoIl: '2026-11-01',
        tonyGuidaOnboardingEndsAt: FUTURO,
        pianoBase: true,
        now: NOW,
      }).tipo
    ).toBe('saluto');
  });
});

describe('costruisciMessaggioSaluto', () => {
  it('con nome e senza pin', () => {
    const m = costruisciMessaggioSaluto({ nome: 'Pier', haPinSede: false });
    expect(m.testo).toContain('Ciao Pier!');
    expect(m.testo).toMatch(/pin/i);
    expect(m.passi).toHaveLength(3);
  });

  it('haPinSede', () => {
    expect(haPinSede({ lat: 44.4, lng: 11.9 })).toBe(true);
    expect(haPinSede(null)).toBe(false);
  });
});

describe('saluto indipendente dalle guide', () => {
  it('deveMostrareSalutoSenzaGuide non richiede guida caricata', () => {
    expect(
      deveMostrareSalutoSenzaGuide({
        tonyLandingSetupCompletatoIl: '2026-11-01T12:00:00Z',
        tonyGuidaOnboardingEndsAt: FUTURO,
        statoLocale: { salutoFatto: false },
        now: NOW,
      })
    ).toBe(true);
  });

  it('main.js: saluto senza setTimeout 1200 fisso', () => {
    const main = readFileSync(join(process.cwd(), 'core/js/tony/main.js'), 'utf8');
    const blocco = main.slice(
      main.indexOf('scheduleTonyLandingSaluto'),
      main.indexOf('checkTnyNotifyGreeting')
    );
    expect(blocco).toMatch(/tentaSaluto\(\)/);
    expect(blocco).not.toMatch(/setTimeout\(tentaSaluto,\s*1200\)/);
  });
});

