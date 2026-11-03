import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('initDashboardMeteo Free: messaggio una volta e side hidden', () => {
    const src = readFileSync(join(process.cwd(), 'core/js/dashboard-meteo.js'), 'utf8');
    const freeBlock = src.slice(src.indexOf('const freeUpsell'), src.indexOf('if (side) side.hidden = false'));
    expect(freeBlock).toContain('side.hidden = true');
    expect(freeBlock).toContain('dashboard-meteo-row--free-single');
    expect(freeBlock.match(/freeUpsell\.message/g) || []).toHaveLength(1);
  });
});

