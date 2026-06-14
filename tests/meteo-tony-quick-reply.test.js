import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const require = createRequire(import.meta.url);

/** Ancora «oggi» al 2026-05-21: le fixture usano date maggio 2026 nell'orizzonte ~8 giorni. */
const METEO_TEST_ANCHOR = '2026-05-21T12:00:00Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(METEO_TEST_ANCHOR));
});

afterEach(() => {
  vi.useRealTimers();
});
const {
  tryMeteoGiornoQuickReply,
  tryMeteoCondizioniQuickReply,
  tryMeteoOperativoQuickReply,
  tryMeteoPreventivoDateQuickReply,
  isTonyPreventivoDateMeteoEval,
  shouldBuildTerreniMeteoContext,
  enrichPrevisioniGiornaliereForTony,
  isTonyMeteoConsigliaDataQuestion,
  isTonyMeteoConsigliaDataFollowUp,
  isTonyMeteoQuestion,
  resolveMeteoModuleActive,
} = require('../functions/meteo-service.js');
const { evaluateMeteoOperativoGiorno, DEFAULT_TONY_METEO_RULES } = require('../functions/tony-meteo-rules.js');

const sampleMeteo = {
  disponibile: true,
  moduloMeteoAttivo: true,
  sede: {
    label: 'Faenza',
    tomorrow: { windSpeedKmh: 8, tempMin: 14, tempMax: 26, pop: 0 },
    previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
      { dt: '2026-05-21', tempMin: 14, tempMax: 26, pop: 5 },
      { dt: '2026-05-22', tempMin: 15, tempMax: 27, pop: 10 },
      { dt: '2026-05-23', tempMin: 13, tempMax: 24, pop: 35, rainMm: 4.2 },
      { dt: '2026-05-27', tempMin: 12, tempMax: 22, pop: 80, rainMm: 12.5 },
      { dt: '2026-05-28', tempMin: 11, tempMax: 21, pop: 75, rainMm: 8 },
    ]),
  },
};

