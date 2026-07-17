import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  tryTonyNavQuickReply,
  tryTonyFieldNavQuickReply,
  resolveNavTarget,
} = require('../functions/tony-nav-quick-reply.js');

const moduli = ['tony', 'contoTerzi', 'magazzino', 'manodopera', 'meteo'];
const ctxBase = {
  moduli_attivi: moduli,
  dashboard: { moduli_attivi: moduli },
};

describe('tryTonyNavQuickReply', () => {
  it('portami alle tariffe → APRI_PAGINA tariffe', () => {
    const hit = tryTonyNavQuickReply({
      message: 'portami alle tariffe',
      ctx: ctxBase,
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('nav');
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'tariffe' });
    expect(hit.text).toMatch(/tariffe/i);
  });

  it('resolveNavTarget riconosce lavori e terreni', () => {
    expect(resolveNavTarget('vai ai lavori')).toBe('lavori');
    expect(resolveNavTarget('apri terreni')).toBe('terreni');
  });

  it('portami alle comunicazioni → target comunicazioni', () => {
    expect(resolveNavTarget('portami alle comunicazioni del caposquadra')).toBe('comunicazioni');
    const hit = tryTonyNavQuickReply({
      message: 'portami alle comunicazioni',
      ctx: ctxBase,
    });
    expect(hit).not.toBeNull();
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'comunicazioni' });
  });
});

describe('tryTonyFieldNavQuickReply', () => {
  const ctxField = {
    ...ctxBase,
    page: {
      pagePath: '/core/mobile/field-workspace-standalone.html',
      currentTableData: { pageType: 'field_workspace', summary: '', items: [] },
    },
  };

  it('operaio: portami alle comunicazioni del caposquadra → APRI_PAGINA comunicazioni', () => {
    const hit = tryTonyFieldNavQuickReply({
      message: 'portami alle comunicazioni del caposquadra',
      ctx: ctxField,
      fieldProfile: 'operaio',
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('nav_field');
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'comunicazioni' });
    expect(hit.text).toMatch(/comunicazioni/i);
  });

  it('operaio: portami alle mie statistiche → statistiche lavoratore (non desktop)', () => {
    const hit = tryTonyFieldNavQuickReply({
      message: 'portami alle mie statistiche',
      ctx: ctxField,
      fieldProfile: 'operaio',
    });
    expect(hit).not.toBeNull();
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'statistiche lavoratore' });
  });

  it('operaio: portami alle statistiche → slide mobile', () => {
    const hit = tryTonyFieldNavQuickReply({
      message: 'portami alle statistiche',
      ctx: ctxField,
      fieldProfile: 'operaio',
    });
    expect(hit).not.toBeNull();
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'statistiche lavoratore' });
  });

  it('operaio: portami ai lavori → slide lavoro campo (non Gestione Lavori)', () => {
    const hit = tryTonyFieldNavQuickReply({
      message: 'portami ai lavori',
      ctx: ctxField,
      fieldProfile: 'operaio',
    });
    expect(hit).not.toBeNull();
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'lavoro campo' });
    expect(hit.text).toMatch(/lavoro/i);
  });

  it('operaio: portami alle ore → segnatura ore (slide workspace)', () => {
    const hit = tryTonyFieldNavQuickReply({
      message: 'portami alle ore',
      ctx: ctxField,
      fieldProfile: 'operaio',
    });
    expect(hit).not.toBeNull();
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'segnatura ore' });
  });

  it('caposquadra: validazione ore consentita', () => {
    const hit = tryTonyFieldNavQuickReply({
      message: 'portami alla validazione ore',
      ctx: ctxField,
      fieldProfile: 'caposquadra',
    });
    expect(hit).not.toBeNull();
    expect(hit.command).toEqual({ type: 'APRI_PAGINA', target: 'validazione ore' });
  });
});

describe('tryTonyNavQuickReply — altri casi', () => {
  it('RIASSUNTO con tableDataSummary → testo tabella', () => {
    const hit = tryTonyNavQuickReply({
      message: 'RIASSUNTO',
      ctx: {
        ...ctxBase,
        page: {
          tableDataSummary: 'Ci sono 12 tariffe in elenco. 10 attive.',
          currentTableData: { pageType: 'tariffe', summary: 'Ci sono 12 tariffe in elenco. 10 attive.', items: [] },
        },
      },
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('riassunto_tabella');
    expect(hit.text).toContain('12 tariffe');
    expect(hit.command).toEqual({ type: 'RIASSUNTO' });
  });

  it('modulo non attivo → messaggio blocco senza comando', () => {
    const hit = tryTonyNavQuickReply({
      message: 'portami alle tariffe',
      ctx: { moduli_attivi: ['tony'], dashboard: { moduli_attivi: ['tony'] } },
    });
    expect(hit.id).toBe('nav_module_blocked');
    expect(hit.command).toBeNull();
  });

  it('crea lavoro non intercettato come nav', () => {
    const hit = tryTonyNavQuickReply({
      message: 'crea un lavoro di trinciatura per luca',
      ctx: ctxBase,
    });
    expect(hit).toBeNull();
  });
});
