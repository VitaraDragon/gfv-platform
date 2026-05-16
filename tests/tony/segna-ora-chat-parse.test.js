/**
 * Allineato a:
 * - core/js/tony/main.js → tonyRecoverSegnaOraFromChatHistory (regex + pausa)
 * - functions/index.js → extractSegnaOraFormDataFromConversation (stessi match orari)
 * Se modifichi lì, aggiorna anche questi test.
 */

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Estrae ora-inizio, ora-fine, ora-pause da un blob testuale (come recovery client). */
function parseQuickHoursFromBlob(blob) {
  if (!blob || typeof blob !== 'string') return null;
  var m = blob.match(/dalle\s+(\d{1,2})(?:[:.](\d{2}))?\s+alle\s+(\d{1,2})(?:[:.](\d{2}))?/i);
  if (!m) {
    m = blob.match(/(?:^|\s)(\d{1,2})(?:[:.](\d{2}))?\s+alle\s+(\d{1,2})(?:[:.](\d{2}))?\b/i);
  }
  if (!m) {
    m = blob.match(
      /(?:ho\s+)?(?:iniziato|inizio|cominciato|comincio)\s+alle\s+(\d{1,2})(?:[:.](\d{2}))?\s+e\s+(?:sono\s+)?(?:finito|fine|terminato)\s+alle\s+(\d{1,2})(?:[:.](\d{2}))?/i
    );
  }
  if (!m) {
    const sm = blob.match(/(?:ho\s+)?(?:iniziato|inizio|cominciato|comincio)\s+alle\s+(\d{1,2})(?:[:.](\d{2}))?/i);
    if (sm) {
      const fm = blob.match(/(?:finito|fine|terminato)\s+alle\s+(\d{1,2})(?:[:.](\d{2}))?/i);
      if (fm) {
        m = [sm[0] + ' … ' + fm[0], sm[1], sm[2] || '', fm[1], fm[2] || ''];
      } else {
        const alleMatches = [];
        const reAlle = /\balle\s+(\d{1,2})(?:[:.](\d{2}))?\b/gi;
        let am;
        while ((am = reAlle.exec(blob)) !== null) {
          alleMatches.push({
            h: parseInt(am[1], 10),
            mi: am[2] ? parseInt(am[2], 10) : 0,
            index: am.index
          });
        }
        if (alleMatches.length >= 2 && sm.index != null) {
          const sh = parseInt(sm[1], 10);
          const smi = sm[2] ? parseInt(sm[2], 10) : 0;
          const afterStart = alleMatches.filter((a) => a.index > sm.index);
          const cand = afterStart.length ? afterStart[afterStart.length - 1] : alleMatches[alleMatches.length - 1];
          if (cand && (cand.h !== sh || cand.mi !== smi)) {
            m = [blob, sm[1], sm[2] || '', String(cand.h), cand.mi ? String(cand.mi) : ''];
          }
        }
      }
    }
  }
  if (!m) return null;
  var h1 = parseInt(m[1], 10);
  var mi1 = m[2] ? parseInt(m[2], 10) : 0;
  var h2 = parseInt(m[3], 10);
  var mi2 = m[4] ? parseInt(m[4], 10) : 0;
  var fd = {
    'ora-inizio': pad(h1) + ':' + pad(mi1),
    'ora-fine': pad(h2) + ':' + pad(mi2)
  };
  var pm = blob.match(/(\d+)\s*min(?:uti)?(?:\s+di\s*pausa)?/i);
  if (pm) fd['ora-pause'] = String(parseInt(pm[1], 10));
  if (/un['']?ora\s+di\s+pausa/i.test(blob) && fd['ora-pause'] == null) fd['ora-pause'] = '60';
  return fd;
}

