/**
 * @vitest-environment node
 *
 * Shortlist sostituti: chi è già previsto sul lavoro di destinazione (roster del giorno
 * o anagrafica squadra) non compare tra i sostituti di quel lavoro, anche se libero.
 * Caso reale Uso Reale 20/10: membri della Squadra Vigna candidabili su #222 (il loro lavoro).
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
  getCollectionData: vi.fn(async () => [])
}));
vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'tenant-test')
}));
vi.mock('../../core/services/lavori-service.js', () => ({
  getAllLavori: vi.fn(),
  getLavoro: vi.fn(),
  updateLavoro: vi.fn(async () => undefined)
}));
vi.mock('../../core/services/terreni-service.js', () => ({
  getAllTerreni: vi.fn(async () => [])
}));
vi.mock('../../core/services/manodopera-assenze-service.js', () => ({
  getOperaioIdsAssentiConfermatiPerGiorno: vi.fn(async () => new Set(['ion']))
}));
vi.mock('../../core/services/profilo-manodopera-service.js', () => ({
  COLLECTION_NAME: 'profiliManodopera'
}));

import { getAllLavori, getLavoro } from '../../core/services/lavori-service.js';
import { buildShortlistSostitutiPerLavoroStandby } from '../../core/services/manodopera-sostituti-shortlist-service.js';
import { DISPONIBILITA_LIBERO } from '../../core/services/manodopera-sostituti-shortlist-logic.js';

const GIORNO = '2026-10-20';
const giorno = (d) => new Date(2026, 9, d, 12, 0, 0);

const destBase = {
  id: 'L222', nome: 'PROVA guasti #222', stato: 'in_standby', caposquadraId: 'marco',
  standbyGiornoKey: GIORNO, standbyOperaioId: 'ion', dataInizio: giorno(17), durataPrevista: 1
};
const squadre = [
  { caposquadraId: 'marco', operai: ['ion', 'sfat', 'rk9q'] },
  { caposquadraId: 'w1', operai: ['giorgio'] }
];
const operaiList = ['ion', 'sfat', 'rk9q', 'giorgio', 'paolo'].map((id) => ({ id, nome: id }));

async function shortlist(dest) {
  getLavoro.mockResolvedValue(dest);
  getAllLavori.mockResolvedValue([dest]);
  return buildShortlistSostitutiPerLavoroStandby({ lavoroId: 'L222', operaiList, squadreList: squadre });
}

describe('shortlist sostituti: esclusi i previsti sul lavoro di destinazione', () => {
  beforeEach(() => vi.clearAllMocks());

  test('membro della squadra di destinazione libero quel giorno → non compare', async () => {
    const res = await shortlist(destBase);
    const ids = res.shortlist.map((c) => c.operaioId);
    expect(ids).not.toContain('sfat');
    expect(ids).not.toContain('rk9q');
    expect(ids).not.toContain('ion');
  });

  test('controllo: operaio non previsto e libero → compare', async () => {
    const res = await shortlist(destBase);
    const paolo = res.shortlist.find((c) => c.operaioId === 'paolo');
    expect(paolo).toBeTruthy();
    expect(paolo.disponibilita).toBe(DISPONIBILITA_LIBERO);
    expect(res.shortlist.map((c) => c.operaioId).sort()).toEqual(['giorgio', 'paolo']);
  });

  test('roster del giorno materializzato: escluso chi è in partecipazioni, non il resto della squadra', async () => {
    const dest = {
      ...destBase,
      equipaggioGiorno: {
        [GIORNO]: {
          assenti: ['ion'],
          partecipazioni: [
            { operaioId: 'ion', stato: 'assente', origine: 'squadra' },
            { operaioId: 'sfat', stato: 'previsto', origine: 'squadra' }
          ]
        }
      }
    };
    const res = await shortlist(dest);
    const ids = res.shortlist.map((c) => c.operaioId);
    expect(ids).not.toContain('sfat');
    expect(ids).toContain('rk9q'); // non nel roster del giorno → candidabile
    expect(ids).toContain('paolo');
  });

  test('lavoro autonomo: escluso solo l\'operaio del lavoro', async () => {
    const dest = { ...destBase, caposquadraId: null, operaioId: 'ion' };
    const res = await shortlist(dest);
    const ids = res.shortlist.map((c) => c.operaioId).sort();
    expect(ids).toEqual(['giorgio', 'paolo', 'rk9q', 'sfat']);
  });
});
