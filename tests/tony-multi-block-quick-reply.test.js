import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { tryTonyMultiBlockQuickReply } = require('../functions/tony-multi-block-quick-reply.js');

const ctxMulti = {
  moduli_attivi: ['tony', 'magazzino', 'meteo', 'parcoMacchine'],
  dashboard: { moduli_attivi: ['tony', 'magazzino', 'meteo', 'parcoMacchine'] },
  azienda: {
    summarySottoScorta: '2 prodotti sotto scorta: Concime A.',
    prodottiSottoScorta: [{ nome: 'Concime A', giacenza: 1, sogliaMinima: 10 }],
    meteo: {
      disponibile: true,
      moduloMeteoAttivo: true,
      summaryMeteo: 'Domani pioggia leggera.',
      giorni: [{ data: '2026-06-04', pioggiaMm: 2 }],
    },
    terreni: [{ id: 't1', nome: 'Casetti' }],
  },
};

describe('tryTonyMultiBlockQuickReply', () => {
  it('scenario #8: meteo + scorte → multi_block quando meteo sync disponibile', async () => {
    const msg = "domani trattamento, ho scorte di concime basse e che meteo c'è?";
    const hit = await tryTonyMultiBlockQuickReply({
      message: msg,
      ctx: ctxMulti,
      meteoFns: {
        tryMeteoGiornoQuickReply: (m, meteo) => {
          if (/meteo/.test(m)) return meteo.summaryMeteo;
          return null;
        },
      },
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('multi_block');
    expect(hit.text).toMatch(/riepilogo/i);
    expect(hit.text).toMatch(/scorta|Concime/i);
  });

  it('singolo dominio → null', async () => {
    const hit = await tryTonyMultiBlockQuickReply({
      message: 'quanto costa trinciatura?',
      ctx: ctxMulti,
      meteoFns: {},
    });
    expect(hit).toBeNull();
  });
});
