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
  calcolaOreNette,
  creaErroreSovrapposizione,
  testoErroreSalvataggioOre,
  oreMacchinaDaSalvare,
  messaggioSovrapposizioneTony,
  chiValidaOra,
  messaggioOraSegnataConSuccesso,
  testoAttesaValidazione,
  deveRichiedereRefreshSkill,
  vociTracciaOra,
  formatTracciaOra,
  formattaDataOraTraccia,
  calcolaContatoriOreValidazione
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

  it('senza mezzo e senza contabilizzate non avvisa', () => {
    const piano = pianoRettificaOreMacchina(null, 'annulla');
    expect(piano.operazioni).toEqual([]);
    expect(piano.avviso).toBe('');
    expect(piano.azzeraCampo).toBe(false);
  });

  it('senza contabilizzate ma con macchina avvisa e non tocca il contatore', () => {
    const piano = pianoRettificaOreMacchina(null, 'annulla', null, { macchinaId: 'mac1' });
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

describe('testo errore salvataggio sovrapposizione', () => {
  it('il prefisso Errore salvataggio è quello che Tony riconosce', () => {
    const err = creaErroreSovrapposizione([
      { orarioInizio: '07:30', orarioFine: '12:00' }
    ]);
    expect(err.code).toBe('ORE_SOVRAPPOSTE');
    const testo = testoErroreSalvataggioOre(err);
    expect(testo.startsWith('Errore salvataggio: ')).toBe(true);
    expect(/^Errore salvataggio:/i.test(testo)).toBe(true);
    expect(testo).toMatch(/07:30/);
  });
});

describe('ore macchina di default', () => {
  it('con macchina e campo vuoto salva le ore nette', () => {
    expect(oreMacchinaDaSalvare({ macchinaId: 'mac1', oreMacchina: '' }, 4)).toBe(4);
    expect(oreMacchinaDaSalvare({ attrezzoId: 'att1', oreMacchina: null }, 3.5)).toBe(3.5);
  });

  it('senza macchina né attrezzo lascia il campo vuoto', () => {
    expect(oreMacchinaDaSalvare({ oreMacchina: 8 }, 4)).toBe(null);
    expect(oreMacchinaDaSalvare({}, 4)).toBe(null);
  });

  it('un valore numerico esplicito resta quello indicato', () => {
    expect(oreMacchinaDaSalvare({ macchinaId: 'mac1', oreMacchina: 2 }, 4)).toBe(2);
    expect(oreMacchinaDaSalvare({ macchinaId: 'mac1', oreMacchina: 0 }, 4)).toBe(0);
  });
});

describe('chi valida l ora', () => {
  it('lavoro autonomo va al manager', () => {
    expect(chiValidaOra({
      ora: { operaioId: 'op1' },
      lavoro: lavoroAutonomo
    })).toBe('manager');
  });

  it('ora del caposquadra su lavoro di squadra va al manager', () => {
    expect(chiValidaOra({
      ora: { operaioId: 'capo1' },
      lavoro: lavoroSquadra
    })).toBe('manager');
  });

  it('ora di un operaio di squadra va al caposquadra', () => {
    expect(chiValidaOra({
      ora: { operaioId: 'op2' },
      lavoro: lavoroSquadra
    })).toBe('caposquadra');
  });

  it('il messaggio di successo dice chi valida', () => {
    expect(messaggioOraSegnataConSuccesso('manager')).toMatch(/^Ora segnata con successo!/);
    expect(messaggioOraSegnataConSuccesso('manager')).toMatch(/manager/);
    expect(testoAttesaValidazione('caposquadra')).toBe('In attesa — la valida il caposquadra');
  });
});

describe('messaggio sovrapposizione per Tony', () => {
  it('dice che l orario è occupato e propone un altro inizio', () => {
    const testo = messaggioSovrapposizioneTony(
      { orarioInizio: '10:00', orarioFine: '11:00' },
      [{ orarioInizio: '08:00', orarioFine: '12:00', lavoroNome: 'Potatura' }]
    );
    expect(testo).toMatch(/10:00/);
    expect(testo).toMatch(/si sovrappone/);
    expect(testo).toMatch(/08:00/);
    expect(testo).toMatch(/dalle 12:00/);
  });
});

describe('traccia della riga', () => {
  const quando = new Date(2026, 9, 8, 14, 5);
  const nomeDi = (uid) => ({ mgr: 'Anna', op: 'Luca' }[uid] || '');

  it('formatta data e ora locali', () => {
    expect(formattaDataOraTraccia(quando)).toBe('08/10/2026 14:05');
  });

  it('mostra validazione, correzione e annullo con motivo', () => {
    const voci = vociTracciaOra({
      validatoDa: 'mgr',
      validatoIl: new Date(2026, 9, 8, 9, 0),
      storicoModifiche: [
        { azione: 'correzione', da: 'mgr', il: new Date(2026, 9, 8, 10, 15), motivo: 'orario errato' },
        { azione: 'annulla_validazione', da: 'mgr', il: new Date(2026, 9, 8, 11, 0), motivo: 'da rifare' }
      ]
    }, nomeDi);
    expect(voci[0]).toBe('Validata da Anna il 08/10/2026 09:00');
    expect(voci[1]).toBe('Corretta da Anna il 08/10/2026 10:15 — orario errato');
    expect(voci[2]).toBe('Validazione annullata da Anna il 08/10/2026 11:00 — da rifare');
    expect(formatTracciaOra({
      validatoDa: 'mgr',
      validatoIl: new Date(2026, 9, 8, 9, 0)
    }, nomeDi)).toBe('Validata da Anna il 08/10/2026 09:00');
  });

  it('mostra il rifiuto nello storico una volta sola', () => {
    const voci = vociTracciaOra({
      rifiutatoDa: 'mgr',
      rifiutatoIl: new Date(2026, 9, 8, 16, 0),
      motivoRifiuto: 'turno doppio',
      storicoModifiche: [
        { azione: 'rifiuto', da: 'mgr', il: new Date(2026, 9, 8, 16, 0), motivo: 'turno doppio' }
      ]
    }, nomeDi);
    expect(voci).toEqual(['Rifiutata da Anna il 08/10/2026 16:00 — turno doppio']);
  });

  it('riga vecchia con solo i campi del rifiuto', () => {
    const voci = vociTracciaOra({
      rifiutatoDa: 'mgr',
      motivoRifiuto: 'manca la pausa'
    }, nomeDi);
    expect(voci).toEqual(['Rifiutata da Anna — manca la pausa']);
  });

  it('include la modifica', () => {
    const voci = vociTracciaOra({
      storicoModifiche: [
        { azione: 'modifica', da: 'op', il: quando, motivo: '' }
      ]
    }, nomeDi);
    expect(voci).toEqual(['Modificata da Luca il 08/10/2026 14:05']);
  });
});

describe('contatori validazione ore', () => {
  const oggi = new Date(2026, 9, 8, 12, 0, 0);
  const flagsManager = { userId: 'mgr', isManager: true, isCaposquadra: false, oggi, giorni: 30 };

  function rigaArchivio(partial) {
    return {
      id: partial.id,
      lavoroId: partial.lavoroId || 'lav1',
      operaioId: partial.operaioId || 'op2',
      data: partial.data || '2026-10-08',
      stato: partial.stato,
      oreNette: partial.oreNette,
      lavoro: partial.lavoro || lavoroSquadra
    };
  }

  it('da validare è la coda, validate e rifiutate sono gli ultimi 30 giorni', () => {
    const righe = [
      rigaArchivio({ id: 'coda', stato: 'da_validare', operaioId: 'op2', oreNette: 2, lavoro: lavoroSquadra }),
      rigaArchivio({ id: 'val', stato: 'validate', oreNette: 4, lavoro: lavoroSquadra }),
      rigaArchivio({ id: 'rif', stato: 'rifiutate', oreNette: 8, lavoro: lavoroSquadra }),
      rigaArchivio({ id: 'vecchia', stato: 'validate', data: '2026-08-01', oreNette: 5, lavoro: lavoroSquadra }),
      rigaArchivio({ id: 'autonoma', stato: 'da_validare', operaioId: 'op1', oreNette: 1, lavoro: lavoroAutonomo })
    ];
    const capo = calcolaContatoriOreValidazione(righe, {
      userId: 'capo1',
      isCaposquadra: true,
      isManager: false,
      oggi,
      giorni: 30
    });
    expect(capo.daValidare.map((r) => r.id)).toEqual(['coda']);
    expect(capo.validate.map((r) => r.id)).toEqual(['val']);
    expect(capo.rifiutate.map((r) => r.id)).toEqual(['rif']);
    expect(capo.periodoEtichetta).toBe('ultimi 30 giorni');

    const manager = calcolaContatoriOreValidazione(righe, flagsManager);
    expect(manager.daValidare.map((r) => r.id)).toEqual(['autonoma']);
    expect(manager.validate.map((r) => r.id)).toEqual(['val']);
    expect(manager.rifiutate.map((r) => r.id)).toEqual(['rif']);
  });

  it('i filtri operaio e lavoro valgono per validate e rifiutate, non per la coda', () => {
    const righe = [
      rigaArchivio({ id: 'coda', stato: 'da_validare', operaioId: 'op2', lavoroId: 'lav1' }),
      rigaArchivio({ id: 'val-a', stato: 'validate', operaioId: 'op2', lavoroId: 'lav1' }),
      rigaArchivio({ id: 'val-b', stato: 'validate', operaioId: 'op3', lavoroId: 'lav2' })
    ];
    const out = calcolaContatoriOreValidazione(righe, {
      userId: 'capo1',
      isCaposquadra: true,
      isManager: false,
      oggi,
      filtroOperaioId: 'op2',
      filtroLavoroId: 'lav1'
    });
    expect(out.daValidare.map((r) => r.id)).toEqual(['coda']);
    expect(out.validate.map((r) => r.id)).toEqual(['val-a']);
  });
});

describe('refresh stelline', () => {
  it('il caposquadra non lo chiede, il manager sì', () => {
    expect(deveRichiedereRefreshSkill(false)).toBe(false);
    expect(deveRichiedereRefreshSkill(true)).toBe(true);
  });
});
