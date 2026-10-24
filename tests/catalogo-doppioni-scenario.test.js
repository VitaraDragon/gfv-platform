/**
 * Scenario reale in due passi (pagina Terreni, tenant con seed doppio):
 * 1) si caricano le categorie (le colture non ci sono ancora);
 * 2) arrivano le colture, con categoriaId sulla copia NON canonica.
 * Vite/Frutteto devono avere colture, Seminativo senza doppioni, la Modifica preseleziona.
 * Vitest puro: select finti, servizi mockati, niente emulatori.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  setFirebaseInstances: vi.fn(),
  timestampToDate: (v) => (v instanceof Date ? v : new Date(v)),
  dateToTimestamp: (v) => v,
}));
vi.mock('../core/services/tenant-service.js', () => ({
  setCurrentTenantId: vi.fn(),
  getCurrentTenantId: vi.fn(() => 'cascina-conti'),
}));
vi.mock('../core/services/categorie-service.js', () => ({
  getAllCategorie: vi.fn(),
  initializeCategoriePredefinite: vi.fn(async () => {}),
}));
vi.mock('../core/services/colture-service.js', () => ({
  initializeColturePredefinite: vi.fn(async () => {}),
  getAllColture: vi.fn(),
  getColturePerCategoria: vi.fn(),
}));

import { getAllCategorie } from '../core/services/categorie-service.js';
import { getAllColture, getColturePerCategoria } from '../core/services/colture-service.js';
import {
  loadCategorieColtureTerreni,
  loadColturePerCategoriaTerreni,
  loadColture,
} from '../core/js/terreni-controller.js';
import { updateColtureDropdownTerreni } from '../core/js/terreni-events.js';
import { raggruppaCategorie, trovaCategoriaPerColtura } from '../core/js/catalogo-dedupe.js';

/** Select minimale: come il DOM, un value non presente tra le option diventa ''. */
class FakeSelect {
  constructor() { this.options = []; this._value = ''; }
  set innerHTML(html) {
    this.options = [];
    this._value = '';
    const m = /<option value="([^"]*)">([^<]*)<\/option>/.exec(String(html || ''));
    if (m) this.options.push({ value: m[1], textContent: m[2] });
  }
  get innerHTML() { return ''; }
  appendChild(opt) { this.options.push(opt); }
  get value() { return this._value; }
  set value(v) { this._value = this.options.some((o) => o.value === String(v)) ? String(v) : ''; }
  valori() { return this.options.filter((o) => o.value).map((o) => o.value); }
}

const T0 = Date.parse('2026-10-23T10:00:00Z');
const categorieDoppie = [
  // Vite: canonica = v-old (createdAt più vecchio); colture tutte su v-new
  { id: 'v-new', codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, ordine: 3, createdAt: new Date(T0 + 5000) },
  { id: 'v-old', codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, ordine: 3, createdAt: new Date(T0) },
  // Frutteto: niente createdAt, canonica per id byte ('B…' < 'a…'); colture su 'aF'
  { id: 'aF', codice: 'frutteto', nome: 'Frutteto', applicabileA: 'colture', predefinita: true, ordine: 1 },
  { id: 'BF', codice: 'frutteto', nome: 'Frutteto', applicabileA: 'colture', predefinita: true, ordine: 1 },
  // Seminativo: colture doppie sulla stessa copia
  { id: 's1', codice: 'seminativo', nome: 'Seminativo', applicabileA: 'colture', predefinita: true, ordine: 2, createdAt: new Date(T0) },
  { id: 's2', codice: 'seminativo', nome: 'Seminativo', applicabileA: 'colture', predefinita: true, ordine: 2, createdAt: new Date(T0 + 1) },
];
const colturePerCategoriaDb = {
  'v-new': [{ id: 'c1', nome: 'Vite' }, { id: 'c2', nome: 'Vite da Vino' }, { id: 'c3', nome: 'Vite' }],
  aF: [{ id: 'c4', nome: 'Melo' }, { id: 'c5', nome: 'Pesco' }],
  s1: [{ id: 'c6', nome: 'Grano' }, { id: 'c7', nome: 'Grano' }, { id: 'c8', nome: 'Mais' }],
};

