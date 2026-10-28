/**
 * Logica voce landing passo 12b (Vitest puro, senza browser e senza rete).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_CARATTERI_TESTO_VOCE,
  MAX_RISPOSTE_VOCE_AUTOMATICHE,
  corpoRichiestaVoce,
  modoVoce,
} from '../../landing/src/lib/tony-chat-logica.js';
import { chiediVoce } from '../../landing/src/lib/tony-voce-client.js';
import { creaPlayerVoce } from '../../landing/src/lib/tony-voce-player.js';
import {
  chiediVoceFinta,
  parametroVoceFinta,
} from '../../landing/src/lib/tony-voce-finta.js';
import { chiediFinto } from '../../landing/src/lib/tony-chat-finto.js';
import { chiediATony } from '../../landing/src/lib/tony-chat-client.js';
import {
  prossimoStato,
  scalettaClip,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  TONY_BUSSA_ATTIVO,
  URL_TONY_LANDING_AUDIO,
} from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { COSTANTI_VOCE } = require('../../functions/lib/tony-landing-voce.js');

const PAROLE_VIETATE = [
  /certificat/i,
  /SIAN/i,
  /a norma/i,
  /quaderno di campagna/i,
  /fattur/i,
  /trattament/i,
];

const ID = 'a1b2c3d4e5f6789012345678abcdef01';

describe('modoVoce e corpo', () => {
  it('combinazioni automatica/pulsante/nessuna', () => {
    const esitoOk = { codice: 'ok', voce: true, idVoce: ID, testo: 'Ciao' };
    expect(
      modoVoce({
        esito: esitoOk,
        altoparlante: true,
        risposteVocaliAutomatiche: 0,
        paginaNascosta: false,
      })
    ).toBe('automatica');
    expect(
      modoVoce({
        esito: esitoOk,
        altoparlante: true,
        risposteVocaliAutomatiche: 2,
        paginaNascosta: false,
      })
    ).toBe('automatica');
    expect(
      modoVoce({
        esito: esitoOk,
        altoparlante: true,
        risposteVocaliAutomatiche: 3,
        paginaNascosta: false,
      })
    ).toBe('pulsante');
    expect(
      modoVoce({
        esito: esitoOk,
        altoparlante: false,
        risposteVocaliAutomatiche: 0,
      })
    ).toBe('pulsante');
    expect(
      modoVoce({
        esito: esitoOk,
        altoparlante: true,
        risposteVocaliAutomatiche: 0,
        paginaNascosta: true,
      })
    ).toBe('pulsante');
    expect(
      modoVoce({
        esito: esitoOk,
        altoparlante: true,
        risposteVocaliAutomatiche: 0,
        riduciMovimento: true,
      })
    ).toBe('automatica');
    expect(
      modoVoce({
        esito: { codice: 'ok', voce: false, idVoce: ID, testo: 'x' },
        altoparlante: true,
        risposteVocaliAutomatiche: 0,
      })
    ).toBe('nessuna');
    expect(
      modoVoce({
        esito: { codice: 'ok', voce: true, testo: 'x' },
        altoparlante: true,
        risposteVocaliAutomatiche: 0,
      })
    ).toBe('nessuna');
    expect(MAX_RISPOSTE_VOCE_AUTOMATICHE).toBe(3);
    expect(MAX_CARATTERI_TESTO_VOCE).toBe(COSTANTI_VOCE.MAX_CARATTERI_TESTO);
    expect(corpoRichiestaVoce({ idVoce: ID, sessione: 's', testo: 't' })).toEqual({
      idVoce: ID,
      sessione: 's',
      testo: 't',
    });
  });
});

describe('chiediVoce', () => {
  it('token null, header, blob e errori', async () => {
    const fetchFn = vi.fn();
    const noToken = await chiediVoce({
      idVoce: ID,
      sessione: 'abcdef0123456789',
      testo: 'Ciao',
      ottieniToken: async () => null,
      fetchFn,
    });
    expect(noToken).toEqual({ ok: false, codice: 'app-check-mancante' });
    expect(fetchFn).not.toHaveBeenCalled();

    fetchFn.mockResolvedValueOnce({
      status: 200,
      headers: { get: () => 'audio/mpeg' },
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }),
    });
    const ok = await chiediVoce({
      idVoce: ID,
      sessione: 'abcdef0123456789',
      testo: 'Ciao',
      ottieniToken: async () => 'tok',
      fetchFn,
    });
    expect(ok.ok).toBe(true);
    expect(fetchFn.mock.calls[0][1].method).toBe('POST');
    expect(fetchFn.mock.calls[0][1].headers['X-Firebase-AppCheck']).toBe('tok');
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      idVoce: ID,
      sessione: 'abcdef0123456789',
      testo: 'Ciao',
    });

    fetchFn.mockResolvedValueOnce({
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ codice: 'voce-gia-usata' }),
    });
    const err = await chiediVoce({
      idVoce: ID,
      sessione: 'abcdef0123456789',
      testo: 'Ciao',
      ottieniToken: async () => 'tok',
      fetchFn,
    });
    expect(err).toEqual({ ok: false, codice: 'voce-gia-usata', http: 409 });

    fetchFn.mockRejectedValueOnce(new Error('offline'));
    const rete = await chiediVoce({
      idVoce: ID,
      sessione: 'abcdef0123456789',
      testo: 'Ciao',
      ottieniToken: async () => 'tok',
      fetchFn,
    });
    expect(rete.codice).toBe('rete');
  });
});

describe('chiediATony idVoce', () => {
  it('restituisce idVoce solo se 32 hex', async () => {
    const stream = [
      'event: done\ndata: {"codice":"ok","testo":"Ciao","voce":true,"idVoce":"' +
        ID +
        '","domandeRimaste":14,"mostraRegistrazione":false}\n\n',
    ];
    const reader = {
      i: 0,
      async read() {
        if (this.i >= stream.length) return { done: true };
        const value = new TextEncoder().encode(stream[this.i++]);
        return { done: false, value };
      },
    };
    const fetchFn = async () => ({
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => reader },
    });
    const esito = await chiediATony({
      domanda: 'x',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => 't',
      fetchFn,
    });
    expect(esito.idVoce).toBe(ID);

    const reader2 = {
      i: 0,
      chunks: [
        'event: done\ndata: {"codice":"ok","testo":"Ciao","voce":true,"idVoce":"NO","domandeRimaste":14,"mostraRegistrazione":false}\n\n',
      ],
      async read() {
        if (this.i >= this.chunks.length) return { done: true };
        return {
          done: false,
          value: new TextEncoder().encode(this.chunks[this.i++]),
        };
      },
    };
    const esito2 = await chiediATony({
      domanda: 'x',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => 't',
      fetchFn: async () => ({
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: { getReader: () => reader2 },
      }),
    });
    expect(esito2.idVoce).toBeUndefined();
  });
});

describe('stati voce', () => {
  it('transizioni e scaletta', () => {
    expect(prossimoStato('scrive', 'voceIniziata')).toBe('parla');
    expect(prossimoStato('pensa', 'voceIniziata')).toBe('parla');
    expect(prossimoStato('parla', 'voceFinita')).toBe('idle');
    expect(prossimoStato('statico', 'voceIniziata')).toBe('statico');
    expect(scalettaClip('scrive', 'parla')).toEqual(['talking']);
    expect(scalettaClip('pensa', 'parla')).toEqual(['talking']);
    expect(scalettaClip('idle', 'pensa')).toEqual(['thinking']);
    expect(scalettaClip('pensa', 'scrive')).toEqual(['scrive']);
  });
});

describe('tony-voce-player', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('suona finita, fallita, interrotta e revoca URL', async () => {
    const urls = [];
    const revocati = [];
    const listeners = {};
    const audio = {
      preload: '',
      src: '',
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      set onplaying(fn) {
        listeners.playing = fn;
      },
      set onended(fn) {
        listeners.ended = fn;
      },
      set onerror(fn) {
        listeners.error = fn;
      },
    };
    const player = creaPlayerVoce({
      AudioCtor: function FakeAudio() {
        return audio;
      },
      createObjectURL: (b) => {
        const u = 'blob:fake-' + urls.length;
        urls.push(u);
        return u;
      },
      revokeObjectURL: (u) => revocati.push(u),
    });

    const onInizio = vi.fn();
    const p = player.suona(new Blob([1]), {
      onInizio,
      attesaMaxMs: 4000,
    });
    listeners.playing();
    listeners.ended();
    expect(await p).toBe('finita');
    expect(onInizio).toHaveBeenCalled();
    expect(revocati).toContain(urls[0]);

    audio.play = vi.fn(() => Promise.reject(new Error('autoplay')));
    expect(await player.suona(new Blob([1]), { attesaMaxMs: 100 })).toBe('fallita');

    vi.useFakeTimers();
    audio.play = vi.fn(() => Promise.resolve());
    const p3 = player.suona(new Blob([1]), { attesaMaxMs: 50 });
    await vi.advanceTimersByTimeAsync(60);
    expect(await p3).toBe('fallita');
    vi.useRealTimers();

    audio.play = vi.fn(() => Promise.resolve());
    const p4 = player.suona(new Blob([1]), { attesaMaxMs: 4000 });
    player.ferma();
    expect(await p4).toBe('interrotta');
  });
});

describe('voce finta', () => {
  it('parametro e chiediVoceFinta senza fetch', async () => {
    expect(parametroVoceFinta('')).toBe('ok');
    expect(parametroVoceFinta('?tonyvoce=1')).toBe('ok');
    expect(parametroVoceFinta('?tonyvoce=lenta')).toBe('lenta');
    expect(parametroVoceFinta('?tonyvoce=errore')).toBe('errore');
    expect(parametroVoceFinta('?tonyvoce=tetto')).toBe('tetto');
    expect(parametroVoceFinta('?tonyvoce=no')).toBe('no');
    expect(parametroVoceFinta('?tonyvoce=xyz')).toBe('ok');

    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('no-fetch');
    });
    const ok = await chiediVoceFinta({
      testo: 'Ciao GFV',
      scenario: 'ok',
      sleepFn: async () => {},
    });
    expect(ok.ok).toBe(true);
    expect(ok.blob.type).toBe('audio/wav');
    expect(ok.blob.size).toBeGreaterThan(0);

    expect(await chiediVoceFinta({ scenario: 'errore', sleepFn: async () => {} })).toEqual({
      ok: false,
      codice: 'voce-errore',
    });
    expect(await chiediVoceFinta({ scenario: 'tetto', sleepFn: async () => {} })).toEqual({
      ok: false,
      codice: 'tetto-voce',
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    vi.useFakeTimers();
    const p = chiediFinto({
      domanda: 'Cosa fa GFV?',
      storia: [],
      sessione: 'abcdef0123456789',
      scenario: 'ok',
      sleepFn: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    await vi.runAllTimersAsync();
    const esito = await p;
    expect(esito.voce).toBe(true);
    expect(esito.idVoce).toMatch(/^[a-f0-9]{32}$/);
    vi.useRealTimers();
  });
});

describe('firebase rete build e testi', () => {
  it('file nuovi senza firebase/elevenlabs; import finta solo in DEV', () => {
    const nuovi = [
      'landing/src/lib/tony-voce-client.js',
      'landing/src/lib/tony-voce-player.js',
      'landing/src/lib/tony-voce-finta.js',
    ];
    for (const rel of nuovi) {
      const testo = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(testo.toLowerCase()).not.toContain('firebase-landing');
      expect(testo).not.toMatch(/from ['"]firebase\//);
      expect(testo).not.toContain('initializeApp');
      expect(testo.toLowerCase()).not.toContain('elevenlabs.io');
      expect(testo).not.toContain('xi-api-key');
    }
    const client = fs.readFileSync(
      path.join(ROOT, 'landing/src/lib/tony-voce-client.js'),
      'utf8'
    );
    expect(client).not.toContain('tony-voce-finta');
    const chat = fs.readFileSync(
      path.join(ROOT, 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(chat).toMatch(/import\.meta\.env\.DEV/);
    expect(chat).toMatch(/import\(['"]\.\.\/lib\/tony-voce-finta/);
    expect(chat).not.toContain('tonyvoce');
    expect(chat).not.toContain('tonyfinto');
    expect(chat).not.toContain('voce finta');
    expect(URL_TONY_LANDING_AUDIO).toBe(
      'https://europe-west1-gfv-platform.cloudfunctions.net/tonyLandingAudio'
    );
    const config = fs.readFileSync(
      path.join(ROOT, 'landing/src/config/landing-config.js'),
      'utf8'
    );
    expect(config).toContain(URL_TONY_LANDING_AUDIO);
    expect(client).toContain('URL_TONY_LANDING_AUDIO');
  });

  it('testi F4 e flag', () => {
    const tb = testiLanding.tonyBussa;
    expect(tb.ascolta).toBe('▶ Ascolta');
    expect(tb.fermaVoce).toBe('■ Ferma');
    expect(tb.voceAccesa).toBeTruthy();
    expect(tb.voceSpenta).toBeTruthy();
    expect(tb.voceLettoreSchermo).toBeTruthy();
    expect(tb.etichetta).toBe('Tony · assistente virtuale con IA');
    const nuovi = [
      tb.ascolta,
      tb.fermaVoce,
      tb.voceAccesa,
      tb.voceSpenta,
      tb.voceLettoreSchermo,
    ].join('\n');
    for (const re of PAROLE_VIETATE) expect(nuovi).not.toMatch(re);
    expect(nuovi).not.toMatch(/\b15\b/);
    expect(nuovi).not.toMatch(/\b30\b/);
    expect(nuovi).not.toMatch(/\b1000\b/);
    expect(nuovi).not.toContain('€');
    expect(TONY_BUSSA_ATTIVO).toBe(false);
  });

  it('nessun log del testo nei file nuovi voce', () => {
    const nuovi = [
      'landing/src/lib/tony-voce-client.js',
      'landing/src/lib/tony-voce-player.js',
      'landing/src/lib/tony-voce-finta.js',
    ];
    for (const rel of nuovi) {
      const testo = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(testo).not.toMatch(/console\.\w+\([^)]*\b(testo|delta|blob|idVoce)\b/);
    }
  });
});
