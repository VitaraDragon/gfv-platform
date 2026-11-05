/** @vitest-environment jsdom */
/**
 * C2: la miscela prevista sul lavoro diventa le righe del trattamento (vigneto, frutteto).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ docs: new Map(), nextId: 1 }));
const mocks = vi.hoisted(() => ({
  lavoro: null,
  terreno: null,
  prodotti: [],
  prodottiFail: false
}));

vi.mock('../core/services/firebase-service.js', () => ({
  getCollectionData: vi.fn(async (path) => {
    const out = [];
    store.docs.forEach((doc, key) => {
      if (key.startsWith(path + '/')) out.push({ ...doc, id: key.slice(path.length + 1) });
    });
    return out;
  }),
  getDocumentData: vi.fn(async (path, id) => store.docs.get(path + '/' + id) || null),
  createDocument: vi.fn(async (path, data) => {
    const id = 'trat-' + store.nextId++;
    store.docs.set(path + '/' + id, { ...data });
    return id;
  }),
  updateDocument: vi.fn(async (path, id, data) => {
    const key = path + '/' + id;
    store.docs.set(key, { ...(store.docs.get(key) || {}), ...data });
  }),
  deleteDocument: vi.fn(),
  dateToTimestamp: vi.fn((d) => d),
  timestampToDate: vi.fn((d) => d),
  getDb: vi.fn()
}));
vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 't1'),
  getCurrentUser: vi.fn(() => ({ uid: 'u1' }))
}));
vi.mock('../core/services/lavori-service.js', () => ({
  getLavoro: vi.fn(async () => mocks.lavoro)
}));
vi.mock('../core/services/terreni-service.js', () => ({
  getTerreno: vi.fn(async () => mocks.terreno)
}));
vi.mock('../core/services/tipi-lavoro-service.js', () => ({
  getTipoLavoroByNome: vi.fn(async () => ({ categoriaId: 'cat1' }))
}));
vi.mock('../core/services/categorie-service.js', () => ({
  getCategoria: vi.fn(async () => ({ codice: 'trattamenti' }))
}));
vi.mock('../core/services/storico-guard.js', () => ({
  assertRegistroImpiantoModificabile: vi.fn(async () => undefined)
}));
vi.mock('../core/js/attivita-utils.js', () => ({
  mapColturaToCategoria: vi.fn(() => 'Frutteto')
}));
vi.mock('../modules/magazzino/services/prodotti-service.js', () => ({
  getAllProdotti: vi.fn(async () => {
    if (mocks.prodottiFail) throw new Error('magazzino non attivo');
    return mocks.prodotti;
  })
}));
vi.mock('../modules/vigneto/services/vigneti-service.js', () => ({
  getAllVigneti: vi.fn(async () => [{ id: 'v1', terrenoId: 'ter1' }]),
  getVigneto: vi.fn(),
  updateVigneto: vi.fn(async () => undefined)
}));
vi.mock('../modules/frutteto/services/frutteti-service.js', () => ({
  getAllFrutteti: vi.fn(async () => [{ id: 'f1', terrenoId: 'ter1', specie: 'Melo' }]),
  getFruttetiByTerreno: vi.fn(async () => [{ id: 'f1', terrenoId: 'ter1', specie: 'Melo' }]),
  getFrutteto: vi.fn(),
  updateFrutteto: vi.fn(async () => undefined)
}));

import {
  righeTrattamentoDaMiscela,
  applicaCostiDaAnagrafica,
  trattamentoHaSoloRigaVuota,
  avvisiRegistrazione
} from '../shared/js/registro-trattamenti.js';
import {
  avvisiMiscelaLavoro,
  componiMiscelaDalForm,
  installaMiscelaLavoro
} from '../shared/js/registro-trattamenti-lavoro.js';
import * as vigneto from '../modules/vigneto/services/trattamenti-vigneto-service.js';
import * as frutteto from '../modules/frutteto/services/trattamenti-frutteto-service.js';

const MISCELA = {
  ettolitriPerEttaro: 4,
  ettolitriTotali: 8,
  prodotti: [
    { prodottoId: 'p1', nome: 'Folpan', unita: 'kg', dosePerEttaro: 2.5, quantita: 5, dosePerEttolitro: 0.625 },
    { prodottoId: 'p2', nome: 'Karathane', unita: 'l', dosePerEttaro: 0.5, dosePerEttolitro: 0.125 }
  ]
};

describe('righeTrattamentoDaMiscela', () => {
  it('mappa i campi della miscela sulla riga trattamento', () => {
    const r = righeTrattamentoDaMiscela(MISCELA, 2);
    expect(r.prodotti).toHaveLength(2);
    expect(r.prodotti[0]).toEqual({
      prodottoId: 'p1',
      prodotto: 'Folpan',
      dosaggio: 2.5,
      unitaDosaggio: 'kg',
      quantita: 5,
      dosePerEttolitroScheda: 0.625
    });
    expect(r.prodotti[1].quantita).toBe(1);
  });

  it('porta con sé l\'acqua', () => {
    const r = righeTrattamentoDaMiscela(MISCELA, 2);
    expect(r.acquaEttolitriPerEttaro).toBe(4);
    expect(r.acquaEttolitriTotali).toBe(8);
  });

  it('arrotonda la quantità a 4 decimali', () => {
    const r = righeTrattamentoDaMiscela({ prodotti: [{ nome: 'X', dosePerEttaro: 0.333333 }] }, 1.23456);
    expect(r.prodotti[0].quantita).toBe(0.4115);
  });

  it('lo stesso prodotto compare una volta sola (per id e per nome)', () => {
    const r = righeTrattamentoDaMiscela({
      prodotti: [
        { prodottoId: 'p1', nome: 'Folpan', dosePerEttaro: 2 },
        { prodottoId: 'p1', nome: 'Folpan', dosePerEttaro: 3 },
        { nome: 'Rame', dosePerEttaro: 1 },
        { nome: ' rame ', dosePerEttaro: 9 }
      ]
    }, 1);
    expect(r.prodotti.map((p) => p.prodotto)).toEqual(['Folpan', 'Rame']);
    expect(r.prodotti[0].dosaggio).toBe(2);
  });

  it('miscela vuota o assente: nessuna riga e nessun NaN', () => {
    [null, undefined, {}, { prodotti: [] }, { prodotti: [{ nome: '' }, null] }].forEach((m) => {
      const r = righeTrattamentoDaMiscela(m, 2);
      expect(r.prodotti).toEqual([]);
      expect(r.acquaEttolitriPerEttaro).toBeNull();
      expect(r.acquaEttolitriTotali).toBeNull();
    });
  });

  it('senza superficie la quantità resta vuota, non NaN', () => {
    [null, undefined, 0, 'abc'].forEach((sup) => {
      const r = righeTrattamentoDaMiscela(MISCELA, sup);
      expect(r.prodotti[0].quantita).toBeNull();
      expect(r.prodotti[0].dosaggio).toBe(2.5);
    });
  });
});

describe('costi e riga vuota', () => {
  it('costo = quantità × prezzo dell\'anagrafica, se c\'è il prezzo', () => {
    const { prodotti } = righeTrattamentoDaMiscela(MISCELA, 2);
    const r = applicaCostiDaAnagrafica(prodotti, [{ id: 'p1', prezzoUnitario: 10 }, { id: 'p2' }]);
    expect(r.prodotti[0].costo).toBe(50);
    expect(r.prodotti[1].costo).toBeNull();
    expect(r.costoProdotto).toBe(50);
  });

  it('riconosce la sola riga vuota e non tocca dati reali', () => {
    expect(trattamentoHaSoloRigaVuota({ prodotto: '', prodotti: [{ prodotto: '', dosaggio: null, quantita: null, costo: null }] })).toBe(true);
    expect(trattamentoHaSoloRigaVuota({ prodotti: [] })).toBe(true);
    expect(trattamentoHaSoloRigaVuota({ prodotti: [{ prodotto: 'Folpan', dosaggio: null }] })).toBe(false);
    expect(trattamentoHaSoloRigaVuota({ prodotti: [{ prodotto: '', dosaggio: 1 }] })).toBe(false);
    expect(trattamentoHaSoloRigaVuota({ prodotti: [{ prodotto: '' }, { prodotto: '' }] })).toBe(false);
  });
});

function impostaScenario(miscela, prodottiAnagrafica = []) {
  store.docs.clear();
  store.nextId = 1;
  mocks.prodotti = prodottiAnagrafica;
  mocks.prodottiFail = false;
  mocks.terreno = { id: 'ter1', coltura: 'Vite', superficie: '2' };
  mocks.lavoro = {
    id: 'lav1',
    nome: 'Passaggio rame',
    tipoLavoro: 'Trattamento antiparassitario',
    terrenoId: 'ter1',
    dataInizio: new Date('2026-05-01T08:00:00Z'),
    operaioId: 'op1',
    miscelaPrevista: miscela
  };
}

describe('createTrattamentoFromLavoro con miscela', () => {
  beforeEach(() => vi.clearAllMocks());

  it('vigneto: scrive righe, acqua e costo dalla miscela', async () => {
    impostaScenario(MISCELA, [{ id: 'p1', prezzoUnitario: 10 }]);
    const id = await vigneto.createTrattamentoFromLavoro('lav1');
    expect(id).toBe('trat-1');
    const doc = store.docs.get('vigneti/v1/trattamenti/trat-1');
    expect(doc.prodotti).toHaveLength(2);
    expect(doc.prodotti[0]).toMatchObject({ prodottoId: 'p1', prodotto: 'Folpan', dosaggio: 2.5, unitaDosaggio: 'kg', quantita: 5, costo: 50, dosePerEttolitroScheda: 0.625 });
    expect(doc.acquaEttolitriPerEttaro).toBe(4);
    expect(doc.acquaEttolitriTotali).toBe(8);
    expect(doc.costoProdotto).toBe(50);
    expect(doc.costoTotale).toBe(50);
  });

  it('vigneto: se il magazzino non risponde il trattamento nasce lo stesso, senza costo', async () => {
    impostaScenario(MISCELA);
    mocks.prodottiFail = true;
    const id = await vigneto.createTrattamentoFromLavoro('lav1');
    const doc = store.docs.get('vigneti/v1/trattamenti/' + id);
    expect(doc.prodotti).toHaveLength(2);
    expect(doc.costoTotale).toBe(0);
  });

  it('vigneto: miscela vuota → una riga vuota, nessun NaN', async () => {
    impostaScenario(null);
    const id = await vigneto.createTrattamentoFromLavoro('lav1');
    const doc = store.docs.get('vigneti/v1/trattamenti/' + id);
    expect(doc.prodotti).toHaveLength(1);
    expect(doc.prodotti[0].prodotto).toBe('');
    expect(doc.prodotti[0].dosaggio).toBeNull();
    expect(Number.isNaN(doc.costoTotale)).toBe(false);
    expect(Number.isNaN(doc.superficieTrattata)).toBe(false);
  });

  it('vigneto: terreno senza superficie → niente NaN e quantità vuota', async () => {
    impostaScenario(MISCELA);
    mocks.terreno = { id: 'ter1', coltura: 'Vite' };
    const id = await vigneto.createTrattamentoFromLavoro('lav1');
    const doc = store.docs.get('vigneti/v1/trattamenti/' + id);
    expect(doc.superficieTrattata).toBeNull();
    expect(doc.prodotti[0].quantita).toBeNull();
    expect(doc.prodotti[0].dosaggio).toBe(2.5);
  });

  it('frutteto: stessa mappatura', async () => {
    impostaScenario(MISCELA);
    mocks.terreno = { id: 'ter1', coltura: 'Melo', superficie: 2 };
    const id = await frutteto.createTrattamentoFromLavoro('lav1');
    const doc = store.docs.get('frutteti/f1/trattamenti/' + id);
    expect(doc.prodotti.map((p) => p.prodotto)).toEqual(['Folpan', 'Karathane']);
    expect(doc.prodotti[1].quantita).toBe(1);
    expect(doc.acquaEttolitriTotali).toBe(8);
  });

  it('frutteto: miscela vuota → riga vuota', async () => {
    impostaScenario({ prodotti: [] });
    mocks.terreno = { id: 'ter1', coltura: 'Melo', superficie: 2 };
    const id = await frutteto.createTrattamentoFromLavoro('lav1');
    const doc = store.docs.get('frutteti/f1/trattamenti/' + id);
    expect(doc.prodotti).toHaveLength(1);
    expect(doc.prodotti[0].prodotto).toBe('');
    expect(Number.isNaN(doc.costoTotale)).toBe(false);
  });
});

describe('syncTrattamentoFromLavoro con miscela', () => {
  beforeEach(() => vi.clearAllMocks());

  it('riempie la sola riga vuota (vigneto)', async () => {
    impostaScenario(null);
    await vigneto.createTrattamentoFromLavoro('lav1');
    mocks.lavoro.miscelaPrevista = MISCELA;
    mocks.prodotti = [{ id: 'p1', prezzoUnitario: 4 }];
    await vigneto.syncTrattamentoFromLavoro('lav1');
    const doc = store.docs.get('vigneti/v1/trattamenti/trat-1');
    expect(doc.prodotti).toHaveLength(2);
    expect(doc.prodotti[0]).toMatchObject({ prodotto: 'Folpan', quantita: 5, costo: 20 });
    expect(doc.costoProdotto).toBe(20);
    expect(doc.acquaEttolitriTotali).toBe(8);
  });

  it('non sovrascrive i dati reali (vigneto)', async () => {
    impostaScenario(null);
    await vigneto.createTrattamentoFromLavoro('lav1');
    const key = 'vigneti/v1/trattamenti/trat-1';
    const reale = [{ prodottoId: 'p9', prodotto: 'Zolfo', dosaggio: 7, unitaDosaggio: 'kg', quantita: 14, costo: 3 }];
    store.docs.set(key, { ...store.docs.get(key), prodotti: reale, acquaEttolitriTotali: 3 });
    mocks.lavoro.miscelaPrevista = MISCELA;
    await vigneto.syncTrattamentoFromLavoro('lav1');
    const doc = store.docs.get(key);
    expect(doc.prodotti).toHaveLength(1);
    expect(doc.prodotti[0]).toMatchObject({ prodotto: 'Zolfo', dosaggio: 7, quantita: 14 });
    expect(doc.acquaEttolitriTotali).toBe(3);
  });

  it('miscela ancora vuota: la riga resta vuota, senza NaN (vigneto)', async () => {
    impostaScenario(null);
    await vigneto.createTrattamentoFromLavoro('lav1');
    await vigneto.syncTrattamentoFromLavoro('lav1');
    const doc = store.docs.get('vigneti/v1/trattamenti/trat-1');
    expect(doc.prodotti).toHaveLength(1);
    expect(doc.prodotti[0].prodotto).toBe('');
    expect(Number.isNaN(doc.costoTotale)).toBe(false);
  });

  it('frutteto: riempie la riga vuota e non sovrascrive dopo', async () => {
    impostaScenario(null);
    mocks.terreno = { id: 'ter1', coltura: 'Melo', superficie: 2 };
    await frutteto.createTrattamentoFromLavoro('lav1');
    mocks.lavoro.miscelaPrevista = MISCELA;
    await frutteto.syncTrattamentoFromLavoro('lav1');
    const key = 'frutteti/f1/trattamenti/trat-1';
    expect(store.docs.get(key).prodotti).toHaveLength(2);

    mocks.lavoro.miscelaPrevista = { prodotti: [{ nome: 'Altro', dosePerEttaro: 9 }] };
    await frutteto.syncTrattamentoFromLavoro('lav1');
    expect(store.docs.get(key).prodotti.map((p) => p.prodotto)).toEqual(['Folpan', 'Karathane']);
  });
});

const FORM_HTML = `
  <form id="lavoro-form">
    <select id="lavoro-tipo-lavoro"><option>Trattamento</option></select>
    <input id="lavoro-acqua-hl-ha"><input id="lavoro-acqua-hl-tot">
    <select id="lavoro-miscela-prodotto">
      <option value="">— Nessun prodotto —</option>
      <option value="p1" data-unita="kg" data-dose-hl="0.5">Folpan</option>
    </select>
    <input id="lavoro-miscela-nome"><input id="lavoro-miscela-dose-ha">
    <button type="button" id="btn-miscela-aggiungi">Aggiungi</button>
    <table><tbody id="tbody-miscela-lavoro"></tbody></table>
    <div id="lavoro-miscela-nota"></div>
  </form>`;

function aggiungiDalForm(id, dose) {
  document.getElementById('lavoro-miscela-prodotto').value = id;
  document.getElementById('lavoro-miscela-dose-ha').value = dose;
  document.getElementById('btn-miscela-aggiungi').click();
}

describe('form miscela sul lavoro', () => {
  beforeEach(() => {
    document.body.innerHTML = FORM_HTML;
    installaMiscelaLavoro();
  });

  it('Aggiungi: la riga passa in tabella e i campi tornano vuoti', () => {
    aggiungiDalForm('p1', '2');
    expect(document.querySelectorAll('#tbody-miscela-lavoro tr[data-extra]')).toHaveLength(1);
    expect(document.getElementById('lavoro-miscela-prodotto').value).toBe('');
    expect(document.getElementById('lavoro-miscela-nome').value).toBe('');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('');
  });

  it('Aggiungi lo stesso prodotto due volte: una riga sola, dose aggiornata', () => {
    aggiungiDalForm('p1', '2');
    aggiungiDalForm('p1', '3');
    const righe = document.querySelectorAll('#tbody-miscela-lavoro tr[data-extra]');
    expect(righe).toHaveLength(1);
    expect(righe[0].querySelector('.miscela-dose-extra').value).toBe('3');
    expect(componiMiscelaDalForm(1, null).prodotti).toHaveLength(1);
  });

  it('Aggiungi lo stesso prodotto libero con maiuscole diverse: una riga sola', () => {
    document.getElementById('lavoro-miscela-nome').value = 'Rame';
    document.getElementById('btn-miscela-aggiungi').click();
    document.getElementById('lavoro-miscela-nome').value = ' rame ';
    document.getElementById('btn-miscela-aggiungi').click();
    expect(document.querySelectorAll('#tbody-miscela-lavoro tr[data-extra]')).toHaveLength(1);
  });

  it('prodotto nel select e uguale in tabella: la miscela lo conta una volta', () => {
    aggiungiDalForm('p1', '2');
    document.getElementById('lavoro-miscela-prodotto').value = 'p1';
    document.getElementById('lavoro-miscela-dose-ha').value = '5';
    const m = componiMiscelaDalForm(1, null);
    expect(m.prodotti).toHaveLength(1);
    expect(m.prodotti[0].dosePerEttaro).toBe(5);
  });
});

describe('avvisi non duplicati', () => {
  const precedenti = [];

  it('avvisiMiscelaLavoro: lo stesso avviso una volta, più la nota finale una volta', () => {
    const miscela = {
      prodotti: [
        { prodottoId: 'p1', nome: 'Folpan' },
        { prodottoId: 'p1', nome: 'Folpan' }
      ]
    };
    const out = avvisiMiscelaLavoro({ miscela, terrenoId: 't', data: new Date('2026-05-01'), precedenti, prodottiAnagrafica: [], specie: 'vite da vino' });
    const nonConfermata = out.filter((m) => m.includes('non è confermata'));
    expect(nonConfermata).toHaveLength(1);
    expect(out.filter((m) => m.includes('trattamento di ieri'))).toHaveLength(1);
  });

  it('avvisiMiscelaLavoro: senza prodotti nessun messaggio', () => {
    expect(avvisiMiscelaLavoro({ miscela: { prodotti: [] }, precedenti })).toEqual([]);
  });

  it('avvisiRegistrazione: righe doppie, un solo avviso', () => {
    const out = avvisiRegistrazione({
      data: new Date('2026-05-01'),
      terrenoId: 't',
      precedenti,
      prodotti: [
        { prodottoId: 'p1', prodotto: 'Folpan' },
        { prodottoId: 'p1', prodotto: 'Folpan' }
      ]
    });
    expect(out.avvisi).toHaveLength(1);
  });
});
