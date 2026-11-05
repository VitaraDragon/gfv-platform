import { describe, it, expect } from 'vitest';
import {
  inferColtureTipoLavoro,
  filtraTipiLavoroPerColtura,
  filtraCategoriePerColtura,
  shouldAutoSwitchTraLeFile
} from '../shared/js/tipi-lavoro-per-coltura.js';
import { applyFiltriTipiPerColtura } from '../core/js/lavoro-cascade-filters.js';

describe('tipi-lavoro-per-coltura', () => {
  const tipi = [
    { id: '1', nome: 'Vendemmia Manuale', colture: ['vigneto'] },
    { id: '2', nome: 'Vendemmia Meccanica' }, // ripiego dal nome
    { id: '3', nome: 'Raccolta Manuale' },
    { id: '4', nome: 'Raccolta con Scuotitore', colture: ['frutteto', 'arboreo'] },
    { id: '5', nome: 'Erpicatura Tra le File', sottocategoriaNome: 'Tra le File' },
    { id: '6', nome: 'Erpicatura' }
  ];

  it('inferisce vigneto da Vendemmia senza campo colture', () => {
    expect(inferColtureTipoLavoro({ nome: 'Vendemmia Meccanica' })).toEqual(['vigneto']);
  });

  it('Vite → Vendemmia sì; Seminativo → Vendemmia no', () => {
    const vite = filtraTipiLavoroPerColtura(tipi, 'vigneto').map((t) => t.nome);
    expect(vite).toContain('Vendemmia Manuale');
    expect(vite).toContain('Vendemmia Meccanica');
    expect(vite).not.toContain('Raccolta con Scuotitore');

    const semi = filtraTipiLavoroPerColtura(tipi, 'seminativo').map((t) => t.nome);
    expect(semi).not.toContain('Vendemmia Manuale');
    expect(semi).not.toContain('Vendemmia Meccanica');
    expect(semi).not.toContain('Erpicatura Tra le File');
    expect(semi).toContain('Raccolta Manuale');
    expect(semi).toContain('Erpicatura');
  });

  it('Melo → niente Vendemmia, sì raccolta frutta', () => {
    const melo = filtraTipiLavoroPerColtura(tipi, { coltura: 'Melo', colturaCategoria: 'frutteto' }).map((t) => t.nome);
    expect(melo).not.toContain('Vendemmia Manuale');
    expect(melo).toContain('Raccolta con Scuotitore');
  });

  it('Modifica: tipo storico escluso dal filtro resta selezionabile', () => {
    const lista = filtraTipiLavoroPerColtura(tipi, 'seminativo', { keepNome: 'Vendemmia Manuale' });
    expect(lista.some((t) => t.nome === 'Vendemmia Manuale')).toBe(true);
  });

  it('categorie senza tipi validi → nascoste', () => {
    const categorie = [
      { id: 'c1', nome: 'Raccolta' },
      { id: 'c2', nome: 'Lavorazione' }
    ];
    const tipiCat = [
      { id: '1', nome: 'Vendemmia Manuale', colture: ['vigneto'], categoriaId: 'c1' },
      { id: '6', nome: 'Erpicatura', categoriaId: 'c2' }
    ];
    const out = filtraCategoriePerColtura(categorie, tipiCat, 'seminativo');
    expect(out.find((x) => x.categoria.id === 'c1').nascosta).toBe(true);
    expect(out.find((x) => x.categoria.id === 'c2').nascosta).toBe(false);
  });

  it('auto Tra le File solo su Lavorazione del Terreno + Generale', () => {
    expect(shouldAutoSwitchTraLeFile({
      categoriaPrincipaleNome: 'Lavorazione del Terreno',
      sottocategoriaNome: 'Generale'
    })).toBe(true);
    expect(shouldAutoSwitchTraLeFile({
      categoriaPrincipaleNome: 'Raccolta',
      sottocategoriaNome: 'Manuale'
    })).toBe(false);
  });

  it('applyFiltriTipiPerColtura: Vite+Raccolta con lista vuota → ripiego Vendemmia', () => {
    const out = applyFiltriTipiPerColtura([], {
      isRaccolta: true,
      terreno: { coltura: 'Vite' }
    });
    expect(out.map((t) => t.nome).sort()).toEqual(['Vendemmia Manuale', 'Vendemmia Meccanica']);
  });

  it('applyFiltriTipiPerColtura: Seminativo+Raccolta senza Vendemmia', () => {
    const out = applyFiltriTipiPerColtura(tipi, {
      isRaccolta: true,
      terreno: { coltura: 'Grano', colturaCategoria: 'seminativo' }
    });
    expect(out.some((t) => /vendemmia/i.test(t.nome))).toBe(false);
  });
});
