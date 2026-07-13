import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TONY_PRODOTTI_REMINDER_STORAGE_KEY,
  buildProdottoCompletamentoReminderMessage,
  buildProdottiListaReminderMessage,
  countProdottiDaCompletare,
  stashProdottoCompletamentoReminder,
  pullProdottoCompletamentoReminder,
} from '../core/js/tony/document-prodotto-reminder.js';

describe('document-prodotto-reminder', () => {
  beforeEach(() => {
    global.sessionStorage = {
      _data: {},
      setItem(k, v) { this._data[k] = v; },
      getItem(k) { return this._data[k] || null; },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; },
    };
  });

  afterEach(() => {
    delete global.sessionStorage;
  });

  it('buildProdottoCompletamentoReminderMessage singolare e plurale', () => {
    expect(buildProdottoCompletamentoReminderMessage([])).toBe('');
    expect(buildProdottoCompletamentoReminderMessage([{ nome: 'Roundup' }])).toContain('1 prodotto');
    expect(buildProdottoCompletamentoReminderMessage([{ nome: 'Roundup' }])).toContain('Roundup');
    var msg = buildProdottoCompletamentoReminderMessage([
      { nome: 'A' },
      { nome: 'B' },
      { nome: 'C' },
      { nome: 'D' },
    ]);
    expect(msg).toContain('4 prodotti');
    expect(msg).toContain('e altri 1');
  });

  it('stash e pull sessionStorage', () => {
    stashProdottoCompletamentoReminder([{ id: 'p1', nome: 'X', categoria: 'altro' }]);
    expect(sessionStorage.getItem(TONY_PRODOTTI_REMINDER_STORAGE_KEY)).toBeTruthy();
    var pulled = pullProdottoCompletamentoReminder();
    expect(pulled.items).toHaveLength(1);
    expect(pulled.items[0].nome).toBe('X');
    expect(sessionStorage.getItem(TONY_PRODOTTI_REMINDER_STORAGE_KEY)).toBeNull();
  });

  it('countProdottiDaCompletare ignora disattivi', () => {
    expect(countProdottiDaCompletare([
      { daCompletare: true, attivo: true },
      { daCompletare: true, attivo: false },
      { daCompletare: false },
    ])).toBe(1);
  });

  it('buildProdottiListaReminderMessage', () => {
    expect(buildProdottiListaReminderMessage(0)).toBe('');
    expect(buildProdottiListaReminderMessage(1)).toContain('1 prodotto');
    expect(buildProdottiListaReminderMessage(3)).toContain('3 prodotti');
    expect(buildProdottiListaReminderMessage(3)).toContain('Tony Occhi');
  });
});
