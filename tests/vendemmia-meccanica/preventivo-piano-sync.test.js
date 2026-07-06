import { describe, test, expect } from 'vitest';
import {
  isPreventivoVendemmiaMeccanica,
  isPreventivoAccettato,
  deriveAnnoStagioneFromPreventivo
} from '../../modules/vendemmia-meccanica/services/lavoro-vm-utils.js';

describe('preventivo-piano-sync (pure)', () => {
  test('solo preventivi VM accettati sono candidati sync', () => {
    expect(
      isPreventivoVendemmiaMeccanica({ tipoLavoro: 'Vendemmia meccanica' }) &&
        isPreventivoAccettato('accettato_email')
    ).toBe(true);
    expect(
      isPreventivoVendemmiaMeccanica({ tipoLavoro: 'Trinciatura' }) &&
        isPreventivoAccettato('accettato_manager')
    ).toBe(false);
  });

  test('anno stagione da data prevista preventivo', () => {
    expect(deriveAnnoStagioneFromPreventivo({ dataPrevista: new Date('2026-08-01') })).toBe(2026);
    expect(deriveAnnoStagioneFromPreventivo({}, 2025)).toBe(2025);
  });
});
