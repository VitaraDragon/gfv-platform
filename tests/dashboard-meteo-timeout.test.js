import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  conTimeoutOFallback,
  messaggioMeteoDashboard,
  METEO_FETCH_TIMEOUT_MS,
  MSG_SEDE_PIN_MANCANTE,
} from '../core/js/meteo-ui-helpers.js';

describe('timeout meteo e operatività', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('meteo ok e conteggi appesi → fallback conteggi entro 15 s', async () => {
    vi.useFakeTimers();
    const opsVuoti = { programmatiOggi: 0, inCorso: 0, oreDaValidare: 0, timedOut: true };
    const opsAppesi = new Promise(() => {});
    const p = conTimeoutOFallback(opsAppesi, METEO_FETCH_TIMEOUT_MS, opsVuoti);
    vi.advanceTimersByTime(METEO_FETCH_TIMEOUT_MS);
    await expect(p).resolves.toEqual(opsVuoti);
  });

  it('meteo appeso → messaggio timeout', async () => {
    vi.useFakeTimers();
    const fallback = { ok: false, timedOut: true, code: 'TIMEOUT' };
    const p = conTimeoutOFallback(new Promise(() => {}), METEO_FETCH_TIMEOUT_MS, fallback);
    vi.advanceTimersByTime(METEO_FETCH_TIMEOUT_MS);
    const esito = await p;
    expect(esito.timedOut).toBe(true);
    expect(messaggioMeteoDashboard({ timedOut: true })).not.toMatch(/Caricamento/i);
  });

  it('SEDE_NOT_SET → messaggio con pin', () => {
    const msg = messaggioMeteoDashboard({ code: 'SEDE_NOT_SET' });
    expect(msg).toBe(MSG_SEDE_PIN_MANCANTE);
    expect(msg).toMatch(/pin della sede/i);
    expect(msg).not.toMatch(/Caricamento/i);
  });
});
