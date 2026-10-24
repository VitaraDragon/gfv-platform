/**
 * @vitest-environment node
 * Registrazione (landing e invito): se fallisce solo registraAccettazioniLegali dopo
 * account/membership, niente rollback e redirect normale; il gate chiede l'accettazione.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import {
  registraAccettazioneDopoAccount,
  messaggioFineRegistrazione,
  ESITO_ACCETTAZIONE,
  MESSAGGIO_ACCETTAZIONE_RIMANDATA
} from '../core/js/accettazione-legale-registrazione.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (rel) => readFileSync(join(root, rel), 'utf8');

describe('registraAccettazioneDopoAccount', () => {
  it('flag spento: callable mai chiamata', async () => {
    const registra = vi.fn();
    expect(await registraAccettazioneDopoAccount({ attiva: false, registra })).toBe(ESITO_ACCETTAZIONE.SALTATA);
    expect(await registraAccettazioneDopoAccount({ registra })).toBe(ESITO_ACCETTAZIONE.SALTATA);
    expect(registra).not.toHaveBeenCalled();
  });

  it('flag acceso e callable ok: registrata, messaggio invariato', async () => {
    const registra = vi.fn().mockResolvedValue({ data: { ok: true } });
    const esito = await registraAccettazioneDopoAccount({ attiva: true, registra });
    expect(esito).toBe(ESITO_ACCETTAZIONE.REGISTRATA);
    expect(registra).toHaveBeenCalledTimes(1);
    expect(messaggioFineRegistrazione(esito, 'OK')).toBe('OK');
  });

  it('callable fallita: non lancia, esito rimandata e messaggio "conferma al primo accesso"', async () => {
    const avvisa = vi.fn();
    const registra = vi.fn().mockRejectedValue(Object.assign(new Error('internal'), { code: 'functions/internal' }));
    const esito = await registraAccettazioneDopoAccount({ attiva: true, registra, avvisa });
    expect(esito).toBe(ESITO_ACCETTAZIONE.RIMANDATA);
    expect(avvisa).toHaveBeenCalledTimes(1);
    const msg = messaggioFineRegistrazione(esito, 'OK');
    expect(msg).toContain(MESSAGGIO_ACCETTAZIONE_RIMANDATA);
    expect(msg).toContain('dashboard');
  });

  it('callable fallita in un flusso: redirect eseguito, nessun deleteUser', async () => {
    // Stesso ordine delle pagine: account creato → accettazione → messaggio → redirect; il catch con cleanup non si raggiunge.
    const deleteUser = vi.fn();
    const redirect = vi.fn();
    async function flusso(registra) {
      try {
        const esito = await registraAccettazioneDopoAccount({ attiva: true, registra, avvisa: () => {} });
        redirect(messaggioFineRegistrazione(esito, 'ok'));
      } catch (err) {
        deleteUser();
      }
    }
    await flusso(() => Promise.reject(new Error('rete')));
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe('pagine di registrazione usano l\'helper', () => {
  it('landing: callable solo dentro registraAccettazioneDopoAccount, dopo il doc utente e prima del redirect', () => {
    const html = leggi('core/auth/registrazione-standalone.html');
    const helper = html.indexOf('await registraAccettazioneDopoAccount(');
    const callable = html.indexOf("getHttpsCallable('registraAccettazioniLegali')");
    const docUtente = html.lastIndexOf('userDocCreated = true', helper);
    const redirect = html.indexOf("window.location.href = '../dashboard-standalone.html'", helper);
    expect(helper).toBeGreaterThan(-1);
    expect(docUtente).toBeGreaterThan(-1);
    expect(callable).toBeGreaterThan(helper);
    expect(redirect).toBeGreaterThan(callable);
    expect(html.split("getHttpsCallable('registraAccettazioniLegali')").length - 1).toBe(1);
    // Il cleanup con deleteUser resta solo per il caso "doc utente non creato".
    expect(html).toMatch(/if \(firebaseUser && !userDocCreated\)/);
    expect(html).toContain('messaggioFineRegistrazione(esitoLegale');
  });

  it('invito: un solo percorso (callable) passa da completaPresaVisione', () => {
    const html = leggi('core/auth/registrazione-invito-standalone.html');
    expect(html).not.toMatch(/await registraPresaVisioneSeAttiva\(\)/);
    // I fallback client che scrivevano membership sono stati tolti: un solo await.
    expect(html.split('await completaPresaVisione()').length - 1).toBe(1);
    expect(html).toMatch(/registraAccettazioneDopoAccount\(\{\s*attiva: accettazioneLegaleAttiva,\s*registra: registraPresaVisioneSeAttiva/);
    expect(html).not.toContain('deleteUser');
    const parte = html.split('await completaPresaVisione()').slice(1)[0];
    const redirect = parte.indexOf("window.location.href = '../dashboard-standalone.html'");
    expect(redirect).toBeGreaterThan(-1);
    expect(parte.slice(0, redirect)).toContain('messaggioFineRegistrazione(esitoLegale');
  });

  it('invito: niente cellulare né token dalla risposta della callable', () => {
    const html = leggi('core/auth/registrazione-invito-standalone.html');
    expect(html).not.toMatch(/inviteData\.cellulare/);
    expect(html).not.toMatch(/inviteData\.token/);
    expect(html).not.toMatch(/invit[oe]Data\.stato/);
    const svc = leggi('core/services/invito-service-standalone.js');
    expect(svc).not.toMatch(/invit[oe]\w*\.(cellulare|token|stato)\b/);
  });
});
