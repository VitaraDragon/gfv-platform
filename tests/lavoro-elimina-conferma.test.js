/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/services/lavori-service.js', () => ({
  countRelatedLavoroData: vi.fn(async () => ({ ripreseFiglie: 0 })),
  deleteLavoroCascade: vi.fn(async () => {}),
  formatLavoroDeleteConfirmMessage: (nome) => 'Sei sicuro di voler eliminare il lavoro "' + nome + '"?',
  formatLavoroDeleteBlockedByRipreseMessage: () => 'bloccato'
}));

describe('conferma prima di eliminare un lavoro', () => {
  beforeEach(async () => {
    const servizio = await import('../core/services/lavori-service.js');
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
      if (!document.getElementById('gfv-confirm-ok')) throw new Error('dialogo assente');
    });
    document.getElementById('gfv-confirm-ok').click();
    await attesa;
    expect(servizio.deleteLavoroCascade).toHaveBeenCalledWith('L1', expect.objectContaining({
      tenantId: 'tenant',
      lavoro: expect.objectContaining({ nome: 'Folpan 21/11' })
    }));
  });
});
