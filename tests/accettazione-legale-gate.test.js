/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pianoGate, eseguiGate, risolviTenantERuoli } from '../core/js/accettazione-legale-gate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (rel) => readFileSync(join(root, rel), 'utf8');

const config = {
  DOCUMENTI_LEGALI: {
    'termini-b2b': { versione: 'termini-b2b-2026-03-01', url: 'https://example.com/termini' },
    privacy: { versione: 'privacy-2026-03-01', url: 'https://example.com/privacy' },
    dpa: { versione: 'dpa-2026-03-01', url: 'https://example.com/dpa' },
    'informativa-lavoratori': {
      versione: 'informativa-lavoratori-2026-03-01',
      url: 'https://example.com/lavoratori'
    }
  }
};

describe('pianoGate', () => {
  it('flag spento: nessuna chiamata e nessuna UI', async () => {
    const leggiStato = vi.fn();
    const mostra = vi.fn();
    const piano = pianoGate({
      attiva: false,
      configOk: true,
      ruoli: ['amministratore'],
      accettazioni: [],
      config
    });
    expect(piano).toEqual({ chiamare: false, mostra: false, canale: '', ruolo: '', mancanti: [] });
    const esito = await eseguiGate({
      attiva: false,
      configOk: true,
      ruoli: ['amministratore'],
      config,
      leggiStato,
      mostra
    });
    expect(esito).toEqual({ mostrato: false });
    expect(leggiStato).not.toHaveBeenCalled();
    expect(mostra).not.toHaveBeenCalled();
  });

  it('admin senza accettazioni: mostra termini, privacy e dpa', () => {
    const piano = pianoGate({
      attiva: true,
      configOk: true,
      ruoli: ['amministratore'],
      accettazioni: [],
      config
    });
    expect(piano.canale).toBe('registrazione');
    expect(piano.mostra).toBe(true);
    expect(piano.mancanti.map((riga) => riga.tipo)).toEqual(['termini-b2b', 'privacy', 'dpa']);
  });

  it('operaio: solo informativa lavoratori', () => {
    const piano = pianoGate({
      attiva: true,
      configOk: true,
      ruoli: ['operaio'],
      accettazioni: [],
      config
    });
    expect(piano.canale).toBe('invito');
    expect(piano.mancanti.map((riga) => riga.tipo)).toEqual(['informativa-lavoratori']);
  });

  it('stessa versione: non mostra', async () => {
    const mostra = vi.fn();
    const esito = await eseguiGate({
      attiva: true,
      configOk: true,
      ruoli: ['operaio'],
      config,
      leggiStato: async () => [{
        tipo: 'informativa-lavoratori',
        versione: 'informativa-lavoratori-2026-03-01'
      }],
      mostra
    });
    expect(esito).toEqual({ mostrato: false });
    expect(mostra).not.toHaveBeenCalled();
  });
});

describe('eseguiGate: stato non leggibile → ingresso bloccato', () => {
  const base = { attiva: true, configOk: true, ruoli: ['operaio'], config };

  it('senza mostraErrore rilancia (chi chiama deve bloccare)', async () => {
    const mostra = vi.fn();
    await expect(eseguiGate(Object.assign({}, base, {
      leggiStato: async () => { throw new Error('unavailable'); },
      mostra
    }))).rejects.toThrow('unavailable');
    expect(mostra).not.toHaveBeenCalled();
  });

  it('con mostraErrore che non viene risolto resta in attesa: non entra', async () => {
    const mostra = vi.fn();
    const mostraErrore = vi.fn(() => new Promise(() => {}));
    const gate = eseguiGate(Object.assign({}, base, {
      leggiStato: async () => { throw new Error('unavailable'); },
      mostra,
      mostraErrore
    }));
    const esito = await Promise.race([gate.then(() => 'entrato'), new Promise((r) => setTimeout(() => r('bloccato'), 30))]);
    expect(esito).toBe('bloccato');
    expect(mostraErrore).toHaveBeenCalledTimes(1);
    expect(mostra).not.toHaveBeenCalled();
  });

  it('Riprova: rilegge e poi mostra la richiesta di accettazione', async () => {
    let tentativi = 0;
    const mostra = vi.fn().mockResolvedValue();
    const mostraErrore = vi.fn().mockResolvedValue();
    const esito = await eseguiGate(Object.assign({}, base, {
      leggiStato: async () => {
        tentativi += 1;
        if (tentativi === 1) throw new Error('unavailable');
        return [];
      },
      mostra,
      mostraErrore
    }));
    expect(tentativi).toBe(2);
    expect(mostraErrore).toHaveBeenCalledTimes(1);
    expect(mostra).toHaveBeenCalledTimes(1);
    expect(esito).toEqual({ mostrato: true });
  });

  it('flag spento: leggiStato e mostraErrore mai chiamati', async () => {
    const leggiStato = vi.fn();
    const mostraErrore = vi.fn();
    expect(await eseguiGate(Object.assign({}, base, { attiva: false, leggiStato, mostraErrore }))).toEqual({ mostrato: false });
    expect(leggiStato).not.toHaveBeenCalled();
    expect(mostraErrore).not.toHaveBeenCalled();
  });
});

