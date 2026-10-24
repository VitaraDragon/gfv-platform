/**
 * Helper catalogo-dedupe: raggruppamento copie omonime, canonico deterministico,
 * unione colture, alias, tipi lavoro e cascade lavoro senza doppioni. Vitest puro.
 */
import { describe, it, expect } from 'vitest';
import {
  chiaveCatalogo,
  confrontaCanonico,
  raggruppaCategorie,
  canonicoDi,
  aliasMapDaCanoniche,
  dedupePerNome,
  unisciColturePerCategoria,
  dedupeTipiLavoro,
  mappeCodiceCanonico,
  trovaCategoriaPerColtura,
} from '../core/js/catalogo-dedupe.js';
import {
  buildLavoroCategorieIndex,
  filterTipiLavoroByCategoria,
  getSottocategorieForParent,
  resolveLavoroCascadeParents,
} from '../core/js/lavoro-cascade-filters.js';

describe('chiaveCatalogo', () => {
  it('usa il codice normalizzato', () => {
    expect(chiaveCatalogo({ codice: ' Vite ', nome: 'Altro' })).toBe('c:vite');
  });
  it('senza codice usa nome normalizzato (+ ambito se presente)', () => {
    expect(chiaveCatalogo({ nome: '  Frutteto   Misto ' })).toBe('n:frutteto misto');
    expect(chiaveCatalogo({ nome: 'Potatura', applicabileA: 'lavori' })).toBe('n:potatura@lavori');
  });
  it('ultima risorsa: id', () => {
    expect(chiaveCatalogo({ id: 'x' })).toBe('i:x');
    expect(chiaveCatalogo(null)).toBe('');
  });
});

describe('confrontaCanonico (deterministico)', () => {
  it('predefinita batte non predefinita', () => {
    expect(confrontaCanonico({ id: 'z', predefinita: true }, { id: 'a' })).toBeLessThan(0);
  });
  it('a parità vince createdAt più vecchio (Date, Timestamp, seconds)', () => {
    const vecchio = { id: 'z', createdAt: new Date('2026-10-01') };
    const nuovo = { id: 'a', createdAt: { toMillis: () => Date.parse('2026-10-02') } };
    expect(confrontaCanonico(vecchio, nuovo)).toBeLessThan(0);
    expect(confrontaCanonico({ id: 'b', createdAt: { seconds: 10 } }, { id: 'a', createdAt: { seconds: 20 } })).toBeLessThan(0);
  });
  it('chi ha createdAt batte chi non lo ha', () => {
    expect(confrontaCanonico({ id: 'z', createdAt: new Date(1) }, { id: 'a' })).toBeLessThan(0);
  });
  it('ultimo criterio: id in ordine byte, non localeCompare', () => {
    // 'B' (0x42) < 'a' (0x61) in byte; localeCompare direbbe il contrario
    expect('aZ1'.localeCompare('B9x')).toBeLessThan(0);
    expect(confrontaCanonico({ id: 'B9x' }, { id: 'aZ1' })).toBeLessThan(0);
  });
});

