import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { tryTonyNavQuickReply, resolveNavTarget } = require('../functions/tony-nav-quick-reply.js');

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