let selects;
beforeEach(() => {
  vi.clearAllMocks();
  selects = { 'terreno-coltura-categoria': new FakeSelect(), 'terreno-coltura': new FakeSelect() };
  globalThis.window = { location: { protocol: 'https:' } };
  globalThis.document = {
    getElementById: (id) => selects[id] || null,
    createElement: () => ({ value: '', textContent: '' }),
  };
  getAllCategorie.mockResolvedValue(categorieDoppie.map((c) => ({ ...c })));
  getAllColture.mockResolvedValue(new Array(25).fill({ nome: 'x' }));
  getColturePerCategoria.mockResolvedValue(JSON.parse(JSON.stringify(colturePerCategoriaDb)));
});
afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
});

describe('Terreni: dedup in due passi senza perdere le colture', () => {
  it('passo 1 (solo categorie): select con le sole canoniche, stato con tutte le copie', async () => {
    const stato = [];
    await loadCategorieColtureTerreni('cascina-conti', {}, {}, {}, stato);
    expect(selects['terreno-coltura-categoria'].valori()).toEqual(['BF', 's1', 'v-old']);
    expect(stato).toHaveLength(6);
  });

  it('passo 2 (colture su copia non canonica): Vite e Frutteto hanno colture, Seminativo senza doppioni', async () => {
    const stato = [];
    const perCategoria = {};
    const colture = [];
    await loadCategorieColtureTerreni('cascina-conti', {}, {}, {}, stato);
    await loadColturePerCategoriaTerreni('cascina-conti', {}, {}, {}, perCategoria, colture, stato);

    expect(perCategoria['v-old'].map((c) => c.nome)).toEqual(['Vite', 'Vite da Vino']);
    expect(perCategoria.BF.map((c) => c.nome)).toEqual(['Melo', 'Pesco']);
    expect(perCategoria.s1.map((c) => c.nome)).toEqual(['Grano', 'Mais']);
    expect(perCategoria['v-new']).toBeUndefined();
    expect(perCategoria.aF).toBeUndefined();

    const state = { colturePerCategoriaTerreni: perCategoria, categorieColtureTerreni: stato };
    for (const [catId, attese] of [['v-old', ['Vite', 'Vite da Vino']], ['BF', ['Melo', 'Pesco']], ['s1', ['Grano', 'Mais']]]) {
      selects['terreno-coltura-categoria'].value = catId;
      updateColtureDropdownTerreni(state, () => {}, null);
      expect(selects['terreno-coltura'].valori()).toEqual(attese);
    }
  });

  it('loadColture completo + Modifica «Vigna Nord» (coltura Vite) preseleziona la categoria', async () => {
    const state = { categorieColtureTerreni: [], colturePerCategoriaTerreni: {}, colture: [] };
    await loadColture('cascina-conti', {}, {}, {}, state.categorieColtureTerreni, state.colturePerCategoriaTerreni, state.colture);
    expect(selects['terreno-coltura-categoria'].valori()).toEqual(['BF', 's1', 'v-old']);

    // stessa logica di openTerrenoModal (terreni-events.js)
    const { aliasToCanon } = raggruppaCategorie(state.categorieColtureTerreni);
    const catId = trovaCategoriaPerColtura('Vite', state.colturePerCategoriaTerreni, aliasToCanon);
    expect(catId).toBe('v-old');
    selects['terreno-coltura-categoria'].value = catId;
    expect(selects['terreno-coltura-categoria'].value).toBe('v-old');
    updateColtureDropdownTerreni(state, () => {}, null);
    selects['terreno-coltura'].value = 'Vite';
    expect(selects['terreno-coltura'].value).toBe('Vite');
  });

  it('anche se il canonico scelto non ha colture proprie, un alias le porta (id «vecchio» salvato altrove)', () => {
    const { aliasToCanon } = raggruppaCategorie(categorieDoppie);
    expect(trovaCategoriaPerColtura('Vite', colturePerCategoriaDb, aliasToCanon)).toBe('v-old');
    expect(trovaCategoriaPerColtura('Pesco', colturePerCategoriaDb, aliasToCanon)).toBe('BF');
  });
});