describe('raggruppaCategorie', () => {
  const cats = [
    { id: 'v2', codice: 'vite', nome: 'Vite', predefinita: true, createdAt: new Date('2026-10-23T10:00:05Z') },
    { id: 'v1', codice: 'vite', nome: 'Vite', predefinita: true, createdAt: new Date('2026-10-23T10:00:00Z') },
    { id: 'f1', codice: 'frutteto', nome: 'Frutteto', predefinita: true },
    { id: 'f2', codice: 'FRUTTETO', nome: 'Frutteto', predefinita: true },
  ];

  it('una canonica per codice, ordine della prima occorrenza, aliasIds e mappa alias', () => {
    const { canoniche, aliasToCanon } = raggruppaCategorie(cats);
    expect(canoniche.map((c) => c.id)).toEqual(['v1', 'f1']);
    expect(canoniche[0].aliasIds).toEqual(['v2', 'v1']);
    expect(aliasToCanon.get('v2')).toBe('v1');
    expect(aliasToCanon.get('f2')).toBe('f1');
    expect(canonicoDi('v2', aliasToCanon)).toBe('v1');
    expect(canonicoDi('sconosciuto', aliasToCanon)).toBe('sconosciuto');
  });

  it('stesso risultato con input in ordine diverso', () => {
    const a = raggruppaCategorie(cats).canoniche.map((c) => c.id).sort();
    const b = raggruppaCategorie(cats.slice().reverse()).canoniche.map((c) => c.id).sort();
    expect(a).toEqual(b);
  });

  it('non modifica gli oggetti in ingresso e conserva il prototipo', () => {
    class Cat { constructor(d) { Object.assign(this, d); } etichetta() { return this.nome; } }
    const input = [new Cat({ id: 'a', codice: 'x', nome: 'X' }), new Cat({ id: 'b', codice: 'x', nome: 'X' })];
    const { canoniche } = raggruppaCategorie(input);
    expect(input[0].aliasIds).toBeUndefined();
    expect(canoniche[0].etichetta()).toBe('X');
  });

  it('sottocategorie: chiave codice padre + codice, parentId riscritto sul padre canonico', () => {
    const { canoniche, aliasToCanon } = raggruppaCategorie([
      { id: 'p1', codice: 'potatura', predefinita: true, createdAt: new Date(1) },
      { id: 'p2', codice: 'potatura', predefinita: true, createdAt: new Date(2) },
      { id: 's1', codice: 'potatura_manuale', parentId: 'p1', predefinita: true, createdAt: new Date(3) },
      { id: 's2', codice: 'potatura_manuale', parentId: 'p2', predefinita: true, createdAt: new Date(4) },
      { id: 'r1', codice: 'manuale', parentId: 'p1' },
      { id: 'q1', codice: 'raccolta' },
      { id: 'r2', codice: 'manuale', parentId: 'q1' },
    ]);
    expect(canoniche.map((c) => c.id)).toEqual(['p1', 's1', 'r1', 'q1', 'r2']);
    expect(aliasToCanon.get('s2')).toBe('s1');
    const r2 = canoniche.find((c) => c.id === 'r2');
    expect(r2.parentId).toBe('q1');
    const s1 = raggruppaCategorie([
      { id: 'p1', codice: 'potatura', createdAt: new Date(2) },
      { id: 'p2', codice: 'potatura', createdAt: new Date(1) },
      { id: 's1', codice: 'potatura_manuale', parentId: 'p1' },
    ]).canoniche.find((c) => c.id === 's1');
    expect(s1.parentId).toBe('p2');
  });

  it('aliasMapDaCanoniche ricostruisce la mappa dagli aliasIds', () => {
    const { canoniche } = raggruppaCategorie(cats);
    const map = aliasMapDaCanoniche(canoniche);
    expect(map.get('v2')).toBe('v1');
    expect(map.get('v1')).toBe('v1');
  });

  it('mappeCodiceCanonico separa principali e sottocategorie', () => {
    const { principali, sottocategorie } = mappeCodiceCanonico([
      ...cats,
      { id: 'sub', codice: 'vendemmia', parentId: 'v2' },
    ]);
    expect(principali.get('vite')).toBe('v1');
    expect(principali.get('frutteto')).toBe('f1');
    expect(sottocategorie.get('vendemmia')).toBe('sub');
  });
});

describe('colture: unione sotto il canonico', () => {
  it('unisce le colture di tutte le copie e toglie i doppioni per nome', () => {
    const { aliasToCanon } = raggruppaCategorie([
      { id: 'v1', codice: 'vite', createdAt: new Date(1) },
      { id: 'v2', codice: 'vite', createdAt: new Date(2) },
    ]);
    const out = unisciColturePerCategoria(
      {
        v2: [{ id: 'c1', nome: 'Vite' }, { id: 'c2', nome: 'Vite da Vino' }],
        v1: [{ id: 'c3', nome: 'vite ' }],
        senza_categoria: [{ id: 'x', nome: 'Boh' }],
      },
      aliasToCanon
    );
    expect(Object.keys(out).sort()).toEqual(['senza_categoria', 'v1']);
    expect(out.v1.map((c) => c.nome)).toEqual(['Vite', 'Vite da Vino']);
  });

  it('dedupePerNome su stringhe e oggetti', () => {
    expect(dedupePerNome(['Grano', 'grano', 'Mais'])).toEqual(['Grano', 'Mais']);
    expect(dedupePerNome([{ id: 'b', nome: 'Mais' }, { id: 'a', nome: 'Mais' }]).map((c) => c.id)).toEqual(['a']);
  });

  it('trovaCategoriaPerColtura risale al canonico', () => {
    const alias = new Map([['v2', 'v1'], ['v1', 'v1']]);
    expect(trovaCategoriaPerColtura('Vite', { v2: [{ nome: 'Vite' }] }, alias)).toBe('v1');
    expect(trovaCategoriaPerColtura('Nessuna', { v2: [{ nome: 'Vite' }] }, alias)).toBeNull();
    expect(trovaCategoriaPerColtura('Boh', { senza_categoria: [{ nome: 'Boh' }] }, alias)).toBeNull();
  });
});

