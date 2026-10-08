import { describe, it, expect } from 'vitest';
import { dateLikeToLocalCalendarIso } from '../../core/js/date-format-it.js';
import {
  chiaveGiornoOra,
  intervalliSiSovrappongono,
  trovaSovrapposizioni,
  permessiOra,
  sommaOreNette,
  formattaOreMinuti,
  aggiungiVoceStorico,
  buildVoceStorico,
  pianoRettificaOreMacchina,
  calcolaOreNette
} from '../../core/services/ore-operai-logic.js';

const lavoroSquadra = { caposquadraId: 'capo1', operaioId: null };
const lavoroSquadraAltro = { caposquadraId: 'capo2', operaioId: null };
const lavoroAutonomo = { caposquadraId: null, operaioId: 'op1' };

function riga(partial) {
  return {
    id: 'r1',
    operaioId: 'u1',
    data: '2026-10-06',
    stato: 'da_validare',
    lavoroId: 'lav1',
    lavoroNome: 'Potatura Vigna Nord',
    orarioInizio: '08:00',
    orarioFine: '12:00',
    ...partial
  };
}

describe('trovaSovrapposizioni', () => {
  const base = riga({ id: 'esistente', orarioInizio: '07:00', orarioFine: '16:00' });

  it('blocca 07–16 contro 08–15', () => {
    const nuova = riga({ id: 'nuova', orarioInizio: '08:00', orarioFine: '15:00' });
    const hits = trovaSovrapposizioni(nuova, [base]);
    expect(hits.map((h) => h.id)).toEqual(['esistente']);
  });

  it('permette i bordi che si toccano', () => {
    expect(intervalliSiSovrappongono(
      { orarioInizio: '07:00', orarioFine: '12:00' },
      { orarioInizio: '12:00', orarioFine: '16:00' }
    )).toBe(false);
    const hits = trovaSovrapposizioni(
      riga({ orarioInizio: '12:00', orarioFine: '16:00' }),
      [riga({ id: 'mattina', orarioInizio: '07:00', orarioFine: '12:00' })]
    );
    expect(hits).toHaveLength(0);
  });

  it('blocca il contenimento e le righe identiche', () => {
    const contenitore = riga({ id: 'ampia', orarioInizio: '07:00', orarioFine: '16:00' });
    expect(trovaSovrapposizioni(
      riga({ orarioInizio: '08:00', orarioFine: '15:00' }),
      [contenitore]
    )).toHaveLength(1);
    expect(trovaSovrapposizioni(
      riga({ id: 'copia', orarioInizio: '08:00', orarioFine: '12:00' }),
      [riga({ id: 'uguale', orarioInizio: '08:00', orarioFine: '12:00' })]
    )).toHaveLength(1);
  });

  it('ignora giorni diversi, rifiutate e la riga in modifica', () => {
    const esistenti = [
      riga({ id: 'altro-giorno', data: '2026-10-07', orarioInizio: '08:00', orarioFine: '15:00' }),
      riga({ id: 'rifiutata', stato: 'rifiutate', orarioInizio: '08:00', orarioFine: '15:00' }),
      riga({ id: 'me-stessa', orarioInizio: '08:00', orarioFine: '15:00' })
    ];
    const hits = trovaSovrapposizioni(
      riga({ id: 'me-stessa', orarioInizio: '08:00', orarioFine: '15:00' }),
      esistenti,
      { escludiId: 'me-stessa' }
    );
    expect(hits).toHaveLength(0);
  });

  it('conta lavori diversi dello stesso giorno e ignora utenti diversi', () => {
    const altraLavoro = riga({
      id: 'altro-lavoro',
      lavoroId: 'lav2',
      orarioInizio: '08:00',
      orarioFine: '15:00'
    });
    const altroUtente = riga({
      id: 'altro-utente',
      operaioId: 'u2',
      orarioInizio: '08:00',
      orarioFine: '15:00'
    });
    const nuova = riga({ orarioInizio: '07:00', orarioFine: '16:00' });
    expect(trovaSovrapposizioni(nuova, [altraLavoro]).map((h) => h.id)).toEqual(['altro-lavoro']);
    expect(trovaSovrapposizioni(nuova, [altroUtente])).toHaveLength(0);
  });
});