describe('tryMeteoOperativoQuickReply', () => {
  it('sconsiglia trattamento con pioggia prevista e propone alternativa', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      sede: {
        label: 'Faenza',
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-21', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          { dt: '2026-05-27', pop: 100, windSpeedKmh: 14, rainMm: 2.4 },
          { dt: '2026-05-29', pop: 5, windSpeedKmh: 10, rainMm: 0 },
        ]),
      },
    };
    const reply = await tryMeteoOperativoQuickReply('posso trattare mercoledì 27?', meteo);
    expect(reply).toMatch(/Sconsiglio di programmare il trattamento/i);
    expect(reply).toMatch(/probabilità di pioggia del 100%/i);
    expect(reply).toMatch(/2\.4 mm/i);
    expect(reply).toMatch(/Meglio anticipare|posticipare/i);
    expect(reply).toMatch(/alternativ/i);
  });

  it('approva trattamento con condizioni favorevoli', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      sede: {
        label: 'Faenza',
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-21', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          { dt: '2026-05-22', pop: 10, windSpeedKmh: 9, rainMm: 0 },
        ]),
      },
    };
    const reply = await tryMeteoOperativoQuickReply('posso trattare domani?', meteo);
    expect(reply).toMatch(/^Sì, Domani/i);
    expect(reply).toMatch(/probabilità di pioggia del 10%/i);
  });

  it('non intercetta domande meteo descrittive', async () => {
    expect(await tryMeteoOperativoQuickReply('pioverà mercoledì?', sampleMeteo)).toBeNull();
  });

  it('non intercetta crea lavoro con data e terreno (intent operativo, non consultazione meteo)', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          ok: true,
          nome: 'Pinot',
          terrenoId: 't1',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-24', pop: 0, windSpeedKmh: 8, rainMm: 0 },
          ]),
        },
      ],
      sede: sampleMeteo.sede,
    };
    const msg =
      'crea un lavoro di trinciatura per luca nel pinot inizio domani durata 3 gg usando agrifull e trincia';
    expect(await tryMeteoOperativoQuickReply(msg, meteo)).toBeNull();
  });

  it('riconosce posso trinciare domani come domanda meteo operativa', async () => {
    expect(isTonyMeteoQuestion('domani posso trinciare il pinot?')).toBe(true);
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          ok: true,
          nome: 'Pinot',
          terrenoId: 't1',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-22', pop: 0, windSpeedKmh: 8, rainMm: 0 },
          ]),
        },
      ],
      sede: sampleMeteo.sede,
    };
    const reply = await tryMeteoOperativoQuickReply('domani posso trinciare il pinot?', meteo, {
      terreniNames: ['Pinot'],
      terreniCatalog: [{ id: 't1', nome: 'Pinot', tipoCampo: 'collina' }],
    });
    expect(reply).toMatch(/^Sì,/i);
    expect(reply).toMatch(/lavorazione in campo|Pinot/i);
  });

  it('resolveMeteoModuleActive usa moduli_attivi dal contesto client', () => {
    expect(resolveMeteoModuleActive({}, ['tony', 'meteo'])).toBe(true);
    expect(resolveMeteoModuleActive({ moduli_attivi: ['tony'] }, ['meteo'])).toBe(true);
    expect(resolveMeteoModuleActive({ moduli_attivi: ['tony'] }, ['tony'])).toBe(false);
  });

  it('consiglia alternativa rispettando vento e pioggia', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      sede: {
        label: 'Faenza',
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-21', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          { dt: '2026-05-22', pop: 5, windSpeedKmh: 19, rainMm: 0, tempMin: 15, tempMax: 25 },
          { dt: '2026-05-27', pop: 100, windSpeedKmh: 14, rainMm: 2.4 },
          { dt: '2026-05-29', pop: 5, windSpeedKmh: 10, rainMm: 0 },
        ]),
      },
    };
    const reply = await tryMeteoOperativoQuickReply('mi puoi consigliare un altra data per il trattamento?', meteo);
    expect(reply).toMatch(/ti consiglio/i);
    expect(reply).toMatch(/15 km\/h/i);
    expect(reply).not.toMatch(/22 maggio/i);
    expect(reply).not.toMatch(/19 km\/h/i);
  });

  it('valuta follow-up "facciamo giovedì?" con vento e pioggia', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      sede: {
        label: 'Faenza',
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-21', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          { dt: '2026-05-28', pop: 100, windSpeedKmh: 12, rainMm: 6 },
        ]),
      },
    };
    const reply = await tryMeteoOperativoQuickReply('allora facciamo giovedì?', meteo);
    expect(reply).toMatch(/Sconsiglio/i);
    expect(reply).toMatch(/6 mm|100%/i);
  });

  it('consiglia data evitando il giorno citato nel messaggio', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      sede: {
        label: 'Faenza',
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-27', pop: 100, windSpeedKmh: 14, rainMm: 2.4 },
          { dt: '2026-05-29', pop: 5, windSpeedKmh: 10, rainMm: 0 },
        ]),
      },
    };
    const reply = await tryMeteoOperativoQuickReply(
      'dovrei trattare mercoledì, che giorno mi consigli?',
      meteo
    );
    expect(reply).toMatch(/non conviene|Mercoledi 27 maggio/i);
    expect(reply).toMatch(/29 maggio/i);
    expect(reply).toMatch(/prima della pioggia|dopo la pioggia|Quale preferisci/i);
  });

  it('chiede morfologia se il terreno citato non ha tipoCampo', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'sg1',
          nome: 'Sangiovese',
          ok: true,
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-23', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('posso trattare sabato 23 sul Sangiovese?', meteo, {
      terreniNames: ['Sangiovese'],
      terreniCatalog: [{ id: 'sg1', nome: 'Sangiovese', tipoCampo: null }],
    });
    expect(reply).toMatch(/morfologia del terreno/i);
    expect(reply).toMatch(/pianura, collina o montagna/i);
  });

  it('sconsiglia in collina con lookback mm elevato e motiva morfologia', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'sg1',
          nome: 'Sangiovese',
          ok: true,
          tipoCampo: 'collina',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-21', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-22', pop: 10, windSpeedKmh: 9, rainMm: 7 },
            { dt: '2026-05-23', pop: 10, windSpeedKmh: 9, rainMm: 5 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('posso trattare sabato 23 sul Sangiovese?', meteo, {
      terreniNames: ['Sangiovese'],
      terreniCatalog: [{ id: 'sg1', nome: 'Sangiovese', tipoCampo: 'collina' }],
    });
    expect(reply).toMatch(/Sconsiglio/i);
    expect(reply).toMatch(/collina/i);
    expect(reply).toMatch(/12 mm|bagnato/i);
  });

  it('in collina con mm in fascia intermedia chiede passaggio trattore', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'sg1',
          nome: 'Sangiovese',
          ok: true,
          tipoCampo: 'collina',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-22', pop: 5, windSpeedKmh: 8, rainMm: 2 },
            { dt: '2026-05-23', pop: 5, windSpeedKmh: 8, rainMm: 2 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('posso trattare sabato 23 sul Sangiovese?', meteo, {
      terreniNames: ['Sangiovese'],
      terreniCatalog: [{ id: 'sg1', nome: 'Sangiovese', tipoCampo: 'collina' }],
    });
    expect(reply).toMatch(/Riesci a passare con il trattore/i);
    expect(reply).toMatch(/collina/i);
  });

  it('in pianura con 15 mm lookback approva se meteo ok', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'sem1',
          nome: 'Seminativo Nord',
          ok: true,
          tipoCampo: 'pianura',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-22', pop: 5, windSpeedKmh: 8, rainMm: 15 },
            { dt: '2026-05-23', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('posso trattare sabato 23 sul Seminativo Nord?', meteo, {
      terreniNames: ['Seminativo Nord'],
      terreniCatalog: [{ id: 'sem1', nome: 'Seminativo Nord', tipoCampo: 'pianura' }],
    });
    expect(reply).toMatch(/^Sì,/i);
    expect(reply).toMatch(/pianura|15 mm|praticabilit/i);
  });

  it('intercetta «trova una data alternativa»', () => {
    expect(isTonyMeteoConsigliaDataQuestion('trova una data alternativa')).toBe(true);
    expect(isTonyMeteoConsigliaDataQuestion('trova un altra data')).toBe(true);
  });

  it('preferisce sabato ideale invece di giovedì con pioggia forte', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-27', pop: 5, windSpeedKmh: 8, rainMm: 1.3 },
            { dt: '2026-05-28', pop: 86, windSpeedKmh: 15, rainMm: 0 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-30', pop: 5, windSpeedKmh: 10, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso trattare i kaki mercoledì 27?' }] },
      { role: 'model', parts: [{ text: 'Riesci a passare con il trattore? Rispondi sì o no.' }] },
      { role: 'user', parts: [{ text: 'no,non riesco' }] },
    ];
    const reply = await tryMeteoOperativoQuickReply('trova un altra data', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(reply).toMatch(/Ti propongo.*Sabato 30 maggio/i);
    expect(reply).toMatch(/Quale preferisci/i);
    expect(reply).not.toMatch(/Giovedi 28 maggio/i);
  });

  it('e sabato dopo «dopo il 27» sceglie il sabato successivo al 27', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-23', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-27', pop: 59, windSpeedKmh: 14, rainMm: 1.3 },
            { dt: '2026-05-30', pop: 5, windSpeedKmh: 9, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'trova una data dopo il 27 per kaki' }] },
      { role: 'model', parts: [{ text: 'Nessun giorno perfetto dopo il 27.' }] },
    ];
    const reply = await tryMeteoOperativoQuickReply('e sabato?', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(reply).toMatch(/Sabato 30 maggio/i);
    expect(reply).not.toMatch(/Sabato 23 maggio/i);
  });

  it('e sabato nel filo trattamento risponde senza Gemini', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-27', pop: 5, windSpeedKmh: 8, rainMm: 1.3 },
            { dt: '2026-05-30', pop: 5, windSpeedKmh: 10, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso trattare kaki mercoledì?' }] },
      { role: 'model', parts: [{ text: 'Riesci a passare con il trattore?' }] },
    ];
    const reply = await tryMeteoOperativoQuickReply('e sabato?', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(typeof reply).toBe('string');
    expect(reply).toMatch(/Sabato 30|trattamento|Sì|Sconsiglio/i);
  });

  it('follow-up sì dopo domanda trattore usa history Gemini (parts)', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-21', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-27', pop: 5, windSpeedKmh: 8, rainMm: 0.2 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 10, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso trattare i kaki mercoledì 27?' }] },
      {
        role: 'model',
        parts: [
          {
            text:
              'Mercoledi 27 maggio per Kaki il trattamento potrebbe essere possibile dal meteo, ma in montagna: Riesci a passare con il trattore quel giorno? Rispondi sì o no.',
          },
        ],
      },
    ];
    const reply = await tryMeteoOperativoQuickReply('si', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(typeof reply).toBe('string');
    expect(reply).toMatch(/Sì|Mercoledi 27|trattamento/i);
  });

  it('follow-up no,non riesco dopo domanda trattore sconsiglia senza Gemini', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-25', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-27', pop: 5, windSpeedKmh: 8, rainMm: 0.2 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso trattare kaki mercoledì 27?' }] },
      {
        role: 'model',
        parts: [
          {
            text:
              'Mercoledi 27 maggio per kaki il trattamento potrebbe essere possibile dal meteo, ma in montagna: Riesci a passare con il trattore quel giorno? Rispondi sì o no.',
          },
        ],
      },
    ];
    const reply = await tryMeteoOperativoQuickReply('no,non riesco', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(reply).toMatch(/Ti propongo/i);
    expect(reply).toMatch(/Quale preferisci/i);
    expect(reply).not.toMatch(/Riesci a passare con il trattore.*Rispondi sì o no/i);
  });

  it('confronto 28 o 29 maggio risponde in modo deterministico', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-28', pop: 90, windSpeedKmh: 12, rainMm: 10.56 },
            { dt: '2026-05-29', pop: 40, windSpeedKmh: 10, rainMm: 2.07 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('e trattare il 28 o il 29 sul kaki?', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
    });
    expect(reply).toMatch(/confronto i giorni/i);
    expect(reply).toMatch(/28/i);
    expect(reply).toMatch(/29/i);
    expect(reply).toMatch(/sconsigliato/i);
  });

  it('posso erpicare sabato 30 intercetta quick reply operativa', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-28', pop: 90, windSpeedKmh: 20, rainMm: 20 },
            { dt: '2026-05-30', pop: 5, windSpeedKmh: 18, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [{ role: 'user', parts: [{ text: 'posso trattare kaki mercoledì?' }] }];
    const reply = await tryMeteoOperativoQuickReply('posso erpicare sabato 30?', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(typeof reply).toBe('string');
    expect(reply).toMatch(/Sabato 30 maggio/i);
    expect(reply).toMatch(/lavorazione in campo|Sì|Sconsiglio/i);
    expect(reply).not.toMatch(/il lavorazione/i);
  });

  it('posso erpicare venerdì in collina dopo 10 mm giovedì chiede morfologia o sconsiglia', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'v1',
          nome: 'Vigneto Sud',
          ok: true,
          tipoCampo: 'collina',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-28', pop: 90, windSpeedKmh: 20, rainMm: 10 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 18, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('posso erpicare venerdì sul Vigneto Sud?', meteo, {
      terreniNames: ['Vigneto Sud'],
      terreniCatalog: [{ id: 'v1', nome: 'Vigneto Sud', tipoCampo: 'collina' }],
    });
    expect(reply).toMatch(/Sconsiglio/i);
    expect(reply).not.toMatch(/vento 18 km\/h.*soglia/i);
    expect(reply).toMatch(/bagnato|asciutte|mm/i);
  });

  it('posso erpicare venerdì in collina dopo pioggia giovedì (20 mm)', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'v1',
          nome: 'Vigneto Sud',
          ok: true,
          tipoCampo: 'collina',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-28', pop: 90, windSpeedKmh: 20, rainMm: 20 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 18, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('posso erpicare venerdì sul Vigneto Sud?', meteo, {
      terreniNames: ['Vigneto Sud'],
      terreniCatalog: [{ id: 'v1', nome: 'Vigneto Sud', tipoCampo: 'collina' }],
    });
    expect(reply).toMatch(/Sconsiglio/i);
    expect(reply).not.toMatch(/vento 18 km\/h.*soglia/i);
    expect(reply).toMatch(/bagnato|asciutte|mm/i);
  });

  it('posso erpicare venerdì senza terreno chiede morfologia', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      sede: {
        label: 'Faenza',
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-28', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          { dt: '2026-05-29', pop: 5, windSpeedKmh: 8, rainMm: 0 },
        ]),
      },
    };
    const reply = await tryMeteoOperativoQuickReply('posso erpicare venerdì?', meteo);
    expect(reply).toMatch(/morfologia del terreno/i);
    expect(reply).toMatch(/pianura, collina o montagna/i);
  });

  it('typo mercoldì attiva valutazione operativa su kaki', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-27', pop: 5, windSpeedKmh: 8, rainMm: 1.26 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply('posso trattare i kaki mercoldì?', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
    });
    expect(reply).toMatch(/Mercoledi 27|trattamento|trattore|Sì|Sconsiglio/i);
  });

  it('dopo il 29 non propone giorni precedenti al 29', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-25', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-27', pop: 80, windSpeedKmh: 12, rainMm: 6 },
            { dt: '2026-05-28', pop: 90, windSpeedKmh: 12, rainMm: 10 },
            { dt: '2026-05-29', pop: 100, windSpeedKmh: 14, rainMm: 15 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [{ role: 'user', parts: [{ text: 'posso trattare kaki mercoledì 27?' }] }];
    const reply = await tryMeteoOperativoQuickReply('trova una data dopo il 29', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(reply).toMatch(/dopo|29 maggio|non trovo/i);
    expect(reply).not.toMatch(/ti consiglio Lunedi 25 maggio/i);
    expect(reply).not.toMatch(/ti consiglio Martedi 26 maggio/i);
  });

  it('esclude dalla history i giorni «non posso» / «neanche»', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-25', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-26', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-27', pop: 80, windSpeedKmh: 12, rainMm: 6 },
            { dt: '2026-05-28', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-30', pop: 5, windSpeedKmh: 10, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso trattare kaki mercoledì 27?' }] },
      { role: 'user', parts: [{ text: 'il 25 non posso' }] },
      { role: 'user', parts: [{ text: 'neanche martedi riesco' }] },
    ];
    const reply = await tryMeteoOperativoQuickReply('quindi che giorno consigli?', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(reply).toMatch(/Ti propongo/i);
    expect(reply).toMatch(/30 maggio/i);
    expect(reply).not.toMatch(/25 maggio/i);
  });

  it('consiglia alternativa con terreno dalla history', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'k1',
          nome: 'Kaki',
          ok: true,
          tipoCampo: 'montagna',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-25', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-26', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-27', pop: 80, windSpeedKmh: 12, rainMm: 6 },
            { dt: '2026-05-28', pop: 100, windSpeedKmh: 14, rainMm: 10 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso trattare i kaki mercoledì 27?' }] },
      { role: 'model', parts: [{ text: 'Riesci a passare con il trattore?' }] },
      { role: 'user', parts: [{ text: 'non è praticabile' }] },
    ];
    const reply = await tryMeteoOperativoQuickReply('trova una data alternativa', meteo, {
      terreniNames: ['Kaki'],
      terreniCatalog: [{ id: 'k1', nome: 'Kaki', tipoCampo: 'montagna' }],
      history,
    });
    expect(reply).toMatch(/Ti propongo/i);
    expect(reply).toMatch(/(25|26) maggio/i);
    expect(reply).toMatch(/prima della pioggia/i);
  });

  it('alternativa in collina evita giorni con lookback impraticabile', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'sg1',
          nome: 'Sangiovese',
          ok: true,
          tipoCampo: 'collina',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-22', pop: 5, windSpeedKmh: 8, rainMm: 8 },
            { dt: '2026-05-23', pop: 5, windSpeedKmh: 8, rainMm: 4 },
            { dt: '2026-05-24', pop: 5, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-25', pop: 5, windSpeedKmh: 10, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const reply = await tryMeteoOperativoQuickReply(
      'consigliami un altra data per il trattamento sul Sangiovese',
      meteo,
      {
        terreniNames: ['Sangiovese'],
        terreniCatalog: [{ id: 'sg1', nome: 'Sangiovese', tipoCampo: 'collina' }],
      }
    );
    expect(reply).toMatch(/ti consiglio/i);
    expect(reply).toMatch(/25 maggio/i);
    expect(reply).not.toMatch(/23 maggio/i);
  });

  it('alternativa erpicatura dopo giovedì 28 non propone date precedenti', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'p1',
          nome: 'Pinot',
          ok: true,
          tipoCampo: 'collina',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-22', pop: 90, windSpeedKmh: 20, rainMm: 15 },
            { dt: '2026-05-27', pop: 10, windSpeedKmh: 8, rainMm: 4.9 },
            { dt: '2026-05-28', pop: 10, windSpeedKmh: 8, rainMm: 5 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-30', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-31', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso erpicare giovedì nel pinot?' }] },
      {
        role: 'model',
        parts: [
          {
            text:
              'Giovedi 28 maggio per pinot la lavorazione in campo potrebbe essere possibile dal meteo, ma in collina (circa 9.9 mm previsti nella finestra pioggia recente): Riesci a lavorare il terreno quel giorno (macchina o attrezzi)? Rispondi sì o no.',
          },
        ],
      },
      { role: 'user', parts: [{ text: 'no' }] },
    ];
    const reply = await tryMeteoOperativoQuickReply('cerca un altra data per erpicare', meteo, {
      terreniNames: ['Pinot'],
      terreniCatalog: [{ id: 'p1', nome: 'Pinot', tipoCampo: 'collina' }],
      history,
    });
    expect(reply).toMatch(/Ti propongo/i);
    expect(reply).toMatch(/31 maggio|due alternative/i);
    expect(reply).toMatch(/prima della pioggia|dopo la pioggia/i);
    expect(reply).not.toMatch(/22 maggio/i);
  });

  it('no dopo chiedi praticabilità propone due alternative prima e dopo', async () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      terreni: [
        {
          terrenoId: 'p1',
          nome: 'Pinot',
          ok: true,
          tipoCampo: 'collina',
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-26', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-27', pop: 10, windSpeedKmh: 8, rainMm: 4.9 },
            { dt: '2026-05-28', pop: 10, windSpeedKmh: 8, rainMm: 5 },
            { dt: '2026-05-29', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-30', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-31', pop: 5, windSpeedKmh: 8, rainMm: 0 },
          ]),
        },
      ],
      sede: { label: 'Faenza', previsioniGiornaliere: [] },
    };
    const history = [
      { role: 'user', parts: [{ text: 'posso erpicare giovedì nel pinot?' }] },
      {
        role: 'model',
        parts: [
          {
            text:
              'Giovedi 28 maggio per pinot la lavorazione in campo potrebbe essere possibile dal meteo, ma in collina (circa 9.9 mm previsti nella finestra pioggia recente): Riesci a lavorare il terreno quel giorno (macchina o attrezzi)? Rispondi sì o no.',
          },
        ],
      },
    ];
    const reply = await tryMeteoOperativoQuickReply('no', meteo, {
      terreniNames: ['Pinot'],
      terreniCatalog: [{ id: 'p1', nome: 'Pinot', tipoCampo: 'collina' }],
      history,
    });
    expect(reply).toMatch(/Ti propongo due alternative/i);
    expect(reply).toMatch(/26 maggio.*prima della pioggia/i);
    expect(reply).toMatch(/31 maggio.*asciugatura/i);
    expect(reply).toMatch(/Quale preferisci/i);
  });

  it('intercetta «cerca un altra data» e follow-up sì nel filo meteo', () => {
    expect(isTonyMeteoConsigliaDataQuestion('cerca un altra data per erpicare')).toBe(true);
    const history = [
      { role: 'model', parts: [{ text: 'Ok, rimandiamo l erpicatura. Vuoi che cerchi un altra data adatta?' }] },
    ];
    expect(isTonyMeteoConsigliaDataFollowUp('si cerca un altra data', history)).toBe(true);
  });
});

