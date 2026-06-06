import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isMovimentoCreationIntent,
  parseMovimentoCreationFromText,
  parseMovimentoDateFromText,
  mergeMovimentoDraft,
  isMovimentoDraftComplete,
  getMovimentoDraftRequiredMissing,
  tryInterceptMovimentoCreateBeforeCf,
  tryRecoverMovimentoCfFakeSave,
} from '../core/js/tony-movimento-create-local.js';

describe('isMovimentoCreationIntent', () => {
  it('riconosce crea entrata/uscita', () => {
    expect(isMovimentoCreationIntent('crea entrata nimrod 10 unità')).toBe(true);
    expect(isMovimentoCreationIntent('nuovo movimento uscita concime 5')).toBe(true);
    expect(isMovimentoCreationIntent('registra carico nimrod 10')).toBe(true);
  });

  it('riconosce scarico/carico imperativo in testa', () => {
    expect(isMovimentoCreationIntent('scarico concime 2 kg')).toBe(true);
    expect(isMovimentoCreationIntent('carico nimrod 10 unità')).toBe(true);
  });

  it('non confonde con domande generiche', () => {
    expect(isMovimentoCreationIntent('quanti movimenti ci sono')).toBe(false);
    expect(isMovimentoCreationIntent('oggi')).toBe(false);
  });
});

describe('parseMovimentoCreationFromText', () => {
  it('estrae prodotto quantità e tipo entrata', () => {
    const fd = parseMovimentoCreationFromText('crea entrata nimrod 10 unità');
    expect(fd).toBeTruthy();
    expect(fd['mov-tipo']).toBe('entrata');
    expect(fd['mov-prodotto']).toBe('nimrod');
    expect(fd['mov-quantita']).toBe('10');
  });

  it('estrae prodotto da «crea movimento nimrod in entrata 15»', () => {
    const fd = parseMovimentoCreationFromText('crea movimento nimrod in entrata 15 unità');
    expect(fd['mov-prodotto']).toBe('nimrod');
    expect(fd['mov-quantita']).toBe('15');
    expect(fd['mov-tipo']).toBe('entrata');
  });

  it('estrae uscita', () => {
    const fd = parseMovimentoCreationFromText('registra uscita di concime 2 litri');
    expect(fd['mov-tipo']).toBe('uscita');
    expect(fd['mov-prodotto']).toMatch(/concime/i);
    expect(fd['mov-quantita']).toBe('2');
  });

  it('estrae frasi naturali uscita (3b-C17)', () => {
    const cases = [
      ['registra uscita roundup 5 litri', { tipo: 'uscita', prodotto: 'roundup', qty: '5' }],
      ['crea uscita di nimrod 10 unità', { tipo: 'uscita', prodotto: 'nimrod', qty: '10' }],
      ['scarico concime 2 kg', { tipo: 'uscita', prodotto: 'concime', qty: '2' }],
      ['crea movimento roundup in uscita 5', { tipo: 'uscita', prodotto: 'roundup', qty: '5' }],
    ];
    cases.forEach(([text, exp]) => {
      const fd = parseMovimentoCreationFromText(text);
      expect(fd['mov-tipo'], text).toBe(exp.tipo);
      expect(fd['mov-prodotto'], text).toBe(exp.prodotto);
      expect(fd['mov-quantita'], text).toBe(exp.qty);
    });
  });
});

