import { describe, it, expect } from 'vitest';
import {
  risolviLavoroDaTesto,
  messaggioSceltaLavoroOre,
  risolviValoreSelectLavoro,
  eDiOggi,
  testoRiepilogoHaLavoro,
  unisciAvvisoSovrapposizioneELavoro,
  riepilogoSegnaOreAmmesso,
  lavoroDaSceltaUi,
} from '../core/js/tony/tony-ora-lavoro-match.js';

const OGGI = '2026-10-08';

describe('risolviLavoroDaTesto', () => {
  const lista = [
    { id: 'tr', nome: 'Trinciatura Vigna di Sant\'Albino (ripresa)', tipoLavoro: 'Trinciatura', dataInizio: '2026-10-13' },
    { id: 'rip', nome: 'Ripristino pali', tipoLavoro: 'Ripristino', dataInizio: OGGI },
  ];

  it('«sul ripristino pali» sceglie Ripristino anche se Trinciatura è prima', () => {
    const esito = risolviLavoroDaTesto('segnami dalle 17:00 alle 17:30 oggi sul ripristino pali, nessuna pausa', lista, { oggiIso: OGGI });
    expect(esito.stato).toBe('unico');
    expect(esito.lavoro.id).toBe('rip');
  });

  it('due lavori «Ripristino pali …» sono ambigui', () => {
    const due = [
      { id: 'n', nome: 'Ripristino pali vigna nord', dataInizio: OGGI },
      { id: 'f', nome: 'Ripristino pali frutteto', dataInizio: OGGI },
    ];
    const esito = risolviLavoroDaTesto('sul ripristino pali', due, { oggiIso: OGGI });
    expect(esito.stato).toBe('ambiguo');
    expect(esito.lavoro).toBeNull();
    expect(messaggioSceltaLavoroOre(esito)).toMatch(/Su quale lavoro/);
    expect(messaggioSceltaLavoroOre(esito)).toMatch(/Ripristino pali vigna nord/);
  });

  it('nessun abbinamento', () => {
    const esito = risolviLavoroDaTesto('sul raccolto delle olive', lista, { oggiIso: OGGI });
    expect(esito.stato).toBe('nessuno');
    expect(esito.nominato).toBe(true);
    expect(esito.lavoro).toBeNull();
    expect(messaggioSceltaLavoroOre(esito)).toMatch(/Non trovo un lavoro/);
  });

  it('lavoro di domani nominato e unico viene scelto', () => {
    const lavori = [
      { id: 'oggi', nome: 'Potatura', dataInizio: OGGI },
      { id: 'domani', nome: 'Ripristino pali', dataInizio: '2026-10-09' },
    ];
    const esito = risolviLavoroDaTesto('sul ripristino pali', lavori, { oggiIso: OGGI });
    expect(esito.stato).toBe('unico');
    expect(esito.lavoro.id).toBe('domani');
  });

  it('lavoro di domani non nominato non viene mai scelto', () => {
    const lavori = [
      { id: 'domani', nome: 'Trinciatura Vigna di Sant\'Albino (ripresa)', dataInizio: '2026-10-13' },
    ];
    const esito = risolviLavoroDaTesto('dalle 17:00 alle 17:30 oggi nessuna pausa', lavori, { oggiIso: OGGI });
    expect(esito.stato).toBe('nessuno');
    expect(esito.lavoro).toBeNull();
    expect(esito.nominato).toBe(false);
  });

  const FRASE_RITEST = 'segnami dalle 17:00 alle 17:30 oggi sul ripristino pali, nessuna pausa';

  function listaRitest(dataSecondo, dataQuarto) {
    return [
      { id: 'tr', nome: 'Trinciatura Vigna di Sant\'Albino (ripresa)', dataInizio: '2026-10-13' },
      { id: 'grazie', nome: 'Ripristino pali Grazie (ripresa)', dataInizio: dataSecondo },
      { id: 'man', nome: 'Manutenzione', dataInizio: '2026-10-09' },
      { id: 'oggi', nome: 'Ripristino pali', dataInizio: dataQuarto },
    ];
  }

  it('a parità di nome sceglie il Ripristino di oggi, mai la Trinciatura', () => {
    const esito = risolviLavoroDaTesto(FRASE_RITEST, listaRitest('2026-10-10', OGGI), { oggiIso: OGGI });
    expect(esito.stato).toBe('unico');
    expect(esito.lavoro.id).toBe('oggi');
    expect(esito.lavoro.id).not.toBe('tr');
  });

  it('due Ripristino pali entrambi di oggi restano ambigui', () => {
    const due = [
      { id: 'a', nome: 'Ripristino pali Grazie (ripresa)', dataInizio: OGGI },
      { id: 'b', nome: 'Ripristino pali', dataInizio: OGGI },
    ];
    const esito = risolviLavoroDaTesto(FRASE_RITEST, due, { oggiIso: OGGI });
    expect(esito.stato).toBe('ambiguo');
    expect(esito.lavoro).toBeNull();
    expect(esito.candidati.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('due Ripristino pali nessuno di oggi: ambiguo, mai il primo della lista', () => {
    const esito = risolviLavoroDaTesto(FRASE_RITEST, listaRitest('2026-10-10', '2026-10-13'), { oggiIso: OGGI });
    expect(esito.stato).toBe('ambiguo');
    expect(esito.lavoro).toBeNull();
    expect(esito.candidati.map((l) => l.id)).not.toContain('tr');
    expect(esito.candidati.map((l) => l.id).sort()).toEqual(['grazie', 'oggi']);
  });

  it('due Ripristino pali senza data non contano come oggi', () => {
    const due = [
      { id: 'a', nome: 'Ripristino pali Grazie (ripresa)' },
      { id: 'b', nome: 'Ripristino pali' },
    ];
    const esito = risolviLavoroDaTesto('sul ripristino pali', due, { oggiIso: OGGI });
    expect(esito.stato).toBe('ambiguo');
    expect(esito.lavoro).toBeNull();
    expect(eDiOggi(due[0], OGGI)).toBe(false);
    expect(eDiOggi(due[1], OGGI)).toBe(false);
  });

  it('senza lavori di oggi il messaggio elenca i disponibili', () => {
    const lavori = [
      { id: 'a', nome: 'Potatura domani', dataInizio: '2026-10-09' },
    ];
    const esito = risolviLavoroDaTesto('sul raccolto delle olive', lavori, { oggiIso: OGGI });
    expect(messaggioSceltaLavoroOre(esito)).toMatch(/I lavori disponibili sono/);
    expect(messaggioSceltaLavoroOre(esito)).not.toMatch(/I lavori di oggi sono/);
  });

  it('Tutto pronto senza il nome del lavoro non è accettabile', () => {
    const testo = 'Tutto pronto: dalle 17:00 alle 17:30, pausa 0 min. Vuoi salvare?';
    expect(testoRiepilogoHaLavoro(testo, '')).toBe(false);
    expect(testoRiepilogoHaLavoro(testo, 'Ripristino pali')).toBe(false);
    expect(testoRiepilogoHaLavoro('Tutto pronto: Ripristino pali, dalle 17:00 alle 17:30.', 'Ripristino pali')).toBe(true);
    expect(testoRiepilogoHaLavoro('Quanti minuti di pausa?', 'Ripristino pali')).toBe(true);
  });

  it('la sovrapposizione chiede anche il lavoro se non è uno solo', () => {
    const avviso = 'Dalle 10:00 alle 11:00 ti sovrapponi al turno 09:00–12:00 su «altro». Il primo orario libero di 1 ora è dalle 12:00 alle 13:00. Va bene?';
    const esito = {
      stato: 'ambiguo',
      candidati: [
        { id: 'a', nome: 'Ripristino pali Grazie (ripresa)' },
        { id: 'b', nome: 'Ripristino pali' },
      ],
    };
    const msg = unisciAvvisoSovrapposizioneELavoro(avviso, esito);
    expect(msg).toMatch(/Va bene\?/);
    expect(msg).toMatch(/E su quale lavoro: Ripristino pali Grazie \(ripresa\) o Ripristino pali\?/);
  });

  it('il refuso «daklle / aslle» non è un nome di lavoro', () => {
    const esito = risolviLavoroDaTesto('daklle 6 aslle 18', lista, { oggiIso: OGGI });
    expect(esito.stato).toBe('nessuno');
    expect(esito.nominato).toBe(false);
  });

  function listaRitestSospesi() {
    return [
      { id: 'tr-rip', nome: 'Trinciatura vigna (ripresa)', tipoLavoro: 'Trinciatura', dataInizio: '2026-10-13', stato: 'assegnato', ripresaDaLavoroId: 'tr-sosp' },
      { id: 'rip-rip', nome: 'Ripristino pali Grazie (ripresa)', dataInizio: '2026-10-10', stato: 'assegnato', ripresaDaLavoroId: 'rip-sosp' },
      { id: 'man', nome: 'Manutenzione attrezzi', dataInizio: '2026-10-09', stato: 'assegnato' },
      { id: 'rip-sosp', nome: 'Ripristino pali', dataInizio: '2026-10-08', stato: 'sospeso' },
      { id: 'tr-sosp', nome: 'Trinciatura vigna', dataInizio: '2026-10-07', stato: 'sospeso' },
    ];
  }

  it('«sul ripristino pali» con il sospeso di oggi non è unico e propone la ripresa', () => {
    const esito = risolviLavoroDaTesto(FRASE_RITEST, listaRitestSospesi(), { oggiIso: OGGI });
    expect(esito.stato).toBe('sospeso');
    expect(esito.lavoro).toBeNull();
    expect(esito.lavoroSospeso.id).toBe('rip-sosp');
    expect((esito.candidati || []).map((l) => l.id)).not.toContain('tr-rip');
    expect((esito.candidati || [])[0].id).toBe('rip-rip');
    const msg = messaggioSceltaLavoroOre(esito);
    expect(msg).toMatch(/sospeso/i);
    expect(msg).toMatch(/Ripristino pali \(08\/10\)/);
    expect(msg).toMatch(/Ripristino pali Grazie \(ripresa\)/);
    expect(msg).not.toMatch(/Tutto pronto/i);
    expect(msg).not.toMatch(/Trinciatura/i);
  });

  it('«sul ripristino pali grazie» sceglie la ripresa nominata', () => {
    const esito = risolviLavoroDaTesto('segnami dalle 17:00 alle 17:30 oggi sul ripristino pali grazie, nessuna pausa', listaRitestSospesi(), { oggiIso: OGGI });
    expect(esito.stato).toBe('unico');
    expect(esito.lavoro.id).toBe('rip-rip');
  });

  it('due Ripristino pali segnabili, uno di oggi: unico su quello di oggi', () => {
    const due = [
      { id: 'altro', nome: 'Ripristino pali Grazie (ripresa)', dataInizio: '2026-10-10', stato: 'assegnato' },
      { id: 'oggi', nome: 'Ripristino pali', dataInizio: OGGI, stato: 'assegnato' },
    ];
    const esito = risolviLavoroDaTesto(FRASE_RITEST, due, { oggiIso: OGGI });
    expect(esito.stato).toBe('unico');
    expect(esito.lavoro.id).toBe('oggi');
  });

  it('sospeso senza ripresa e senza altri abbinamenti chiede su quale lavoro', () => {
    const solo = [
      { id: 's', nome: 'Ripristino pali', dataInizio: '2026-10-07', stato: 'sospeso' },
      { id: 'm', nome: 'Manutenzione attrezzi', dataInizio: '2026-10-09', stato: 'assegnato' },
    ];
    const esito = risolviLavoroDaTesto('sul ripristino pali', solo, { oggiIso: OGGI });
    expect(esito.stato).toBe('sospeso');
    expect(esito.candidati).toEqual([]);
    expect(messaggioSceltaLavoroOre(esito)).toMatch(/Su quale lavoro segno le ore\?/);
    expect(messaggioSceltaLavoroOre(esito)).toMatch(/sospeso/i);
  });

  it('il filtro sostituisce Tutto pronto senza nome e lascia quello con il nome', () => {
    const testoRitest = 'Tutto pronto: dalle 17:00 alle 17:30, pausa 0 min. Vuoi salvare? Scrivi «sì» o «salva».';
    const senza = riepilogoSegnaOreAmmesso({
      esito: { stato: 'sospeso', lavoro: null },
      nomeLavoro: '',
      testo: testoRitest,
      domanda: 'Su quale lavoro segno le ore?',
    });
    expect(senza.ammesso).toBe(false);
    expect(senza.testo).toBe('Su quale lavoro segno le ore?');
    expect(senza.testo).not.toMatch(/Tutto pronto/i);
    const conNome = 'Tutto pronto: Ripristino pali, dalle 17:00 alle 17:30, pausa 0 min, Fiat e Berti. Vuoi salvare? Scrivi «sì» o «salva».';
    const con = riepilogoSegnaOreAmmesso({
      esito: { stato: 'unico', lavoro: { id: 'rip', nome: 'Ripristino pali' } },
      nomeLavoro: 'Ripristino pali',
      testo: conNome,
      domanda: 'Su quale lavoro segno le ore?',
    });
    expect(con.ammesso).toBe(true);
    expect(con.testo).toBe(conNome);
  });

  it('la scelta in pagina senza nome non è un lavoro unico', () => {
    expect(lavoroDaSceltaUi('abc', null, '')).toBeNull();
    expect(lavoroDaSceltaUi('abc', { id: 'abc', nome: '' }, 'Seleziona lavoro...')).toBeNull();
    const ok = lavoroDaSceltaUi('abc', null, 'Ripristino pali');
    expect(ok.id).toBe('abc');
    expect(ok.nome).toBe('Ripristino pali');
  });

  it('il select non ripiega sulla prima opzione', () => {
    const opzioni = [
      { value: '', text: 'Seleziona lavoro...' },
      { value: 'tr', text: 'Trinciatura Vigna di Sant\'Albino (ripresa)' },
      { value: 'rip', text: 'Ripristino pali' },
    ];
    expect(risolviValoreSelectLavoro('rip', opzioni)).toBe('rip');
    expect(risolviValoreSelectLavoro('qualcosa che non c\'è', opzioni)).toBeNull();
    expect(risolviValoreSelectLavoro('ripristino pali', opzioni)).toBe('rip');
  });
});