describe('evaluateMeteoOperativoGiorno', () => {
  it('sconsiglia trattamento con pop alta e mm previsti', () => {
    const ev = evaluateMeteoOperativoGiorno(
      { pop: 100, rainMm: 2.4, windSpeedKmh: 14 },
      'trattamento',
      DEFAULT_TONY_METEO_RULES
    );
    expect(ev.esito).toBe('sconsigliato');
  });
});

describe('tryMeteoCondizioniQuickReply', () => {
  it('ricava vento domani dalle previsioni se manca su tomorrow', () => {
    const meteo = {
      disponibile: true,
      moduloMeteoAttivo: true,
      sede: {
        label: 'Sabbie Gialle — Faenza',
        tomorrow: { pop: 0, tempMin: 14, tempMax: 26 },
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-21', pop: 5, windSpeedKmh: 9 },
          { dt: '2026-05-22', pop: 0, windSpeedKmh: 18, tempMin: 14, tempMax: 26 },
        ]),
      },
    };
    const reply = tryMeteoCondizioniQuickReply('ci sarà vento domani?', meteo);
    expect(reply).toMatch(/^Domani:/);
    expect(reply).not.toMatch(/per Sabbie/i);
    expect(reply).toMatch(/18 km\/h/i);
  });

  it('risponde sul vento di domani per un terreno citato', () => {
    const meteo = {
      ...sampleMeteo,
      terreni: [
        {
          terrenoId: 'pinot1',
          nome: 'Pinot — Faenza',
          ok: true,
          domani: { windSpeedKmh: 22, tempMin: 12, tempMax: 24, pop: 0 },
          previsioniGiornaliere: [],
        },
      ],
    };
    const reply = tryMeteoCondizioniQuickReply('ci sarà vento domani nel pinot?', meteo, {
      terreniNames: ['Pinot — Faenza'],
    });
    expect(reply).toMatch(/Domani per Pinot/i);
    expect(reply).toMatch(/vento moderato \(22 km\/h\)/i);
    expect(reply).not.toMatch(/pioggia/i);
  });
});

