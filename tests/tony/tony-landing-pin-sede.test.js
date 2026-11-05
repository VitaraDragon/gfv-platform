/**
 * G1 — pin sede / saluto Tony: attesa dell'auto-pin, merge __gfvTenantData, riga «pin tardivo».
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  attendiPinSedeAutoPin,
  costruisciMessaggioPinTardivo,
  ATTESA_PIN_SEDE_MS,
} from '../../core/js/tony/tony-landing-saluto.js';
import {
  esponiAutoPinPromise,
  unisciTenantDataMantenendoSede,
} from '../../core/js/sede-auto-pin.js';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('attendiPinSedeAutoPin', () => {
  it('pin già presente: nessuna attesa', async () => {
    const t0 = Date.now();
    const r = await attendiPinSedeAutoPin(
      () => ({ sedeCoordinate: { lat: 44.4, lng: 11.9 } }),
      () => undefined
    );
    expect(r).toMatchObject({ haPin: true, atteso: false, scaduto: false });
    expect(Date.now() - t0).toBeLessThan(100);
  });

  it('pin mancante + promise che salva il pin: attende e restituisce haPin', async () => {
    const tenant = {};
    const p = new Promise((res) =>
      setTimeout(() => {
        tenant.sedeCoordinate = { lat: 44.4, lng: 11.9 };
        res({ saved: true });
      }, 30)
    );
    const r = await attendiPinSedeAutoPin(() => tenant, () => p, { maxMs: 1000 });
    expect(r.haPin).toBe(true);
    expect(r.atteso).toBe(true);
    expect(r.scaduto).toBe(false);
  });

  it('promise finita senza pin: non aspetta oltre', async () => {
    const t0 = Date.now();
    const r = await attendiPinSedeAutoPin(
      () => ({}),
      () => Promise.resolve({ saved: false, reason: 'no-match' }),
      { maxMs: 2000 }
    );
    expect(r.haPin).toBe(false);
    expect(r.scaduto).toBe(false);
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it('promise rifiutata: equivale a nessun pin', async () => {
    const r = await attendiPinSedeAutoPin(
      () => ({}),
      () => Promise.reject(new Error('boom')),
      { maxMs: 500 }
    );
    expect(r.haPin).toBe(false);
  });

  it('promise mai risolta: scade entro maxMs e restituisce la promise per la riga tardiva', async () => {
    const pendente = new Promise(() => {});
    const t0 = Date.now();
    const r = await attendiPinSedeAutoPin(() => ({}), () => pendente, { maxMs: 80 });
    expect(r.scaduto).toBe(true);
    expect(r.haPin).toBe(false);
    expect(r.promessa).toBe(pendente);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(70);
    expect(Date.now() - t0).toBeLessThan(600);
  });

  it('promise che compare dopo (dashboard lenta): la intercetta con il polling', async () => {
    const tenant = {};
    let p;
    setTimeout(() => {
      p = Promise.resolve().then(() => {
        tenant.sedeCoordinate = { lat: 1, lng: 2 };
      });
    }, 40);
    const r = await attendiPinSedeAutoPin(() => tenant, () => p, { maxMs: 1000, pollMs: 10 });
    expect(r.haPin).toBe(true);
  });

  it('attesa predefinita tra 3 e 4 secondi', () => {
    expect(ATTESA_PIN_SEDE_MS).toBeGreaterThanOrEqual(3000);
    expect(ATTESA_PIN_SEDE_MS).toBeLessThanOrEqual(4000);
  });
});

describe('messaggio pin tardivo', () => {
  it('una riga che inizia con «Ho messo il pin della sede»', () => {
    for (const mode of ['civico', 'centro', undefined]) {
      const t = costruisciMessaggioPinTardivo(mode);
      expect(t).toMatch(/^Ho messo il pin della sede/);
      expect(t).not.toContain('\n');
    }
  });
});

describe('esponiAutoPinPromise', () => {
  it('espone window.__gfvSedeAutoPinPromise e non rifiuta mai', async () => {
    const target = {};
    const p = esponiAutoPinPromise(Promise.reject(new Error('x')), target);
    expect(target.__gfvSedeAutoPinPromise).toBe(p);
    await expect(p).resolves.toMatchObject({ saved: false });
    const ok = esponiAutoPinPromise(Promise.resolve({ saved: true }), target);
    await expect(ok).resolves.toEqual({ saved: true });
  });
});

describe('unisciTenantDataMantenendoSede (merge, non replace)', () => {
  const pin = { lat: 44.42, lng: 11.97 };
  it('snapshot senza pin + pin già in memoria → il pin resta', () => {
    const m = unisciTenantDataMantenendoSede(
      { nome: 'Az', citta: 'Lugo' },
      { modules: ['tony'], plan: 'base' },
      { sedeCoordinate: pin, nome: 'vecchio' }
    );
    expect(m.sedeCoordinate).toEqual(pin);
    expect(m.nome).toBe('Az');
    expect(m.modules).toEqual(['tony']);
  });
  it('snapshot con pin: vince lo snapshot (dato fresco da Firestore)', () => {
    const nuovo = { lat: 1, lng: 2 };
    const m = unisciTenantDataMantenendoSede({ sedeCoordinate: nuovo }, {}, { sedeCoordinate: pin });
    expect(m.sedeCoordinate).toEqual(nuovo);
  });
  it('nessun pin ovunque / memoria assente: nessuna chiave inventata', () => {
    expect(unisciTenantDataMantenendoSede({ nome: 'A' }, {}, null).sedeCoordinate).toBeUndefined();
    expect(unisciTenantDataMantenendoSede(null, { plan: 'x' }, undefined)).toEqual({ plan: 'x' });
  });
  it('coordinate non numeriche in memoria non vengono propagate', () => {
    const m = unisciTenantDataMantenendoSede({}, {}, { sedeCoordinate: { lat: 'x', lng: null } });
    expect(m.sedeCoordinate).toBeUndefined();
  });
});

describe('wiring dashboard + main.js', () => {
  const dash = read('core/dashboard-standalone.html');
  const main = read('core/js/tony/main.js');

  it('dashboard: nessun replace di __gfvTenantData con sola snapshot (due punti di scrittura = merge)', () => {
    expect(dash).not.toMatch(/window\.__gfvTenantData\s*=\s*Object\.assign\(\{\},\s*tenantDataSnapshot/);
    const n = (dash.match(/unisciTenantDataMantenendoSede\(tenantDataSnapshot/g) || []).length;
    expect(n).toBe(2);
  });

  it('dashboard: __gfvSedeAutoPinPromise esposta per tutti i ruoli (admin: auto-pin, altri: risolta)', () => {
    expect(dash).toMatch(/esponiAutoPinPromise\(tryAutoSaveSedePinOnFirstAccess\(/);
    expect(dash).toMatch(/esponiAutoPinPromise\(Promise\.resolve\(\{ saved: false, reason: 'ruolo' \}\)\)/);
  });

  it('dashboard: ultimoAccesso (E4) resta scritto su users/, mai dentro __gfvTenantData', () => {
    const idx = [...dash.matchAll(/ultimoAccesso: serverTimestamp\(\)/g)];
    expect(idx.length).toBeGreaterThanOrEqual(1);
    for (const m of idx) {
      const prima = dash.slice(Math.max(0, m.index - 200), m.index);
      expect(prima).toMatch(/updateDoc\(userDocRef/);
    }
  });

  it('main.js: il saluto attende __gfvSedeAutoPinPromise e dice al massimo una riga tardiva', () => {
    expect(main).toMatch(/attendiPinSedeAutoPin\(/);
    expect(main).toMatch(/window\.__gfvSedeAutoPinPromise/);
    expect(main).toMatch(/__tonyLandingPinTardivoShow/);
    expect(main).toMatch(/__tonyLandingPinTardivoDetto/);
    // la frase del saluto (pinSede) è calcolata DOPO l'attesa
    const iAttesa = main.indexOf('await attendiPinSedeAutoPin(');
    const iShow = main.indexOf('window.__tonyLandingSalutoShow({');
    expect(iAttesa).toBeGreaterThan(0);
    expect(iShow).toBeGreaterThan(iAttesa);
  });

  it('pin tardivo mostrato una sola volta (flag)', () => {
    // simula il corpo di __tonyLandingPinTardivoShow
    const src = main.slice(main.indexOf('window.__tonyLandingPinTardivoShow = function'));
    expect(src.slice(0, 400)).toMatch(/if \(window\.__tonyLandingPinTardivoDetto\) return false;/);
  });
});