import { describe, expect, it } from 'vitest';
import {
  coltureDisponibiliPerCategoria,
  extractColtureUnicheFromTerreni,
  filterTipiLavoroByCategoria,
  filterTipiLavoroVendemmia,
  getSottocategorieForParent,
  isCategoriaRaccolta,
  resolvePreserveCascadeSelection,
  resolveCascadeFilterCategoriaId,
  terrenoHaColturaVite,
} from '../core/js/lavoro-cascade-filters.js';

const CATEGORIE = [
  { id: 'cat-lav-terreno', nome: 'Lavorazione del Terreno' },
  { id: 'cat-raccolta', nome: 'Raccolta' },
];

const SOTTOCAT_MAP = new Map([
  [
    'cat-lav-terreno',
    [
      { id: 'sub-generale', nome: 'Generale', parentId: 'cat-lav-terreno' },
      { id: 'sub-file', nome: 'Tra le File', parentId: 'cat-lav-terreno' },
    ],
  ],
  [
    'cat-raccolta',
    [
      { id: 'sub-raccolta-man', nome: 'Raccolta Manuale', parentId: 'cat-raccolta', codice: 'raccolta_manuale' },
      { id: 'sub-raccolta-mec', nome: 'Raccolta Meccanica', parentId: 'cat-raccolta', codice: 'raccolta_meccanica' },
    ],
  ],
]);

const TIPI_LAVORO = [
  { id: 't-erp', nome: 'Erpicatura', categoriaId: 'sub-generale', sottocategoriaId: 'sub-generale' },
  { id: 't-pot', nome: 'Potatura', categoriaId: 'sub-file', sottocategoriaId: 'sub-file' },
  { id: 't-v-man', nome: 'Vendemmia Manuale', categoriaId: 'sub-raccolta-man', sottocategoriaId: 'sub-raccolta-man' },
  { id: 't-v-mec', nome: 'Vendemmia Meccanica', categoriaId: 'sub-raccolta-mec', sottocategoriaId: 'sub-raccolta-mec' },
  { id: 't-olive', nome: 'Raccolta olive', categoriaId: 'cat-raccolta' },
];

describe('cascade lavori — categoria → sottocategoria → tipo', () => {
  it('categoria principale → sottocategorie figlie', () => {
    const subs = getSottocategorieForParent('cat-lav-terreno', SOTTOCAT_MAP);
    expect(subs.map((s) => s.nome)).toEqual(['Generale', 'Tra le File']);
  });

  it('sottocategoria Generale → solo tipi di quella sottocategoria', () => {
    const tipi = filterTipiLavoroByCategoria(
      'sub-generale',
      TIPI_LAVORO,
      CATEGORIE,
      SOTTOCAT_MAP
    );
    expect(tipi.map((t) => t.nome)).toEqual(['Erpicatura']);
  });

  it('categoria principale Lavorazione del Terreno → tipi di tutte le sottocategorie', () => {
    const tipi = filterTipiLavoroByCategoria(
      'cat-lav-terreno',
      TIPI_LAVORO,
      CATEGORIE,
      SOTTOCAT_MAP
    );
    expect(tipi.map((t) => t.nome).sort()).toEqual(['Erpicatura', 'Potatura']);
  });
});

describe('cascade colture — terreni e categoria coltura', () => {
  const terreni = [
    { id: 't1', nome: 'Vigneto Nord', coltura: 'Vite da Vino' },
    { id: 't2', nome: 'Grano Sud', coltura: 'Grano tenero' },
    { id: 't3', nome: 'Vigneto Est', coltura: 'Vite da Tavola' },
    { id: 't4', nome: 'Orto', coltura: 'Grano tenero' },
  ];

  it('terreni → colture uniche ordinate', () => {
    expect(extractColtureUnicheFromTerreni(terreni)).toEqual([
      'Grano tenero',
      'Vite da Tavola',
      'Vite da Vino',
    ]);
  });

  it('categoria coltura → elenco colture filtrato', () => {
    const colturePerCategoria = {
      'cat-seminativo': [{ nome: 'Grano tenero' }, { nome: 'Mais' }],
      'cat-vite': [{ nome: 'Vite da Vino' }, { nome: 'Vite da Tavola' }],
    };
    expect(coltureDisponibiliPerCategoria('cat-vite', colturePerCategoria)).toEqual([
      'Vite da Tavola',
      'Vite da Vino',
    ]);
    expect(coltureDisponibiliPerCategoria('cat-seminativo', colturePerCategoria)).toEqual([
      'Grano tenero',
      'Mais',
    ]);
  });
});

describe('cascade raccolta + vite → vendemmia', () => {
  it('terreno vite + categoria raccolta → solo tipi vendemmia', () => {
    const terrenoVite = { id: 'tv', coltura: 'Vite da Vino' };
    expect(terrenoHaColturaVite(terrenoVite)).toBe(true);
    expect(isCategoriaRaccolta('cat-raccolta', CATEGORIE, SOTTOCAT_MAP)).toBe(true);

    const tipiRaccolta = filterTipiLavoroByCategoria(
      'cat-raccolta',
      TIPI_LAVORO,
      CATEGORIE,
      SOTTOCAT_MAP
    );
    const tipiFinali = filterTipiLavoroVendemmia(tipiRaccolta, {
      isRaccolta: true,
      isTerrenoVite: terrenoHaColturaVite(terrenoVite),
    });

    expect(tipiFinali.map((t) => t.nome).sort()).toEqual([
      'Vendemmia Manuale',
      'Vendemmia Meccanica',
    ]);
    expect(tipiFinali.some((t) => t.nome === 'Raccolta olive')).toBe(false);
  });

  it('terreno non vite → nessun filtro vendemmia', () => {
    const tipiRaccolta = filterTipiLavoroByCategoria(
      'cat-raccolta',
      TIPI_LAVORO,
      CATEGORIE,
      SOTTOCAT_MAP
    );
    const tipiFinali = filterTipiLavoroVendemmia(tipiRaccolta, {
      isRaccolta: true,
      isTerrenoVite: false,
    });
    expect(tipiFinali.length).toBe(tipiRaccolta.length);
    expect(tipiFinali.some((t) => t.nome === 'Raccolta olive')).toBe(true);
  });

  it('resolvePreserveCascadeSelection — mantiene figlio valido, scarta figlio di altro padre', () => {
    const subs = SOTTOCAT_MAP.get('cat-lav-terreno') || [];
    expect(resolvePreserveCascadeSelection('sub-file', subs)).toBe('sub-file');
    expect(resolvePreserveCascadeSelection('sub-raccolta-man', subs)).toBeNull();
    expect(resolvePreserveCascadeSelection(null, subs)).toBeNull();
  });

  it('resolveCascadeFilterCategoriaId — preferisce sottocategoria', () => {
    expect(resolveCascadeFilterCategoriaId('sub-file', 'cat-lav-terreno')).toBe('sub-file');
    expect(resolveCascadeFilterCategoriaId('', 'cat-lav-terreno')).toBe('cat-lav-terreno');
  });
});
