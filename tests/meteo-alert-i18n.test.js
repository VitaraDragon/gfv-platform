import { describe, it, expect } from 'vitest';
import {
  translateMeteoAlertEvent,
  translateMeteoAlertDescription,
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

  it('localizeMeteoAlert conserva l’originale', () => {
    const loc = localizeMeteoAlert({
      event: 'Thunderstorm Warning',
      description: 'Be aware of thunderstorms.',
    });
    expect(loc.event).toBe('Avviso temporali');
    expect(loc.eventOriginal).toBe('Thunderstorm Warning');
  });

  it('renderAlertsBanner mostra titolo alert in italiano', () => {
    const html = renderAlertsBanner(
      {
        alerts: [
          {
            event: 'Thunderstorm Warning',
            description: 'Be aware of the possibility of thunderstorms.',
            start: '2026-06-01T10:00:00.000Z',
          },
        ],
      },
      { cssPrefix: 'dashboard-meteo' }
    );
    expect(html).toContain('Avviso temporali');
    expect(html).not.toContain('Thunderstorm Warning');
  });
});
