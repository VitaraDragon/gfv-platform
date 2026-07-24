/**
 * @vitest-environment node
 *
 * Test sulla logica di assegnazione (mock getLavoro/updateLavoro).
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
  serverTimestamp: () => ({ __ts: true })
}));

vi.mock('../../core/services/lavori-service.js', () => ({
  getLavoro: vi.fn(),
  updateLavoro: vi.fn()
}));

vi.mock('../../core/services/manodopera-assenze-service.js', () => ({
  registraSostitutoSuAssenza: vi.fn()
}));

import { getLavoro, updateLavoro } from '../../core/services/lavori-service.js';
import { registraSostitutoSuAssenza } from '../../core/services/manodopera-assenze-service.js';
import {
  assegnaSostitutoDaStandby,
  applicaBucoPrestitoSuLavoroOrigine
} from '../../core/services/lavoro-sostituzione-assenza-service.js';

describe('lavoro-sostituzione-assenza-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('autonomo: aggiorna operaioId e equipaggioGiorno', async () => {
    getLavoro.mockResolvedValue({
      id: 'Ldest',
      stato: 'in_standby',
      standbyCausa: 'assenza_personale',
      standbyOperaioId: 'assente1',
      standbyStatoPrecedente: 'in_corso',
      standbyAssenzaId: 'A1',
      standbyGiornoKey: '2026-07-22',
      operaioId: 'assente1'
    });
    updateLavoro.mockResolvedValue(undefined);
    registraSostitutoSuAssenza.mockResolvedValue(undefined);

    const res = await assegnaSostitutoDaStandby({
      lavoroId: 'Ldest',
      sostitutoOperaioId: 'sost1',
      managerId: 'mgr1'
    });

    expect(res.isLavoroSquadra).toBe(false);
    expect(res.doppioMovimento).toBe(false);
    expect(updateLavoro).toHaveBeenCalledTimes(1);
    const patch = updateLavoro.mock.calls[0][1];
    expect(patch.operaioId).toBe('sost1');
    expect(patch.assenzaSostitutoOperaioId).toBe('sost1');
    expect(patch.stato).toBe('in_corso');
    expect(patch.equipaggioGiorno['2026-07-22'].assenti).toContain('assente1');
    expect(patch.equipaggioGiorno['2026-07-22'].sostituzioni[0].sostitutoOperaioId).toBe('sost1');
    expect(registraSostitutoSuAssenza).toHaveBeenCalledWith('A1', 'sost1', 'mgr1', null);
  });

  test('squadra: non setta operaioId, scrive equipaggioGiorno', async () => {
    getLavoro.mockResolvedValue({
      id: 'Lsq',
      stato: 'in_standby',
      standbyCausa: 'assenza_personale',
      standbyOperaioId: 'opAssente',
      standbyStatoPrecedente: 'assegnato',
      standbyGiornoKey: '2026-07-22',
      caposquadraId: 'cap1'
    });
    updateLavoro.mockResolvedValue(undefined);

    const res = await assegnaSostitutoDaStandby({
      lavoroId: 'Lsq',
      sostitutoOperaioId: 'sost2',
      managerId: 'mgr1'
    });

    expect(res.isLavoroSquadra).toBe(true);
    const patch = updateLavoro.mock.calls[0][1];
    expect(patch.operaioId).toBeUndefined();
    expect(patch.assenzaSostitutoOperaioId).toBe('sost2');
    expect(patch.equipaggioGiorno['2026-07-22'].sostituzioni).toHaveLength(1);
  });

  test('spostabile senza conferma → errore', async () => {
    getLavoro.mockResolvedValue({
      id: 'Ldest',
      stato: 'in_standby',
      standbyCausa: 'assenza_personale',
      standbyOperaioId: 'a1',
      standbyGiornoKey: '2026-07-22',
      operaioId: 'a1'
    });

    await expect(
      assegnaSostitutoDaStandby({
        lavoroId: 'Ldest',
        sostitutoOperaioId: 's1',
        managerId: 'mgr1',
        impegnoLavoroId: 'Lorig',
        confermaSpostamento: false
      })
    ).rejects.toThrow(/Conferma spostamento/);
  });

  test('doppio movimento: standby prestito su origine autonoma', async () => {
    getLavoro
      .mockResolvedValueOnce({
        id: 'Ldest',
        stato: 'in_standby',
        standbyCausa: 'assenza_personale',
        standbyOperaioId: 'a1',
        standbyStatoPrecedente: 'assegnato',
        standbyGiornoKey: '2026-07-22',
        operaioId: 'a1'
      })
      .mockResolvedValueOnce({
        id: 'Lorig',
        stato: 'in_corso',
        operaioId: 's1',
        macchinaId: null,
        attrezzoId: null
      });
    updateLavoro.mockResolvedValue(undefined);

    const res = await assegnaSostitutoDaStandby({
      lavoroId: 'Ldest',
      sostitutoOperaioId: 's1',
      managerId: 'mgr1',
      confermaSpostamento: true,
      impegnoLavoroId: 'Lorig'
    });

    expect(res.doppioMovimento).toBe(true);
    expect(updateLavoro).toHaveBeenCalledTimes(2);
    const patchOrig = updateLavoro.mock.calls[0][1];
    expect(updateLavoro.mock.calls[0][0]).toBe('Lorig');
    expect(patchOrig.standbyCausa).toBe('prestito_manodopera');
    expect(patchOrig.stato).toBe('in_standby');
    expect(patchOrig.manodoperaPrestata.versoLavoroId).toBe('Ldest');
  });

  test('buco prestito su lavoro di squadra origine (no standby globale)', async () => {
    getLavoro.mockResolvedValue({
      id: 'LorigSq',
      stato: 'in_corso',
      caposquadraId: 'cap1'
    });
    updateLavoro.mockResolvedValue(undefined);

    await applicaBucoPrestitoSuLavoroOrigine({
      lavoroOrigineId: 'LorigSq',
      operaioId: 'opX',
      versoLavoroId: 'Ldest',
      managerId: 'mgr1',
      giornoKey: '2026-07-22'
    });

    const patch = updateLavoro.mock.calls[0][1];
    expect(patch.stato).toBeUndefined();
    expect(patch.equipaggioGiorno['2026-07-22'].assenti).toContain('opX');
    expect(patch.equipaggioGiorno['2026-07-22'].prestitiUscita[0].versoLavoroId).toBe('Ldest');
  });
});
