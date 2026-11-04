/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllTerreni: vi.fn()
}));

vi.mock('../core/services/firebase-service.js', () => ({
  createDocument: vi.fn(),
  getDocumentData: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getCollectionData: vi.fn()
}));

vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: () => 'tenant-1'
}));

vi.mock('../core/services/categorie-service.js', () => ({
  getAllCategorie: vi.fn(async () => [])
}));

vi.mock('../core/services/colture-service.js', () => ({
  getAllColture: vi.fn(async () => [])
}));

vi.mock('../core/services/terreni-service.js', () => ({
  getAllTerreni: mocks.getAllTerreni
}));

import { terreniPerTendina } from '../shared/js/coltura-terreno.js';
import { listTerreniSeminativo } from '../modules/seminativo/services/seminativi-service.js';
import { selezionaRigheTrattamento } from '../modules/seminativo/models/SeminativoTrattamento.js';
import { selezionaLavorazioniCollegate } from '../modules/seminativo/models/SeminativoLavorazione.js';
import { lavoriRecentiHub, panoramicaHubSeminativo } from '../modules/seminativo/models/SeminativoHub.js';

const TUTTI = [
  { id: 'attivo', nome: 'Campo Nord', coltura: 'Grano', stato: 'attivo' },
  { id: 'vecchio', nome: 'Campo Vecchio', coltura: 'Grano', stato: 'archiviato' }
];

describe('seminativo — storico dei terreni archiviati', () => {
  beforeEach(() => {
    mocks.getAllTerreni.mockImplementation(async ({ includiArchiviati = false } = {}) => (
      includiArchiviati ? TUTTI : TUTTI.filter((t) => t.stato !== 'archiviato')
    ));
  });

  it('listTerreniSeminativo esclude gli archiviati, salvo richiesta esplicita', async () => {
    const soloAttivi = await listTerreniSeminativo();
    expect(soloAttivi.map((t) => t.id)).toEqual(['attivo']);
    expect(mocks.getAllTerreni).toHaveBeenCalledWith({ includiArchiviati: false });

    const conStorico = await listTerreniSeminativo({ includiArchiviati: true });
    expect(conStorico.map((t) => t.id)).toEqual(['attivo', 'vecchio']);
  });

  it('il registro trattamenti tiene la riga e il nome con (archiviato)', () => {
    const righe = selezionaRigheTrattamento({
      terreni: [TUTTI[1]],
      nomiTipi: ['trattamento meccanico'],
      campagne: [{ id: 'c1', terrenoId: 'vecchio', campagna: '2025/2026', colturaNome: 'Grano' }],
      lavori: [{
        id: 'l1',
        terrenoId: 'vecchio',
        stato: 'completato',
        tipoLavoro: 'Trattamento Meccanico',
        dataInizio: '2026-03-04'
      }]
    });
    expect(righe).toHaveLength(1);
    expect(righe[0].terrenoNome).toContain(' (archiviato)');
  });

  it('lavorazioni e hub tengono la riga del terreno archiviato', () => {
    const lavorazioni = selezionaLavorazioniCollegate({
      terreni: [TUTTI[1]],
      lavori: [{
        id: 'lav1',
        terrenoId: 'vecchio',
        tipoLavoro: 'Aratura',
        dataInizio: '2026-10-02',
        stato: 'completato'
      }]
    });
    expect(lavorazioni).toHaveLength(1);
    expect(lavorazioni[0].terrenoNome).toBe('Campo Vecchio (archiviato)');

    const lavori = lavoriRecentiHub({
      now: new Date('2026-09-27T12:00:00'),
      terreni: [TUTTI[1]],
      lavori: [{
        id: 'l1',
        terrenoId: 'vecchio',
        stato: 'completato',
        tipoLavoro: 'Erpicatura',
        dataInizio: '2026-09-15'
      }]
    });
    expect(lavori).toHaveLength(1);
    expect(lavori[0].terrenoNome).toContain(' (archiviato)');
  });

  it('la tendina della nuova campagna non contiene il terreno archiviato', () => {
    const nuova = terreniPerTendina(TUTTI);
    expect(nuova.map((t) => t.id)).toEqual(['attivo']);
    const modifica = terreniPerTendina(TUTTI, { idCorrente: 'vecchio' });
    expect(modifica.map((t) => t.id)).toContain('vecchio');
  });

  it('ettari e conteggi di oggi non includono il terreno archiviato', () => {
    const p = panoramicaHubSeminativo({
      now: new Date('2026-09-27T12:00:00'),
      terreni: TUTTI,
      campagne: [
        { id: 'c-att', terrenoId: 'attivo', campagna: '2026/2027', stato: 'seminato', superficieEttari: 4 },
        { id: 'c-arc', terrenoId: 'vecchio', campagna: '2026/2027', stato: 'seminato', superficieEttari: 9 }
      ],
      semine: [{ campagnaId: 'c-att' }, { campagnaId: 'c-arc' }],
      raccolte: [{ campagnaId: 'c-arc' }]
    });
    expect(p.campagneAperte).toBe(1);
    expect(p.ettari).toBe(4);
    expect(p.semine).toBe(1);
    expect(p.raccolte).toBe(0);
  });
});
