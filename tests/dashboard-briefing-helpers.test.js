/**
 * Briefing proattivo di Tony sulla dashboard (checkGlobalStatus in dashboard-standalone.html).
 * - Il saluto segue la fascia oraria della policy (prima era una lista casuale con «Buongiorno!» anche alle 20:35).
 * - Il meteo (Cloud Function senza timeout) si aspetta al massimo 4 s: con meteo a 12 s il briefing
 *   partiva a ~16 s. Se il meteo arriva dopo, va comunque nel contesto di Tony.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BRIEFING_METEO_ATTESA_MS,
  attendiConLimite,
  salutoBriefingPerOra,
} from '../core/js/dashboard-briefing-helpers.js';
import {
  decideProactiveBriefingAction,
  formatProactiveDeltaMessage,
  loadProactiveBriefingState,
  saveProactiveBriefingState,
} from '../core/js/tony-proactive-briefing-policy.js';
import {
  buildRawProactiveCounts,
  collectProactiveSignals,
  formatProactiveOpsAttentionSnippet,
  pickProactiveOpenFollowUp,
  pickProactiveOpenFollowUpFromDelta,
  createProactiveOpenOffer,
} from '../core/config/tony-proactive-signals.js';

function alle(ore, minuti = 0) {
  return new Date(2026, 9, 22, ore, minuti, 0, 0);
}

function dopo(ms, valore) {
  return new Promise((r) => setTimeout(() => r(valore), ms));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('salutoBriefingPerOra', () => {
  it('ore 5: Buongiorno', () => {
    expect(salutoBriefingPerOra(alle(5))).toBe('Buongiorno!');
  });
  it('ore 12: Buon pomeriggio', () => {
    expect(salutoBriefingPerOra(alle(12))).toBe('Buon pomeriggio!');
  });
  it('ore 18: Buonasera', () => {
    expect(salutoBriefingPerOra(alle(18))).toBe('Buonasera!');
  });
  it('ore 23: Buonasera', () => {
    expect(salutoBriefingPerOra(alle(23))).toBe('Buonasera!');
  });
  it('bordi: 4:59 sera, 11:59 mattina, 17:59 pomeriggio, 20:35 sera', () => {
    expect(salutoBriefingPerOra(alle(4, 59))).toBe('Buonasera!');
    expect(salutoBriefingPerOra(alle(11, 59))).toBe('Buongiorno!');
    expect(salutoBriefingPerOra(alle(17, 59))).toBe('Buon pomeriggio!');
    expect(salutoBriefingPerOra(alle(20, 35))).toBe('Buonasera!');
  });
});

describe('attendiConLimite (meteo del briefing)', () => {
  it('limite di 4 s', () => {
    expect(BRIEFING_METEO_ATTESA_MS).toBe(4000);
  });

  it('meteo che risponde dopo 12 s: null entro 4 s', async () => {
    vi.useFakeTimers();
    const meteo = { proactiveText: 'Pioggia domani.' };
    let esito;
    let risolto = false;
    attendiConLimite(dopo(12000, meteo), BRIEFING_METEO_ATTESA_MS).then((v) => {
      esito = v;
      risolto = true;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(risolto).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(risolto).toBe(true);
    expect(esito).toBeNull();
  });

  it('meteo che risponde subito: restituisce il dato', async () => {
    vi.useFakeTimers();
    const meteo = { proactiveText: 'Pioggia domani.' };
    let esito;
    attendiConLimite(Promise.resolve(meteo), BRIEFING_METEO_ATTESA_MS).then((v) => {
      esito = v;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(esito).toBe(meteo);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('meteo in errore: null, senza eccezione', async () => {
    await expect(attendiConLimite(Promise.reject(new Error('rete')), 4000)).resolves.toBeNull();
  });
});

const html = readFileSync(resolve(__dirname, '../core/dashboard-standalone.html'), 'utf8');

function estraiFunzioneAsync(nome) {
  const inizio = html.indexOf(`async function ${nome}(`);
  if (inizio < 0) throw new Error(`${nome} non trovata`);
  let i = html.indexOf('{', html.indexOf(')', inizio));
  let profondita = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') profondita++;
    else if (html[i] === '}') {
      profondita--;
      if (profondita === 0) return html.slice(inizio, i + 1);
    }
  }
  throw new Error(`${nome}: fine non trovata`);
}

function memoria() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function preparaCheckGlobalStatus(meteoPromise) {
  const consegne = [];
  const warn = vi.fn();
  const win = { Tony: { setContext: vi.fn() }, localStorage: memoria() };
  const deps = {
    window: win,
    console: { warn, log() {}, info() {} },
    tonyGlobalBriefingRoles: () => true,
    awaitDashboardCountsSnapshot: async () => ({}),
    getDashboardCountsSnapshot: () => null,
    tonyMeteoBriefingAllowed: () => true,
    loadTonyMeteoBriefingData: () => meteoPromise,
    attendiConLimite,
    BRIEFING_METEO_ATTESA_MS,
    salutoBriefingPerOra,
    collectProactiveSignals,
    buildRawProactiveCounts,
    tonyHasTonyAdvancedModule: () => true,
    loadProactiveBriefingState,
    decideProactiveBriefingAction,
    saveProactiveBriefingState,
    formatProactiveDeltaMessage,
    pickProactiveOpenFollowUp,
    pickProactiveOpenFollowUpFromDelta,
    formatProactiveOpsAttentionSnippet,
    createProactiveOpenOffer,
    tonyDashboardBriefingVoiceAllowed: () => false,
    tonyDashboardPrefetchBriefingVoice: () => {},
    tonyDashboardDeliverBriefing: (testo) => consegne.push({ testo, t: Date.now() }),
  };
  const nomi = Object.keys(deps);
  const crea = new Function(...nomi, `${estraiFunzioneAsync('checkGlobalStatus')}\nreturn checkGlobalStatus;`);
  const checkGlobalStatus = crea(...nomi.map((n) => deps[n]));
  return { win, consegne, warn, checkGlobalStatus };
}

describe('dashboard: checkGlobalStatus con meteo lento', () => {
  const meteoConConsigli = {
    proactiveText: 'Domani pioggia: rimanda i trattamenti.',
    weatherSummary: 'Oggi a Sede: sereno.',
    consigliCount: 2,
    consigli: [],
  };
  const meteoSereno = {
    proactiveText: '',
    weatherSummary: 'Oggi a Sede: sereno.',
    consigliCount: 0,
    consigli: [],
  };

  it('getFriendlyGreeting non è più usato dal briefing della dashboard', () => {
    expect(estraiFunzioneAsync('checkGlobalStatus')).not.toContain('getFriendlyGreeting');
  });

  it('meteo a 12 s: briefing a 4 s + 3 s con saluto serale e senza meteo; meteo poi nel contesto di Tony', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(alle(20, 35));
    const t0 = Date.now();
    const p = preparaCheckGlobalStatus(dopo(12000, meteoConConsigli));
    p.checkGlobalStatus('T1', ['manager'], ['tony', 'meteo'], null);
    await vi.advanceTimersByTimeAsync(BRIEFING_METEO_ATTESA_MS + 3000);
    expect(p.consegne).toHaveLength(1);
    expect(p.consegne[0].t - t0).toBe(7000);
    expect(p.consegne[0].testo).toBe('Buonasera! Tutto sotto controllo in azienda. Chiedimi un riassunto dettagliato quando vuoi.');
    expect(p.win.tonyMeteoBriefing).toBeNull();
    expect(p.win.Tony.setContext).not.toHaveBeenCalledWith('meteoBriefing', expect.anything());

    await vi.advanceTimersByTimeAsync(5000);
    expect(p.win.tonyMeteoBriefing).toBe(meteoConConsigli);
    expect(p.win.tonyGlobalBriefing.meteo).toBe(meteoConConsigli);
    expect(p.win.tonyGlobalBriefing.meteoConsigliCount).toBe(2);
    expect(p.win.Tony.setContext).toHaveBeenCalledWith('globalStatus', p.win.tonyGlobalBriefing);
    expect(p.win.Tony.setContext).toHaveBeenCalledWith('meteoBriefing', meteoConConsigli);
    expect(p.win.Tony.setContext).toHaveBeenLastCalledWith('meteoBriefing', meteoConConsigli);
    expect(p.consegne).toHaveLength(1);
    expect(p.warn).not.toHaveBeenCalled();
  });

  it('meteo subito: briefing a 3 s con il meteo, saluto del mattino', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(alle(8, 0));
    const t0 = Date.now();
    const p = preparaCheckGlobalStatus(Promise.resolve(meteoSereno));
    p.checkGlobalStatus('T1', ['manager'], ['tony', 'meteo'], null);
    await vi.advanceTimersByTimeAsync(3000);
    expect(p.consegne).toHaveLength(1);
    expect(p.consegne[0].t - t0).toBe(3000);
    expect(p.consegne[0].testo).toBe('Buongiorno! Oggi a Sede: sereno. Chiedimi un riassunto dettagliato quando vuoi.');
    expect(p.win.tonyMeteoBriefing).toBe(meteoSereno);
    expect(p.win.Tony.setContext).toHaveBeenCalledWith('meteoBriefing', meteoSereno);
    expect(p.warn).not.toHaveBeenCalled();
  });
});
