import { describe, expect, it } from 'vitest';
import {
  ETICHETTA_COMPLETATO_SENZA_ZONE,
  lavoroCompletatoSenzaZone,
} from '../core/js/lavoro-progresso-display.js';

describe('lavoroCompletatoSenzaZone', () => {
  it('l’etichetta è quella della barra', () => {
    expect(ETICHETTA_COMPLETATO_SENZA_ZONE).toBe('✅ Completato (nessuna zona tracciata)');
  });

  it('vale solo se il lavoro è chiuso', () => {
    expect(lavoroCompletatoSenzaZone({ stato: 'in_corso' })).toBe(false);
    expect(lavoroCompletatoSenzaZone({ stato: 'assegnato' })).toBe(false);
    expect(lavoroCompletatoSenzaZone(null)).toBe(false);
  });

  it('se c’è zoneCount decide quello', () => {
    const chiuso = { stato: 'completato', percentualeCompletamento: 80, superficieTotaleLavorata: 2 };
    expect(lavoroCompletatoSenzaZone(chiuso, { zoneCount: 0 })).toBe(true);
    expect(lavoroCompletatoSenzaZone(chiuso, { zoneCount: 3 })).toBe(false);
    expect(lavoroCompletatoSenzaZone({ stato: 'completato_da_approvare' }, { zoneCount: 0 })).toBe(true);
  });

  it('completamento parziale non è «nessuna zona»', () => {
    expect(
      lavoroCompletatoSenzaZone(
        { stato: 'completato', completamentoParziale: true },
        { zoneCount: 0 }
      )
    ).toBe(false);
  });

  it('percentualeCompletamentoTracciata decide se non c’è zoneCount', () => {
    expect(
      lavoroCompletatoSenzaZone({
        stato: 'completato_da_approvare',
        percentualeCompletamentoTracciata: 0,
        superficieTotaleLavorata: 4,
      })
    ).toBe(true);
    expect(
      lavoroCompletatoSenzaZone({
        stato: 'completato',
        percentualeCompletamentoTracciata: 12,
      })
    ).toBe(false);
  });

  it('senza tracciato e senza zoneCount: vero se non c’è superficie né percentuale', () => {
    expect(lavoroCompletatoSenzaZone({ stato: 'completato' })).toBe(true);
    expect(lavoroCompletatoSenzaZone({ stato: 'completato', percentualeCompletamento: 0 })).toBe(true);
    expect(lavoroCompletatoSenzaZone({ stato: 'completato', superficieTotaleLavorata: 1.2 })).toBe(false);
    expect(lavoroCompletatoSenzaZone({ stato: 'completato', percentualeCompletamento: 40 })).toBe(false);
  });
});
