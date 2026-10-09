import { describe, it, expect } from 'vitest';
import {
  SEGNA_ORE_ASK_FALLBACK,
  buildSegnaOreMissingFieldsMessage,
  listSegnaOreMissingRequired,
  userBlobAcknowledgesZeroPause,
  extractSegnaOrePauseMinutesFromUserBlob,
  getSegnaOreDomFieldIds,
  filtraCampiMezzoNonNominati,
  interpretaEsitoSalvataggioOra,
  messaggioConfermaSalvataggioOra,
  riepilogoRipristinatoScaduto,
  togliConfermeSalvataggioVecchie,
} from '../core/js/tony/tony-segna-ora-local-engine.js';

describe('tony-segna-ora-local-engine', () => {
  it('SEGNA_ORE_ASK_FALLBACK elenca tutti i campi principali', () => {
    expect(SEGNA_ORE_ASK_FALLBACK).toMatch(/inizio/i);
    expect(SEGNA_ORE_ASK_FALLBACK).toMatch(/fine/i);
    expect(SEGNA_ORE_ASK_FALLBACK).toMatch(/pausa/i);
  });

  it('listSegnaOreMissingRequired — tutti i campi se stato vuoto', () => {
    var missing = listSegnaOreMissingRequired({
      lavoroVal: '',
      dateVal: '',
      startVal: '',
      endVal: '',
      pauseVal: '',
    });
    expect(missing).toContain('data');
    expect(missing).toContain('orario di inizio');
    expect(missing).toContain('orario di fine');
  });

  it('listSegnaOreMissingRequired — solo pausa se orari ok', () => {
    var missing = listSegnaOreMissingRequired({
      lavoroVal: 'abc',
      dateVal: '2026-07-11',
      startVal: '07:00',
      endVal: '18:00',
      pauseVal: '',
    }, { requireLavoro: false });
    expect(missing).toEqual(['minuti di pausa']);
  });

  it('buildSegnaOreMissingFieldsMessage — richiesta raggruppata', () => {
    var msg = buildSegnaOreMissingFieldsMessage({
      lavoroVal: 'x',
      dateVal: '2026-07-11',
      startVal: '',
      endVal: '',
      pauseVal: '',
    }, { requireLavoro: false });
    expect(msg).toMatch(/Mi servono:/);
    expect(msg).toMatch(/inizio/);
    expect(msg).toMatch(/fine/);
  });

  it('buildSegnaOreMissingFieldsMessage — conferma save se completo', () => {
    var msg = buildSegnaOreMissingFieldsMessage({
      lavoroVal: 'x',
      dateVal: '2026-07-11',
      startVal: '07:00',
      endVal: '18:00',
      pauseVal: '0',
    }, { requireLavoro: false, pauseAcknowledged: true, lavoroNome: 'Ripristino pali' });
    expect(msg).toMatch(/salvare/i);
    expect(msg).toMatch(/Ripristino pali/);
  });

  it('buildSegnaOreMissingFieldsMessage — il riepilogo dice il lavoro', () => {
    var msg = buildSegnaOreMissingFieldsMessage({
      lavoroVal: 'rip',
      dateVal: '2026-10-08',
      startVal: '17:00',
      endVal: '17:30',
      pauseVal: '0',
    }, {
      requireLavoro: true,
      pauseAcknowledged: true,
      lavoroNome: 'Ripristino pali',
      macchinaNome: 'Fiat 880 DT',
      attrezzoNome: 'Berti',
      oggiIso: '2026-10-09',
    });
    expect(msg).toMatch(/Tutto pronto: Ripristino pali, ieri 08\/10, dalle 17:00 alle 17:30, pausa 0 min, Fiat 880 DT e Berti/);
    expect(msg).toMatch(/Vuoi salvare/);
  });

  it('senza nome del lavoro non dice Tutto pronto', () => {
    var msg = buildSegnaOreMissingFieldsMessage({
      lavoroVal: 'abc',
      dateVal: '2026-10-08',
      startVal: '17:00',
      endVal: '17:30',
      pauseVal: '0',
    }, { pauseAcknowledged: true, lavoroNome: '' });
    expect(msg).not.toMatch(/Tutto pronto/i);
    expect(msg).toMatch(/Su quale lavoro/);
  });

  it('userBlobAcknowledgesZeroPause', () => {
    expect(userBlobAcknowledgesZeroPause('0')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('nessuna pausa')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('30')).toBe(false);
  });

  it('extractSegnaOrePauseMinutesFromUserBlob — vocale «con pausa 30»', () => {
    expect(extractSegnaOrePauseMinutesFromUserBlob('dalle 7:00 alle 17:30 con pausa 30')).toBe(30);
    expect(extractSegnaOrePauseMinutesFromUserBlob('dalle 6 alle 18 con 30 min di pausa')).toBe(30);
    expect(extractSegnaOrePauseMinutesFromUserBlob('dalle 6 alle 18')).toBeNull();
  });

  it('getSegnaOreDomFieldIds — mobile vs desktop', () => {
    expect(getSegnaOreDomFieldIds('quick-hours').start).toBe('ora-start');
    expect(getSegnaOreDomFieldIds('ora-modal').start).toBe('ora-inizio');
  });

  it('la pausa 0 del form non conta finché non è confermata', () => {
    var missing = listSegnaOreMissingRequired({
      lavoroVal: 'abc',
      dateVal: '2026-10-08',
      startVal: '10:00',
      endVal: '11:00',
      pauseVal: '0',
    }, { requireLavoro: false });
    expect(missing).toEqual(['minuti di pausa']);
    var ok = listSegnaOreMissingRequired({
      lavoroVal: 'abc',
      dateVal: '2026-10-08',
      startVal: '10:00',
      endVal: '11:00',
      pauseVal: '0',
    }, { requireLavoro: false, pauseAcknowledged: true });
    expect(ok).toEqual([]);
  });

  it('userBlobAcknowledgesZeroPause riconosce pausa 0 nella frase', () => {
    expect(userBlobAcknowledgesZeroPause('dalle 10 alle 11 pausa 0')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('pausa 0')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('senza pausa')).toBe(true);
  });

  it('filtraCampiMezzoNonNominati scarta i mezzi non detti e tiene quelli nominati', () => {
    var conMezzi = {
      'ora-lavoro': 'lav1',
      'ora-macchina': 'Landini',
      'ora-attrezzo': 'rimorchio',
      'ora-ore-macchina': '2',
    };
    var scartati = filtraCampiMezzoNonNominati(conMezzi, 'dalle 10 alle 11 pausa 0');
    expect(scartati['ora-lavoro']).toBe('lav1');
    expect(scartati['ora-macchina']).toBeUndefined();
    expect(scartati['ora-attrezzo']).toBeUndefined();
    expect(scartati['ora-ore-macchina']).toBeUndefined();

    var tenuti = filtraCampiMezzoNonNominati(conMezzi, 'uso il trattore Landini');
    expect(tenuti['ora-macchina']).toBe('Landini');
    expect(tenuti['ora-attrezzo']).toBe('rimorchio');
  });

  it('filtraCampiMezzoNonNominati scarta Landini e Rimorchio se il modello li copia e l’utente non li nomina', () => {
    var daModello = {
      'ora-lavoro': 'potatura',
      'ora-macchina': 'Landini',
      'ora-attrezzo': 'Rimorchio',
    };
    var senza = filtraCampiMezzoNonNominati(daModello, 'segna le ore dalle 10 alle 11 sul lavoro potatura');
    expect(senza['ora-lavoro']).toBe('potatura');
    expect(senza['ora-macchina']).toBeUndefined();
    expect(senza['ora-attrezzo']).toBeUndefined();

    var conLandini = filtraCampiMezzoNonNominati(daModello, 'segna le ore dalle 10 alle 11 sul lavoro potatura col Landini');
    expect(conLandini['ora-macchina']).toBe('Landini');
    expect(conLandini['ora-attrezzo']).toBe('Rimorchio');
  });

  it('interpretaEsitoSalvataggioOra distingue successo, errore e silenzio', () => {
    const attesa = interpretaEsitoSalvataggioOra({
      evento: { ok: true, stato: 'in_attesa', chiValida: 'caposquadra' },
    });
    expect(attesa.esito).toBe('ok_in_attesa');

    const validata = interpretaEsitoSalvataggioOra({
      evento: { ok: true, stato: 'validata' },
    });
    expect(validata.esito).toBe('ok_validata');

    const toastCapo = interpretaEsitoSalvataggioOra({
      toastTesti: ['Ora segnata con successo! In attesa — la valida il caposquadra.'],
    });
    expect(toastCapo.esito).toBe('ok_in_attesa');
    expect(toastCapo.chiValida).toBe('caposquadra');

    const toastManager = interpretaEsitoSalvataggioOra({
      toastTesti: ['Ora segnata con successo! In attesa — la valida il manager.'],
    });
    expect(toastManager.esito).toMatch(/^ok/);
    expect(toastManager.chiValida).toBe('manager');

    const sovrapposta = interpretaEsitoSalvataggioOra({
      evento: {
        ok: false,
        codice: 'ORE_SOVRAPPOSTE',
        messaggio: 'Ti sovrapponi a 06:00–06:30 su «Manutenzione» (in attesa).',
      },
    });
    expect(sovrapposta.esito).toBe('errore');
    expect(sovrapposta.messaggio).toMatch(/sovrappon/i);

    expect(interpretaEsitoSalvataggioOra({}).esito).toBe('sconosciuto');

    const oreSalvate = interpretaEsitoSalvataggioOra({
      statusTesto: 'Ore salvate: 0,5. Puoi registrare un altro turno.',
    });
    expect(oreSalvate.esito).toMatch(/^ok/);

    const erroreStato = interpretaEsitoSalvataggioOra({
      statusTesto: 'Errore salvataggio: rete assente',
    });
    expect(erroreStato.esito).toBe('errore');
    expect(erroreStato.messaggio).toMatch(/rete assente/);
  });

  it('messaggioConfermaSalvataggioOra dice il fatto, l’errore vero o il dubbio', () => {
    const base = {
      lavoroNome: 'Manutenzione attrezzi',
      dataIso: '2026-10-09',
      oggiIso: '2026-10-09',
      inizio: '06:00',
      fine: '06:30',
    };
    const inAttesa = messaggioConfermaSalvataggioOra({
      ...base,
      esito: 'ok_in_attesa',
      chiValida: 'caposquadra',
    });
    expect(inAttesa).toBe(
      'Fatto: ho segnato Manutenzione attrezzi, oggi 09/10, dalle 06:00 alle 06:30. Ora la valida il caposquadra.'
    );

    const giaValida = messaggioConfermaSalvataggioOra({ ...base, esito: 'ok_validata' });
    expect(giaValida).toBe('Fatto: ho segnato Manutenzione attrezzi, oggi 09/10, dalle 06:00 alle 06:30.');
    expect(giaValida).not.toMatch(/la valida/);

    const errore = messaggioConfermaSalvataggioOra({
      esito: 'errore',
      messaggioErrore: 'Ti sovrapponi a 06:00–06:30 su «Manutenzione» (in attesa).',
    });
    expect(errore).toMatch(/sovrappon/);
    expect(errore).not.toMatch(/Non vedo la conferma/);

    expect(messaggioConfermaSalvataggioOra({ esito: 'sconosciuto' })).toBe(
      'Non riesco a controllare il salvataggio. Guarda l\'elenco delle ore.'
    );
  });

  it('riepilogoRipristinatoScaduto chiude la domanda vecchia se non c’è conferma in memoria', () => {
    const history = [
      { role: 'user', parts: [{ text: 'segnami dalle 6 alle 6:30 oggi' }] },
      { role: 'model', parts: [{ text: 'Tutto pronto: Manutenzione, oggi 09/10. Vuoi salvare? Scrivi «sì» o «salva».' }] },
    ];
    const scaduto = riepilogoRipristinatoScaduto(history, false);
    expect(scaduto.scaduto).toBe(true);
    expect(scaduto.history).toHaveLength(3);
    expect(scaduto.history[2].parts[0].text).toMatch(/scaduta/);
    expect(riepilogoRipristinatoScaduto(history, true).scaduto).toBe(false);
    expect(riepilogoRipristinatoScaduto([
      { role: 'model', parts: [{ text: 'Ciao.' }] },
    ], false).scaduto).toBe(false);
    const dueVolte = riepilogoRipristinatoScaduto(scaduto.history, false);
    expect(dueVolte.history).toHaveLength(3);
  });

  it('toglie dalla chat salvata Tutto pronto, il sì e la nota scaduta', () => {
    const history = [
      { role: 'user', parts: [{ text: 'Ciao' }] },
      { role: 'model', parts: [{ text: 'Tutto pronto: Manutenzione, oggi 09/10. Vuoi salvare? Scrivi «sì» o «salva».' }] },
      { role: 'user', parts: [{ text: 'sì' }] },
      { role: 'model', parts: [{ text: 'Questa richiesta è scaduta. Dimmi di nuovo giorno, orario e lavoro.' }] },
      { role: 'model', parts: [{ text: 'Sono qui.' }] },
    ];
    const pulita = togliConfermeSalvataggioVecchie(history);
    expect(pulita.map((m) => m.parts[0].text)).toEqual(['Ciao', 'Sono qui.']);
    expect(history).toHaveLength(5);
  });
});
