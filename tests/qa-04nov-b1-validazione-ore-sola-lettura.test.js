import { describe, expect, it } from 'vitest';
import { assertOraLavoroModificabile } from '../core/services/ore-sola-lettura.js';
import {
  htmlAzioniRegistro,
  MESSAGGIO_ORE_SOLA_LETTURA
} from '../shared/js/storico-sola-lettura.js';

describe('B1 — validazione ore in sola lettura', () => {
  it('il servizio rifiuta un lavoro su terreno archiviato', () => {
    expect(() => assertOraLavoroModificabile(
      { id: 'lav-1', terrenoId: 'ter-1', stato: 'assegnato' },
      { id: 'ter-1', stato: 'archiviato' }
    )).toThrow(MESSAGGIO_ORE_SOLA_LETTURA);
  });

  it('la riga sostituisce le azioni con Solo consultazione', () => {
    const html = htmlAzioniRegistro(
      true,
      '<button onclick="validaOra()">✅ Valida</button>'
    );
    expect(html).toContain('Solo consultazione');
    expect(html).not.toContain('validaOra');
    expect(html).not.toContain('✅ Valida');
  });

  it('un lavoro normale resta validabile', () => {
    expect(() => assertOraLavoroModificabile(
      { id: 'lav-2', terrenoId: 'ter-2', stato: 'assegnato' },
      { id: 'ter-2', stato: 'attivo' }
    )).not.toThrow();
  });
});