describe('tipi lavoro e cascade senza doppioni', () => {
  const categorie = [
    { id: 'P1', codice: 'potatura', nome: 'Potatura', applicabileA: 'entrambi', predefinita: true, ordine: 4, createdAt: new Date(1) },
    { id: 'P2', codice: 'potatura', nome: 'Potatura', applicabileA: 'entrambi', predefinita: true, ordine: 4, createdAt: new Date(2) },
    { id: 'S1', codice: 'potatura_manuale', nome: 'Manuale', parentId: 'P1', applicabileA: 'lavori', predefinita: true, createdAt: new Date(3) },
    { id: 'S2', codice: 'potatura_manuale', nome: 'Manuale', parentId: 'P2', applicabileA: 'lavori', predefinita: true, createdAt: new Date(4) },
  ];
  const tipi = [
    { id: 't1', nome: 'Potatura di produzione', categoriaId: 'P1', sottocategoriaId: 'S1', predefinito: true },
    { id: 't2', nome: 'Potatura di produzione', categoriaId: 'P2', sottocategoriaId: 'S2', predefinito: true },
    { id: 't3', nome: 'Potatura verde', categoriaId: 'P2', sottocategoriaId: null, predefinito: true },
  ];

  it('buildLavoroCategorieIndex: principali uniche, sottocategorie unite sotto il padre canonico', () => {
    const { principali, map } = buildLavoroCategorieIndex(categorie);
    expect(principali.map((c) => c.id)).toEqual(['P1']);
    expect(getSottocategorieForParent('P1', map).map((s) => s.id)).toEqual(['S1']);
    expect(map.has('P2')).toBe(false);
  });

  it('filterTipiLavoroByCategoria: un solo tipo per nome, anche se appeso alla copia', () => {
    const { principali, map } = buildLavoroCategorieIndex(categorie);
    const perPrincipale = filterTipiLavoroByCategoria('P1', tipi, principali, map);
    expect(perPrincipale.map((t) => t.nome).sort()).toEqual(['Potatura di produzione', 'Potatura verde']);
    const perSotto = filterTipiLavoroByCategoria('S1', tipi, principali, map);
    expect(perSotto.map((t) => t.nome)).toEqual(['Potatura di produzione', 'Potatura verde']);
    expect(perSotto.filter((t) => t.nome === 'Potatura di produzione')).toHaveLength(1);
  });

  it('resolveLavoroCascadeParents: id salvato sulla copia → select sul canonico', () => {
    const { principali, map } = buildLavoroCategorieIndex(categorie);
    expect(resolveLavoroCascadeParents('S2', null, principali, map)).toEqual({ categoriaPrincipaleId: 'P1', sottocategoriaId: 'S1' });
    expect(resolveLavoroCascadeParents('P2', 'S2', principali, map)).toEqual({ categoriaPrincipaleId: 'P1', sottocategoriaId: 'S1' });
  });

  it('dedupeTipiLavoro riscrive gli id sul canonico', () => {
    const alias = new Map([['P2', 'P1'], ['S2', 'S1']]);
    const out = dedupeTipiLavoro(tipi, alias);
    expect(out).toHaveLength(2);
    expect(out.find((t) => t.nome === 'Potatura verde').categoriaId).toBe('P1');
  });
});
