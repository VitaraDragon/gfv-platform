/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { dettaglioSpeseCampagna, intervalloCampagna } from '../modules/seminativo/models/SeminativoSpese.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Seminativo — spese campagna', () => {
  it('il periodo agricolo va da settembre ad agosto', () => {
    expect(intervalloCampagna('2025/2026')).toEqual({
      inizio: '2025-09-01',
      fine: '2026-08-31'
    });
    expect(intervalloCampagna('2026/2028')).toBeNull();
  });

  it('somma lavori completati e diario, senza doppioni né fuori campagna', () => {
    const dettaglio = dettaglioSpeseCampagna({
      terrenoId: 't-grano',
      campagna: '2025/2026',
      lavori: [
        { id: 'l1', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2025-12-19', costoManodopera: 40, costoMacchine: 10 },
        { id: 'l2', terrenoId: 't-grano', stato: 'in_corso', tipoLavoro: 'Aratura', dataInizio: '2026-01-03', costoManodopera: 80, costoMacchine: 0 },
        { id: 'l3', terrenoId: 't-vite', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2025-12-19', costoManodopera: 99, costoMacchine: 0 }
      ],
      attivita: [
        { id: 'a1', terrenoId: 't-grano', tipoLavoro: 'Erpicatura', data: '2025-12-19', costoManodopera: 15, costoMacchine: 0 },
        { id: 'a2', terrenoId: 't-grano', tipoLavoro: 'Ripuntatura', data: '2026-03-04', oreNette: 2, costoManodopera: 30, costoMacchine: 5 },
        { id: 'a3', terrenoId: 't-grano', tipoLavoro: 'Aratura', data: '2026-10-02', costoManodopera: 50, costoMacchine: 0 }
      ]
    });
    expect(dettaglio.lavori.map((row) => row.id)).toEqual(['l1']);
    expect(dettaglio.attivita.map((row) => row.id)).toEqual(['a2']);
    expect(dettaglio.costoManodopera).toBe(70);
    expect(dettaglio.costoMacchine).toBe(15);
    expect(dettaglio.costoTotale).toBe(85);
  });

  it('il totale include il costo prodotti e non raddoppia manodopera e macchine del trattamento', () => {
    const dettaglio = dettaglioSpeseCampagna({
      terrenoId: 't-grano',
      campagna: '2026/2027',
      campagnaId: 'c1',
      lavori: [],
      attivita: [
        { id: 'a1', terrenoId: 't-grano', tipoLavoro: 'Trattamento Meccanico', data: '2026-09-15', costoManodopera: 60, costoMacchine: 48 }
      ],
      prodotti: [
        {
          id: 'tr1',
          campagnaId: 'c1',
          data: '2026-09-15',
          tipoLavoro: 'Trattamento Meccanico',
          costoProdotto: 153.6,
          costoManodopera: 60,
          costoMacchina: 48,
          prodotti: [{ prodotto: 'Rame ossicloruro', costo: 153.6 }]
        },
        {
          id: 'tr-altra',
          campagnaId: 'c2',
          data: '2026-09-15',
          tipoLavoro: 'Concimazione',
          costoProdotto: 80,
          prodotti: [{ prodotto: 'Concime', costo: 80 }]
        }
      ]
    });
    expect(dettaglio.costoManodopera).toBe(60);
    expect(dettaglio.costoMacchine).toBe(48);
    expect(dettaglio.costoProdotti).toBe(153.6);
    expect(dettaglio.costoTotale).toBe(261.6);
    expect(dettaglio.prodotti.map((row) => row.nome)).toEqual(['Rame ossicloruro']);
  });

  it('anagrafica mostra la colonna costo e il dettaglio', () => {
    const page = readFileSync(join(root, 'modules/seminativo/views/seminativi-standalone.html'), 'utf8');
    expect(page).toContain('Costo Totale Anno (€)');
    expect(page).toContain('Dettaglio Spese');
    expect(page).toContain('seminativo-spese-modal');
    const pageJs = readFileSync(join(root, 'modules/seminativo/js/seminativi-anagrafica-page.js'), 'utf8');
    expect(pageJs).toContain('📊 Dettaglio');
    expect(pageJs).toContain('✏️ Modifica');
    expect(pageJs).toContain('🗑️ Elimina');
  });
});
