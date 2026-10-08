import { describe, it, expect } from 'vitest';
import {
  risolviLavoroDaTesto,
  messaggioSceltaLavoroOre,
  risolviValoreSelectLavoro,
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
