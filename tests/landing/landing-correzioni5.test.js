/**
 * Correzioni 5 – anteprima landing Tony (PR #323).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  collegaTerreniAiPoderi,
  unisciDati,
} from '../../landing/src/lib/tony-aiuto-account.js';
import {
  BUSSATA_AUTOMATICA_MOBILE_MS,
  BUSSATA_AUTOMATICA_MS,
  formatoClip,
  ritardoBussataAutomaticaMs,
  tempiScena,
} from '../../landing/src/lib/tony-bussa-logica.js';
import { LIMITI } from '../../landing/src/lib/generati/tony-landing-setup-core.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const require = createRequire(import.meta.url);
const {
  preparaTestoVoce,
} = require('../../functions/lib/tony-landing-voce.js');
const {
  promptSistemaAccount,
  rispostaAccountDaTesto,
  togliDomandaCapProvincia,
  togliRiaperturaPoderi,
} = require('../../functions/lib/tony-landing-account.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function leggi(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('correzioni 5 – OK a inizio frase per la voce', () => {
  it('sostituisce OK/Ok/Okay all’inizio, lascia il resto', () => {
    expect(preparaTestoVoce('OK, continuiamo.')).toMatch(/^Va bene/);
    expect(preparaTestoVoce('Ok, passiamo ai terreni.')).toMatch(/^Va bene/);
    expect(preparaTestoVoce('Okay, fatto.')).toMatch(/^Va bene/);
    expect(preparaTestoVoce('Vedi https://esempio.it ok')).toBe('Vedi ok');
  });
});

describe('correzioni 5 – limite 5 terreni', () => {
  it('accetta il 5° e rifiuta solo il 6° anche con lista cumulativa', () => {
    expect(LIMITI.MAX_TERRENI_PER_RICHIESTA).toBe(5);
    const base = {
      sede: null,
      poderi: [{ nome: 'Nord' }],
      terreni: [
        { nome: 'T1', superficie: 1, coltura: 'Grano', podere: 'Nord' },
        { nome: 'T2', superficie: 1, coltura: 'Grano', podere: 'Nord' },
        { nome: 'T3', superficie: 1, coltura: 'Grano', podere: 'Nord' },
        { nome: 'T4', superficie: 1, coltura: 'Grano', podere: 'Nord' },
      ],
    };
    const quinto = unisciDati(
      base,
      {
        terreni: [
          ...base.terreni,
          { nome: 'T5', superficie: 1, coltura: 'Mais', podere: 'Nord' },
        ],
      },
      'terreni'
    );
    expect(quinto.troppiTerreni).toBe(false);
    expect(quinto.dati.terreni).toHaveLength(5);

    const sesto = unisciDati(
      quinto.dati,
      {
        terreni: [
          ...quinto.dati.terreni,
          { nome: 'T6', superficie: 1, coltura: 'Orzo', podere: 'Nord' },
        ],
      },
      'terreni'
    );
    expect(sesto.troppiTerreni).toBe(true);
    expect(sesto.dati.terreni).toHaveLength(5);
  });
});

describe('correzioni 5 – non riaprire i poderi', () => {
  it('prompt e filtro testo in fase terreni', () => {
    const prompt = promptSistemaAccount('terreni', {
      raccolti: 'Poderi: Nord\nTerreno: Campo A',
    });
    expect(prompt).toMatch(/Flusso lineare/);
    expect(prompt).toMatch(/non richiedere di nuovo sede né poderi/i);

    expect(
      togliRiaperturaPoderi('Hai dei poderi? Ne hai altri o vediamo il riepilogo?')
    ).toMatch(/Ne hai altri/);
    expect(
      togliRiaperturaPoderi('Hai dei poderi?')
    ).toMatch(/riepilogo/i);

    const out = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Hai dei poderi? Dimmi pure un altro terreno.',
        terreni: [],
        fatto: false,
      }),
      { argomento: 'terreni', raccolti: 'Poderi: Nord' }
    );
    expect(out.testo).not.toMatch(/hai dei poderi/i);
  });

  it('Torna alla chat riparte dai terreni', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toMatch(/passoAiuto\.value = 'terreni'/);
    expect(chat).toMatch(/next < cur/);
  });

  it('un solo podere assegna in automatico', () => {
    const uniti = collegaTerreniAiPoderi({
      poderi: [{ nome: 'Nord' }],
      terreni: [{ nome: 'Campo', superficie: 1, coltura: null, podere: null }],
    });
    expect(uniti.terreni[0].podere).toBe('Nord');
  });
});

describe('correzioni 5 – sede senza CAP/provincia', () => {
  it('prompt e filtro non chiedono CAP/provincia', () => {
    const prompt = promptSistemaAccount('sede');
    expect(prompt).toMatch(/NON chiedere provincia né CAP/);
    expect(prompt).toMatch(/via \(con numero civico\) e comune/);
    expect(testiLanding.tonyBussa.aiuto.domandaSede).toMatch(/via.*comune/);

    expect(
      togliDomandaCapProvincia('Qual è il CAP? E la provincia?')
    ).toMatch(/via e comune/i);

    const out = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Ok. Qual è il CAP?',
        sede: { indirizzo: 'Via Roma 1', citta: 'Faenza' },
        fatto: false,
      }),
      { argomento: 'sede' }
    );
    expect(out.testo).not.toMatch(/\bCAP\b/);
  });
});

describe('correzioni 5 – bussata telefono e pillola', () => {
  it('ritardo mobile più corto e clip leggera', () => {
    expect(ritardoBussataAutomaticaMs('mobile')).toBe(BUSSATA_AUTOMATICA_MOBILE_MS);
    expect(ritardoBussataAutomaticaMs('desktop')).toBe(BUSSATA_AUTOMATICA_MS);
    expect(BUSSATA_AUTOMATICA_MOBILE_MS).toBeLessThan(BUSSATA_AUTOMATICA_MS);
    expect(tempiScena({ variante: 'mobile' }).entrataMs).toBeLessThan(
      tempiScena({ variante: 'desktop' }).entrataMs
    );
    expect(
      formatoClip({
        userAgent: 'Mozilla/5.0 (Linux; Android 13)',
        maxTouchPoints: 5,
        webmAlfaSupportato: true,
        preferisciLeggero: true,
      })
    ).toBe('webp');
  });

  it('pillola solo dopo tonyGiaApparso', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toContain('tonyGiaApparso');
    expect(home).toMatch(
      /v-if="tonyOn && tonyGiaApparso && !avvisoAperto && \(!stageAperto \|\| tonyRidotto\)"/
    );
    expect(home).toContain('ritardoBussataAutomaticaMs');
  });
});

describe('correzioni 5 – informativa e spazio Tony', () => {
  it('consenso senza max-height/scroll interno', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toMatch(/\.consenso-invio[\s\S]*?max-height:\s*none/);
    expect(chat).toMatch(/\.informativa-aiuto[\s\S]*?max-height:\s*none/);
  });

  it('padding-right sulla pagina con Tony mobile', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toMatch(
      /\.landing-pagina--tony[\s\S]*?padding-right:\s*calc\(min\(32vw,\s*140px\)/
    );
  });
});

describe('correzioni 5 – CTA account (solo verifica)', () => {
  it('con modulo disponibile apre TonyRegistrazione in pannello, altrimenti link standalone', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toMatch(/v-if="moduloDisponibile && !moduloAperto && !faseAiuto"/);
    expect(chat).toContain('@click="apriModulo"');
    expect(chat).toContain('URL_REGISTRAZIONE');
    expect(chat).toMatch(/v-else-if="!moduloAperto && !faseAiuto"/);
  });
});
