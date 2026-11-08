/**
 * Landing round 2 – F5, passo dati, ortaggi, dashboard, ripiego.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  allineaPassoAiuto,
  colturaOrtaggiGenerica,
  erroriColturaTerreniForm,
  esitoRipiegoAccount,
  normalizzaColturaCatalogo,
} from '../../landing/src/lib/tony-aiuto-account.js';
import { azionePerEsito } from '../../landing/src/lib/tony-chat-logica.js';
import { urlDashboardDopoRegistrazione } from '../../landing/src/lib/tony-registrazione.js';

const require = createRequire(import.meta.url);
const {
  parseJsonAccount,
  rispostaAccountDaTesto,
  TESTO_RIPIEGO,
} = require('../../functions/lib/tony-landing-account.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function leggi(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('round2 – passo segue i dati', () => {
  it('terreni in risposta durante sede, senza poderi → chiede i poderi', () => {
    expect(
      allineaPassoAiuto(
        'sede',
        { sede: { indirizzo: 'Via Roma 1', citta: 'Faenza' }, poderi: [], terreni: [] },
        { terreni: [{ nome: 'Campo A', superficie: 1, coltura: 'Grano' }] },
        'ok'
      )
    ).toBe('poderi');
  });

  it('terreni in risposta durante sede, podere già detto → passo terreni', () => {
    expect(
      allineaPassoAiuto(
        'sede',
        {
          sede: { indirizzo: 'Via Roma 1', citta: 'Faenza' },
          poderi: [{ nome: 'Nord' }],
          terreni: [],
        },
        { terreni: [{ nome: 'Campo A', superficie: 1, coltura: 'Grano' }] },
        'ok'
      )
    ).toBe('terreni');
  });

  it('poderi in risposta con sede → passo poderi', () => {
    expect(
      allineaPassoAiuto(
        'sede',
        { sede: { indirizzo: 'Via Roma 1', citta: 'Faenza' }, poderi: [], terreni: [] },
        { poderi: [{ nome: 'Nord' }] },
        'ok'
      )
    ).toBe('poderi');
  });

  it('«No, solo quello» con ≥1 podere → terreni', () => {
    expect(
      allineaPassoAiuto(
        'poderi',
        { sede: null, poderi: [{ nome: 'Nord' }], terreni: [] },
        {},
        'No, solo quello'
      )
    ).toBe('terreni');
  });
});

describe('round2 – ortaggi e scheda', () => {
  it('normalizza coltura case-insensitive', () => {
    expect(normalizzaColturaCatalogo('pesco')).toBe('Pesco');
    expect(colturaOrtaggiGenerica('ortaggi')).toBe(true);
  });

  it('scheda: categoria Ortive senza coltura → errore', () => {
    const err = erroriColturaTerreniForm(
      [{ nome: 'Orto Sud', coltura: '' }],
      { terreni: [{ nome: 'Orto Sud', categoria: 'Ortive' }] }
    );
    expect(err[0].campo).toBe('terreni[0].coltura');
    expect(err[0].errore).toMatch(/Pomodoro/);
  });
});

describe('round2 – accesso e ripiego', () => {
  it('accesso-mancante non disabilita il campo', () => {
    const azione = azionePerEsito({
      codice: 'accesso-mancante',
      fase: 'account',
      http: 401,
    });
    expect(azione.tipo).toBe('accesso-mancante');
    expect(azione.campoAttivo).toBe(true);
  });

  it('ripiego server e client', () => {
    expect(
      esitoRipiegoAccount({ testo: TESTO_RIPIEGO, ripiego: true })
    ).toBe(true);
    expect(parseJsonAccount('testo sporco {"testo":"ciao","fatto":false}')).toMatchObject({
      testo: 'ciao',
    });
    const out = rispostaAccountDaTesto('non json', {});
    expect(out.ripiego).toBe(true);
    expect(out.jsonOk).toBe(false);
  });
});

describe('round2 – wiring sorgenti', () => {
  it('authStateReady in firebase-landing-account', () => {
    const src = leggi('landing/src/lib/firebase-landing-account.js');
    expect(src).toMatch(/authStateReady/);
  });

  it('TonyStage non fa signOut onUnmounted', () => {
    const src = leggi('landing/src/components/TonyStage.vue');
    const unmount = src.match(/onUnmounted\(\(\)\s*=>\s*\{[\s\S]*?\n\}\);/);
    expect(unmount, 'blocco onUnmounted').toBeTruthy();
    expect(unmount[0]).not.toMatch(/esciDopoRegistrazione|signOut/);
    expect(src).toMatch(/onVaiDashboard[\s\S]*esciDopoRegistrazione/);
  });

  it('LandingHome ripristino intervista senza bussata', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toContain('apriScenaRipristinoIntervista');
    expect(home).toContain('ripristinoIntervistaAttivo');
    expect(home).toContain('programmaTettoSalutoAudio');
  });

  it('url dashboard con frammento email', () => {
    const url = urlDashboardDopoRegistrazione('a@b.it');
    expect(url).toContain('#email=');
    expect(url).toContain('registered=true');
  });
});
