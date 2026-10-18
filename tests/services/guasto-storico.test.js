import { describe, expect, it } from 'vitest';
import {
  aggiungiVoceStorico,
  buildAnnullaPatch,
  buildRisoltoDaMePatch,
  buildVoceStorico
} from '../../core/services/guasto-storico.js';

/** Elenco delle rules, righe 460-461. Una chiave nuova va rifiutata. */
const CHIAVI_SEGNALATORE = [
  'stato',
  'dettagli',
  'noteRisoluzione',
  'costoRiparazione',
  'risolto',
  'risoltoDa',
  'risoltoIl',
  'annullatoDa',
  'annullatoIl',
  'storico',
  'noteAggiuntive',
  'updatedAt'
];

function chiaviAmmesse(patch) {
  expect(Object.keys(patch).every((k) => CHIAVI_SEGNALATORE.includes(k))).toBe(true);
}

describe('storico', () => {
  it('la voce porta la Date e la nota vuota diventa null', () => {
    const now = new Date('2026-10-17T08:00:00Z');
    const voce = buildVoceStorico({ azione: 'segnalato', uid: 'u1', now, nota: '  ' });
    expect(voce).toEqual({ azione: 'segnalato', da: 'u1', il: now, nota: null });
    expect(voce.il).toBeInstanceOf(Date);
  });

  it('senza storico parte da un array di una voce', () => {
    const voce = buildVoceStorico({ azione: 'annullato', uid: 'u1', now: new Date(), nota: 'sbagliato' });
    expect(aggiungiVoceStorico(null, voce)).toEqual([voce]);
    expect(aggiungiVoceStorico(undefined, voce)).toEqual([voce]);
    expect(aggiungiVoceStorico('no', voce)).toEqual([voce]);
  });

  it('accoda la voce e non modifica lo storico originale', () => {
    const now = new Date('2026-10-17T09:00:00Z');
    const originale = [{ azione: 'segnalato', da: 'u1', il: now, nota: null }];
    const copia = originale.slice();
    const voce = buildVoceStorico({ azione: 'annullato', uid: 'u1', now, nota: null });
    const nuovo = aggiungiVoceStorico(originale, voce);
    expect(originale).toEqual(copia);
    expect(nuovo).toHaveLength(2);
    expect(nuovo[0]).toBe(originale[0]);
    expect(nuovo[1]).toBe(voce);
  });
});

describe('patch del segnalatore', () => {
  const now = new Date('2026-10-17T10:00:00Z');

  it('annulla con storico e updatedAt, senza campi fuori elenco', () => {
    const patch = buildAnnullaPatch({
      uid: 'u1',
      now,
      nota: 'non era un guasto',
      storico: []
    });
    expect(patch.stato).toBe('annullato');
    expect(patch.annullatoDa).toBe('u1');
    expect(patch.annullatoIl).toBe(now);
    expect(patch.updatedAt).toBe(now);
    expect(patch.storico[0].azione).toBe('annullato');
    expect(patch.storico[0].nota).toBe('non era un guasto');
    expect(patch.notaAnnullamento).toBeUndefined();
    chiaviAmmesse(patch);
  });

  it('rifiuta Risolto da me se la nota è vuota o solo spazi', () => {
    expect(buildRisoltoDaMePatch({ uid: 'u1', now, nota: '', costo: 10, storico: [] }).ok).toBe(false);
    const spazi = buildRisoltoDaMePatch({ uid: 'u1', now, nota: '   ', costo: 0, storico: [] });
    expect(spazi.ok).toBe(false);
    expect(spazi.errore).toBeTruthy();
  });

  it('tiene il costo zero e scarta negativo o non numerico', () => {
    const zero = buildRisoltoDaMePatch({ uid: 'u1', now, nota: 'fatto', costo: 0, storico: [] });
    expect(zero.ok).toBe(true);
    expect(zero.patch.costoRiparazione).toBe(0);
    expect(zero.patch.stato).toBe('risolto');
    expect(zero.patch.risolto).toBe(true);
    expect(zero.patch.noteRisoluzione).toBe('fatto');
    expect(zero.patch.storico[0].azione).toBe('risolto_da_segnalatore');
    chiaviAmmesse(zero.patch);

    const negativo = buildRisoltoDaMePatch({ uid: 'u1', now, nota: 'fatto', costo: -5, storico: [] });
    expect(negativo.patch.costoRiparazione).toBeUndefined();
    chiaviAmmesse(negativo.patch);

    const testo = buildRisoltoDaMePatch({ uid: 'u1', now, nota: 'fatto', costo: 'abc', storico: [] });
    expect(testo.patch.costoRiparazione).toBeUndefined();
    chiaviAmmesse(testo.patch);

    const assente = buildRisoltoDaMePatch({ uid: 'u1', now, nota: 'fatto', storico: [] });
    expect(assente.patch.costoRiparazione).toBeUndefined();
    chiaviAmmesse(assente.patch);
  });
});
