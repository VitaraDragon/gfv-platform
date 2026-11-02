import { describe, expect, it } from 'vitest';
import {
  REGOLE_TONY_LANDING,
  PROMPT_SISTEMA_LANDING,
  istruzioneNomeServizioDaStoria,
  pulisciNomeServizioRisposta,
} from '../functions/lib/tony-landing-prompt.js';
import { corpoRichiestaGemini, COSTANTI } from '../functions/lib/tony-landing-limiti.js';
import { preparaTestoVoce } from '../functions/lib/tony-landing-voce.js';

describe('nome GFV e contesto landing', () => {
  it('regole: nome, contesto, niente GFV Platform', () => {
    const testo = REGOLE_TONY_LANDING.join('\n');
    expect(testo).toMatch(/prima volta/i);
    expect(testo).toMatch(/Global Farm View/);
    expect(testo).toMatch(/mai «GFV Platform»|Non dire mai «GFV Platform»/i);
    expect(testo).toMatch(/5 ettari di vigneto|Usa quello che il visitatore/i);
    // La regola cita «GFV Platform» solo per vietarlo; non deve presentarlo come nome.
    expect(PROMPT_SISTEMA_LANDING).toMatch(/Non dire mai «GFV Platform»/);
    expect(PROMPT_SISTEMA_LANDING).not.toMatch(/il servizio è «GFV Platform»/i);
  });

  it('riga dinamica nome: primo vs secondo turno', () => {
    expect(istruzioneNomeServizioDaStoria([])).toBe(
      'In questa risposta chiama il servizio Global Farm View'
    );
    expect(
      istruzioneNomeServizioDaStoria([
        { ruolo: 'tony', testo: 'Global Farm View ti aiuta in campo.' },
      ])
    ).toBe('Chiama il servizio solo GFV.');
    const corpo1 = corpoRichiestaGemini({
      promptSistema: PROMPT_SISTEMA_LANDING + '\n' + istruzioneNomeServizioDaStoria([]),
      storia: [],
      domanda: "cos'è GFV",
    });
    expect(corpo1.systemInstruction.parts[0].text).toContain(
      'In questa risposta chiama il servizio Global Farm View'
    );
    const corpo2 = corpoRichiestaGemini({
      promptSistema:
        PROMPT_SISTEMA_LANDING +
        '\n' +
        istruzioneNomeServizioDaStoria([
          { ruolo: 'tony', testo: 'Con Global Farm View organizzi i lavori.' },
        ]),
      storia: [{ ruolo: 'tony', testo: 'Con Global Farm View organizzi i lavori.' }],
      domanda: 'e per la mia azienda?',
    });
    expect(corpo2.systemInstruction.parts[0].text).toContain('Chiama il servizio solo GFV.');
  });

  it('pulizia GFV Platform anche per la voce', () => {
    expect(pulisciNomeServizioRisposta('Prova GFV Platform oggi')).toBe('Prova GFV oggi');
    expect(pulisciNomeServizioRisposta('Global Farm View Platform')).toBe('Global Farm View');
    const voce = preparaTestoVoce('Benvenuto in GFV Platform');
    expect(voce).not.toMatch(/Platform/i);
  });

  it('MAX_BATTUTE_STORIA a 10', () => {
    expect(COSTANTI.MAX_BATTUTE_STORIA).toBe(10);
  });
});
