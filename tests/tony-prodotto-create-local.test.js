import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isProdottoCreationIntent,
  parseProdottoCreationFromText,
  mergeProdottoDraft,
  isProdottoDraftComplete,
  getProdottoDraftRequiredMissing,
  normalizeProdottoCategoriaFromText,
  normalizeProdottoUnitaFromText,
  tryInterceptProdottoCreateBeforeCf,
  tryRecoverProdottoCfFakeSave,
} from '../core/js/tony-prodotto-create-local.js';

describe('isProdottoCreationIntent', () => {
  it('riconosce crea prodotto', () => {
    expect(isProdottoCreationIntent('crea prodotto roundup fitofarmaci')).toBe(true);
    expect(isProdottoCreationIntent('nuovo prodotto concime fertilizzanti')).toBe(true);
  });

  it('non confonde con domande generiche', () => {
    expect(isProdottoCreationIntent('quanti prodotti ci sono')).toBe(false);
  });
});

describe('parseProdottoCreationFromText', () => {
  it('estrae nome categoria unità scorta prezzo', () => {
    const fd = parseProdottoCreationFromText(
      'crea prodotto roundup fitofarmaci litri scorta 50 prezzo 45'
    );
    expect(fd).toBeTruthy();
    expect(fd['prodotto-nome']).toBe('roundup');
    expect(fd['prodotto-categoria']).toBe('fitofarmaci');
    expect(fd['prodotto-unita']).toBe('L');
    expect(fd['prodotto-scorta-minima']).toBe('50');
    expect(fd['prodotto-prezzo']).toBe('45');
  });

  it('normalizza concime → fertilizzanti', () => {
    expect(normalizeProdottoCategoriaFromText('concime npk')).toBe('fertilizzanti');
    expect(normalizeProdottoUnitaFromText('10 kg')).toBe('kg');
  });
});

describe('tryInterceptProdottoCreateBeforeCf', () => {
  let commands;

  beforeEach(() => {
    global.window = global.window || {};
    global.sessionStorage = {
      _data: {},
      setItem(k, v) { this._data[k] = v; },
      getItem(k) { return this._data[k] || null; },
      removeItem(k) { delete this._data[k]; },
    };
    global.document = {
      getElementById: (id) => {
        if (id === 'prodotto-modal') {
          return { id: 'prodotto-modal', classList: { contains: () => false } };
        }
        return null;
      },
    };
    window.location = { pathname: '/modules/magazzino/views/prodotti-standalone.html', href: '' };
    commands = [];
    window.__tonyProdottoPendingDraft = null;
  });

  afterEach(() => {
    window.__tonyProdottoPendingDraft = null;
  });

  it('apre modal su intent completo con dosaggio e carenza', () => {
    const res = tryInterceptProdottoCreateBeforeCf(
      'crea prodotto roundup fitofarmaci litri scorta 50 prezzo 45 dosaggio 0.5-1 carenza 30',
      {
        appendMessage: () => {},
        processTonyCommand: (c) => commands.push(c),
        clearEarlyTyping: () => {},
      }
    );
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(true);
    expect(commands[0].type).toBe('OPEN_MODAL');
    expect(commands[0].id).toBe('prodotto-modal');
    expect(commands[0].fields['prodotto-nome']).toBe('roundup');
    expect(commands[0].fields['prodotto-categoria']).toBe('fitofarmaci');
    expect(commands[0].fields['prodotto-dosaggio-min']).toBe('0.5');
    expect(commands[0].fields['prodotto-giorni-carenza']).toBe('30');
  });

  it('chiede dosaggio se fitofarmaci senza range', () => {
    const msgs = [];
    const res = tryInterceptProdottoCreateBeforeCf(
      'crea prodotto roundup fitofarmaci litri scorta 50 prezzo 45',
      {
        appendMessage: (m) => msgs.push(m),
        clearEarlyTyping: () => {},
      }
    );
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(false);
    expect(msgs[0]).toMatch(/dosaggio/i);
  });

  it('naviga cross-page se non su prodotti (draft completo)', () => {
    window.location = { pathname: '/core/dashboard-standalone.html', href: '' };
    const res = tryInterceptProdottoCreateBeforeCf(
      'crea prodotto nimrod fitofarmaci L dosaggio 0.5-1 carenza 30 prezzo 45',
      {
        appendMessage: () => {},
        getUrlForTarget: () => '/modules/magazzino/views/prodotti-standalone.html',
        clearEarlyTyping: () => {},
      }
    );
    expect(res.handled).toBe(true);
    expect(res.navigating).toBe(true);
    expect(sessionStorage.getItem('tony_pending_intent')).toMatch(/prodotto-modal/);
  });

  it('chiede categoria se mancante', () => {
    const msgs = [];
    const res = tryInterceptProdottoCreateBeforeCf('crea prodotto roundup litri', {
      appendMessage: (m) => msgs.push(m),
      clearEarlyTyping: () => {},
    });
    expect(res.handled).toBe(true);
    expect(res.opened).toBe(false);
    expect(msgs[0]).toMatch(/categoria/i);
  });
});

describe('tryRecoverProdottoCfFakeSave', () => {
  beforeEach(() => {
    global.window = global.window || {};
    global.document = {
      getElementById: (id) => {
        if (id === 'prodotto-modal') {
          return { id: 'prodotto-modal', classList: { contains: () => false } };
        }
        return null;
      },
    };
    window.location = { pathname: '/prodotti-standalone.html' };
    window.__tonyProdottoPendingDraft = {
      'prodotto-nome': 'roundup',
      'prodotto-categoria': 'fitofarmaci',
      'prodotto-unita': 'L',
      'prodotto-dosaggio-min': '0.5',
      'prodotto-dosaggio-max': '1',
      'prodotto-giorni-carenza': '30',
    };
  });

  afterEach(() => {
    window.__tonyProdottoPendingDraft = null;
  });

  it('recupera falso Prodotto salvato!', () => {
    const commands = [];
    const ok = tryRecoverProdottoCfFakeSave('Prodotto salvato!', {
      appendMessage: () => {},
      processTonyCommand: (c) => commands.push(c),
    });
    expect(ok).toBe(true);
    expect(commands[0].type).toBe('OPEN_MODAL');
  });
});

describe('isProdottoDraftComplete', () => {
  it('richiede nome categoria unità', () => {
    expect(getProdottoDraftRequiredMissing({ 'prodotto-nome': 'x' })).toContain('prodotto-categoria');
    expect(isProdottoDraftComplete({
      'prodotto-nome': 'x',
      'prodotto-categoria': 'sementi',
      'prodotto-unita': 'kg',
    })).toBe(true);
  });

  it('fitofarmaci richiede dosaggio e carenza', () => {
    expect(isProdottoDraftComplete({
      'prodotto-nome': 'roundup',
      'prodotto-categoria': 'fitofarmaci',
      'prodotto-unita': 'L',
    })).toBe(false);
    expect(getProdottoDraftRequiredMissing({
      'prodotto-nome': 'roundup',
      'prodotto-categoria': 'fitofarmaci',
      'prodotto-unita': 'L',
    })).toContain('prodotto-dosaggio-min');
    expect(isProdottoDraftComplete({
      'prodotto-nome': 'roundup',
      'prodotto-categoria': 'fitofarmaci',
      'prodotto-unita': 'L',
      'prodotto-dosaggio-min': '0.5',
      'prodotto-dosaggio-max': '1',
      'prodotto-giorni-carenza': '30',
    })).toBe(true);
  });
});
