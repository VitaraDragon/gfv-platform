import { describe, it, expect } from 'vitest';
import {
  isTerrenoVignetoCliente,
  isTerrenoFruttetoCliente,
  filterRigheVigneto,
  groupClientiVignetoPiano,
  buildGestioneLavoriUrl,
  buildPreventiviCtUrl,
  buildCalcolatoreVmUrl,
  rowHasVendemmiaDati
} from '../../modules/vendemmia-meccanica/services/piano-stagione-utils.js';

describe('piano-stagione-utils', () => {
  const ctx = {
    viteCategoryIds: new Set(['cat-vite-1']),
    fruttetoCategoryIds: new Set(['cat-frutteto-1']),
    viteColtureNames: new Set(['vite', 'vite da vino', 'sangiovese']),
    fruttetoColtureNames: new Set(['melo', 'pero']),
    categoriaNomiById: new Map([
      ['cat-vite-1', 'vite'],
      ['cat-frutteto-1', 'frutteto']
    ])
  };

  it('isTerrenoFruttetoCliente riconosce frutteto', () => {
    expect(isTerrenoFruttetoCliente({ colturaCategoria: 'cat-frutteto-1' }, ctx)).toBe(true);
    expect(isTerrenoFruttetoCliente({ coltura: 'Melo Golden' }, ctx)).toBe(true);
  });

  it('isTerrenoVignetoCliente esclude frutteto anche con tipo palo', () => {
    expect(isTerrenoVignetoCliente({ colturaCategoria: 'cat-frutteto-1', tipoPalo: 'ferro' }, ctx)).toBe(false);
  });

  it('isTerrenoVignetoCliente riconosce categoria Vite per ID', () => {
    expect(isTerrenoVignetoCliente({ colturaCategoria: 'cat-vite-1', coltura: 'Sangiovese' }, ctx)).toBe(true);
  });

  it('isTerrenoVignetoCliente riconosce tipo palo su vigneto', () => {
    expect(isTerrenoVignetoCliente({ colturaCategoria: 'cat-vite-1', tipoPalo: 'ferro' }, ctx)).toBe(true);
    expect(isTerrenoVignetoCliente({ coltura: 'Vite da Vino', tipoPalo: 'legno' }, ctx)).toBe(true);
  });

  it('filterRigheVigneto esclude frutteto', () => {
    const rows = [
      { terrenoId: '1', colturaCategoria: 'cat-vite-1', clienteId: 'c1' },
      { terrenoId: '2', colturaCategoria: 'cat-frutteto-1', clienteId: 'c1' }
    ];
    expect(filterRigheVigneto(rows, ctx)).toHaveLength(1);
  });

  it('groupClientiVignetoPiano aggrega per cliente', () => {
    const rows = [
      { clienteId: 'c1', clienteNome: 'Rossi', inPiano: true, ettariEffettivi: 1.2, colturaCategoria: 'cat-vite-1' },
      { clienteId: 'c1', clienteNome: 'Rossi', inPiano: false, ettariEffettivi: 0.8, colturaCategoria: 'cat-vite-1' },
      { clienteId: 'c2', clienteNome: 'Bianchi', inPiano: false, colturaCategoria: 'cat-frutteto-1' }
    ];
    const groups = groupClientiVignetoPiano(rows, ctx);
    expect(groups).toHaveLength(1);
    expect(groups[0].clienteId).toBe('c1');
    expect(groups[0].terreniVigneto).toBe(2);
    expect(groups[0].terreniInPiano).toBe(1);
  });

  it('buildGestioneLavoriUrl include contoTerzi e lavoroId', () => {
    expect(buildGestioneLavoriUrl('lav-1')).toContain('contoTerzi=true');
    expect(buildGestioneLavoriUrl('lav-1')).toContain('lavoroId=lav-1');
    expect(buildGestioneLavoriUrl(null)).not.toContain('lavoroId=');
  });

  it('buildPreventiviCtUrl passa preventivoId e clienteId', () => {
    const url = buildPreventiviCtUrl('prev-1', 'cli-1');
    expect(url).toContain('preventivoId=prev-1');
    expect(url).toContain('clienteId=cli-1');
  });

  it('buildCalcolatoreVmUrl passa clienteId e terrenoId', () => {
    const url = buildCalcolatoreVmUrl('cli-1', 'terr-1');
    expect(url).toContain('clienteId=cli-1');
    expect(url).toContain('terrenoId=terr-1');
  });

  it('buildCalcolatoreVmUrl passa lavoroId e calcoloId', () => {
    const url = buildCalcolatoreVmUrl('cli-1', 'terr-1', { lavoroId: 'lav-1', calcoloId: 'calc-1' });
    expect(url).toContain('lavoroId=lav-1');
    expect(url).toContain('calcoloId=calc-1');
  });

  it('rowHasVendemmiaDati riconosce lavoro, zone e ha netti', () => {
    expect(rowHasVendemmiaDati({ lavoroId: 'l1' })).toBe(true);
    expect(rowHasVendemmiaDati({ zoneVendemmiateCount: 2 })).toBe(true);
    expect(rowHasVendemmiaDati({ zoneEscluseCount: 1 })).toBe(true);
    expect(rowHasVendemmiaDati({ superficie: 5, stato: { ettariVendemmiati: 4.2 } })).toBe(true);
    expect(rowHasVendemmiaDati({ superficie: 5, stato: { ettariVendemmiati: 5 } })).toBe(false);
    expect(rowHasVendemmiaDati({ superficie: 5, vendemmiato: true })).toBe(false);
  });
});
