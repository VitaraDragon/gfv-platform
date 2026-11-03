/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decidiAllineamentoRegistriDopoModifica,
  motivoNessunAllineamentoRegistri
} from '../core/services/lavoro-registri-allineamento.js';

describe('decidiAllineamentoRegistriDopoModifica', () => {
  const lavoroVite = { id: 'L1', terrenoId: 'T-vite', tipoLavoro: 'Potatura' };
  const terrenoVite = { id: 'T-vite', coltura: 'Vite' };
  const terrenoMelo = { id: 'T-vite', coltura: 'Melo' };

  it('stesso terreno passato da Vite a Melo → nessuna (non cancella)', () => {
    const azione = decidiAllineamentoRegistriDopoModifica({
      lavoroOriginale: lavoroVite,
      lavoroData: { ...lavoroVite, tipoLavoro: 'Potatura' },
      terrenoOriginale: terrenoVite,
      terrenoNuovo: terrenoMelo,
      registro: 'potatura'
    });
    expect(azione).toBe('nessuna');
    expect(azione).not.toBe('cancella');
  });

  it('terreno eliminato (null) → nessuna', () => {
    const azione = decidiAllineamentoRegistriDopoModifica({
      lavoroOriginale: lavoroVite,
      lavoroData: { ...lavoroVite },
      terrenoOriginale: terrenoVite,
      terrenoNuovo: null,
      registro: 'trattamento'
    });
    expect(azione).toBe('nessuna');
  });

  it('cambio vero di terrenoId → scollega', () => {
    const azione = decidiAllineamentoRegistriDopoModifica({
      lavoroOriginale: lavoroVite,
      lavoroData: { ...lavoroVite, terrenoId: 'T-altro' },
      terrenoOriginale: terrenoVite,
      terrenoNuovo: { id: 'T-altro', coltura: 'Vite' },
      registro: 'potatura'
    });
    expect(azione).toBe('scollega');
  });

  it('terreno ancora Vite e stesso terreno → sync', () => {
    const azione = decidiAllineamentoRegistriDopoModifica({
      lavoroOriginale: lavoroVite,
      lavoroData: { ...lavoroVite, note: 'aggiornato' },
      terrenoOriginale: terrenoVite,
      terrenoNuovo: terrenoVite,
      registro: 'trattamento'
    });
    expect(azione).toBe('sync');
  });

  it('vendemmia: tipo non più vendemmia → scollega (mai cancella)', () => {
    const azione = decidiAllineamentoRegistriDopoModifica({
      lavoroOriginale: { ...lavoroVite, tipoLavoro: 'Vendemmia' },
      lavoroData: { ...lavoroVite, tipoLavoro: 'Potatura' },
      terrenoOriginale: terrenoVite,
      terrenoNuovo: terrenoVite,
      registro: 'vendemmia'
    });
    expect(azione).toBe('scollega');
  });

  it('vendemmia: stesso terreno non più vite → nessuna', () => {
    const azione = decidiAllineamentoRegistriDopoModifica({
      lavoroOriginale: { ...lavoroVite, tipoLavoro: 'Vendemmia' },
      lavoroData: { ...lavoroVite, tipoLavoro: 'Vendemmia' },
      terrenoOriginale: terrenoVite,
      terrenoNuovo: terrenoMelo,
      registro: 'vendemmia'
    });
    expect(azione).toBe('nessuna');
  });

  it('motivo console quando nessuna', () => {
    const msg = motivoNessunAllineamentoRegistri({
      lavoroOriginale: lavoroVite,
      lavoroData: lavoroVite,
      terrenoNuovo: terrenoMelo
    });
    expect(msg).toMatch(/coltura|invariato/i);
  });
});

describe('gestione-lavori-events allineamento: niente delete registri', () => {
  it('nel blocco allineamento non compaiono deletePotatura( né deleteTrattamento(', () => {
    const src = readFileSync(
      resolve('core/admin/js/gestione-lavori-events.js'),
      'utf8'
    );
    const start = src.indexOf('Allineamento registri vigneto collegati');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("allineamento vendemmia/potatura", start);
    const blocco = src.slice(start, end > start ? end : start + 4000);
    expect(blocco).not.toMatch(/deletePotatura\s*\(/);
    expect(blocco).not.toMatch(/deleteTrattamento\s*\(/);
    expect(blocco).not.toMatch(/deleteVendemmia\s*\(/);
  });
});
