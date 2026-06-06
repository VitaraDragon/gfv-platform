import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { tryTonyFilterTableQuickReply } = require('../functions/tony-filter-table-quick-reply.js');

const ctxProdotti = {
  page: {
    currentTableData: {
      pageType: 'prodotti',
      summary: '5 prodotti',
      items: [{ nome: 'Concime A', attivo: true }],
    },
  },
};

const ctxLavori = {
  page: {
    currentTableData: {
      pageType: 'lavori',
      summary: '3 lavori',
      items: [{ terreno: 'Pinot nero' }, { terreno: 'Trebbiano' }],
    },
  },
  azienda: {
    terreni: [{ id: 't1', nome: 'Pinot nero' }],
  },
};

describe('tryTonyFilterTableQuickReply', () => {
  it('solo attivi su prodotti → FILTER_TABLE attivo true', () => {
    const hit = tryTonyFilterTableQuickReply({
      message: 'solo attivi',
      ctx: ctxProdotti,
    });
    expect(hit).not.toBeNull();
    expect(hit.command).toEqual({ type: 'FILTER_TABLE', params: { attivo: 'true' } });
  });

  it('filtra per pinot su lavori → FILTER_TABLE terreno', () => {
    const hit = tryTonyFilterTableQuickReply({
      message: 'filtra per pinot',
      ctx: ctxLavori,
    });
    expect(hit).not.toBeNull();
    expect(hit.command.params.terreno).toMatch(/pinot/i);
  });

  it('reset filtri', () => {
    const hit = tryTonyFilterTableQuickReply({
      message: 'pulisci filtri',
      ctx: ctxProdotti,
    });
    expect(hit.command.params.filterType).toBe('reset');
  });

  it('senza pageType noto → null (fallback Gemini)', () => {
    const hit = tryTonyFilterTableQuickReply({
      message: 'solo attivi',
      ctx: { page: {} },
    });
    expect(hit).toBeNull();
  });
});