describe('chiaveGiornoOra', () => {
  it('mezzanotte locale resta il giorno civile', () => {
    const local = new Date(2026, 9, 6, 0, 0, 0, 0);
    expect(chiaveGiornoOra(local)).toBe('2026-10-06');
    expect(chiaveGiornoOra({ toDate: () => local })).toBe('2026-10-06');
  });

  it('Timestamp a mezzanotte UTC usa il giorno locale di quell’istante', () => {
    const seconds = Math.floor(Date.UTC(2026, 9, 6, 0, 0, 0) / 1000);
    const istante = new Date(seconds * 1000);
    expect(chiaveGiornoOra({ seconds })).toBe(dateLikeToLocalCalendarIso(istante));
    expect(chiaveGiornoOra({ seconds })).toBe(chiaveGiornoOra(istante));
    if (istante.getTimezoneOffset() <= 0) {
      expect(chiaveGiornoOra({ seconds })).toBe('2026-10-06');
      expect(chiaveGiornoOra(new Date(2026, 9, 6, 0, 0, 0, 0))).toBe('2026-10-06');
    }
  });

  it('una stringa YYYY-MM-DD non slitta di fuso', () => {
    expect(chiaveGiornoOra('2026-10-06')).toBe('2026-10-06');
  });
});

describe('permessiOra', () => {
  it('operaio: modifica da_validare e rifiutate, niente sulle validate', () => {
    const base = {
      lavoro: lavoroSquadra,
      userId: 'op1',
      isCaposquadra: false,
      isManager: false
    };
    const attesa = permessiOra({ ...base, ora: { operaioId: 'op1', stato: 'da_validare' } });
    expect(attesa.puoModificare).toBe(true);
    expect(attesa.puoEliminare).toBe(true);
    expect(attesa.puoCorreggere).toBe(false);
    expect(attesa.puoAnnullareValidazione).toBe(false);
    expect(attesa.puoRifiutare).toBe(false);

    const rifiutata = permessiOra({ ...base, ora: { operaioId: 'op1', stato: 'rifiutate' } });
    expect(rifiutata.puoModificare).toBe(true);
    expect(rifiutata.puoEliminare).toBe(true);

    const validata = permessiOra({ ...base, ora: { operaioId: 'op1', stato: 'validate' } });
    expect(validata.puoModificare).toBe(false);
    expect(validata.puoEliminare).toBe(false);
    expect(validata.puoCorreggere).toBe(false);
    expect(validata.motivoBlocco).toContain('caposquadra');
  });

  it('caposquadra: operai della sua squadra, non le proprie, non quelle di un altro capo', () => {
    const sulleOreOperaio = permessiOra({
      ora: { operaioId: 'op2', stato: 'validate' },
      lavoro: lavoroSquadra,
      userId: 'capo1',
      isCaposquadra: true,
      isManager: false
    });
    expect(sulleOreOperaio.puoModificare).toBe(false);
    expect(sulleOreOperaio.puoCorreggere).toBe(true);
    expect(sulleOreOperaio.puoAnnullareValidazione).toBe(true);
    expect(sulleOreOperaio.puoRifiutare).toBe(true);

    const inCoda = permessiOra({
      ora: { operaioId: 'op2', stato: 'da_validare' },
      lavoro: lavoroSquadra,
      userId: 'capo1',
      isCaposquadra: true,
      isManager: false
    });
    expect(inCoda.puoCorreggere).toBe(true);
    expect(inCoda.puoAnnullareValidazione).toBe(false);
    expect(inCoda.puoModificare).toBe(false);

    const proprie = permessiOra({
      ora: { operaioId: 'capo1', stato: 'da_validare' },
      lavoro: lavoroSquadra,
      userId: 'capo1',
      isCaposquadra: true,
      isManager: false
    });
    expect(proprie.puoModificare).toBe(true);
    expect(proprie.puoCorreggere).toBe(false);
    expect(proprie.puoRifiutare).toBe(false);

    const proprieValidate = permessiOra({
      ora: { operaioId: 'capo1', stato: 'validate' },
      lavoro: lavoroSquadra,
      userId: 'capo1',
      isCaposquadra: true,
      isManager: false
    });
    expect(proprieValidate.puoModificare).toBe(false);
    expect(proprieValidate.puoCorreggere).toBe(false);
    expect(proprieValidate.motivoBlocco).toContain('manager');

    const altroCapo = permessiOra({
      ora: { operaioId: 'op9', stato: 'validate' },
      lavoro: lavoroSquadraAltro,
      userId: 'capo1',
      isCaposquadra: true,
      isManager: false
    });
    expect(altroCapo.puoCorreggere).toBe(false);
    expect(altroCapo.puoAnnullareValidazione).toBe(false);
    expect(altroCapo.puoRifiutare).toBe(false);
  });

  it('manager: squadra e autonomo, senza cancellare al posto del proprietario', () => {
    const squadra = permessiOra({
      ora: { operaioId: 'op2', stato: 'validate' },
      lavoro: lavoroSquadra,
      userId: 'mgr',
      isCaposquadra: false,
      isManager: true
    });
    expect(squadra.puoCorreggere).toBe(true);
    expect(squadra.puoAnnullareValidazione).toBe(true);
    expect(squadra.puoRifiutare).toBe(true);
    expect(squadra.puoEliminare).toBe(false);

    const autonomo = permessiOra({
      ora: { operaioId: 'op1', stato: 'da_validare' },
      lavoro: lavoroAutonomo,
      userId: 'mgr',
      isCaposquadra: false,
      isManager: true
    });
    expect(autonomo.puoCorreggere).toBe(true);
    expect(autonomo.puoRifiutare).toBe(true);
    expect(autonomo.puoAnnullareValidazione).toBe(false);

    const autonomoValidatoDalProprietario = permessiOra({
      ora: { operaioId: 'op1', stato: 'validate' },
      lavoro: lavoroAutonomo,
      userId: 'op1',
      isCaposquadra: false,
      isManager: false
    });
    expect(autonomoValidatoDalProprietario.motivoBlocco).toContain('manager');
  });
});

