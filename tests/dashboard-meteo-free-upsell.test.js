import { describe, it, expect } from 'vitest';
import {
  meteoFreeUpsell,
  MSG_METEO_PIANO_BASE,
  ABBONAMENTO_HREF_DASHBOARD,
} from '../core/js/meteo-ui-helpers.js';

describe('meteoFreeUpsell', () => {
  it('piano Free → messaggio Base con link Abbonamento', () => {
    const u = meteoFreeUpsell({ planId: 'free' });
    expect(u).toEqual({
      showUpsell: true,
      message: MSG_METEO_PIANO_BASE,
      linkHref: ABBONAMENTO_HREF_DASHBOARD,
      linkLabel: 'Vai ad Abbonamento →',
    });
    expect(u.message).toContain('piano Base');
  });

  it('piano Base / altro → nessun upsell', () => {
    expect(meteoFreeUpsell({ planId: 'base' })).toBeNull();
    expect(meteoFreeUpsell({ planId: 'pro' })).toBeNull();
    expect(meteoFreeUpsell({})).toBeNull();
  });
});
