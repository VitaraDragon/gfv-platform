import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  chooseSttEngine,
  isIosLikeDevice,
  isStandaloneDisplayMode,
  pickRecorderMimeType,
  rmsFromByteTimeDomain,
  createVoiceActivityTracker,
  mapRecorderErrorToSpeechError,
  buildFinalResultEvent,
  createRecorderSpeechRecognition,
  streamIsUsable,
  RECORDER_STT_DEFAULTS,
} from '../core/js/tony/voice-recorder-stt.js';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

function mkWin(o) {
  o = o || {};
  const nav = Object.assign(
    {
      userAgent: CHROME_UA,
      platform: 'Win32',
      maxTouchPoints: 0,
      mediaDevices: { getUserMedia: () => Promise.resolve({}) },
    },
    o.navigator || {}
  );
  const win = {
    navigator: nav,
    MediaRecorder: o.MediaRecorder === undefined ? function () {} : o.MediaRecorder,
    matchMedia: o.matchMedia || (() => ({ matches: false })),
    sessionStorage: { getItem: () => o.override || null },
  };
  if (o.webSpeech !== false) win.webkitSpeechRecognition = function () {};
  return win;
}

describe('voice-recorder-stt — scelta motore', () => {
  it('riconosce iPhone e iPad con UA desktop', () => {
    expect(isIosLikeDevice({ userAgent: IPHONE_UA })).toBe(true);
    expect(isIosLikeDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIosLikeDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIosLikeDevice({ userAgent: CHROME_UA })).toBe(false);
  });

  it('rileva standalone da navigator.standalone o display-mode', () => {
    expect(isStandaloneDisplayMode({ navigator: { standalone: true } })).toBe(true);
    expect(isStandaloneDisplayMode({ navigator: {}, matchMedia: (q) => ({ matches: q.includes('standalone') }) })).toBe(true);
    expect(isStandaloneDisplayMode({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false);
  });

  it('desktop Chrome → webspeech', () => {
    expect(chooseSttEngine(mkWin())).toBe('webspeech');
  });

  it('iPhone Safari (non installata) → recorder (Web Speech inaffidabile / muta in PWA)', () => {
    expect(chooseSttEngine(mkWin({ navigator: { userAgent: IPHONE_UA, platform: 'iPhone' } }))).toBe('recorder');
  });

  it('iPhone web app da schermata Home → recorder anche se Web Speech esiste', () => {
    const win = mkWin({ navigator: { userAgent: IPHONE_UA, platform: 'iPhone', standalone: true } });
    expect(chooseSttEngine(win)).toBe('recorder');
  });

  it('iPhone senza MediaRecorder → webspeech se c\'è, altrimenti none', () => {
    const withSpeech = mkWin({ navigator: { userAgent: IPHONE_UA, platform: 'iPhone', standalone: true }, MediaRecorder: null });
    expect(chooseSttEngine(withSpeech)).toBe('webspeech');
    const none = mkWin({ navigator: { userAgent: IPHONE_UA, platform: 'iPhone' }, MediaRecorder: null, webSpeech: false });
    expect(chooseSttEngine(none)).toBe('none');
  });

  it('override sessionStorage per test', () => {
    expect(chooseSttEngine(mkWin({ override: 'recorder' }))).toBe('recorder');
    const ios = mkWin({ navigator: { userAgent: IPHONE_UA, platform: 'iPhone', standalone: true }, override: 'webspeech' });
    expect(chooseSttEngine(ios)).toBe('webspeech');
  });

  it('senza Web Speech e senza registrazione → none', () => {
    const win = mkWin({ webSpeech: false, MediaRecorder: null });
    expect(chooseSttEngine(win)).toBe('none');
  });
});

describe('voice-recorder-stt — helper', () => {
  it('pickRecorderMimeType: webm/opus dove c\'è (Chromium), mp4 su Safari', () => {
    expect(pickRecorderMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecorderMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMimeType((t) => t === 'audio/mp4' || t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMimeType(() => false)).toBe('');
    expect(pickRecorderMimeType(undefined)).toBe('');
  });

  it('rmsFromByteTimeDomain: 128 = silenzio, ampiezza piena ≈ 1', () => {
    expect(rmsFromByteTimeDomain(new Uint8Array(64).fill(128))).toBe(0);
    const loud = new Uint8Array(64);
    for (let i = 0; i < 64; i++) loud[i] = i % 2 ? 255 : 1;
    expect(rmsFromByteTimeDomain(loud)).toBeGreaterThan(0.98);
    expect(rmsFromByteTimeDomain([])).toBe(0);
  });

  it('mapRecorderErrorToSpeechError traduce nei codici Web Speech', () => {
    expect(mapRecorderErrorToSpeechError({ name: 'NotAllowedError' }).error).toBe('not-allowed');
    expect(mapRecorderErrorToSpeechError({ code: 'permission-denied', message: 'x' }).error).toBe('not-allowed');
    expect(mapRecorderErrorToSpeechError({ name: 'NotFoundError' }).error).toBe('audio-capture');
    expect(mapRecorderErrorToSpeechError({ code: 'resource-exhausted' }).error).toBe('network');
    expect(mapRecorderErrorToSpeechError({ code: 'invalid-argument' }).error).toBe('bad-grammar');
    expect(mapRecorderErrorToSpeechError(new Error('boh')).error).toBe('network');
  });

  it('buildFinalResultEvent ha la forma letta dal widget (results[i][j].transcript, isFinal)', () => {
    const ev = buildFinalResultEvent('ciao Tony');
    expect(ev.resultIndex).toBe(0);
    expect(ev.results.length).toBe(1);
    const res = ev.results[0];
    expect(res.isFinal).toBe(true);
    expect(res.length).toBe(1);
    expect(res[0].transcript).toBe('ciao Tony');
    expect(ev.results.item(0)).toBe(res);
  });
});

describe('voice-recorder-stt — VAD', () => {
  it('rileva inizio voce, fine dopo silenzio, e niente parlato entro il timeout', () => {
    const vad = createVoiceActivityTracker({ silenceMs: 300, noSpeechTimeoutMs: 2000, minSpeechRms: 0.01, speechRatio: 2 });
    let t = 0;
    vad.reset(t);
    // rumore di fondo basso
    for (let i = 0; i < 10; i++) { t += 50; expect(vad.push(0.004, t).event).toBeNull(); }
    // voce
    t += 50;
    expect(vad.push(0.2, t).event).toBe('speechStart');
    for (let i = 0; i < 6; i++) { t += 50; expect(vad.push(0.15, t).event).toBeNull(); }
    // silenzio: fine frase solo dopo silenceMs
    t += 100; expect(vad.push(0.004, t).event).toBeNull();
    t += 100; expect(vad.push(0.004, t).event).toBeNull();
    t += 150; expect(vad.push(0.004, t).event).toBe('speechEnd');
    expect(vad.hadSpeech()).toBe(true);
    expect(vad.speechMs()).toBeGreaterThanOrEqual(300);

    const quiet = createVoiceActivityTracker({ noSpeechTimeoutMs: 1000 });
    let q = 0;
    quiet.reset(q);
    let ev = null;
    while (q < 1200 && ev !== 'noSpeech') { q += 100; ev = quiet.push(0.002, q).event; }
    expect(ev).toBe('noSpeech');
    expect(quiet.hadSpeech()).toBe(false);
  });

  it('chiude per durata massima anche se la voce continua', () => {
    const vad = createVoiceActivityTracker({ maxUtteranceMs: 1000, silenceMs: 500 });
    let t = 0;
    vad.reset(t);
    t += 50; vad.push(0.001, t);
    t += 50; expect(vad.push(0.3, t).event).toBe('speechStart');
    let ev = null;
    while (t < 1500 && ev !== 'maxDuration') { t += 50; ev = vad.push(0.3, t).event; }
    expect(ev).toBe('maxDuration');
  });

  it('la soglia si adatta al rumore di fondo (ventilatore) senza scattare', () => {
    const vad = createVoiceActivityTracker({ minSpeechRms: 0.01, speechRatio: 2.2, noSpeechTimeoutMs: 60000 });
    let t = 0;
    vad.reset(t);
    for (let i = 0; i < 40; i++) { t += 50; expect(vad.push(0.05 + (i % 2) * 0.005, t).event).toBeNull(); }
    t += 50;
    expect(vad.push(0.3, t).event).toBe('speechStart');
  });
});

describe('voice-recorder-stt — adapter SpeechRecognition-like', () => {
  let level; // ampiezza fittizia del microfono (0..127)
  let recorders;
  let tracksStopped;

  function FakeAnalyser() {
    this.fftSize = 1024;
    this.getByteTimeDomainData = (buf) => {
      for (let i = 0; i < buf.length; i++) buf[i] = 128 + (i % 2 ? level : -level);
    };
    this.disconnect = () => {};
  }
  function FakeAudioContext() {
    this.state = 'running';
    this.resume = () => Promise.resolve();
    this.createMediaStreamSource = () => ({ connect: () => {} });
    this.createAnalyser = () => new FakeAnalyser();
  }
  class FakeMediaRecorder {
    constructor(stream, opts) {
      this.mimeType = (opts && opts.mimeType) || 'audio/webm';
      this.state = 'inactive';
      recorders.push(this);
    }
    static isTypeSupported(t) { return t === 'audio/mp4'; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      if (this.ondataavailable) this.ondataavailable({ data: new Blob(['audio-bytes'], { type: this.mimeType }) });
      if (this.onstop) this.onstop();
    }
  }
  function mkStream() {
    const track = { stop: () => { tracksStopped += 1; } };
    return { active: true, getTracks: () => [track], getAudioTracks: () => [track] };
  }

  function mkRec(overrides) {
    const events = [];
    const transcribe = vi.fn(async () => ({ transcript: 'Dalle 7 alle 12', hasSpeech: true }));
    const rec = createRecorderSpeechRecognition(
      Object.assign(
        {
          transcribe,
          getUserMedia: vi.fn(() => Promise.resolve(mkStream())),
          MediaRecorder: FakeMediaRecorder,
          AudioContext: FakeAudioContext,
          blobToBase64: async () => 'QUJD',
          options: { silenceMs: 300, noSpeechTimeoutMs: 1500, minSpeechMs: 100, tickMs: 50, releaseStreamAfterIdleMs: 500 },
        },
        overrides || {}
      )
    );
    ['onstart', 'onaudiostart', 'onsoundstart', 'onspeechstart', 'onspeechend', 'onaudioend', 'onend'].forEach((n) => {
      rec[n] = () => events.push(n);
    });
    rec.onresult = (e) => events.push('onresult:' + e.results[0][0].transcript);
    rec.onerror = (e) => events.push('onerror:' + e.error);
    return { rec, events, transcribe };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    level = 0;
    recorders = [];
    tracksStopped = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('frase → CF → onresult poi onspeechend poi onend (ordine atteso dal widget)', async () => {
    const { rec, events, transcribe } = mkRec();
    rec.start();
    await vi.advanceTimersByTimeAsync(10); // getUserMedia risolve
    expect(events).toEqual(['onstart', 'onaudiostart']);
    expect(recorders[0].mimeType).toBe('audio/mp4');

    await vi.advanceTimersByTimeAsync(200); // rumore di fondo
    level = 60; // parla
    await vi.advanceTimersByTimeAsync(400);
    expect(events).toContain('onspeechstart');
    level = 0; // silenzio
    await vi.advanceTimersByTimeAsync(400);

    expect(transcribe).toHaveBeenCalledTimes(1);
    const payload = transcribe.mock.calls[0][0];
    expect(payload.mimeType).toBe('audio/mp4');
    expect(payload.data).toBe('QUJD');
    expect(payload.lang).toBe('it-IT');
    expect(payload.durationMs).toBeGreaterThan(0);

    const tail = events.slice(events.indexOf('onaudioend'));
    expect(tail).toEqual(['onaudioend', 'onresult:Dalle 7 alle 12', 'onspeechend', 'onend']);
    expect(rec.isActive()).toBe(false);
  });

  it('senza parlato → no-speech senza chiamare la CF; lo stream viene rilasciato dopo idle', async () => {
    const { rec, events, transcribe } = mkRec();
    rec.start();
    await vi.advanceTimersByTimeAsync(1700);
    expect(transcribe).not.toHaveBeenCalled();
    expect(events).toContain('onerror:no-speech');
    expect(events[events.length - 1]).toBe('onend');
    expect(tracksStopped).toBe(0);
    await vi.advanceTimersByTimeAsync(600);
    expect(tracksStopped).toBe(1);
  });

  it('permesso negato → onerror not-allowed + onend, niente CF', async () => {
    const { rec, events, transcribe } = mkRec({
      getUserMedia: () => Promise.reject({ name: 'NotAllowedError', message: 'denied' }),
    });
    rec.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(events).toEqual(['onerror:not-allowed', 'onend']);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('stop()/release() richiamati dentro onerror (come fa il widget) non duplicano onend né aggiungono no-speech', async () => {
    const { rec, events, transcribe } = mkRec({
      getUserMedia: () => Promise.reject({ name: 'NotAllowedError', message: 'denied' }),
    });
    rec.onerror = (e) => {
      events.push('onerror:' + e.error);
      rec.stop();
      rec.release();
    };
    rec.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(events).toEqual(['onerror:not-allowed', 'onend']);
    expect(transcribe).not.toHaveBeenCalled();
    expect(rec.isActive()).toBe(false);
  });

  it('start() durante una sessione lancia InvalidStateError (come SpeechRecognition)', async () => {
    const { rec } = mkRec();
    rec.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(() => rec.start()).toThrow(/already started/);
  });

  it('stop() chiude la frase e trascrive; abort() scarta senza CF', async () => {
    const a = mkRec();
    a.rec.start();
    await vi.advanceTimersByTimeAsync(100);
    level = 60;
    await vi.advanceTimersByTimeAsync(300);
    a.rec.stop();
    await vi.advanceTimersByTimeAsync(50);
    expect(a.transcribe).toHaveBeenCalledTimes(1);
    expect(a.events).toContain('onresult:Dalle 7 alle 12');

    level = 0;
    const b = mkRec();
    b.rec.start();
    await vi.advanceTimersByTimeAsync(100);
    level = 60;
    await vi.advanceTimersByTimeAsync(300);
    b.rec.abort();
    await vi.advanceTimersByTimeAsync(50);
    expect(b.transcribe).not.toHaveBeenCalled();
    expect(b.events[b.events.length - 1]).toBe('onend');
  });

  it('CF senza parlato o in errore → no-speech / network', async () => {
    const a = mkRec({ transcribe: vi.fn(async () => ({ transcript: '', hasSpeech: false })) });
    a.rec.start();
    await vi.advanceTimersByTimeAsync(100);
    level = 60;
    await vi.advanceTimersByTimeAsync(300);
    level = 0;
    await vi.advanceTimersByTimeAsync(400);
    expect(a.events).toContain('onerror:no-speech');
    expect(a.events.some((e) => e.startsWith('onresult'))).toBe(false);

    const b = mkRec({ transcribe: vi.fn(async () => { throw { code: 'resource-exhausted', message: 'limite' }; }) });
    b.rec.start();
    await vi.advanceTimersByTimeAsync(100);
    level = 60;
    await vi.advanceTimersByTimeAsync(300);
    level = 0;
    await vi.advanceTimersByTimeAsync(400);
    expect(b.events).toContain('onerror:network');
    expect(b.events[b.events.length - 1]).toBe('onend');
  });

  it('seconda sessione riusa lo stream (una sola getUserMedia) e release() ferma le tracce', async () => {
    const gum = vi.fn(() => Promise.resolve(mkStream()));
    const { rec } = mkRec({ getUserMedia: gum });
    rec.start();
    await vi.advanceTimersByTimeAsync(100);
    level = 60;
    await vi.advanceTimersByTimeAsync(300);
    level = 0;
    await vi.advanceTimersByTimeAsync(400);
    expect(rec.isActive()).toBe(false);
    rec.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(gum).toHaveBeenCalledTimes(1);
    rec.release();
    expect(tracksStopped).toBe(1);
    expect(rec.isActive()).toBe(false);
  });

  it('usa i default documentati', () => {
    expect(RECORDER_STT_DEFAULTS.silenceMs).toBe(900);
    expect(RECORDER_STT_DEFAULTS.maxUtteranceMs).toBe(30000);
    expect(RECORDER_STT_DEFAULTS.releaseStreamAfterIdleMs).toBe(60000);
  });

  it('streamIsUsable: tracce live sì, ended no, readyState assente = live', () => {
    expect(streamIsUsable(null)).toBe(false);
    expect(streamIsUsable({ active: false, getAudioTracks: () => [{ readyState: 'live' }] })).toBe(false);
    expect(streamIsUsable({ active: true, getAudioTracks: () => [{ readyState: 'ended' }] })).toBe(false);
    expect(streamIsUsable({ active: true, getAudioTracks: () => [{ stop: () => {} }] })).toBe(true);
    expect(streamIsUsable({ active: true, getAudioTracks: () => [{ readyState: 'live' }] })).toBe(true);
  });

  it('getUserMedia OverconstrainedError → fallback { audio: true }', async () => {
    const gum = vi.fn((c) => {
      if (c && c.audio && typeof c.audio === 'object') {
        return Promise.reject({ name: 'OverconstrainedError', message: 'x' });
      }
      return Promise.resolve(mkStream());
    });
    const { rec, events } = mkRec({ getUserMedia: gum });
    rec.start();
    await vi.advanceTimersByTimeAsync(20);
    expect(gum).toHaveBeenCalledTimes(2);
    expect(events).toContain('onstart');
  });

  it('MediaRecorder.start(timeslice) che lancia → retry senza timeslice', async () => {
    class TimesliceThenOk extends FakeMediaRecorder {
      start(timeslice) {
        if (timeslice) throw new Error('timeslice not supported');
        this.state = 'recording';
      }
    }
    const { rec, events } = mkRec({ MediaRecorder: TimesliceThenOk });
    rec.start();
    await vi.advanceTimersByTimeAsync(20);
    expect(events).toContain('onstart');
  });

  it('AudioContext suspended → niente VAD silenzioso, clip a durata fissa verso la CF', async () => {
    function SuspendedCtx() {
      this.state = 'suspended';
      this.resume = () => Promise.resolve();
      this.createMediaStreamSource = () => ({ connect: () => {} });
      this.createAnalyser = () => new FakeAnalyser();
    }
    const { rec, events, transcribe } = mkRec({
      AudioContext: SuspendedCtx,
      options: { silenceMs: 300, noSpeechTimeoutMs: 8000, minSpeechMs: 100, tickMs: 50, noAnalyserClipMs: 400, releaseStreamAfterIdleMs: 500 },
    });
    rec.start();
    await vi.advanceTimersByTimeAsync(20);
    level = 60;
    await vi.advanceTimersByTimeAsync(500);
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(events).toContain('onresult:Dalle 7 alle 12');
  });
});
