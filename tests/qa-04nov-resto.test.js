import { describe, it, expect } from 'vitest';
import { etichettaAttivitaMovimento, etichettaLavoroMovimento } from '../shared/js/magazzino-etichette.js';
import { impiantiAperti, isImpiantoChiuso, nomeImpiantoConStato } from '../shared/js/impianto-aperto.js';
import { nomeTerrenoPerStorico } from '../shared/js/terreno-archivio.js';
import { htmlAzioniRegistro, isLavoroSolaLettura } from '../shared/js/storico-sola-lettura.js';
import { oreNetteVisualizzate } from '../core/js/attivita-utils.js';

describe('A5 etichette magazzino', () => {
  it('id presente → etichetta; assente → Attività eliminata; mai uguale all\'id', () => {
    expect(etichettaAttivitaMovimento({
      data: '2026-11-01',
      tipoLavoro: 'Potatura',
      terrenoNome: 'Vigna'
    }, 'att-1')).toBe('2026-11-01 – Potatura – Vigna');
    expect(etichettaAttivitaMovimento(null, 'att-1')).toBe('Attività eliminata');
    expect(etichettaAttivitaMovimento(null, 'att-1')).not.toBe('att-1');
    expect(etichettaLavoroMovimento({ nome: 'Potatura QACC' }, 'l1')).toBe('Potatura QACC');
    expect(etichettaLavoroMovimento(null, 'l1')).toBe('Lavoro eliminato');
  });
});

describe('C3 terreno archiviato', () => {
  it('Nome (archiviato)', () => {
    expect(nomeTerrenoPerStorico({ nome: 'Sangiovese', stato: 'archiviato' })).toBe('Sangiovese (archiviato)');
  });
});

describe('C4 vigneti chiusi esclusi dai totali attivi', () => {
  it('5 vigneti di cui 2 chiusi e 1 senza stato → totale 3', () => {
    const lista = [
      { id: '1', statoImpianto: 'attivo' },
      { id: '2', statoImpianto: 'chiuso' },
      { id: '3' },
      { id: '4', statoImpianto: 'chiuso' },
      { id: '5', statoImpianto: 'attivo' }
    ];
    expect(impiantiAperti(lista)).toHaveLength(3);
    expect(isImpiantoChiuso({ statoImpianto: 'chiuso' })).toBe(true);
    expect(nomeImpiantoConStato({ varieta: 'Sangiovese', statoImpianto: 'chiuso' })).toContain('(chiuso)');
  });
});

describe('C5 sola lettura gestione lavori', () => {
  it('lavoro su terreno archiviato → solo consultazione', () => {
    const sola = isLavoroSolaLettura(
      { stato: 'assegnato', dataInizio: '2026-11-01' },
      { stato: 'archiviato', nome: 'X' }
    );
    expect(sola).toBe(true);
    expect(htmlAzioniRegistro(true, '<button>Elimina</button>')).toContain('Solo consultazione');
    expect(htmlAzioniRegistro(true, '<button>Elimina</button>')).not.toContain('Elimina');
  });
});

describe('A6 ore riga Diario', () => {
  it('08:00–10:00 senza pausa → 2 h, mai 8', () => {
    const vis = oreNetteVisualizzate({
      orarioInizio: '08:00',
      orarioFine: '10:00',
      pauseMinuti: 0,
      oreNette: 8
    });
    expect(vis.ore).toBe(2);
    expect(vis.corretta).toBe(true);
  });
});
