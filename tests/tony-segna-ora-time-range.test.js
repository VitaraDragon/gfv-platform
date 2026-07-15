import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  matchSegnaOraTimeRangeFromBlob,
  matchSegnaOraSingleTimeFromBlob,
  matchSegnaOraBareHourFromBlob,
  matchSegnaOraTimeRangeFromUserTexts,
  matchSegnaOraIncompleteDallePausaFromBlob,
  normalizeSegnaOraSttBlob,
  isSegnaOraUntrustedPartialStart,
  repairSegnaOraVoiceTranscript,
  reconstructSegnaOraItnClockRange,
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

  it('typo vocali daklle 6 aslle 18 (T-TYPO-001)', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('daklle 6 aslle 18'))).toEqual({
      start: '06:00',
      end: '18:00',
    });
  });

  it('variante dalle 6 al 18 (T-TYPO-002)', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('dalle 6 al 18'))).toEqual({
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

  it('orario inizio/fine nello stesso messaggio', () => {
    expect(
      toTimes(matchSegnaOraTimeRangeFromBlob('orario inizio 7, orario fine 18, pausa 30'))
    ).toEqual({ start: '07:00', end: '18:00' });
  });

  it('dalle 17:53 con pausa: normalizzazione non produce inizio spurio', () => {
    expect(matchSegnaOraIncompleteDallePausaFromBlob('Ora è dalle 17:53 con 45 minuti di pausa.')).toBeNull();
  });

  it('dalle 7 alle Dalle 17:53 pausa 45: ignora orologio spurio', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('dalle 7 alle Dalle 17:53 pausa 45'))).toBeNull();
    const p = matchSegnaOraIncompleteDallePausaFromBlob('dalle 7 alle Dalle 17:53 pausa 45');
    expect(p).not.toBeNull();
    expect(p.startH).toBe(7);
    expect(p.pauseMin).toBe(45);
    expect(p.untrustedStart).toBe(false);
  });

  it('dalle 7 alle 18 con 45 min di pausa', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('dalle 7 alle 18 con 45 minuti di pausa'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('STT vocale: dalle 7 e alle 18 con pausa (congiunzione «e»)', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('segna le ore dalle 7 e alle 18 con 45 min di pausa'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('STT vocale: dalle 7, alle 18 con pausa (virgola)', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('segna le ore dalle 7, alle 18 con 45 min di pausa'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('STT vocale: dalle 7 fino alle 18', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('dalle 7 fino alle 18 pausa 30'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('fascia dalle/alle non viene rimossa se coincide con ora corrente (intero)', () => {
    const now = new Date();
    const h = now.getHours();
    const end = h < 20 ? h + 2 : Math.max(0, h - 2);
    const blob = 'segna le ore dalle ' + h + ' alle ' + end + ' con 30 min di pausa';
    expect(toTimes(matchSegnaOraTimeRangeFromBlob(blob))).toEqual({
      start: (h < 10 ? '0' : '') + h + ':00',
      end: (end < 10 ? '0' : '') + end + ':00',
    });
  });

  it('dalle 7 alle 18 pausa 30: repair non rimuove fascia valida', () => {
    expect(repairSegnaOraVoiceTranscript('dalle 7 alle 18 pausa 30')).toBe('dalle 7 alle 18 pausa 30');
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('dalle 7 alle 18 pausa 30'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('inizia alle 7 fine alle 18', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('inizia alle 07:00 fine alle 18:00 pausa 45'))).toEqual({
      start: '07:00',
      end: '18:00',
    });
  });

  it('repair vocale: non tocca dalle 7 alle 18', () => {
    expect(repairSegnaOraVoiceTranscript('dalle 7 alle 18 pausa 30')).toBe('dalle 7 alle 18 pausa 30');
  });

  it('fascia esplicita con minuti liberi: dalle 7:15 alle 18', () => {
    expect(toTimes(matchSegnaOraTimeRangeFromBlob('dalle 7:15 alle 18'))).toEqual({
      start: '07:15',
      end: '18:00',
    });
  });
});

describe('orologio spurio STT (ora corrente inserita dal vocale)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 17, 53, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('repair vocale: rimuove dalle 17:53 spuria (= ora corrente)', () => {
    expect(repairSegnaOraVoiceTranscript('Ora è dalle 17:53 con 45 minuti di pausa.'))
      .toBe('Ora è con 45 minuti di pausa.');
  });

  it('repair vocale: «Segna dalle 17:53» (= ora corrente) non collassa in «Segna .»', () => {
    expect(repairSegnaOraVoiceTranscript('Segna dalle 17:53.')).toBe('segna le ore');
    expect(repairSegnaOraVoiceTranscript('Segna dalle 17:53 con 30 minuti di pausa.'))
      .toBe('segna le ore con 30 minuti di pausa');
  });

  it('nessuna ricostruzione ITN se l\'orario coincide con l\'orologio', () => {
    expect(reconstructSegnaOraItnClockRange('Segna dalle 17:53 con 30 minuti di pausa.')).toBeNull();
  });
});

describe('ricostruzione ITN «dalle H:MM» (STT fonde «dalle X alle Y»)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 16, 16, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dalle 18:53 → dalle 7 alle 19 (caso reale STT)', () => {
    expect(reconstructSegnaOraItnClockRange('Segna dalle 18:53 con 20 minuti di pausa.')).toEqual({
      startH: 7,
      endH: 19,
      pauseMin: 20,
    });
    expect(repairSegnaOraVoiceTranscript('Segna dalle 18:53 con 20 minuti di pausa.'))
      .toBe('segna le ore dalle 7 alle 19 con 20 minuti di pausa');
  });

  it('la fascia ricostruita viene poi parsata correttamente', () => {
    const repaired = repairSegnaOraVoiceTranscript('Segna dalle 18:53 con 20 minuti di pausa.');
    expect(toTimes(matchSegnaOraTimeRangeFromBlob(repaired))).toEqual({
      start: '07:00',
      end: '19:00',
    });
  });

  it('senza «segna»: dalle 17:54 pausa 30 → dalle 6 alle 18', () => {
    expect(repairSegnaOraVoiceTranscript('dalle 17:54 pausa 30'))
      .toBe('dalle 6 alle 18 con 30 minuti di pausa');
  });

  it('dalle 16:45 → dalle 15 alle 17 (turno pomeridiano)', () => {
    expect(reconstructSegnaOraItnClockRange('dalle 16:45')).toEqual({
      startH: 15,
      endH: 17,
      pauseMin: null,
    });
  });

  it('non ricostruisce con minuti 0/30 (orario di lavoro plausibile)', () => {
    expect(reconstructSegnaOraItnClockRange('dalle 6:30 pausa 20')).toBeNull();
    expect(reconstructSegnaOraItnClockRange('dalle 7:00 pausa 20')).toBeNull();
  });

  it('non ricostruisce se c\'è già una fine esplicita «alle N»', () => {
    expect(reconstructSegnaOraItnClockRange('dalle 7:15 alle 18')).toBeNull();
  });

  it('non ricostruisce fasce implausibili (inizio ≥ fine)', () => {
    // 20:59 → start 1, end 21 ok; 5:40 → start 20, end 6 → rifiutata
    expect(reconstructSegnaOraItnClockRange('dalle 5:40')).toBeNull();
  });
});
