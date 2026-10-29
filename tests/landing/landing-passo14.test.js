/**
 * @vitest-environment node
 * Passo 14: ritocchi R1–R6, clip argomenti, setup-core generato, aiuto account.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { generaTesto } from '../../landing/scripts/genera-setup-core-landing.mjs';
import {
  CLIP_IN_LOOP,
  CLIP_PER_ARGOMENTO,
  CLIP_UNA_VOLTA,
  DURATE_CLIP_MS,
  dopoFineClip,
  passaggioClip,
  percorsoVoceFatto,
  percorsiClipArgomenti,
  scalettaArgomento,
  scalettaClip,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  controllaScheda,
  esitoSalvataggio,
  messaggioErroreSetup,
  numeroDaTesto,
  nuovoRequestId,
  PASSI_AIUTO,
  payloadDaScheda,
  prossimoPasso,
  unisciDati,
} from '../../landing/src/lib/tony-aiuto-account.js';
import {
  azionePerEsito,
  corpoRichiesta,
  MESSAGGI_CHAT,
} from '../../landing/src/lib/tony-chat-logica.js';
import { chiediFinto } from '../../landing/src/lib/tony-chat-finto.js';
import { EMAIL_CONTATTO } from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const require = createRequire(import.meta.url);
const coreCjs = require('../../functions/lib/tony-landing-setup-core.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TONY_LIVE = path.join(ROOT, 'landing/public/tony-live');

function md5File(p) {
  return createHash('md5').update(fs.readFileSync(p)).digest('hex');
}

function leggi(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const CLIP_A1 = [
  ['tony-topic-sede-desktop-576x720-alpha-v4.webm', 327379, '7896f796e86ff4f612dd599679c7df63'],
  ['tony-topic-sede-mobile-432x540-alpha-v4.webm', 233849, '9b87bd82bdecedb6290b42c4e39135fb'],
  ['tony-topic-sede-desktop-576x720-12fps-v4.webp', 527380, 'd85f26fb7cdfa2815b3adf9b9edcb125'],
  ['tony-topic-sede-mobile-432x540-12fps-v4.webp', 376452, '939a6f28a2b1111a42930db659032f32'],
  ['tony-topic-sede-desktop-576x1440-stacked-alpha-v4.mp4', 459172, 'd936577831e243f293b08ac7f3630b93'],
  ['tony-topic-sede-mobile-432x1080-stacked-alpha-v4.mp4', 310057, 'dc7cde9b5d49e87db56b49737868fcd3'],
  ['tony-topic-poderi-2s5-desktop-576x720-alpha-v4.webm', 249903, '2aabdd28097f6a6dd6e3afc103409d92'],
  ['tony-topic-poderi-2s5-mobile-432x540-alpha-v4.webm', 177876, 'fdc60bd68529b16455b345727c2a8d38'],
  ['tony-topic-poderi-2s5-desktop-576x720-12fps-v4.webp', 452228, '673801c539766f7fce907b0a63279246'],
  ['tony-topic-poderi-2s5-mobile-432x540-12fps-v4.webp', 321814, '71cfbb3809603ade502ca375a6bf64bd'],
  ['tony-topic-poderi-2s5-desktop-576x1440-stacked-alpha-v4.mp4', 361891, '67cf433f906e897f7a31d992f17b47e3'],
  ['tony-topic-poderi-2s5-mobile-432x1080-stacked-alpha-v4.mp4', 242242, 'c3abb611f41e92871363e464dccba077'],
  ['tony-topic-terreni-desktop-576x720-alpha-v4.webm', 295603, '8cb9f9e2b0b2d152e9f29d1b653713b3'],
  ['tony-topic-terreni-mobile-432x540-alpha-v4.webm', 210809, '904c4aaaaba16a6592f61dc0db220365'],
  ['tony-topic-terreni-desktop-576x720-12fps-v4.webp', 546120, '527a10ad5079232a4f2523e0a4033db2'],
  ['tony-topic-terreni-mobile-432x540-12fps-v4.webp', 388564, 'e1e56e7c82950531813b8493a8aa45e6'],
  ['tony-topic-terreni-desktop-576x1440-stacked-alpha-v4.mp4', 434538, '8f2ee31a798cb157aefb56f590472fcf'],
  ['tony-topic-terreni-mobile-432x1080-stacked-alpha-v4.mp4', 292993, 'db6c3485e10753611f1c471cdff1c48a'],
];

describe('R1–R4 ritocchi', () => {
  it('R1 onChiudiModulo ripristina stato', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toMatch(/statoPrimaDelModulo/);
    expect(chat).not.toMatch(/function onChiudiModulo\(\)[\s\S]{0,200}campoAttivo\.value = true;/);
  });

  it('R2 saluta controlla invioInCorso', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toMatch(/if \(invioInCorso\.value\) return;/);
    expect(home).not.toMatch(
      /if \(fase\.value === 'modulo' \|\| registrazioneCompletata\.value\) return;/
    );
    expect(home).toMatch(/'modulo'/);
    expect(home).toMatch(/registrazioneCompletata\.value = false/);
  });

  it('R3 Esc solo su .tony-reg / .tony-scheda', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toMatch(/\.tony-reg/);
    expect(home).toMatch(/\.tony-scheda/);
  });

  it('R4 login try/catch senza console', () => {
    const login = leggi('core/auth/login-standalone.html');
    expect(login).toMatch(/login-email-precompilata\.js/);
    const blocco = login.slice(
      login.indexOf('login-email-precompilata'),
      login.indexOf('login-email-precompilata') + 800
    );
    expect(login).toMatch(/try\s*\{[\s\S]*login-email-precompilata/);
    expect(blocco).not.toMatch(/console\./);
  });
});

describe('R5 R6 passaggioClip', () => {
  it('scaletta modulo e passaggioClip', () => {
    expect(scalettaClip('idle', 'modulo')).toEqual(['topicRegistrazione', 'scrive']);
    expect(passaggioClip({ da: 'pensa', a: 'scrive' }).modo).toBe('subito');
    expect(passaggioClip({ da: 'scrive', a: 'idle' }).modo).toBe('fineGiro');
    expect(
      passaggioClip({
        da: 'scrive',
        a: 'idle',
        codaInAttesa: ['scrive'],
      }).lista
    ).toEqual(['scrive', 'idle']);
    expect(passaggioClip({ da: 'scrive', a: 'parla' }).modo).toBe('subito');
    expect(passaggioClip({ da: 'idle', a: 'esce' }).modo).toBe('subito');
    expect(passaggioClip({ da: 'modulo', a: 'idle' }).modo).toBe('subito');
    expect(passaggioClip({ da: 'pensa', a: 'scrive', riduciMovimento: true }).lista).toEqual(
      []
    );
  });

  it('TonyStage usa dopoFineClip e passaggioClip', () => {
    const stage = leggi('landing/src/components/TonyStage.vue');
    expect(stage).toMatch(/dopoFineClip/);
    expect(stage).toMatch(/passaggioClip/);
    expect(stage).toMatch(/codaClip = \['entry', 'idle'\]/);
  });

  it('sequenza vera delle clip con timer finti', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    // tonyfinto=ok: thinking → scrive al primo pezzo (~700) → idle non prima di scrive+3583
    {
      const registro = [];
      let fase = 'pensa';
      let inizioScrive = null;
      let testoIniziatoA = null;

      registro.push({ t: 0, clip: 'thinking' });

      const p = chiediFinto({
        domanda: 'cosa fa gfv?',
        storia: [],
        scenario: 'ok',
        onPezzo: () => {
          if (testoIniziatoA != null) return;
          testoIniziatoA = Date.now();
          const dec = passaggioClip({
            da: 'pensa',
            a: 'scrive',
            clipCorrente: 'thinking',
          });
          expect(dec.modo).toBe('subito');
          expect(dec.lista).toEqual(['scrive']);
          fase = 'scrive';
          inizioScrive = Date.now();
          registro.push({ t: inizioScrive, clip: 'scrive' });
        },
      });

      await vi.advanceTimersByTimeAsync(700);
      expect(testoIniziatoA).toBe(700);
      expect(registro.find((e) => e.clip === 'scrive').t).toBe(700);

      await vi.advanceTimersByTimeAsync(8000);
      await p;
      expect(fase).toBe('scrive');
      const decIdle = passaggioClip({ da: 'scrive', a: 'idle' });
      expect(decIdle.modo).toBe('fineGiro');
      const tIdle = inizioScrive + DURATE_CLIP_MS.scrive;
      registro.push({ t: tIdle, clip: 'idle' });
      expect(tIdle).toBeGreaterThanOrEqual(700 + DURATE_CLIP_MS.scrive);
      expect(testoIniziatoA).toBeLessThan(inizioScrive + DURATE_CLIP_MS.scrive);
    }

    // tonyfinto=lento: thinking a 0, 2375, 4750; scrive ~6000
    {
      vi.setSystemTime(0);
      const registro = [];
      let fase = 'pensa';
      let t = 0;
      while (t < 6000) {
        registro.push({ t, clip: 'thinking' });
        const dec = dopoFineClip({
          nome: 'thinking',
          fase,
          inLoop: false,
          codaDopoCorrente: null,
        });
        expect(dec.azione).toBe('ripeti');
        t += DURATE_CLIP_MS.thinking;
      }
      expect(registro.map((e) => e.t)).toEqual([0, 2375, 4750]);

      let testoIniziatoA = null;
      const p = chiediFinto({
        domanda: 'cosa fa gfv?',
        storia: [],
        scenario: 'lento',
        onPezzo: () => {
          if (testoIniziatoA != null) return;
          testoIniziatoA = Date.now();
          fase = 'scrive';
          registro.push({ t: Date.now(), clip: 'scrive' });
        },
      });
      await vi.advanceTimersByTimeAsync(6000);
      expect(testoIniziatoA).toBe(6000);
      expect(registro.find((e) => e.clip === 'scrive').t).toBe(6000);
      await vi.advanceTimersByTimeAsync(4000);
      await p;
      expect(fase).toBe('scrive');
      expect(6000 + DURATE_CLIP_MS.scrive).toBe(6000 + 3583);
    }

    // voce: scrive → parla passa subito a talking
    {
      const dec = passaggioClip({ da: 'scrive', a: 'parla' });
      expect(dec.modo).toBe('subito');
      expect(dec.lista).toEqual(['talking']);
    }

    // R4: modulo aperto, Annulla → idle subito, niente scrive
    {
      const dec = passaggioClip({
        da: 'modulo',
        a: 'idle',
        clipCorrente: 'topicRegistrazione',
        codaInAttesa: ['scrive'],
      });
      expect(dec.modo).toBe('subito');
      expect(dec.lista).toEqual(['idle']);
      expect(dec.lista).not.toContain('scrive');
      // chat: scrive in coda resta protetta
      expect(
        passaggioClip({
          da: 'scrive',
          a: 'idle',
          codaInAttesa: ['scrive'],
        }).lista
      ).toEqual(['scrive', 'idle']);
    }

    expect(CLIP_UNA_VOLTA).toContain('thinking');
    vi.useRealTimers();
  });
});

describe('B clip argomenti', () => {
  it('chiavi durate percorsi', () => {
    expect(CLIP_PER_ARGOMENTO.sede).toBe('topicSede');
    expect(DURATE_CLIP_MS.topicSede).toBe(2792);
    expect(DURATE_CLIP_MS.topicPoderi).toBe(2500);
    expect(DURATE_CLIP_MS.topicTerreni).toBe(3042);
    expect(CLIP_IN_LOOP).not.toContain('topicSede');
    expect(scalettaArgomento('sede')).toEqual(['topicSede', 'idle']);
    expect(scalettaArgomento('x')).toBeNull();
    expect(percorsiClipArgomenti('webm', 'desktop').length).toBe(3);
    expect(percorsoVoceFatto().mp3).toBe('/tony-live/voci/tony-fatto.mp3');
  });
});

describe('A asset', () => {
  it('18 clip + 2 voce', () => {
    for (const [nome, byte, md5] of CLIP_A1) {
      const p = path.join(TONY_LIVE, nome);
      expect(fs.existsSync(p), nome).toBe(true);
      expect(fs.statSync(p).size).toBe(byte);
      expect(md5File(p)).toBe(md5);
    }
    const mp3 = path.join(TONY_LIVE, 'voci/tony-fatto.mp3');
    const vtt = path.join(TONY_LIVE, 'voci/tony-fatto.vtt');
    expect(fs.statSync(mp3).size).toBe(63572);
    expect(md5File(mp3)).toBe('21db3cb5d0e97dfcc26d1e1a42085a08');
    expect(fs.statSync(vtt).size).toBe(90);
    expect(md5File(vtt)).toBe('dcd0574b4479f9173659ac9f980d8a99');
    expect(fs.readFileSync(vtt, 'utf8')).toMatch(
      /Fatto! Per 7 giorni ti guido anche dentro l'app\./
    );
    expect(fs.existsSync(path.join(TONY_LIVE, 'voci/tony-fatto.wav'))).toBe(false);
  });
});

describe('D file generato', () => {
  it('uguale a generaTesto e parità controlli', async () => {
    const core = leggi('functions/lib/tony-landing-setup-core.js');
    const colture = leggi('functions/config/colture-predefinite.js');
    const generato = leggi('landing/src/lib/generati/tony-landing-setup-core.js');
    expect(generato.replace(/\r\n/g, '\n')).toBe(
      generaTesto(core, colture).replace(/\r\n/g, '\n')
    );
    expect(generato).not.toMatch(/\brequire\b/);
    expect(generato).not.toMatch(/firebase/);
    expect(generato).not.toMatch(/admin/);
    expect(generato).not.toMatch(/process\.env/);

    const es = await import('../../landing/src/lib/generati/tony-landing-setup-core.js');
    const casi = [
      { requestId: 'abcdefgh', sede: null, poderi: [], terreni: [] },
      {
        requestId: 'abcdefgh',
        sede: { indirizzo: 'Via Roma 1', citta: 'Faenza', cap: '48018', provincia: 'RA' },
        poderi: [],
        terreni: [],
      },
      {
        requestId: 'abcdefgh',
        sede: { indirizzo: 'Via', citta: 'Faenza', cap: '48', provincia: 'RA' },
        poderi: [],
        terreni: [],
      },
      {
        requestId: 'abcdefgh',
        sede: { indirizzo: 'Via Roma 1', citta: 'Faenza', cap: '48018', provincia: 'ra' },
        poderi: [],
        terreni: [],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: '2,34', coltura: 'Grano', podere: null }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 0, coltura: 'Grano', podere: null }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 1001, coltura: 'Grano', podere: null }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 2.345, coltura: 'Grano', podere: null }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: Array.from({ length: 6 }, (_, i) => ({
          nome: 'T' + i,
          superficie: 1,
          coltura: 'Grano',
          podere: null,
        })),
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [{ nome: 'A' }, { nome: 'a' }],
        terreni: [],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 1, coltura: 'mele', podere: null }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 1, coltura: 'seminativo', podere: null }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 1, coltura: 'Grano', podere: 'Inesistente' }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [],
        tenantId: 'x',
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [],
        piva: '1',
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 1, coltura: 'Grano', podere: null, confini: {} }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', ettari: 1, coltura: 'Grano', podere: null }],
      },
      { requestId: 'abc', sede: null, poderi: [], terreni: [] },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [{ nome: 'Casetti' }],
        terreni: [],
      },
      {
        requestId: 'abcdefgh',
        sede: { indirizzo: 'Via Roma 1', citta: 'Faenza', cap: '48018', provincia: 'RA' },
        poderi: [{ nome: 'Casetti' }],
        terreni: [
          { nome: 'Campo grande', superficie: 2.34, coltura: 'Grano', podere: 'Casetti' },
        ],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 1, coltura: 'Melo', podere: null }],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Campo', superficie: 1, coltura: null, podere: null }],
      },
      {
        requestId: 'abcdefgh-ijkl',
        sede: { indirizzo: 'Via Lunga 10', citta: 'Bologna', cap: '40121', provincia: 'BO' },
        poderi: [],
        terreni: [],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [{ nome: 'Nord' }, { nome: 'Sud' }],
        terreni: [
          { nome: 'A', superficie: 1, coltura: 'Mais', podere: 'Nord' },
          { nome: 'B', superficie: 2, coltura: 'Orzo', podere: null },
        ],
      },
      {
        requestId: 'abcdefgh',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'X', superficie: 0.01, coltura: 'Grano', podere: null }],
      },
    ];
    expect(casi.length).toBeGreaterThanOrEqual(25);
    for (const c of casi) {
      const a = coreCjs.validaRichiestaSetup(c);
      const b = es.validaRichiestaSetup(c);
      expect(b.ok).toBe(a.ok);
      if (a.ok) {
        const ra = coreCjs.risolviControAzienda(a.richiesta, {
          poderi: [],
          terreni: [],
          coltureAzienda: [],
        });
        const rb = es.risolviControAzienda(b.richiesta, {
          poderi: [],
          terreni: [],
          coltureAzienda: [],
        });
        expect(rb.ok).toBe(ra.ok);
      } else {
        expect(b.motivo || b.codice).toBe(a.motivo || a.codice);
      }
    }
  });
});

describe('E aiuto puro', () => {
  it('passi unisci numero payload', () => {
    expect(PASSI_AIUTO).toEqual(['sede', 'poderi', 'terreni']);
    expect(prossimoPasso('sede')).toBe('poderi');
    expect(prossimoPasso('terreni')).toBeNull();
    expect(numeroDaTesto('2,34')).toBe(2.34);
    expect(numeroDaTesto('x')).toBeNull();
    const u = unisciDati(
      { sede: null, poderi: [], terreni: [] },
      { sede: { indirizzo: 'Via', citta: 'Faenza', cap: '48018', provincia: 'RA' } },
      'sede'
    );
    expect(u.dati.sede.citta).toBe('Faenza');
    const UUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const id1 = nuovoRequestId();
    const id2 = nuovoRequestId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(UUID);
    expect(id2).toMatch(UUID);
    const realCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { randomUUID: undefined });
    const id3 = nuovoRequestId();
    const id4 = nuovoRequestId();
    expect(id3).not.toBe(id4);
    vi.stubGlobal('crypto', realCrypto);
    const schedaSrc = leggi('landing/src/components/TonySchedaConferma.vue');
    expect(schedaSrc).toMatch(/const requestId = ref\(nuovoRequestId\(\)\)/);
    const onSalva = schedaSrc.slice(schedaSrc.indexOf('async function onSalva'));
    expect(onSalva).not.toMatch(/nuovoRequestId\(/);
    const payload = payloadDaScheda(
      {
        sede: { indirizzo: 'Via 1', citta: 'Faenza', cap: '', provincia: '' },
        poderi: [{ nome: 'Casetti' }],
        terreni: [{ nome: 'Campo', superficie: '2,34', coltura: 'Grano', podere: 'Casetti' }],
      },
      id1
    );
    expect(payload.terreni[0].superficie).toBe(2.34);
    const check = controllaScheda(payload);
    expect(check.ok).toBe(true);
    expect(esitoSalvataggio({ giaSalvato: true }).ok).toBe(true);

    const err = testiLanding.tonyBussa.aiuto.errori;
    expect(messaggioErroreSetup({ motivo: 'non-collegato' })).toBe(err.nonCollegato);
    expect(messaggioErroreSetup({ motivo: 'unauthenticated' })).toBe(err.nonCollegato);
    expect(messaggioErroreSetup({ motivo: 'app-check' })).toBe(err.appCheck);
    expect(messaggioErroreSetup({ motivo: 'failed-precondition' })).toBe(err.appCheck);
    expect(messaggioErroreSetup({ motivo: 'troppe-chiamate' })).toBe(err.troppeChiamate);
    expect(messaggioErroreSetup({ motivo: 'resource-exhausted' })).toBe(err.troppeChiamate);
    expect(messaggioErroreSetup({ motivo: 'dati-non-validi' })).toBe(err.datiNonValidi);
    expect(messaggioErroreSetup({ motivo: 'invalid-argument' })).toBe(err.datiNonValidi);
    expect(messaggioErroreSetup({ motivo: 'niente-da-salvare' })).toBe(err.nienteDaSalvare);
    const senzaAz = messaggioErroreSetup(
      { motivo: 'senza-azienda' },
      { email: 'mario@example.com' }
    );
    expect(senzaAz).toBe(
      err.senzaAzienda + ' ' + err.contatto.replace('{email}', EMAIL_CONTATTO)
    );
    expect(senzaAz).toContain('info@globalfarmview.net');
    expect(senzaAz).not.toContain('mario@example.com');
    expect(
      messaggioErroreSetup({ motivo: 'non-autorizzato' }, { email: 'mario@example.com' })
    ).not.toContain('mario@example.com');
    expect(
      messaggioErroreSetup({
        motivo: 'limite-terreni',
        dettagli: { esistenti: 3, limite: 5 },
      })
    ).toBe(
      err.limiteTerreni.replace('{esistenti}', '3').replace('{rimasti}', '2')
    );
    expect(messaggioErroreSetup({ motivo: 'limite-terreni' })).toMatch(/Ne hai già 0/);
    expect(messaggioErroreSetup({ motivo: 'gia-preparato' })).toBe(err.giaPreparato);
    expect(messaggioErroreSetup({ motivo: 'already-exists' })).toBe(err.giaPreparato);
    expect(messaggioErroreSetup({ motivo: 'rete' })).toBe(err.rete);
    expect(messaggioErroreSetup({ motivo: 'unavailable' })).toBe(err.rete);
    expect(messaggioErroreSetup({ motivo: 'codice-strano' })).toBe(err.rete);
  });
});

describe('G client logica', () => {
  it('corpoRichiesta e azione account', () => {
    expect(Object.keys(corpoRichiesta({ domanda: 'a', sessione: 'b'.repeat(16), storia: [] }))).toEqual([
      'domanda',
      'sessione',
      'storia',
    ]);
    expect(
      Object.keys(
        corpoRichiesta({
          domanda: 'a',
          sessione: 'b'.repeat(16),
          storia: [],
          fase: 'account',
          argomento: 'sede',
        })
      ).sort()
    ).toEqual(['argomento', 'domanda', 'fase', 'sessione', 'storia']);
    const az = azionePerEsito({ codice: 'limite-account', fase: 'account' });
    expect(az.tipo).toBe('aiuto-sospeso');
    expect(MESSAGGI_CHAT.limiteAccount).toBeTruthy();
    expect(MESSAGGI_CHAT.accessoMancante).toBeTruthy();
  });
});

describe('Isolamento e testi', () => {
  it('niente firebase/tonyfinto nei file nuovi', () => {
    const files = [
      'landing/src/components/TonyChat.vue',
      'landing/src/lib/tony-chat-client.js',
      'landing/src/lib/tony-chat-logica.js',
      'landing/src/lib/tony-chat-finto.js',
      'landing/src/lib/tony-clip-player.js',
      'landing/src/components/TonySchedaConferma.vue',
      'landing/src/lib/tony-aiuto-account.js',
    ];
    for (const f of files) {
      const t = leggi(f);
      if (f.endsWith('tony-chat-finto.js')) continue;
      expect(t, f).not.toMatch(/firebase-landing/);
      if (!f.endsWith('TonyChat.vue')) {
        expect(t, f).not.toMatch(/tonyfinto|tonyaiuto|tonysetup/);
      }
    }
    const setupFinto = leggi('landing/src/lib/tony-setup-finto.js');
    expect(setupFinto).not.toMatch(/localStorage|sessionStorage/);
    expect(setupFinto).not.toMatch(/console\./);
    const aiuto = leggi('landing/src/lib/tony-aiuto-account.js');
    expect(aiuto).not.toMatch(/localStorage|sessionStorage|console\./);
  });

  it('testi J parola per parola', () => {
    const a = testiLanding.tonyBussa.aiuto;
    expect(a.invito).toBe(
      'Vuoi che ti aiuti a preparare l\'azienda? Ti faccio tre domande: sede legale, poderi e terreni. Puoi saltarne una con "Dopo".'
    );
    expect(a.fatto).toBe("Fatto! Per 7 giorni ti guido anche dentro l'app.");
    expect(a.domandaSede).toMatch(/sede legale/);
    expect(a.errori.nonCollegato).toBe('Prima crea il tuo account, poi salviamo i dati.');
  });
});
