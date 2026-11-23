/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/services/lavori-service.js', () => ({
  countRelatedLavoroData: vi.fn(async () => ({ ripreseFiglie: 0 })),
  deleteLavoroCascade: vi.fn(async () => {}),
  formatLavoroDeleteConfirmMessage: (nome, counts) => {
    const base = 'Sei sicuro di voler eliminare il lavoro "' + nome + '"?';
    const n = Number(counts?.trattamenti) || 0;
    if (n > 0) {
      return base + '\n\nVerranno eliminati anche:\n• ' + n + ' trattamento\n\nQuesta azione non può essere annullata.';
    }
    return base + '\n\nQuesta azione non può essere annullata.';
  },
  formatLavoroDeleteBlockedByRipreseMessage: () => 'bloccato'
}));

describe('conferma prima di eliminare un lavoro', () => {
  beforeEach(async () => {
    const servizio = await import('../core/services/lavori-service.js');
    servizio.countRelatedLavoroData.mockReset();
    servizio.countRelatedLavoroData.mockResolvedValue({ ripreseFiglie: 0 });
    servizio.deleteLavoroCascade.mockClear();
    document.body.innerHTML = '';
  });

  it('chiede conferma con il nome e non elimina se si annulla', async () => {
    const servizio = await import('../core/services/lavori-service.js');
    const { openEliminaModal } = await import('../core/admin/js/gestione-lavori-events.js');
    const attesa = openEliminaModal('L1', [{ id: 'L1', nome: 'Folpan 21/11' }], 'tenant', {}, false, null, null, null, null);
    await vi.waitFor(() => {
      if (!document.getElementById('gfv-confirm-body')) throw new Error(document.body.innerHTML.slice(0, 800) || 'body vuoto');
    });
    expect(document.getElementById('gfv-confirm-body').textContent).toContain('Folpan 21/11');
    document.getElementById('gfv-confirm-cancel').click();
    await attesa;
    expect(servizio.deleteLavoroCascade).not.toHaveBeenCalled();
  });

  it('elimina solo dopo la conferma', async () => {
    const servizio = await import('../core/services/lavori-service.js');
    const { openEliminaModal } = await import('../core/admin/js/gestione-lavori-events.js');
    const attesa = openEliminaModal('L1', [{ id: 'L1', nome: 'Folpan 21/11' }], 'tenant', {}, false, null, null, null, null);
    await vi.waitFor(() => {
      const ok = document.getElementById('gfv-confirm-ok');
      if (!ok || ok.disabled) throw new Error('dialogo non pronto');
    });
    document.getElementById('gfv-confirm-ok').click();
    await attesa;
    expect(servizio.deleteLavoroCascade).toHaveBeenCalledWith('L1', expect.objectContaining({
      tenantId: 'tenant',
      lavoro: expect.objectContaining({ nome: 'Folpan 21/11' })
    }));
  });

  it('disattiva Elimina durante il conteggio e lo riattiva a conteggio pronto', async () => {
    const servizio = await import('../core/services/lavori-service.js');
    let releaseCount;
    servizio.countRelatedLavoroData.mockImplementation(
      () => new Promise((resolve) => {
        releaseCount = () => resolve({ ripreseFiglie: 0, trattamenti: 1 });
      })
    );
    const { openEliminaModal } = await import('../core/admin/js/gestione-lavori-events.js');
    const attesa = openEliminaModal('L1', [{ id: 'L1', nome: 'Trattamento pesco' }], 'tenant', {}, false, null, null, null, null);

    await vi.waitFor(() => {
      const ok = document.getElementById('gfv-confirm-ok');
      const body = document.getElementById('gfv-confirm-body');
      if (!ok || !body) throw new Error('dialogo assente');
    });
    expect(document.getElementById('gfv-confirm-ok').disabled).toBe(true);
    expect(document.getElementById('gfv-confirm-body').textContent).toContain('Controllo dati collegati');
    expect(document.getElementById('gfv-confirm-cancel').disabled).toBe(false);

    releaseCount();
    await vi.waitFor(() => {
      const ok = document.getElementById('gfv-confirm-ok');
      if (!ok || ok.disabled) throw new Error('ancora disabilitato');
    });
    expect(document.getElementById('gfv-confirm-body').textContent).toContain('1 trattamento');
    document.getElementById('gfv-confirm-cancel').click();
    await attesa;
    expect(servizio.deleteLavoroCascade).not.toHaveBeenCalled();
  });

  it('riattiva Elimina se il conteggio fallisce', async () => {
    const servizio = await import('../core/services/lavori-service.js');
    servizio.countRelatedLavoroData.mockRejectedValue(new Error('firestore down'));
    const { openEliminaModal } = await import('../core/admin/js/gestione-lavori-events.js');
    const attesa = openEliminaModal('L1', [{ id: 'L1', nome: 'Folpan 21/11' }], 'tenant', {}, false, null, null, null, null);

    await vi.waitFor(() => {
      const ok = document.getElementById('gfv-confirm-ok');
      if (!ok || ok.disabled) throw new Error('non riattivato');
    });
    expect(document.getElementById('gfv-confirm-body').textContent).toContain(
      'Non è stato possibile verificare i dati collegati'
    );
    document.getElementById('gfv-confirm-cancel').click();
    await attesa;
  });

  it('riattiva Elimina se il conteggio supera il timeout', async () => {
    vi.useFakeTimers();
    const servizio = await import('../core/services/lavori-service.js');
    servizio.countRelatedLavoroData.mockImplementation(() => new Promise(() => {}));
    const { openEliminaModal } = await import('../core/admin/js/gestione-lavori-events.js');
    const attesa = openEliminaModal('L1', [{ id: 'L1', nome: 'Folpan 21/11' }], 'tenant', {}, false, null, null, null, null);

    await vi.waitFor(() => {
      if (!document.getElementById('gfv-confirm-ok')) throw new Error('dialogo assente');
    });
    expect(document.getElementById('gfv-confirm-ok').disabled).toBe(true);

    await vi.advanceTimersByTimeAsync(15000);
    await vi.waitFor(() => {
      const ok = document.getElementById('gfv-confirm-ok');
      if (!ok || ok.disabled) throw new Error('timeout non gestito');
    });
    expect(document.getElementById('gfv-confirm-body').textContent).toContain(
      'Non è stato possibile verificare i dati collegati'
    );
    document.getElementById('gfv-confirm-cancel').click();
    await attesa;
    vi.useRealTimers();
  });

  it('ignora il conteggio se il modale è già chiuso', async () => {
    const servizio = await import('../core/services/lavori-service.js');
    let releaseCount;
    servizio.countRelatedLavoroData.mockImplementation(
      () => new Promise((resolve) => {
        releaseCount = () => resolve({ ripreseFiglie: 0, trattamenti: 2 });
      })
    );
    const { openEliminaModal } = await import('../core/admin/js/gestione-lavori-events.js');
    const attesa = openEliminaModal('L1', [{ id: 'L1', nome: 'Folpan 21/11' }], 'tenant', {}, false, null, null, null, null);

    await vi.waitFor(() => {
      if (!document.getElementById('gfv-confirm-cancel')) throw new Error('dialogo assente');
    });
    document.getElementById('gfv-confirm-cancel').click();
    await attesa;
    releaseCount();
    await Promise.resolve();
    expect(servizio.deleteLavoroCascade).not.toHaveBeenCalled();
    expect(document.getElementById('gfv-confirm-overlay').style.display).toBe('none');
  });
});