describe('tryMeteoGiornoQuickReply', () => {
  it('risolve sabato al sabato nel range 8 giorni', () => {
    const reply = tryMeteoGiornoQuickReply('sabato pioverà?', sampleMeteo);
    expect(reply).toMatch(/Sabato 23 maggio/i);
    expect(reply).toMatch(/probabilità del 35%/i);
    expect(reply).toMatch(/4\.2 mm previsti/i);
  });

  it('risponde ai millimetri previsti per un giorno', () => {
    const reply = tryMeteoGiornoQuickReply('quanti mm di pioggia sabato?', sampleMeteo);
    expect(reply).toMatch(/Sabato 23 maggio/i);
    expect(reply).toMatch(/4\.2 mm previsti/i);
  });

  it('risolve sabato 23 esplicito', () => {
    const reply = tryMeteoGiornoQuickReply('sabato 23 pioverà?', sampleMeteo);
    expect(reply).toMatch(/Sabato 23 maggio/i);
  });

  it('risponde alla prossima pioggia', () => {
    const reply = tryMeteoGiornoQuickReply('quando pioverà la prossima volta?', sampleMeteo);
    expect(reply).toMatch(/prossima pioggia/i);
    expect(reply).toMatch(/23 maggio|27 maggio/i);
  });
});

