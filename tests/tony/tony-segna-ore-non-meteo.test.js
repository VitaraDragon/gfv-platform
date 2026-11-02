import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { isTonySegnaOreIntent as isTonySegnaOreIntentClient } from '../../core/js/tony/engine.js';

const require = createRequire(import.meta.url);
const { isTonyMeteoQuestion } = require('../../functions/meteo-service.js');
const { isTonySegnaOreIntent } = require('../../functions/tony-quick-replies.js');
const {
  classifyTonyIntentShadow,
  isTonyMeteoOperationalQuestionLocal,
} = require('../../functions/tony-intent-router.js');

const SEGNA_ORE = [
  'aiutami a segnare le ore di oggi per un lavoro',
  'segna le ore di oggi',
  'registra 3 ore di potatura oggi',
  'devo mettere le ore di ieri',
];

/** Già meteo prima di questa correzione. «fra quante ore pioverà?» non è in lista: oggi non lo è. */
const RESTANO_METEO = [
  'oggi posso lavorare nella vigna?',
  'domani conviene trattare?',
  'quante ore di pioggia domani?',
  'posso erpicare sabato?',
];

describe('segna ore non è meteo', () => {
  it.each(SEGNA_ORE)('non meteo: %s', (phrase) => {
    expect(isTonySegnaOreIntent(phrase)).toBe(true);
    expect(isTonyMeteoQuestion(phrase)).toBe(false);
    expect(isTonyMeteoOperationalQuestionLocal(phrase)).toBe(false);
    expect(classifyTonyIntentShadow({ message: phrase, ctx: {} }).binario).not.toBe('A');
  });

  it.each(RESTANO_METEO)('resta meteo: %s', (phrase) => {
    expect(isTonySegnaOreIntent(phrase)).toBe(false);
    expect(isTonyMeteoQuestion(phrase)).toBe(true);
  });

  it('fra quante ore pioverà non è segna-ore e oggi non è meteo', () => {
    const phrase = 'fra quante ore pioverà?';
    expect(isTonySegnaOreIntent(phrase)).toBe(false);
    expect(isTonyMeteoQuestion(phrase)).toBe(false);
    expect(isTonyMeteoOperationalQuestionLocal(phrase)).toBe(false);
    expect(classifyTonyIntentShadow({ message: phrase, ctx: {} }).binario).not.toBe('A');
  });

  it.each(SEGNA_ORE.concat(RESTANO_METEO, ['fra quante ore pioverà?']))(
    'gemella client = server: %s',
    (phrase) => {
      expect(isTonySegnaOreIntentClient(phrase)).toBe(isTonySegnaOreIntent(phrase));
    }
  );

  it('erpicare sabato e ore di pioggia restano consultazione meteo', () => {
    expect(isTonyMeteoOperationalQuestionLocal('posso erpicare sabato?')).toBe(true);
    expect(classifyTonyIntentShadow({ message: 'posso erpicare sabato?', ctx: {} }).binario).toBe('A');
    expect(classifyTonyIntentShadow({ message: 'quante ore di pioggia domani?', ctx: {} }).binario).toBe('A');
  });
});
