/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { showArchiveTerrenoDialog } from '../shared/js/confirm-dialog.js';
import { eseguiEliminazioneOArchiviazione } from '../core/js/azione-eliminazione-terreno.js';

describe('C2 — modale archiviazione terreno', () => {
  it('mostra i tre motivi e il pulsante Archivia', async () => {
    const promise = showArchiveTerrenoDialog('Ci sono lavori collegati.');
    const select = document.getElementById('gfv-archive-reason');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      'Fine affitto',
      'Venduto',
      'Altro'
    ]);
    expect(document.getElementById('gfv-confirm-ok').textContent).toBe('Archivia');
    select.value = 'vendita';
    document.getElementById('gfv-confirm-ok').click();
    await expect(promise).resolves.toEqual({ motivo: 'vendita', nota: null });
  });

  it('Annulla non archivia e non usa window.prompt', async () => {
    const archiviaTerreno = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt');
    const result = await eseguiEliminazioneOArchiviazione(
      { id: 'ter-1', nome: 'Campo Nord' },
      {
        getCollegamentiTerreno: vi.fn(async () => ({ lavori: 1 })),
        archiviaTerreno,
        eliminaTerreno: vi.fn(),
        chiediArchiviazione: vi.fn(async () => null),
        avvisa: vi.fn()
      }
    );
    expect(result.azione).toBe('annullata');
    expect(archiviaTerreno).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });
});