describe('parseMovimentoDateFromText', () => {
  it('riconosce oggi', () => {
    const d = parseMovimentoDateFromText('oggi');
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('mergeMovimentoDraft + complete', () => {
  it('completa draft con data oggi', () => {
    let draft = mergeMovimentoDraft(null, 'crea entrata nimrod 10 unità');
    draft = mergeMovimentoDraft(draft, 'oggi');
    draft['mov-data'] = draft['mov-data'] || parseMovimentoDateFromText('oggi');
    expect(isMovimentoDraftComplete(draft)).toBe(true);
    expect(getMovimentoDraftRequiredMissing(draft)).toEqual([]);
  });
});

describe('tryInterceptMovimentoCreateBeforeCf', () => {
  let commands;

  beforeEach(() => {
    global.window = global.window || {};
    global.document = {
      getElementById: (id) => {
        if (id === 'movimento-modal') {
          return { id: 'movimento-modal', classList: { contains: () => false } };
        }
        return null;
      },
    };
    window.location = { pathname: '/modules/magazzino/views/movimenti-standalone.html' };
    commands = [];
    window.__tonyMovimentoPendingDraft = null;
  });

  afterEach(() => {
    window.__tonyMovimentoPendingDraft = null;
  });

  it('apre modal su intent completo entrata (data default oggi)', () => {
    const msgs = [];
    const res = tryInterceptMovimentoCreateBeforeCf('crea entrata nimrod 10 unità', {
      appendMessage: (m) => msgs.push(m),
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(true);
    expect(commands.length).toBe(1);
    expect(commands[0].type).toBe('OPEN_MODAL');
    expect(commands[0].id).toBe('movimento-modal');
    expect(commands[0].fields['mov-prodotto']).toBe('nimrod');
    expect(commands[0].fields['mov-quantita']).toBe('10');
    expect(commands[0].fields['mov-tipo']).toBe('entrata');
    expect(commands[0].fields['mov-data']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('apre modal su intent completo uscita (3b-C17, no prezzo)', () => {
    const res = tryInterceptMovimentoCreateBeforeCf('registra uscita roundup 5 litri', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(true);
    expect(commands[0].fields['mov-tipo']).toBe('uscita');
    expect(commands[0].fields['mov-prodotto']).toBe('roundup');
    expect(commands[0].fields['mov-quantita']).toBe('5');
    expect(commands[0].fields['mov-prezzo']).toBeUndefined();
  });

  it('intercept uscita scarico imperativo', () => {
    const res = tryInterceptMovimentoCreateBeforeCf('scarico concime 2 kg', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(true);
    expect(commands[0].fields['mov-tipo']).toBe('uscita');
    expect(commands[0].fields['mov-prodotto']).toBe('concime');
  });

  it('naviga cross-page se non su movimenti', () => {
    global.sessionStorage = {
      _data: {},
      setItem(k, v) { this._data[k] = v; },
      getItem(k) { return this._data[k] || null; },
      removeItem(k) { delete this._data[k]; },
    };
    window.location = { pathname: '/core/dashboard-standalone.html', href: '' };
    const res = tryInterceptMovimentoCreateBeforeCf('registra uscita roundup 5 litri', {
      appendMessage: () => {},
      getUrlForTarget: () => '/modules/magazzino/views/movimenti-standalone.html',
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(res.navigating).toBe(true);
    expect(sessionStorage.getItem('tony_pending_intent')).toMatch(/movimento-modal/);
  });

  it('recupera conferma si con draft CF', () => {
    window.__tonyMovimentoPendingDraft = {
      'mov-tipo': 'entrata',
      'mov-prodotto': 'nimrod',
      'mov-quantita': '10',
      'mov-data': '2026-05-31',
    };
    const res = tryInterceptMovimentoCreateBeforeCf('si', {
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(commands[0].fields['mov-prodotto']).toBe('nimrod');
  });
});

describe('tryRecoverMovimentoCfFakeSave', () => {
  beforeEach(() => {
    global.window = global.window || {};
    global.document = {
      getElementById: (id) => {
        if (id === 'movimento-modal') {
          return { id: 'movimento-modal', classList: { contains: () => false } };
        }
        return null;
      },
    };
    window.location = { pathname: '/movimenti-standalone.html' };
    window.__tonyMovimentoPendingDraft = {
      'mov-tipo': 'entrata',
      'mov-prodotto': 'nimrod',
      'mov-quantita': '10',
      'mov-data': '2026-05-31',
    };
  });

  afterEach(() => {
    window.__tonyMovimentoPendingDraft = null;
  });

  it('recupera falso Movimento registrato!', () => {
    const commands = [];
    const ok = tryRecoverMovimentoCfFakeSave('Movimento registrato!', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
    });
    expect(ok).toBe(true);
    expect(commands[0].type).toBe('OPEN_MODAL');
  });
});
