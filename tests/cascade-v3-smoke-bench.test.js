/**
 * Smoke + benchmark v3: filtri cascata, semafori dashboard, CV attrezzi.
 * Dataset dimensioni demo-max plausibili; misura tempi e coerenza X→Y.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  filterTipiLavoroByCategoria,
  filterTipiLavoroVendemmia,
  extractColtureUnicheFromTerreni,
  coltureDisponibiliPerCategoria,
  getSottocategorieForParent,
  isCategoriaRaccolta,
  terrenoHaColturaVite,
} from '../core/js/lavoro-cascade-filters.js';
import {
  attrezziCompatibiliConTrattoreCv,
  filterAttrezziDropdownCompatibili,
} from '../core/js/macchine-cv-compat.js';
import { localizeMeteoAlert } from '../core/config/meteo-alert-i18n.js';
import { addDaysFromToday } from '../simulator/lib/seed-parco-macchine-details.js';

vi.mock('../core/js/dashboard-data.js', () => {
  function calcolaAlertAffitto(dataScadenza) {
    if (!dataScadenza) return { colore: null, testo: '', giorni: null };
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const scadenza = dataScadenza instanceof Date ? dataScadenza : new Date(dataScadenza);
    scadenza.setHours(0, 0, 0, 0);
    const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
    const mesiRimanenti = giorniRimanenti / 30;
    if (giorniRimanenti < 0) {
      return { colore: 'grey', testo: 'Scaduto', giorni: giorniRimanenti, mesi: null };
    }
    if (giorniRimanenti <= 30) {
      return { colore: 'red', testo: `${giorniRimanenti} giorni`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    }
    if (giorniRimanenti <= 180) {
      return { colore: 'yellow', testo: `~${Math.floor(mesiRimanenti)} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    }
    return { colore: 'green', testo: `~${Math.floor(mesiRimanenti)} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
  }
  return {
    calcolaAlertAffitto,
    formattaDataScadenza: (d) => new Date(d).toLocaleDateString('it-IT'),
    loadLavoriDaPianificareCount: async () => 0,
    countOreDaValidareManager: async () => 0,
  };
});

vi.mock('../core/js/dashboard-counts-snapshot.js', () => ({
  getDashboardCountsSnapshot: () => null,
  ORE_READY_EVENT: 'dashboard-ore-ready',
}));

vi.mock('../core/js/dashboard-perf.js', () => ({
  dashboardPerfAsync: async (_label, fn) => fn(),
}));

import {
  calcolaUrgenzaData,
  fetchInArrivoItems,
  fetchScadenzeAmministrazioneItems,
} from '../core/js/dashboard-deadlines.js';

const COLTURE = ['Grano tenero', 'Mais', 'Vite da Vino', 'Vite da Tavola', 'Olivo', 'Soia'];

function buildDemoDataset() {
  const categorie = [
    { id: 'cat-lav', nome: 'Lavorazione del Terreno' },
    { id: 'cat-rac', nome: 'Raccolta' },
    { id: 'cat-tratt', nome: 'Trattamenti' },
  ];
  const sottoMap = new Map([
    ['cat-lav', [
      { id: 'sub-gen', nome: 'Generale', parentId: 'cat-lav' },
      { id: 'sub-file', nome: 'Tra le File', parentId: 'cat-lav' },
    ]],
    ['cat-rac', [
      { id: 'sub-rman', nome: 'Raccolta Manuale', parentId: 'cat-rac' },
      { id: 'sub-rmec', nome: 'Raccolta Meccanica', parentId: 'cat-rac' },
    ]],
    ['cat-tratt', [{ id: 'sub-fit', nome: 'Fitosanitari', parentId: 'cat-tratt' }]],
  ]);

  const tipi = [];
  for (let i = 0; i < 120; i++) {
    const subKeys = ['sub-gen', 'sub-file', 'sub-rman', 'sub-rmec', 'sub-fit'];
    const subId = subKeys[i % subKeys.length];
    const isVendemmia = (subId === 'sub-rman' || subId === 'sub-rmec') && i % 3 === 0;
    tipi.push({
      id: `tipo-${i}`,
      nome: isVendemmia
        ? `Vendemmia ${subId === 'sub-rman' ? 'Manuale' : 'Meccanica'}`
        : `Lavoro demo ${i}`,
      categoriaId: subId,
      sottocategoriaId: subId,
    });
  }

  const terreni = Array.from({ length: 48 }, (_, i) => ({
    id: `t-${i}`,
    nome: `Campo ${i}`,
    coltura: COLTURE[i % COLTURE.length],
    tipoPossesso: i % 7 === 0 ? 'affitto' : 'proprieta',
    dataScadenzaAffitto: i % 7 === 0 ? addDaysFromToday((i % 4) * 60 - 10) : null,
  }));

  const trattori = Array.from({ length: 8 }, (_, i) => ({
    id: `tr-${i}`,
    nome: `Trattore ${50 + i * 10}`,
    cavalli: 50 + i * 10,
    tipoMacchina: 'trattore',
    oreAttuali: 1200 + i * 20,
    oreProssimaManutenzione: 1230 + i * 15,
    prossimaManutenzione: addDaysFromToday(10 + i * 5),
  }));

  const attrezzi = Array.from({ length: 35 }, (_, i) => ({
    id: `at-${i}`,
    nome: `Attrezzo ${i}`,
    cavalliMinimiRichiesti: 30 + (i % 5) * 15,
    stato: i % 11 === 0 ? 'dismesso' : 'disponibile',
  }));

  const kmBase = 45000;
  const flotta = Array.from({ length: 6 }, (_, i) => ({
    id: `fl-${i}`,
    nome: `Furgone ${i}`,
    tipoMacchina: 'furgone',
    kmAttuali: kmBase + i * 2000,
    kmProssimaManutenzione: kmBase + i * 2000 + (i === 1 ? -500 : 800),
    prossimaManutenzione: addDaysFromToday(i === 2 ? -2 : 20 + i),
    prossimaRevisione: addDaysFromToday(i === 0 ? -5 : 30 + i * 10),
    prossimaAssicurazione: addDaysFromToday(i === 3 ? 5 : 90 + i * 20),
  }));

  return { categorie, sottoMap, tipi, terreni, trattori, attrezzi, flotta, kmBase };
}

function benchMs(fn, iterations = 2000) {
  const t0 = performance.now();
  let last;
  for (let i = 0; i < iterations; i++) {
    last = fn(i);
  }
  const elapsed = performance.now() - t0;
  return { elapsed, perCallUs: (elapsed / iterations) * 1000, last };
}

function makeMockDeps(collections) {
  return {
    db: {},
    collection: (_db, path) => ({ path }),
    getDocs: async (ref) => ({
      forEach: (fn) => {
        (collections[ref.path] || []).forEach((row) => {
          fn({ id: row.id, data: () => row.data });
        });
      },
    }),
  };
}

describe('cascade v3 smoke — catena integrata demo-max', () => {
  const ds = buildDemoDataset();

  it('terreni → colture → filtro categoria coltura coerente', () => {
    const colture = extractColtureUnicheFromTerreni(ds.terreni);
    expect(colture.length).toBe(COLTURE.length);

    const perCat = {
      'cat-vite': [{ nome: 'Vite da Vino' }, { nome: 'Vite da Tavola' }],
      'cat-cereali': [{ nome: 'Grano tenero' }, { nome: 'Mais' }, { nome: 'Soia' }],
    };
    const vite = coltureDisponibiliPerCategoria('cat-vite', perCat);
    expect(vite.every((c) => c.includes('Vite'))).toBe(true);
    expect(colture.filter((c) => c.includes('Vite')).sort()).toEqual(vite);
  });

  it('categoria lavoro → tipi → vendemmia su terreno vite', () => {
    const terrenoVite = ds.terreni.find((t) => t.coltura === 'Vite da Vino');
    expect(terrenoHaColturaVite(terrenoVite)).toBe(true);
    expect(isCategoriaRaccolta('cat-rac', ds.categorie, ds.sottoMap)).toBe(true);

    const tipiRaccolta = filterTipiLavoroByCategoria(
      'cat-rac',
      ds.tipi,
      ds.categorie,
      ds.sottoMap
    );
    expect(tipiRaccolta.length).toBeGreaterThan(0);

    const vendemmia = filterTipiLavoroVendemmia(tipiRaccolta, {
      isRaccolta: true,
      isTerrenoVite: true,
    });
    expect(vendemmia.length).toBeGreaterThan(0);
    expect(vendemmia.every((t) => /vendemmia/i.test(t.nome))).toBe(true);
  });

  it('trattore CV → attrezzi dropdown (8 trattori × 35 attrezzi)', () => {
    for (const tr of ds.trattori) {
      const compat = filterAttrezziDropdownCompatibili(tr, ds.attrezzi);
      expect(compat.every((a) => a.stato !== 'dismesso')).toBe(true);
      const cv = Number(tr.cavalli);
      expect(compat.every((a) => cv >= (Number(a.cavalliMinimiRichiesti) || 0))).toBe(true);
    }
    const tr50 = ds.trattori[0];
    const tr100 = ds.trattori[5];
    expect(
      filterAttrezziDropdownCompatibili(tr50, ds.attrezzi).length
    ).toBeLessThan(filterAttrezziDropdownCompatibili(tr100, ds.attrezzi).length);
  });

  it('semafori dashboard — fetch parco + affitti senza errori e colori attesi', async () => {
    const affitti = ds.terreni.filter((t) => t.tipoPossesso === 'affitto');
    const deps = makeMockDeps({
      'tenants/sim_smoke/terreni': affitti.map((t) => ({ id: t.id, data: t })),
      'tenants/sim_smoke/macchine': [...ds.trattori, ...ds.flotta].map((m) => ({
        id: m.id,
        data: m,
      })),
    });

    const inArrivo = await fetchInArrivoItems(
      'sim_smoke',
      { hasManodopera: false, hasContoTerzi: false, availableModules: ['parcoMacchine'] },
      deps
    );
    const scadenze = await fetchScadenzeAmministrazioneItems(
      'sim_smoke',
      ['parcoMacchine'],
      deps
    );

    expect(inArrivo.length).toBeGreaterThan(0);
    expect(scadenze.length).toBeGreaterThan(0);

    const coloriInArrivo = new Set(inArrivo.map((it) => it.colore));
    expect(coloriInArrivo.has('black') || coloriInArrivo.has('red')).toBe(true);

    const affittoItems = scadenze.filter((it) => it.tipoLabel === 'Affitto');
    expect(affittoItems.length).toBe(affitti.length);
    expect(new Set(affittoItems.map((it) => it.colore)).size).toBeGreaterThan(1);

    expect(calcolaUrgenzaData(addDaysFromToday(-1)).colore).toBe('black');
    expect(calcolaUrgenzaData(addDaysFromToday(3)).colore).toBe('red');
  });

  it('meteo i18n — campione alert non in inglese', () => {
    const samples = [
      { event: 'Extreme high temperature', sender_name: 'MeteoAlarm Italy' },
      { event: 'Wind', description: 'Strong wind gusts expected' },
    ];
    for (const s of samples) {
      const out = localizeMeteoAlert(s);
      expect(out.event).toBeTruthy();
      expect(out.event.toLowerCase()).not.toMatch(/^extreme high temperature$/);
    }
  });
});

describe('cascade v3 bench — tempi filtri (soglie demo ERP)', () => {
  const ds = buildDemoDataset();
  const ITER = 3000;

  it('filterTipiLavoroByCategoria — < 0.05 ms/chiamata media', () => {
    const { elapsed, perCallUs, last } = benchMs(
      () => filterTipiLavoroByCategoria('cat-rac', ds.tipi, ds.categorie, ds.sottoMap),
      ITER
    );
    expect(last.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(150);
    expect(perCallUs).toBeLessThan(50);
    console.log(`[bench] filterTipiLavoroByCategoria: ${elapsed.toFixed(2)}ms / ${ITER} = ${perCallUs.toFixed(3)}µs`);
  });

  it('filterAttrezziDropdownCompatibili — < 0.05 ms/chiamata media', () => {
    const tr = ds.trattori[3];
    const { elapsed, perCallUs, last } = benchMs(
      () => filterAttrezziDropdownCompatibili(tr, ds.attrezzi),
      ITER
    );
    expect(last.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
    expect(perCallUs).toBeLessThan(50);
    console.log(`[bench] filterAttrezziDropdownCompatibili: ${elapsed.toFixed(2)}ms / ${ITER} = ${perCallUs.toFixed(3)}µs`);
  });

  it('extractColtureUnicheFromTerreni — < 0.1 ms/chiamata (48 terreni)', () => {
    const { elapsed, perCallUs, last } = benchMs(
      () => extractColtureUnicheFromTerreni(ds.terreni),
      ITER
    );
    expect(last.length).toBe(COLTURE.length);
    expect(elapsed).toBeLessThan(200);
    expect(perCallUs).toBeLessThan(100);
    console.log(`[bench] extractColtureUnicheFromTerreni: ${elapsed.toFixed(2)}ms / ${ITER} = ${perCallUs.toFixed(3)}µs`);
  });

  it('getSottocategorieForParent — < 0.02 ms/chiamata', () => {
    const { elapsed, perCallUs, last } = benchMs(
      () => getSottocategorieForParent('cat-lav', ds.sottoMap),
      ITER
    );
    expect(last.length).toBe(2);
    expect(elapsed).toBeLessThan(80);
    expect(perCallUs).toBeLessThan(30);
    console.log(`[bench] getSottocategorieForParent: ${elapsed.toFixed(2)}ms / ${ITER} = ${perCallUs.toFixed(3)}µs`);
  });

  it('fetchInArrivoItems + fetchScadenzeAmministrazioneItems — < 15ms per ciclo', async () => {
    const affitti = ds.terreni.filter((t) => t.tipoPossesso === 'affitto');
    const deps = makeMockDeps({
      'tenants/sim_smoke/terreni': affitti.map((t) => ({ id: t.id, data: t })),
      'tenants/sim_smoke/macchine': [...ds.trattori, ...ds.flotta].map((m) => ({
        id: m.id,
        data: m,
      })),
    });
    const cycles = 200;
    const t0 = performance.now();
    for (let i = 0; i < cycles; i++) {
      await fetchInArrivoItems(
        'sim_smoke',
        { hasManodopera: false, hasContoTerzi: false, availableModules: ['parcoMacchine'] },
        deps
      );
      await fetchScadenzeAmministrazioneItems('sim_smoke', ['parcoMacchine'], deps);
    }
    const elapsed = performance.now() - t0;
    const perCycle = elapsed / cycles;
    expect(elapsed).toBeLessThan(3000);
    expect(perCycle).toBeLessThan(15);
    console.log(`[bench] dashboard fetch x${cycles}: ${elapsed.toFixed(2)}ms tot, ${perCycle.toFixed(3)}ms/ciclo`);
  });

  it('catena cascata completa (5 step) — < 1 ms per interazione utente simulata', () => {
    const terreno = ds.terreni.find((t) => t.coltura.includes('Vite'));
    const trattore = ds.trattori[4];
    const I = 1000;
    const t0 = performance.now();
    for (let n = 0; n < I; n++) {
      getSottocategorieForParent('cat-rac', ds.sottoMap);
      const tipi = filterTipiLavoroByCategoria('cat-rac', ds.tipi, ds.categorie, ds.sottoMap);
      filterTipiLavoroVendemmia(tipi, {
        isRaccolta: true,
        isTerrenoVite: terrenoHaColturaVite(terreno),
      });
      filterAttrezziDropdownCompatibili(trattore, ds.attrezzi);
      attrezziCompatibiliConTrattoreCv(trattore, ds.attrezzi);
    }
    const elapsed = performance.now() - t0;
    const perInteraction = elapsed / I;
    expect(perInteraction).toBeLessThan(1);
    console.log(`[bench] catena 5-step x${I}: ${elapsed.toFixed(2)}ms, ${perInteraction.toFixed(3)}ms/interazione`);
  });
});