describe('shouldBuildTerreniMeteoContext', () => {
  it('non carica terreni per domanda generica su sabato', () => {
    expect(
      shouldBuildTerreniMeteoContext('sabato pioverà?', null, { terreniNames: ['Sabbie Gialle'] })
    ).toBe(false);
  });

  it('carica terreni se citato il campo', () => {
    expect(
      shouldBuildTerreniMeteoContext('sabato pioverà a Sabbie Gialle?', null, {
        terreniNames: ['Sabbie Gialle'],
      })
    ).toBe(true);
  });

  it('carica terreni per vento su campo citato per token', () => {
    expect(
      shouldBuildTerreniMeteoContext('ci sarà vento domani nel pinot?', null, {
        terreniNames: ['Pinot — Faenza'],
      })
    ).toBe(true);
  });

  it('carica terreni per domanda operativa su giorno', () => {
    expect(shouldBuildTerreniMeteoContext('posso trattare mercoledì?', null, {})).toBe(true);
  });
});

describe('tryMeteoPreventivoDateQuickReply', () => {
  const preventivoCtx = {
    form: {
      formId: 'preventivo-form',
      fields: [
        { id: 'tipo-lavoro', value: 'Trinciatura tra le file' },
        { id: 'terreno-id', value: 'terreno-vite-1' },
        { id: 'tipo-campo', value: 'collina' },
      ],
    },
  };

  const meteoTerreno = {
    disponibile: true,
    moduloMeteoAttivo: true,
    sede: { label: 'Faenza', previsioniGiornaliere: [] },
    terreni: [
      {
        terrenoId: 'terreno-vite-1',
        nome: 'Trebbiano lago',
        ok: true,
        tipoCampo: 'collina',
        previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
          { dt: '2026-05-24', pop: 0, windSpeedKmh: 10, rainMm: 0 },
          { dt: '2026-05-26', pop: 0, windSpeedKmh: 12, rainMm: 0 },
          { dt: '2026-05-27', pop: 100, windSpeedKmh: 14, rainMm: 2.7 },
        ]),
      },
    ],
  };

  it('isTonyPreventivoDateMeteoEval: mercoledì con tipo lavoro nel form', () => {
    expect(isTonyPreventivoDateMeteoEval('mercoledì', preventivoCtx)).toBe(true);
    expect(isTonyPreventivoDateMeteoEval('posso trinciare mercoledì?', preventivoCtx)).toBe(false);
  });

  it('sconsiglia data preventivo se meteo sfavorevole e propone alternativa', async () => {
    const reply = await tryMeteoPreventivoDateQuickReply('mercoledì', meteoTerreno, {
      tonyContext: preventivoCtx,
    });
    expect(reply).toMatch(/Sconsiglio/i);
    expect(reply).toMatch(/alternativ/i);
  });

  it('non blocca se meteo favorevole (lascia iniezione data a Gemini)', async () => {
    const meteoOk = {
      ...meteoTerreno,
      terreni: [
        {
          ...meteoTerreno.terreni[0],
          previsioniGiornaliere: enrichPrevisioniGiornaliereForTony([
            { dt: '2026-05-24', pop: 0, windSpeedKmh: 10, rainMm: 0 },
            { dt: '2026-05-26', pop: 5, windSpeedKmh: 8, rainMm: 0 },
            { dt: '2026-05-27', pop: 10, windSpeedKmh: 9, rainMm: 0 },
          ]),
        },
      ],
    };
    const reply = await tryMeteoPreventivoDateQuickReply('mercoledì', meteoOk, {
      tonyContext: preventivoCtx,
    });
    expect(reply).toBeNull();
  });

  it('accetta ok facciamo martedì come data preventivo (non meteo operativo generico)', () => {
    expect(isTonyPreventivoDateMeteoEval('ok facciamo martedì', preventivoCtx)).toBe(true);
  });
});
