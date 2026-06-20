import { describe, it, expect } from 'vitest';
import {
  isItalianLikelyQuestion,
  applyItalianVoiceQuestionPunctuation,
} from '../core/js/tony/engine.js';

describe('Tony voce — punteggiatura domande (STT)', () => {
  it('aggiunge ? a domande con parole interrogative', () => {
    expect(applyItalianVoiceQuestionPunctuation('Come sarà il tempo oggi')).toBe(
      'Come sarà il tempo oggi?'
    );
    expect(applyItalianVoiceQuestionPunctuation('Che cosa posso fare con il meteo')).toBe(
      'Che cosa posso fare con il meteo?'
    );
    expect(applyItalianVoiceQuestionPunctuation('Tony quanti trattori ho')).toBe(
      'Tony quanti trattori ho?'
    );
  });

  it('non modifica saluti o affermazioni', () => {
    expect(applyItalianVoiceQuestionPunctuation('Ciao Tony tutto bene')).toBe('Ciao Tony tutto bene');
    expect(applyItalianVoiceQuestionPunctuation('Ok grazie')).toBe('Ok grazie');
    expect(applyItalianVoiceQuestionPunctuation('Ho finito.')).toBe('Ho finito.');
  });

  it('non duplica ? se già presente', () => {
    expect(applyItalianVoiceQuestionPunctuation('Dove sei?')).toBe('Dove sei?');
  });

  it('riconosce domande con puoi / è possibile', () => {
    expect(isItalianLikelyQuestion('Puoi aprire il magazzino')).toBe(true);
    expect(isItalianLikelyQuestion('È possibile salvare adesso')).toBe(true);
  });
});
