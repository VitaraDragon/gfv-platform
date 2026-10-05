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
  mergeMagazzinoInject,
  clearMovimentoGestureState,
  extractCampoHint,
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

describe('carburante carico e pieno', () => {
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
    window.__tonyMovimentoPendingDraft = null;
    commands = [];
  });

  it('è arrivato il gasolio, 800 litri → entrata carico cisterna', () => {
    const res = tryInterceptMovimentoCreateBeforeCf('è arrivato il gasolio, 800 litri', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(true);
    expect(commands[0].fields['mov-tipo']).toBe('entrata');
    expect(commands[0].fields['mov-prodotto']).toBe('gasolio');
    expect(commands[0].fields['mov-quantita']).toBe('800');
    expect(commands[0].fields['mov-origine-carburante']).toBe('carico_cisterna');
  });

  it('ho fatto il pieno al T5, 80 litri → uscita e mezzo, anche senza prodotto', () => {
    const res = tryInterceptMovimentoCreateBeforeCf('ho fatto il pieno al T5, 80 litri', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(true);
    expect(commands[0].fields['mov-tipo']).toBe('uscita');
    expect(commands[0].fields['mov-quantita']).toBe('80');
    expect(commands[0].fields['mov-macchina']).toBe('T5');
    expect(commands[0].fields['mov-origine-carburante']).toBe('pieno');
    expect(commands[0].fields['mov-prodotto']).toBeUndefined();
  });

  it('naviga al form filtrato se non sei sui movimenti', () => {
    global.sessionStorage = {
      _data: {},
      setItem(k, v) { this._data[k] = v; },
      getItem(k) { return this._data[k] || null; },
      removeItem(k) { delete this._data[k]; },
    };
    window.location = { pathname: '/core/dashboard-standalone.html', href: '' };
    const res = tryInterceptMovimentoCreateBeforeCf('è arrivato il gasolio, 800 litri', {
      appendMessage: () => {},
      getUrlForTarget: () => '/modules/magazzino/views/movimenti-standalone.html',
      clearEarlyTyping: () => {},
    });
    expect(res.navigating).toBe(true);
    expect(window.location.href).toContain('categoria=carburante');
    expect(window.location.href).toContain('tipo=entrata');
  });
});