describe('ore nette e storico', () => {
  it('sommaOreNette e formattaOreMinuti', () => {
    expect(calcolaOreNette('07:00', '16:00', 30)).toBe(8.5);
    expect(sommaOreNette([{ oreNette: 8.5 }, { oreNette: 4 }, { oreNette: 'no' }])).toBe(12.5);
    expect(formattaOreMinuti(12.5)).toBe('12h 30min');
    expect(formattaOreMinuti(8)).toBe('8h');
    expect(formattaOreMinuti(0)).toBe('0h');
  });

  it('aggiungiVoceStorico tiene al massimo 20 voci', () => {
    let storico = [];
    for (let i = 1; i <= 25; i += 1) {
      storico = aggiungiVoceStorico(storico, buildVoceStorico({
        azione: 'modifica',
        da: 'u1',
        il: i,
        motivo: '',
        prima: { stato: 'da_validare', data: '2026-10-06' },
        dopo: { stato: 'da_validare', note: String(i) }
      }));
    }
    expect(storico).toHaveLength(20);
    expect(storico[0].il).toBe(6);
    expect(storico[19].il).toBe(25);
    expect(storico[19].azione).toBe('modifica');
    expect(storico[19].prima.data).toBe('2026-10-06');
  });
});

describe('pianoRettificaOreMacchina', () => {
  const cont = { macchinaId: 'mac1', attrezzoId: 'att1', ore: 8 };

  it('in correzione applica solo la differenza', () => {
    const piano = pianoRettificaOreMacchina(cont, 'correzione', {
      macchinaId: 'mac1',
      attrezzoId: 'att1',
      ore: 6
    });
    expect(piano.operazioni).toEqual([
      { id: 'mac1', delta: -2 },
      { id: 'att1', delta: -2 }
    ]);
    expect(piano.azzeraCampo).toBe(false);
    expect(piano.prossimoContabilizzate.ore).toBe(6);
    expect(piano.avviso).toBe('');
  });

  it('in annullamento sottrae le ore contabilizzate', () => {
    const piano = pianoRettificaOreMacchina(cont, 'annulla');
    expect(piano.operazioni).toEqual([
      { id: 'mac1', delta: -8 },
      { id: 'att1', delta: -8 }
    ]);
    expect(piano.azzeraCampo).toBe(true);
    expect(piano.prossimoContabilizzate).toBeNull();
  });

  it('senza oreMacchinaContabilizzate non tocca la macchina', () => {
    const piano = pianoRettificaOreMacchina(null, 'annulla');
    expect(piano.operazioni).toEqual([]);
    expect(piano.avviso).toMatch(/verificare a mano/);
    expect(piano.azzeraCampo).toBe(false);
    const senzaOre = pianoRettificaOreMacchina({ macchinaId: 'mac1' }, 'correzione', {
      macchinaId: 'mac1',
      ore: 3
    });
    expect(senzaOre.operazioni).toEqual([]);
    expect(senzaOre.avviso).toMatch(/verificare a mano/);
  });
});
