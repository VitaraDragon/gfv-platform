import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  translateMeteoAlertEvent,
  translateMeteoAlertDescription,
  translateMeteoAlertSender,
  localizeMeteoAlert,
  localizeMeteoAlerts,
  alertTextLooksEnglish,
} from '../core/config/meteo-alert-i18n.js';
import { renderAlertsBanner } from '../core/js/meteo-ui-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/meteo-alerts-openweather.json'), 'utf8')
);

function expectFullyItalian(loc) {
  expect(alertTextLooksEnglish(loc.event), `event still EN: ${loc.event}`).toBe(false);
  expect(alertTextLooksEnglish(loc.description), `description still EN: ${loc.description}`).toBe(false);
  expect(alertTextLooksEnglish(loc.sender), `sender still EN: ${loc.sender}`).toBe(false);
  expect(loc.event).toMatch(/^(Avviso|Allerta)\s/i);
}

describe('meteo-alert-i18n', () => {
  it('traduce eventi MeteoAlarm comuni in inglese', () => {
    expect(translateMeteoAlertEvent('Thunderstorm Warning')).toBe('Avviso temporali');
    expect(translateMeteoAlertEvent('Severe Thunderstorm Warning')).toBe('Avviso temporali grave');
    expect(translateMeteoAlertEvent('Heavy Rain Warning')).toBe('Avviso pioggia intensa');
    expect(translateMeteoAlertEvent('Wind Warning')).toBe('Avviso vento');
  });

  it('traduce temperature alte e basse (titolo)', () => {
    expect(translateMeteoAlertEvent('High Temperature Warning')).toBe('Avviso temperature elevate');
    expect(translateMeteoAlertEvent('Low Temperature Warning')).toBe('Avviso temperature basse');
    expect(translateMeteoAlertEvent('Extreme Heat Warning')).toBe('Avviso caldo estremo');
    expect(translateMeteoAlertEvent('Extreme Cold Warning')).toBe('Avviso freddo estremo');
    expect(translateMeteoAlertEvent('Moderate Cold Warning')).toBe('Avviso freddo moderato');
    expect(translateMeteoAlertEvent('Yellow Moderate Heat Warning')).toBe('Avviso caldo moderato');
  });

  it('traduce vento, alluvioni, neve, nebbia, ghiaccio, costa, incendi, valanghe', () => {
    expect(translateMeteoAlertEvent('Extreme Wind Warning')).toBe('Avviso vento estremo');
    expect(translateMeteoAlertEvent('Flood Warning')).toBe('Avviso alluvioni');
    expect(translateMeteoAlertEvent('Heavy Snow Warning')).toBe('Avviso neve intensa');
    expect(translateMeteoAlertEvent('Fog Warning')).toBe('Avviso nebbia');
    expect(translateMeteoAlertEvent('Ice Warning')).toBe('Avviso ghiaccio');
    expect(translateMeteoAlertEvent('Coastal Event Warning')).toBe('Avviso eventi costieri');
    expect(translateMeteoAlertEvent('Forest Fire Warning')).toBe('Avviso incendi boschivi');
    expect(translateMeteoAlertEvent('Avalanche Warning')).toBe('Avviso valanghe');
  });

  it('traduce prefissi colore MeteoAlarm (Yellow/Orange/Red)', () => {
    expect(translateMeteoAlertEvent('Yellow Thunderstorm Warning')).toBe('Avviso temporali');
    expect(translateMeteoAlertEvent('Orange Rain Warning')).toBe('Avviso pioggia');
    expect(translateMeteoAlertEvent('Red Wind Warning')).toBe('Avviso vento');
  });

  it('usa i tag OpenWeather se il titolo evento è generico', () => {
    expect(translateMeteoAlertEvent('Thunderstorm', ['Thunderstorm'])).toBe('Avviso temporali');
    expect(translateMeteoAlertEvent('Weather Alert', ['Rain'])).toBe('Avviso pioggia');
    expect(translateMeteoAlertEvent('Weather Alert', ['Heat'])).toBe('Avviso caldo');
    expect(translateMeteoAlertEvent('Weather Alert', ['Cold'])).toBe('Avviso freddo');
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

  it('applica sostituzioni lessicali sulla descrizione (tempo, vento, alluvioni)', () => {
    const heat = translateMeteoAlertDescription(
      'High temperatures are expected during the afternoon.'
    );
    expect(heat).toMatch(/temperature elevate/i);
    expect(heat).toMatch(/sono previsti/i);
    expect(heat).toMatch(/pomeriggio/i);
    expect(alertTextLooksEnglish(heat)).toBe(false);

    const cold = translateMeteoAlertDescription(
      'Low temperatures and frost are forecast overnight.'
    );
    expect(cold).toMatch(/temperature basse/i);
    expect(cold).toMatch(/gelate/i);
    expect(alertTextLooksEnglish(cold)).toBe(false);

    const flood = translateMeteoAlertDescription(
      'There is a risk of flooding and flash flood in low-lying areas.'
    );
    expect(flood).toMatch(/rischio di allagamenti/i);
    expect(flood).toMatch(/alluvione improvvisa/i);
    expect(alertTextLooksEnglish(flood)).toBe(false);
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
    expect(translateMeteoAlertSender('Protezione Civile')).toBe('Protezione Civile');
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
    expectFullyItalian(loc);
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

  it('fixture OpenWeather — tutti gli alert localizzati in italiano', () => {
    const localized = localizeMeteoAlerts(FIXTURES);
    expect(localized.length).toBe(FIXTURES.length);
    for (const loc of localized) {
      expectFullyItalian(loc);
    }
  });

  it('fixture — banner dashboard senza testo inglese', () => {
    const html = renderAlertsBanner(
      { alerts: localizeMeteoAlerts(FIXTURES.slice(0, 6)) },
      { cssPrefix: 'dashboard-meteo' }
    );
    expect(html).not.toMatch(/\bWarning\b/);
    expect(html).not.toMatch(/\bThunderstorm\b/);
    expect(html).not.toMatch(/\bTemperature\b/);
    expect(html).not.toMatch(/Italian Meteorological Service/);
  });
});