describe('cambio gesto carico → pieno', () => {
  let commands;
  let modalOpen;
  let fields;

  function installDoc() {
    fields = {};
    global.document = {
      getElementById: (id) => {
        if (id === 'movimento-modal') {
          return {
            id: 'movimento-modal',
            classList: {
              contains: () => modalOpen,
              remove() { modalOpen = false; },
            },
          };
        }
        if (id === 'movimento-form') return { reset() {} };
        if (!fields[id]) fields[id] = { id, value: '' };
        return fields[id];
      },
      querySelector: () => null,
    };
  }

  beforeEach(() => {
    global.window = global.window || {};
    modalOpen = false;
    installDoc();
    window.location = { pathname: '/modules/magazzino/views/movimenti-standalone.html', href: '' };
    window.__tonyMovimentoPendingDraft = null;
    window.__tonyMagazzinoLastInject = null;
    window.__tonyMovimentoIgnoreInjectBefore = 0;
    commands = [];
  });

  it('estrae mezzo e campo dal pieno in campo', () => {
    const fd = parseMovimentoCreationFromText(
      'ho fatto il pieno in campo alla mietitrebbia, 150 litri, campo del grano'
    );
    expect(fd['mov-tipo']).toBe('uscita');
    expect(fd['mov-quantita']).toBe('150');
    expect(fd['mov-origine-carburante']).toBe('pieno');
    expect(fd['mov-macchina']).toBe('mietitrebbia');
    expect(fd['mov-note']).toBe('Campo del grano');
    expect(extractCampoHint('pieno in campo alla mietitrebbia')).toBeNull();
  });

  it('con il form del carico aperto, il pieno usa 150 e non 2000', () => {
    tryInterceptMovimentoCreateBeforeCf('è arrivato il carico cisterna, 2000 litri di gasolio', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(commands[0].fields['mov-quantita']).toBe('2000');
    expect(commands[0].fields['mov-origine-carburante']).toBe('carico_cisterna');

    modalOpen = true;
    window.__tonyMagazzinoLastInject = {
      formId: 'movimento-form',
      formData: Object.assign({}, commands[0].fields),
      t: Date.now(),
    };
    window.__tonyMovimentoPendingDraft = Object.assign({}, commands[0].fields);
    fields['mov-quantita'] = { value: '2000' };

    const msgs = [];
    const res = tryInterceptMovimentoCreateBeforeCf(
      'ho fatto il pieno in campo alla mietitrebbia, 150 litri, campo del grano',
      {
        appendMessage: (m) => msgs.push(m),
        processTonyCommand: (c) => commands.push(c),
        clearEarlyTyping: () => {},
      }
    );
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(true);
    const pieno = commands[commands.length - 1];
    expect(pieno.fields['mov-quantita']).toBe('150');
    expect(pieno.fields['mov-tipo']).toBe('uscita');
    expect(pieno.fields['mov-origine-carburante']).toBe('pieno');
    expect(pieno.fields['mov-macchina']).toBe('mietitrebbia');
    expect(pieno.fields['mov-note']).toBe('Campo del grano');
    expect(pieno.fields['mov-prodotto']).toBeUndefined();
    expect(msgs.join(' ').toLowerCase()).toContain('pieno');
    expect(msgs.join(' ')).not.toContain('2000');
  });

  it('senza mezzo non lascia la quantità del carico', () => {
    modalOpen = true;
    fields['mov-quantita'] = { value: '2000' };
    window.__tonyMovimentoPendingDraft = {
      'mov-tipo': 'entrata',
      'mov-quantita': '2000',
      'mov-prodotto': 'gasolio',
      'mov-origine-carburante': 'carico_cisterna',
    };
    const msgs = [];
    const res = tryInterceptMovimentoCreateBeforeCf('ho fatto il pieno in campo, 150 litri', {
      appendMessage: (m) => msgs.push(m),
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(commands[0].fields['mov-quantita']).toBe('150');
    expect(commands[0].fields['mov-quantita']).not.toBe('2000');
    expect(commands[0].fields['mov-macchina']).toBeUndefined();
    expect(msgs.join(' ').toLowerCase()).toMatch(/mezzo/);
  });

  it('un seguito senza nuovo gesto non chiude il form aperto', () => {
    modalOpen = true;
    const res = tryInterceptMovimentoCreateBeforeCf('150 litri', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(false);
    expect(commands).toEqual([]);
  });

  it('il merge non riporta la quantità del carico sul pieno', () => {
    const kept = mergeMagazzinoInject(
      {
        'mov-quantita': '10',
        'mov-tipo': 'entrata',
        'mov-prodotto': 'gasolio',
        'mov-origine-carburante': 'carico_cisterna',
      },
      { 'mov-note': 'bolla' }
    );
    expect(kept['mov-quantita']).toBe('10');

    const switched = mergeMagazzinoInject(
      {
        'mov-quantita': '2000',
        'mov-tipo': 'entrata',
        'mov-prodotto': 'gasolio',
        'mov-origine-carburante': 'carico_cisterna',
        'mov-data': '2026-10-05',
      },
      { 'mov-tipo': 'uscita', 'mov-origine-carburante': 'pieno' }
    );
    expect(switched['mov-quantita']).toBeUndefined();
    expect(switched['mov-prodotto']).toBeUndefined();
    expect(switched['mov-tipo']).toBe('uscita');
    expect(switched['mov-data']).toBe('2026-10-05');

    const withQty = mergeMagazzinoInject(
      {
        'mov-quantita': '2000',
        'mov-tipo': 'entrata',
        'mov-origine-carburante': 'carico_cisterna',
      },
      {
        'mov-tipo': 'uscita',
        'mov-origine-carburante': 'pieno',
        'mov-quantita': '150',
        'mov-macchina': 'mietitrebbia',
      }
    );
    expect(withQty['mov-quantita']).toBe('150');
    expect(withQty['mov-macchina']).toBe('mietitrebbia');
  });

  it('passare a un attività azzera pending e quantità del movimento', () => {
    modalOpen = true;
    fields['mov-quantita'] = { value: '2000' };
    window.__tonyMagazzinoLastInject = {
      formId: 'movimento-form',
      formData: { 'mov-quantita': '2000' },
      t: Date.now(),
    };
    window.__tonyMovimentoPendingDraft = { 'mov-quantita': '2000' };
    global.sessionStorage = {
      _data: { tony_pending_intent: '{"modalId":"movimento-modal"}' },
      setItem(k, v) { this._data[k] = v; },
      getItem(k) { return this._data[k] || null; },
      removeItem(k) { delete this._data[k]; },
    };
    clearMovimentoGestureState();
    expect(window.__tonyMagazzinoLastInject).toBeNull();
    expect(window.__tonyMovimentoPendingDraft).toBeNull();
    expect(sessionStorage.getItem('tony_pending_intent')).toBeNull();
    expect(modalOpen).toBe(false);
    expect(fields['mov-quantita'].value).toBe('');
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
