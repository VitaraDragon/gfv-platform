import { describe, it, expect } from 'vitest';
import {
  translateMeteoAlertEvent,
  translateMeteoAlertDescription,
  translateMeteoAlertSender,
  localizeMeteoAlert,
} from '../core/config/meteo-alert-i18n.js';
import { renderAlertsBanner } from '../core/js/meteo-ui-helpers.js';

describe('meteo-alert-i18n', () => {
  it('traduce eventi MeteoAlarm comuni in inglese', () => {
    expect(translateMeteoAlertEvent('Thunderstorm Warning')).toBe('Avviso temporali');
    expect(translateMeteoAlertEvent('Severe Thunderstorm Warning')).toBe('Avviso temporali grave');
    expect(translateMeteoAlertEvent('Heavy Rain Warning')).toBe('Avviso pioggia intensa');
    expect(translateMeteoAlertEvent('Wind Warning')).toBe('Avviso vento');
  });

  it('traduce prefissi colore MeteoAlarm (Yellow/Orange/Red)', () => {
    expect(translateMeteoAlertEvent('Yellow Thunderstorm Warning')).toBe('Avviso temporali');
    expect(translateMeteoAlertEvent('Orange Rain Warning')).toBe('Avviso pioggia');
    expect(translateMeteoAlertEvent('Red Wind Warning')).toBe('Avviso vento');
  });

  it('usa i tag OpenWeather se il titolo evento è generico', () => {
    expect(translateMeteoAlertEvent('Thunderstorm', ['Thunderstorm'])).toBe('Avviso temporali');
    expect(translateMeteoAlertEvent('Weather Alert', ['Rain'])).toBe('Avviso pioggia');
  });

  it('tronca titoli con suffisso "in effect"', () => {
    expect(
      translateMeteoAlertEvent('Yellow Thunderstorm Warning in effect from Sunday 12:00 PM CET')
    ).toBe('Avviso temporali');
  });

  it('non modifica testi già in italiano', () => {
    expect(translateMeteoAlertEvent('Avviso temporali')).toBe('Avviso temporali');
    expect(translateMeteoAlertDescription('Possibilità di temporali forti.')).toBe(
      'Possibilità di temporali forti.'
    );
  });

  it('applica sostituzioni lessicali sulla descrizione', () => {
    const out = translateMeteoAlertDescription(
      'Be aware of the possibility of heavy rain and thunderstorms.'
    );
    expect(out).toMatch(/Possibilità di/i);
    expect(out).toMatch(/pioggia intensa/i);
    expect(out).toMatch(/temporali/i);
  });

  it('localizza descrizioni MeteoAlarm tipiche', () => {
    const out = translateMeteoAlertDescription(
      'There is a risk of thunderstorms. This warning is in effect from 12:00 until 21:00. Source: MeteoAlarm'
    );
    expect(out).toMatch(/rischio di temporali/i);
    expect(out).toMatch(/in vigore dal/i);
    expect(out).toMatch(/fino al/i);
    expect(out).toMatch(/Fonte:/i);
  });

  it('localizza il mittente Aeronautica Militare / MeteoAlarm IT', () => {
    expect(translateMeteoAlertSender('Italian Meteorological Service')).toBe(
      'Servizio Meteorologico Italiano'
    );
    expect(translateMeteoAlertSender('Italian Air Force National Meteorological Service')).toBe(
      'Servizio Meteorologico Aeronautica Militare'
    );
  });

  it('non salta la traduzione solo perché compare METEOALARM nel disclaimer inglese', () => {
    const raw =
      'Moderate intensity weather phenomena expected EMILIAN APENNINES (DISCLAIMER: "Information provided on METEOALARM for Italy regard only the intensity';
    const out = translateMeteoAlertDescription(raw);
    expect(out).toMatch(/Previsti fenomeni meteo di intensità moderata/i);
    expect(out).toMatch(/Appennino emiliano/i);
    expect(out).not.toMatch(/Moderate intensity weather phenomena expected/i);
  });

  it('localizza descrizione MeteoAlarm Aeronautica Militare (formato screenshot)', () => {
    const out = translateMeteoAlertDescription(
      'Moderate intensity weather phenomena expected EMILIAN APENNINES (DISCLAIMER: "Information provided on METEOALARM for Italy regard only the intensity and recurrence of the phenomena, further details can be found at www.meteoam.it. METEOALARM information do not provide the assessment of impact on the territory and they do not"'
    );
    expect(out).toMatch(/Previsti fenomeni meteo di intensità moderata/i);
    expect(out).toMatch(/Appennino emiliano/i);
    expect(out).toMatch(/Nota MeteoAlarm/i);
    expect(out).toMatch(/impatto sul territorio/i);
    expect(out).toMatch(/meteoam\.it/i);
    expect(out).not.toMatch(/DISCLAIMER/i);
    expect(out).not.toMatch(/Information provided on METEOALARM/i);
  });

  it('renderAlertsBanner — alert Aeronautica Militare in italiano', () => {
    const html = renderAlertsBanner(
      {
        alerts: [
          {
            event: 'Moderate Thunderstorm Warning',
            description:
              'Moderate intensity weather phenomena expected EMILIAN APENNINES (DISCLAIMER: "Information provided on METEOALARM for Italy regard only the intensity and recurrence of the phenomena, further details can be found at www.meteoam.it.")',
            sender: 'Italian Air Force National Meteorological Service',
            start: '2026-06-07T12:00:00.000Z',
            end: '2026-06-09T17:59:00.000Z',
          },
        ],
      },
      { cssPrefix: 'dashboard-meteo' }
    );
    expect(html).toContain('Avviso temporali moderato');
    expect(html).toContain('Servizio Meteorologico Aeronautica Militare');
    expect(html).toContain('Appennino emiliano');
    expect(html).not.toContain('Italian Air Force');
    expect(html).not.toContain('DISCLAIMER');
  });

  it('localizeMeteoAlert conserva l’originale', () => {
    const loc = localizeMeteoAlert({
      event: 'Thunderstorm Warning',
      description: 'Be aware of thunderstorms.',
      sender: 'Italian Meteorological Service',
      tags: ['Thunderstorm'],
    });
    expect(loc.event).toBe('Avviso temporali');
    expect(loc.eventOriginal).toBe('Thunderstorm Warning');
    expect(loc.sender).toBe('Servizio Meteorologico Italiano');
  });

  it('renderAlertsBanner mostra titolo alert in italiano', () => {
    const html = renderAlertsBanner(
      {
        alerts: [
          {
            event: 'Yellow Thunderstorm Warning',
            description: 'Be aware of the possibility of thunderstorms.',
            sender: 'Italian Meteorological Service',
            start: '2026-06-01T10:00:00.000Z',
          },
        ],
      },
      { cssPrefix: 'dashboard-meteo' }
    );
    expect(html).toContain('Avviso temporali');
    expect(html).toContain('Servizio Meteorologico Italiano');
    expect(html).not.toContain('Yellow Thunderstorm Warning');
    expect(html).not.toContain('Italian Meteorological Service');
  });
});
