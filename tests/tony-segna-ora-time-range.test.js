import { describe, it, expect } from 'vitest';
import {
  matchSegnaOraTimeRangeFromBlob,
  matchSegnaOraSingleTimeFromBlob,
  matchSegnaOraBareHourFromBlob,
  matchSegnaOraTimeRangeFromUserTexts,
} from '../core/js/tony/engine.js';

function toTimes(m) {
  if (!m) return null;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  const h1 = parseInt(m[1], 10);
  const mi1 = m[2] ? parseInt(m[2], 10) : 0;
  const h2 = parseInt(m[3], 10);
  const mi2 = m[4] ? parseInt(m[4], 10) : 0;
  return {
    start: pad(h1) + ':' + pad(mi1),
    end: pad(h2) + ':' + pad(mi2),
  };
}

describe('matchSegnaOraTimeRangeFromBlob', () => {
  it('dalle 7 alle 18', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('dalle 7 alle 18'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('alle 8 e finito alle 19 con pausa', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('alle 8 e finito alle 19 con 60 min di pausa'))).toEqual({
      start: '08:00',
      end: '19:00',
    });
  });

  it('ho iniziato alle 7 e finito alle 18', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('ho iniziato alle 7 e finito alle 18'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('ignora segniamo le ore senza orari', () => {
    expect(matchSegnaOraTimeRangeFromBlob('segniamo le ore')).toBeNull();
  });

  it('typo vocali daklle 6 aslle 18', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('daklle 6 aslle 18'))).toEqual({
      start: '06:00',
      end: '18:00',
    });
  });

  it('conferma Tony dalle 06:00 alle 18:00', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('Ok, dalle 06:00 alle 18:00. Quanti minuti di pausa?'))).toEqual({
      start: '06:00',
      end: '18:00',
    });
  });

  it('riconosce intento segniamo le ore', () => {
    expect(/segn\w*\s+le\s+ore/i.test('segniamo le ore')).toBe(true);
    expect(/segn\w*\s+le\s+ore/i.test('segno le ore')).toBe(true);
  });

  it('singolo alle 7', () => {
    expect(matchSegnaOraSingleTimeFromBlob('alle 7')).toEqual(
      expect.arrayContaining(['alle 7', '7', '', 'unknown'])
    );
    expect(matchSegnaOraTimeRangeFromBlob('alle 7')).toBeNull();
  });

  it('ora nuda 18 con inizio già impostato → fine', () => {
    expect(matchSegnaOraBareHourFromBlob('18', { hasStart: true, hasEnd: false })).toEqual(
      expect.arrayContaining(['18', '18', '', 'end'])
    );
  });

  it('accetta 18,30 e 18 30 come orario fine', () => {
    expect(matchSegnaOraBareHourFromBlob('18,30', { hasStart: true, hasEnd: false })).toEqual(
      expect.arrayContaining(['18,30', '18', '30', 'end'])
    );
    expect(matchSegnaOraBareHourFromBlob('18 30', { hasStart: true, hasEnd: false })).toEqual(
      expect.arrayContaining(['18 30', '18', '30', 'end'])
    );
    expect(matchSegnaOraSingleTimeFromBlob('alle 18,30')).toEqual(
      expect.arrayContaining(['alle 18,30', '18', '30', 'unknown'])
    );
  });

  it('ora nuda 7 senza inizio → inizio', () => {
    expect(matchSegnaOraBareHourFromBlob('7', { hasStart: false, hasEnd: false })).toEqual(
      expect.arrayContaining(['7', '7', '', 'start'])
    );
  });

  it('numero >23 con fine mancante non è ora', () => {
    expect(matchSegnaOraBareHourFromBlob('60', { hasStart: true, hasEnd: false })).toBeNull();
  });

  it('turni separati alle 7 poi alle 18', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromUserTexts(['segniamo le ore', 'alle 7', 'alle 18']))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('non confonde ordine con messaggio duplicato in coda', () => {
    expect(
      toTimes(matchSegnaOraTimeRangeFromUserTexts(['segniamo le ore', 'alle 7', 'alle 18', 'alle 18']))
    ).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });
});