describe('gate per azienda', () => {
  it('seconda azienda: stato vuoto per az2 → richiede l\'informativa anche se accettata in az1', async () => {
    const statoPerTenant = {
      az1: [{ tipo: 'informativa-lavoratori', versione: 'informativa-lavoratori-2026-03-01' }],
      az2: []
    };
    const mostra = vi.fn().mockResolvedValue();
    for (const tenantId of ['az1', 'az2']) {
      await eseguiGate({
        attiva: true, configOk: true, ruoli: ['operaio'], config,
        leggiStato: async () => statoPerTenant[tenantId],
        mostra
      });
    }
    expect(mostra).toHaveBeenCalledTimes(1);
  });

  it('risolviTenantERuoli: contesto, poi tenant corrente con ruoli della membership, poi legacy', () => {
    const user = {
      tenantId: 'az1',
      ruoli: ['amministratore'],
      tenantMemberships: { az1: { ruoli: ['amministratore'] }, az2: { ruoli: ['operaio'] } }
    };
    const daMembership = (data, t) => (data.tenantMemberships[t] && data.tenantMemberships[t].ruoli) || [];
    expect(risolviTenantERuoli({ tenantId: 'az2', ruoli: ['caposquadra'] }, user, 'az1', daMembership))
      .toEqual({ tenantId: 'az2', ruoli: ['caposquadra'] });
    expect(risolviTenantERuoli(null, user, 'az2', daMembership)).toEqual({ tenantId: 'az2', ruoli: ['operaio'] });
    expect(risolviTenantERuoli(null, user, '', null)).toEqual({ tenantId: 'az1', ruoli: ['amministratore'] });
    // Ruoli legacy di un'altra azienda non si applicano al tenant corrente.
    expect(risolviTenantERuoli(null, { tenantId: 'az1', ruoli: ['amministratore'] }, 'az2', null))
      .toEqual({ tenantId: 'az2', ruoli: [] });
  });

  it('avviaDaFirebase passa il tenantId alla callable stato', () => {
    const src = leggi('core/js/accettazione-legale-gate.js');
    expect(src).toMatch(/callable\(\{ azione: 'stato', tenantId \}\)/);
    expect(src).toMatch(/mostraErrore,\s*\n\s*leggiStato/);
  });
});

describe('pagine di ingresso: flag acceso non è fail-open', () => {
  it('dashboard: con flag acceso un errore di caricamento blocca', () => {
    const html = leggi('core/dashboard-standalone.html');
    const inizio = html.indexOf('async function attendiAccettazioneLegaleSeServe');
    const blocco = html.slice(inizio, html.indexOf('function applicaIngressoDopoLogin', inizio));
    expect(blocco).toContain('flagAcceso = true');
    expect(blocco).toMatch(/if \(!flagAcceso\)/);
    expect(blocco).toContain('bloccaIngressoLegale()');
    expect(blocco).toContain('await new Promise(() => {})');
  });

  it('field workspace: il controller parte solo dopo il gate', () => {
    const html = leggi('core/mobile/field-workspace-standalone.html');
    expect(html).not.toMatch(/<script type="module" src="\.\/js\/field-workspace-controller\.js/);
    const gate = html.indexOf('await gate.avviaDaFirebase(');
    const controller = html.indexOf("await import('./js/field-workspace-controller.js?v=2026-10-21b')");
    expect(gate).toBeGreaterThan(-1);
    expect(controller).toBeGreaterThan(gate);
    expect(html).toMatch(/if \(!bloccato\) \{\s*await import\('\.\/js\/field-workspace-controller/);
  });
});
