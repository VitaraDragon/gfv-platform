import { describe, it, expect } from 'vitest';
import {
  isDashboardMeteoQuestion,
  isTonyDashboardPagePath,
  formatSedeMeteoReply,
  tonyWantsDashboardRiassunto,
  buildDashboardRiassuntoText,
  formatDashboardOpsBriefingText,
} from '../core/js/tony/meteo-dashboard-quick-reply-utils.js';
import { pulisciTestoPerVoce } from '../core/js/tony/voice.js';

describe('meteo-dashboard-quick-reply', () => {
  it('riconosce domanda meteo domani', () => {
    expect(isDashboardMeteoQuestion("Com'è il meteo domani")).toBe(true);
    expect(isDashboardMeteoQuestion('previsioni pioggia')).toBe(true);
    expect(isDashboardMeteoQuestion('apri il modulo attività')).toBe(false);
  });

  it('isTonyDashboardPagePath su pathname dashboard', () => {
    expect(isTonyDashboardPagePath({ location: { pathname: '/core/dashboard-standalone.html' } })).toBe(true);
    expect(isTonyDashboardPagePath({ location: { pathname: '/core/terreni-standalone.html' } })).toBe(false);
  });

  it('formatSedeMeteoReply domani — testo adatto al TTS (no 19–29°C)', () => {
    var reply = formatSedeMeteoReply('Com\'è il meteo domani', {
      label: 'Sede',
      tomorrow: { tempMin: 19, tempMax: 29, pop: 40, description: 'Nuvoloso' },
    });
    expect(reply).toContain('Domani');
    expect(reply).toContain('da 19 a 29 gradi');
    expect(reply).not.toMatch(/°C/);
    expect(reply).not.toMatch(/19–29/);
  });

  it('pulisciTestoPerVoce: range °C non diventa 1929 gradi', () => {
    var spoken = pulisciTestoPerVoce('temperature 19–29°C, probabilità pioggia 40%');
    expect(spoken).toContain('da 19 a 29 gradi');
    expect(spoken).not.toMatch(/1929/);
    expect(spoken).toContain('40 percento');
  });

  it('formatSedeMeteoReply + pulisciTestoPerVoce: descrizione con en-dash non corrompe TTS', () => {
    var reply = formatSedeMeteoReply('Com\'è il meteo domani', {
      label: 'Sede',
      tomorrow: { tempMin: 19, tempMax: 29, pop: 40, description: '19–29°C, nuvoloso' },
    });
    var spoken = pulisciTestoPerVoce(reply);
    expect(spoken).toContain('da 19 a 29 gradi');
    expect(spoken).not.toMatch(/1929/);
    expect(spoken).toMatch(/nuvoloso/i);
  });

  it('tonyWantsDashboardRiassunto — esplicito sì, no ok grazie', () => {
    expect(tonyWantsDashboardRiassunto('fammi un riassunto')).toBe(true);
    expect(tonyWantsDashboardRiassunto('sì', { allowShortConfirm: true })).toBe(true);
    expect(tonyWantsDashboardRiassunto('ok grazie', { allowShortConfirm: true })).toBe(false);
  });

  it('buildDashboardRiassuntoText unisce ops + meteo', () => {
    var text = buildDashboardRiassuntoText({
      meteo: {
        weatherSummary: 'Domani a Sede: Nuvoloso, temperature da 19 a 29 gradi.',
        proactiveText: 'Domani pioggia forte prevista.',
      },
    }, 'Siamo in una botte di ferro, non vedo criticità.');
    expect(text).toContain('botte di ferro');
    expect(text).toContain('Domani a Sede');
    expect(text).toContain('pioggia forte');
  });

  it('formatDashboardOpsBriefingText elenca prodotti e guasti per nome', () => {
    var ops = formatDashboardOpsBriefingText({
      availableModules: ['magazzino', 'parcoMacchine'],
      hasMagazzino: true,
      hasParcoMacchine: true,
      sottoScorta: 2,
      guastiAperti: 1,
      scadenzeUrgenti: 0,
      summarySottoScorta: '2 prodotti sotto scorta: Urea, Glifosate.',
      summaryGuasti: 'C\'è 1 guasto aperto: Trattore T5 (alta).',
    });
    expect(ops).toContain('Urea');
    expect(ops).toContain('Trattore T5');
    expect(ops).not.toContain('qualche guasto di troppo');
  });
});
