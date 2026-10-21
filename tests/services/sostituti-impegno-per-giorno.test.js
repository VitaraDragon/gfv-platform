/**
 * @vitest-environment node
 *
 * Shortlist sostituti: un candidato è «impegnato» solo se il suo lavoro copre il giorno
 * dell'assenza (stessa regola di lavoroCopreGiornoKey della vista Impegni giornalieri).
 * Caso reale Uso Reale 20/10: candidati «Impegnato (override)» per lavori iniziati il 19/10
 * con durata 1 e mai chiusi.
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
import {
  DISPONIBILITA_LIBERO,
  DISPONIBILITA_IMPEGNATO
} from '../../core/services/manodopera-sostituti-shortlist-logic.js';

const GIORNO = '2026-10-20';
const giorno = (d) => new Date(2026, 9, d, 12, 0, 0);

const dest = {
  id: 'L222', nome: 'PROVA guasti #222', stato: 'in_standby', caposquadraId: 'marco',
  standbyGiornoKey: GIORNO, standbyOperaioId: 'ion', dataInizio: giorno(17), durataPrevista: 1
};
const squadre = [
  { caposquadraId: 'marco', operai: ['ion', 'luca'] },
  { caposquadraId: 'w1', operai: ['giorgio'] },
  { caposquadraId: 'k', operai: ['sara'] }
];

async function disponibilitaDi(operaioId, altriLavori) {
  getAllLavori.mockResolvedValue([dest, ...altriLavori]);
  const res = await buildShortlistSostitutiPerLavoroStandby({
    lavoroId: 'L222',
    operaiList: [{ id: operaioId, nome: operaioId }],
    squadreList: squadre
  });
  expect(res.shortlist).toHaveLength(1);
  return res.shortlist[0];
}

describe('shortlist sostituti: impegno solo nel giorno dell\'assenza', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLavoro.mockResolvedValue(dest);
  });

  test('lavoro futuro (inizia il 22/10) → libero', async () => {
    const c = await disponibilitaDi('paolo', [
      { id: 'Lfut', stato: 'assegnato', operaioId: 'paolo', dataInizio: giorno(22), durataPrevista: 1 }
    ]);
    expect(c.disponibilita).toBe(DISPONIBILITA_LIBERO);
  });

  test('lavoro concluso ieri per piano (19/10, durata 1) ma ancora in_corso → libero (caso Uso Reale)', async () => {
    const c = await disponibilitaDi('paolo', [
      { id: 'dfjSm', nome: 'Controllo scoline', stato: 'in_corso', operaioId: 'paolo', dataInizio: giorno(19), durataPrevista: 1 }
    ]);
    expect(c.disponibilita).toBe(DISPONIBILITA_LIBERO);
    expect(c.impegnoLavoroId).toBeNull();
  });

  test('lavoro in corso oggi → impegnato (override)', async () => {
    const c = await disponibilitaDi('paolo', [
      { id: 'Loggi', nome: 'Oggi', stato: 'in_corso', operaioId: 'paolo', dataInizio: giorno(20), durataPrevista: 1 }
    ]);
    expect(c.disponibilita).toBe(DISPONIBILITA_IMPEGNATO);
    expect(c.impegnoLavoroId).toBe('Loggi');
  });

  test('lavoro di più giorni iniziato ieri che copre oggi → impegnato', async () => {
    const c = await disponibilitaDi('paolo', [
      { id: 'Lmulti', stato: 'in_corso', operaioId: 'paolo', dataInizio: giorno(19), durataPrevista: 3 }
    ]);
    expect(c.disponibilita).toBe(DISPONIBILITA_IMPEGNATO);
  });

  test('membro di squadra: il caposquadra ha un altro lavoro solo in altri giorni → libero', async () => {
    const c = await disponibilitaDi('giorgio', [
      { id: 'VJkgi', nome: 'Aratura Campo del mais', stato: 'in_corso', caposquadraId: 'w1', dataInizio: giorno(19), durataPrevista: 1 },
      { id: 'Lw1fut', stato: 'assegnato', caposquadraId: 'w1', dataInizio: giorno(23), durataPrevista: 2 }
    ]);
    expect(c.disponibilita).toBe(DISPONIBILITA_LIBERO);
  });

  test('membro di squadra con lavoro della squadra oggi → impegnato', async () => {
    const c = await disponibilitaDi('sara', [
      { id: 'Lk', stato: 'in_corso', caposquadraId: 'k', dataInizio: giorno(20), durataPrevista: 1 }
    ]);
    expect(c.disponibilita).toBe(DISPONIBILITA_IMPEGNATO);
  });

  test('lavoro in standby che copre oggi → non impegna (libero)', async () => {
    const c = await disponibilitaDi('paolo', [
      { id: 'Lsb', stato: 'in_standby', operaioId: 'paolo', dataInizio: giorno(20), durataPrevista: 2 }
    ]);
    expect(c.disponibilita).toBe(DISPONIBILITA_LIBERO);
  });
});
