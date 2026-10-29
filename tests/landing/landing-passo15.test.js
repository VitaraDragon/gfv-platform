/**
 * @vitest-environment node
 * Passo 15: ritocchi R1–R5, email contatto, tetto in aiuto, avvisi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EMAIL_CONTATTO,
  PAGINE_LEGALI,
  PEC_CONTATTO,
  TESTO_CHI_SIAMO,
  IVA_CONFERMATA,
  TESTI_LEGALI_PRONTI,
  DOMINIO_CONFERMATO,
  URL_SITO,
} from '../../landing/src/config/landing-config.js';
import { cosaMancaPerAccendere } from '../../landing/src/lib/landing-logica.js';
import { mappaSegnapostoPaginaLegale } from '../../landing/src/lib/pagine-tecniche.js';
import { testiPagineTecniche } from '../../landing/src/content/testi-pagine-tecniche.js';
import { messaggioErroreSetup } from '../../landing/src/lib/tony-aiuto-account.js';
import { passaggioClip } from '../../landing/src/lib/tony-bussa-logica.js';
import { parametroTonyAiuto } from '../../landing/src/lib/tony-chat-finto.js';
import { azionePerEsito } from '../../landing/src/lib/tony-chat-logica.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function leggi(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('R1 Torna alla chat', () => {
  it('ripristina stato salvato, non forza campoAttivo true', () => {
    const t = leggi('landing/src/components/TonyChat.vue');
    expect(t).toMatch(/statoPrimaDellaScheda/);
    expect(t).toMatch(/function onTornaDallaScheda/);
    const fn = t.slice(
      t.indexOf('function onTornaDallaScheda'),
      t.indexOf('async function suVoceFatto')
    );
    expect(fn).not.toMatch(/campoAttivo\.value = true/);
    expect(fn).toMatch(/statoPrimaDellaScheda\.campoAttivo/);
  });
});

describe('R2 email contatto GFV', () => {
  it('mai email utente', () => {
    const t = leggi('landing/src/lib/tony-aiuto-account.js');
    expect(t).not.toMatch(/emailCtx/);
    expect(t).toMatch(/const email = EMAIL_CONTATTO \|\| ''/);
    const msg = messaggioErroreSetup(
      { motivo: 'senza-azienda' },
      { email: 'mario@example.com' }
    );
    expect(msg).not.toContain('mario@example.com');
    expect(msg).toContain('info@globalfarmview.net');
  });
});

describe('R3 EMAIL_CONTATTO', () => {
  it('valore, cosaManca, legale, prompt senza email', () => {
    expect(EMAIL_CONTATTO).toBe('info@globalfarmview.net');
    const manca = cosaMancaPerAccendere({
      emailContatto: EMAIL_CONTATTO,
      testoChiSiamo: TESTO_CHI_SIAMO,
      ivaConfermata: IVA_CONFERMATA,
      testiLegaliPronti: TESTI_LEGALI_PRONTI,
      dominioConfermato: DOMINIO_CONFERMATO,
    });
    expect(manca.join(' ')).not.toMatch(/email di contatto/i);
    const mappa = mappaSegnapostoPaginaLegale({
      pagina: PAGINE_LEGALI.privacy,
      pagineLegali: PAGINE_LEGALI,
      testi: testiPagineTecniche,
      urlSito: URL_SITO,
      emailContatto: EMAIL_CONTATTO,
      pecContatto: PEC_CONTATTO,
      conSezioneTony: false,
    });
    expect(JSON.stringify(mappa)).toMatch(/mailto:info@globalfarmview\.net/);
    const prompt = leggi('functions/lib/tony-landing-prompt.js');
    const kb = leggi('functions/config/tony-landing-kb.js');
    expect(prompt).not.toMatch(/info@globalfarmview\.net/);
    expect(kb).not.toMatch(/info@globalfarmview\.net/);
    expect(prompt + kb).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(prompt + kb).toMatch(/fondo (della |alla )?pagina/);
  });
});

describe('R4 Annulla modulo', () => {
  it('modulo→idle subito; chat scrive protetta', () => {
    expect(
      passaggioClip({
        da: 'modulo',
        a: 'idle',
        codaInAttesa: ['scrive'],
      })
    ).toMatchObject({ modo: 'subito', lista: ['idle'] });
    expect(
      passaggioClip({
        da: 'scrive',
        a: 'idle',
        codaInAttesa: ['scrive'],
      }).lista
    ).toEqual(['scrive', 'idle']);
  });
});

describe('R5 voce e aria', () => {
  it('suVoceFatto senza riduciMovimento; aria-describedby in scheda', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    const voce = chat.slice(
      chat.indexOf('async function suVoceFatto'),
      chat.indexOf('async function onSchedaSalvata')
    );
    expect(voce).not.toMatch(/riduciMovimento/);
    expect(voce).toMatch(/if \(!altoparlante\.value\) return/);

    const scheda = leggi('landing/src/components/TonySchedaConferma.vue');
    const invalids = scheda.match(/:aria-invalid=/g) || [];
    const described = scheda.match(/:aria-describedby=/g) || [];
    expect(described.length).toBe(invalids.length);
    expect(scheda).toMatch(/tony-scheda-err-sede-indirizzo/);
    expect(scheda).toMatch(/tony-scheda-err-terreni-.*-superficie/);
    const errRighe = scheda.match(/class="err"/g) || [];
    expect(errRighe.length).toBeGreaterThanOrEqual(8);
  });
});

describe('F tonyaiuto=tetto', () => {
  it('parametro e azione aiuto-sospeso', () => {
    expect(parametroTonyAiuto('?tonyaiuto=tetto')).toBe('tetto');
    expect(
      azionePerEsito({ codice: 'tetto', fase: 'account' }).tipo
    ).toBe('aiuto-sospeso');
  });
});

describe('Isolamento file ritocchi', () => {
  it('niente firebase / parametri finti fuori da DEV', () => {
    const files = [
      'landing/src/components/TonyChat.vue',
      'landing/src/components/TonySchedaConferma.vue',
      'landing/src/lib/tony-aiuto-account.js',
      'landing/src/lib/tony-bussa-logica.js',
    ];
    for (const f of files) {
      const t = leggi(f);
      expect(t, f).not.toMatch(/firebase-landing/);
      if (!f.endsWith('TonyChat.vue')) {
        expect(t, f).not.toMatch(/tonyfinto|tonyaiuto|tonysetup/);
      }
    }
  });
});