describe('Tony quick-hours: parsing orari da chat (recovery / CF extract)', () => {
  it('screenshot: dalle 7 alle 18 con 60 min di pausa', () => {
    const blob = 'ho fatto dalle 7 alle 18 con 60 min di pausa';
    const fd = parseQuickHoursFromBlob(blob);
    expect(fd).toEqual({
      'ora-inizio': '07:00',
      'ora-fine': '18:00',
      'ora-pause': '60'
    });
  });

  it('variante senza "dalle": 7 alle 18 con pausa', () => {
    const fd = parseQuickHoursFromBlob('7 alle 18 con 60 min di pausa');
    expect(fd).toEqual({
      'ora-inizio': '07:00',
      'ora-fine': '18:00',
      'ora-pause': '60'
    });
  });

  it('un\'ora di pausa senza numeri espliciti', () => {
    const fd = parseQuickHoursFromBlob("dalle 8 alle 17 con un'ora di pausa");
    expect(fd['ora-inizio']).toBe('08:00');
    expect(fd['ora-fine']).toBe('17:00');
    expect(fd['ora-pause']).toBe('60');
  });

  it('orari con minuti', () => {
    const fd = parseQuickHoursFromBlob('dalle 7:30 alle 18:15');
    expect(fd['ora-inizio']).toBe('07:30');
    expect(fd['ora-fine']).toBe('18:15');
  });

  it('formulazione «iniziato alle … e finito alle …» (screenshot utente)', () => {
    const blob =
      'segniamo le ore di oggi...ho iniziato alle 7 e finito alle 18 con 60 min di pausa';
    const fd = parseQuickHoursFromBlob(blob);
    expect(fd).toEqual({
      'ora-inizio': '07:00',
      'ora-fine': '18:00',
      'ora-pause': '60'
    });
  });

  it('due messaggi: inizio in un turno, «alle 18» nel successivo', () => {
    const blob =
      'voglio segnare le ore di oggi ho iniziato alle 7 Sono Tony, il tuo assistente personale per questa app. alle 18';
    const fd = parseQuickHoursFromBlob(blob);
    expect(fd).toEqual({
      'ora-inizio': '07:00',
      'ora-fine': '18:00'
    });
  });

  it('note: prefisso nel mezzo della stringa concatenata (60 note: … si)', () => {
    function extractNoteUserBlob(blob) {
      if (!blob || typeof blob !== 'string') return null;
      const s = blob.replace(/\s+/g, ' ').trim();
      if (!s) return null;
      const re = /\b(note|nota|annotazioni?)\s*[:\.](.+?)(?=\s+(?:note|nota|annotazioni?)\s*[:\.]|\s*$)/gi;
      let lastChunk = null;
      let m;
      while ((m = re.exec(s)) !== null) {
        const chunk = (m[2] || '').trim();
        if (chunk) lastChunk = chunk;
      }
      if (lastChunk != null && lastChunk !== '') {
        return lastChunk.replace(/\s+(si|sì|ok|yes|salva)\s*$/i, '').trim() || null;
      }
      return null;
    }
    expect(extractNoteUserBlob('60 note: pioveva forte si')).toBe('pioveva forte');
    expect(extractNoteUserBlob('note: solo pioggia')).toBe('solo pioggia');
  });

  it('pausa (user-only): senza «N min» nel testo utente non si estrae pausa; con «30 min» sì', () => {
    function extractPauseUserOnly(userBlob) {
      if (!userBlob || typeof userBlob !== 'string') return null;
      const pm = userBlob.match(/(\d+)\s*min(?:uti)?(?:\s+di\s*pausa)?/i);
      if (pm) {
        const n0 = parseInt(pm[1], 10);
        if (Number.isFinite(n0) && n0 >= 0 && n0 <= 600) return n0;
      }
      if (/un['']?ora\s+di\s+pausa/i.test(userBlob)) return 60;
      return null;
    }
    expect(extractPauseUserOnly('dalle 6 alle 18')).toBeNull();
    expect(extractPauseUserOnly('dalle 6 alle 18 con 30 min di pausa')).toBe(30);
  });
});
