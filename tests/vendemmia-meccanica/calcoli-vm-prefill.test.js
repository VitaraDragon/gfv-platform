import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/services/lavori-service.js', () => ({
  getLavoro: vi.fn()
}));

vi.mock('../../core/services/firebase-service.js', () => ({
  createDocument: vi.fn(),
  getDocumentData: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getCollectionData: vi.fn()
}));

vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'tenant-1')
}));

import { getLavoro } from '../../core/services/lavori-service.js';
import { getDocumentData } from '../../core/services/firebase-service.js';
import {
  parseCalcolatoreUrlParams,
  resolveQuintaliFromLavoro,
  buildPrefillFromLavoro,
  buildPrefillFromCalcoloSalvato,
  loadCalcoloPrefillContext
} from '../../modules/vendemmia-meccanica/services/calcoli-vm-service.js';
import { isLavoroEligibleForCalcolatoreShortcut } from '../../modules/vendemmia-meccanica/services/lavoro-vm-utils.js';
import {
  buildCalcolatoreVmUrl,
  buildCalcolatoreVmUrlFromLavoro,
  CALCOLATORE_VM_ADMIN_BASE
} from '../../modules/vendemmia-meccanica/services/piano-stagione-utils.js';

describe('Calcolatore VM — URL e prefill', () => {
  test('parseCalcolatoreUrlParams legge lavoroId e calcoloId', () => {
    const p = parseCalcolatoreUrlParams('?clienteId=c1&terrenoId=t1&lavoroId=lav-1&calcoloId=calc-9');
    expect(p.clienteId).toBe('c1');
    expect(p.terrenoIds).toEqual(['t1']);
    expect(p.lavoroId).toBe('lav-1');
    expect(p.calcoloId).toBe('calc-9');
  });

  test('buildCalcolatoreVmUrl include lavoroId e calcoloId', () => {
    const url = buildCalcolatoreVmUrl('c1', 't1', { lavoroId: 'lav-1', calcoloId: 'calc-1' });
    expect(url).toContain('clienteId=c1');
    expect(url).toContain('terrenoId=t1');
    expect(url).toContain('lavoroId=lav-1');
    expect(url).toContain('calcoloId=calc-1');
  });

  test('buildCalcolatoreVmUrlFromLavoro usa base admin', () => {
    const url = buildCalcolatoreVmUrlFromLavoro(
      { id: 'lav-2', clienteId: 'c2', terrenoId: 't2', stato: 'completato' },
      { basePath: CALCOLATORE_VM_ADMIN_BASE }
    );
    expect(url).toContain(CALCOLATORE_VM_ADMIN_BASE);
    expect(url).toContain('lavoroId=lav-2');
  });

  test('resolveQuintaliFromLavoro legge campi opzionali', () => {
    expect(resolveQuintaliFromLavoro({ quantitaQli: 42.5 })).toBe(42.5);
    expect(resolveQuintaliFromLavoro({ nome: 'X' })).toBeNull();
  });

  test('buildPrefillFromLavoro', () => {
    const prefill = buildPrefillFromLavoro({
      id: 'lav-1',
      clienteId: 'c1',
      terrenoId: 't1',
      preventivoId: 'prev-1',
      quantitaQli: 80
    });
    expect(prefill.lavoroId).toBe('lav-1');
    expect(prefill.terrenoIds).toEqual(['t1']);
    expect(prefill.quintali).toBe(80);
    expect(prefill.preventivoId).toBe('prev-1');
  });

  test('buildPrefillFromCalcoloSalvato', () => {
    const prefill = buildPrefillFromCalcoloSalvato({
      id: 'calc-1',
      clienteId: 'c1',
      lavoroId: 'lav-1',
      quintali: 50,
      terreni: [{ terrenoId: 't1', nome: 'Barbera' }],
      destinazioneTrasporto: 'sociale',
      scontoMaggiorazione: -5
    });
    expect(prefill.calcoloId).toBe('calc-1');
    expect(prefill.terrenoIds).toEqual(['t1']);
    expect(prefill.quintali).toBe(50);
    expect(prefill.destinazioneTrasporto).toBe('sociale');
  });

  test('isLavoroEligibleForCalcolatoreShortcut solo VM completato', () => {
    const lavoroVm = {
      id: 'l1',
      tipoLavoro: 'Vendemmia meccanica',
      clienteId: 'c1',
      terrenoId: 't1',
      stato: 'completato'
    };
    expect(isLavoroEligibleForCalcolatoreShortcut(lavoroVm, { hasVmModule: true })).toBe(true);
    expect(isLavoroEligibleForCalcolatoreShortcut({ ...lavoroVm, stato: 'in_corso' }, { hasVmModule: true })).toBe(false);
    expect(isLavoroEligibleForCalcolatoreShortcut({ ...lavoroVm, tipoLavoro: 'Potatura' }, { hasVmModule: true })).toBe(false);
  });
});

describe('loadCalcoloPrefillContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('priorità calcoloId su lavoroId', async () => {
    getDocumentData.mockResolvedValue({
      clienteId: 'c1',
      quintali: 10,
      terreni: [{ terrenoId: 't1' }],
      destinazioneTrasporto: 'sociale'
    });
    const ctx = await loadCalcoloPrefillContext({ calcoloId: 'calc-1', lavoroId: 'lav-1' });
    expect(ctx.calcoloId).toBe('calc-1');
    expect(getDocumentData).toHaveBeenCalled();
    expect(getLavoro).not.toHaveBeenCalled();
  });

  test('carica da lavoroId', async () => {
    getLavoro.mockResolvedValue({
      id: 'lav-1',
      clienteId: 'c1',
      terrenoId: 't1',
      dataInizio: '2026-09-15'
    });
    const ctx = await loadCalcoloPrefillContext({ lavoroId: 'lav-1' });
    expect(ctx.lavoroId).toBe('lav-1');
    expect(ctx.clienteId).toBe('c1');
    expect(getLavoro).toHaveBeenCalledWith('lav-1');
  });
});
