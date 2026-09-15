/**
 * Tony — motore STT «registratore» (getUserMedia + MediaRecorder + trascrizione cloud).
 *
 * Espone la stessa superficie di `SpeechRecognition` (start/stop/abort, onresult, onerror,
 * onspeechstart, onspeechend, onend…) così il widget (`main.js`) non distingue i due motori.
 * Serve dove la Web Speech API non funziona: web app iOS aggiunte alla schermata Home
 * (WebKit bug 225298 — l'API esiste ma non parte mai e non chiede il permesso).
 *
 * Differenze rispetto a SpeechRecognition:
 * - nessun risultato parziale: `onresult` arriva una sola volta, a fine frase, dopo la CF;
 * - la fine frase la rileviamo noi (RMS su AnalyserNode → silenzio ≥ `silenceMs`);
 * - `onspeechend` viene emesso DOPO `onresult`, così il timer di auto-invio del widget
 *   trova già il testo pronto.
 *
 * @module core/js/tony/voice-recorder-stt
 */

/**
 * Ordine: webm/Opus dove c'è (Chromium, Firefox); Safari non registra webm e ricade su
 * mp4/AAC. Chromium recente dichiara anche `audio/mp4` ma lo riempie con Opus — meglio evitarlo.
 */
var RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

export var RECORDER_STT_DEFAULTS = {
  /** Silenzio dopo il parlato prima di chiudere la frase. */
  silenceMs: 900,
  /** Nessun parlato dall'avvio → errore `no-speech` (come Web Speech). */
  noSpeechTimeoutMs: 8000,
  /** Durata massima di una singola frase registrata. */
  maxUtteranceMs: 30000,
  /** Parlato minimo per inviare il clip alla CF (evita colpi di tosse / click). */
  minSpeechMs: 350,
  /** Fattore sopra il rumore di fondo per considerare «voce». */
  speechRatio: 2.2,
  /** Soglia RMS assoluta minima (0..1) sotto cui non è mai voce. */
  minSpeechRms: 0.012,
  /** Intervallo di campionamento del VAD. */
  tickMs: 60,
  /** Dopo quanto rilasciare lo stream microfono se nessuna nuova sessione. */
  releaseStreamAfterIdleMs: 20000,
  /** Senza AudioContext (nessun VAD): durata fissa del clip inviato alla CF. */
  noAnalyserClipMs: 6000,
  /** Timeslice MediaRecorder. */
  timesliceMs: 250,
};

/**
 * iPhone/iPad (compresi iPad con UA desktop) — solo lettura UA/piattaforma.
 * @param {{ userAgent?: string, platform?: string, maxTouchPoints?: number }} nav
 */
export function isIosLikeDevice(nav) {
  nav = nav || {};
  var ua = String(nav.userAgent || '');
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  var platform = String(nav.platform || '');
  if (/Mac/i.test(platform) && Number(nav.maxTouchPoints || 0) > 1) return true;
  return false;
}

/**
 * Web app aperta dalla schermata Home (standalone), qualunque piattaforma.
 * @param {{ navigator?: object, matchMedia?: Function }} win
 */
export function isStandaloneDisplayMode(win) {
  win = win || {};
  var nav = win.navigator || {};
  if (nav.standalone === true) return true;
  try {
    if (typeof win.matchMedia === 'function') {
      var mq = win.matchMedia('(display-mode: standalone)');
      if (mq && mq.matches) return true;
      var mqF = win.matchMedia('(display-mode: fullscreen)');
      if (mqF && mqF.matches) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

/**
 * Decide il motore STT. Regola unica per tutte le pagine:
 * - override esplicito (`sessionStorage.tony_stt_engine` = `recorder` | `webspeech`) per test;
 * - iOS + standalone → registratore (Web Speech muto lì);
 * - altrimenti Web Speech se disponibile, altrimenti registratore se possibile.
 * @param {{ navigator?: object, matchMedia?: Function, MediaRecorder?: Function, sessionStorage?: object, SpeechRecognition?: Function, webkitSpeechRecognition?: Function }} win
 * @returns {'webspeech'|'recorder'|'none'}
 */
export function chooseSttEngine(win) {
  win = win || {};
  var nav = win.navigator || {};
  var hasWebSpeech = !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  var canRecord = !!(nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function' && typeof win.MediaRecorder === 'function');

  var override = '';
  try {
    override = String((win.sessionStorage && win.sessionStorage.getItem('tony_stt_engine')) || '').toLowerCase();
  } catch (e) { /* ignore */ }
  if (override === 'recorder' && canRecord) return 'recorder';
  if (override === 'webspeech' && hasWebSpeech) return 'webspeech';

  if (isIosLikeDevice(nav) && isStandaloneDisplayMode(win)) {
    return canRecord ? 'recorder' : 'none';
  }
  if (hasWebSpeech) return 'webspeech';
  return canRecord ? 'recorder' : 'none';
}

/**
 * @param {Function} isTypeSupported MediaRecorder.isTypeSupported
 * @returns {string} '' se nessuno dichiarato (lasciamo scegliere al browser)
 */
export function pickRecorderMimeType(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return '';
  for (var i = 0; i < RECORDER_MIME_CANDIDATES.length; i++) {
    try {
      if (isTypeSupported(RECORDER_MIME_CANDIDATES[i])) return RECORDER_MIME_CANDIDATES[i];
    } catch (e) { /* ignore */ }
  }
  return '';
}

/**
 * RMS normalizzato 0..1 da `getByteTimeDomainData` (128 = silenzio).
 * @param {Uint8Array|number[]} bytes
 */
export function rmsFromByteTimeDomain(bytes) {
  if (!bytes || !bytes.length) return 0;
  var sum = 0;
  for (var i = 0; i < bytes.length; i++) {
    var v = (bytes[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / bytes.length);
}

/**
 * Macchina a stati del VAD, pura (testabile): riceve campioni RMS con timestamp e
 * decide `speechStart`, `speechEnd`, `noSpeech`, `maxDuration`.
 * @param {Partial<typeof RECORDER_STT_DEFAULTS>} [opts]
 */
export function createVoiceActivityTracker(opts) {
  var cfg = Object.assign({}, RECORDER_STT_DEFAULTS, opts || {});
  var startedAt = null;
  var noiseFloor = null;
  var speaking = false;
  var speechStartedAt = null;
  var lastVoiceAt = null;
  var speechTotalMs = 0;
  var lastTickAt = null;

  function reset(now) {
    startedAt = now;
    noiseFloor = null;
    speaking = false;
    speechStartedAt = null;
    lastVoiceAt = null;
    speechTotalMs = 0;
    lastTickAt = now;
  }

  /**
   * @param {number} rms
   * @param {number} now
   * @returns {{ event: null|'speechStart'|'speechEnd'|'noSpeech'|'maxDuration', speaking: boolean, speechMs: number }}
   */
  function push(rms, now) {
    if (startedAt == null) reset(now);
    var dt = lastTickAt != null ? Math.max(0, now - lastTickAt) : 0;
    lastTickAt = now;

    if (noiseFloor == null) {
      noiseFloor = rms;
    } else if (!speaking) {
      // Rumore di fondo: segue lentamente verso il basso, più lentamente verso l'alto
      noiseFloor = rms < noiseFloor ? noiseFloor * 0.8 + rms * 0.2 : noiseFloor * 0.97 + rms * 0.03;
    }
    var threshold = Math.max(cfg.minSpeechRms, (noiseFloor || 0) * cfg.speechRatio);
    var isVoice = rms >= threshold;

    var event = null;
    if (isVoice) {
      lastVoiceAt = now;
      if (!speaking) {
        speaking = true;
        speechStartedAt = now;
        event = 'speechStart';
      }
      speechTotalMs += dt;
    } else if (speaking && lastVoiceAt != null && now - lastVoiceAt >= cfg.silenceMs) {
      speaking = false;
      event = 'speechEnd';
    }

    if (!event) {
      if (!speaking && speechStartedAt == null && now - startedAt >= cfg.noSpeechTimeoutMs) {
        event = 'noSpeech';
      } else if (now - startedAt >= cfg.maxUtteranceMs) {
        event = 'maxDuration';
      }
    }
    return { event: event, speaking: speaking, speechMs: speechTotalMs, threshold: threshold };
  }

  return {
    push: push,
    reset: reset,
    hadSpeech: function () { return speechStartedAt != null; },
    speechMs: function () { return speechTotalMs; },
    /** Senza analyser non sappiamo se c'è voce: marchiamo il clip come «da trascrivere». */
    forceSpeech: function (ms) {
      if (speechStartedAt == null) speechStartedAt = startedAt != null ? startedAt : 0;
      speechTotalMs = Math.max(speechTotalMs, ms || 0);
    },
    config: cfg,
  };
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>} base64 senza prefisso data:
 */
export function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    try {
      var reader = new FileReader();
      reader.onload = function () {
        var s = String(reader.result || '');
        var comma = s.indexOf(',');
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.onerror = function () { reject(new Error('Lettura audio non riuscita.')); };
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Traduce le eccezioni getUserMedia / CF nei codici errore di SpeechRecognition.
 * @param {any} err
 * @returns {{ error: string, message: string }}
 */
export function mapRecorderErrorToSpeechError(err) {
  var name = err && (err.name || err.code) ? String(err.name || err.code) : '';
  var msg = err && err.message ? String(err.message) : '';
  if (/NotAllowed|SecurityError|permission-denied|PermissionDenied/i.test(name) || /permesso|permission/i.test(msg)) {
    return { error: 'not-allowed', message: msg || 'Permesso microfono negato.' };
  }
  if (/NotFound|DevicesNotFound|OverconstrainedError|NotReadable|TrackStart|AbortError/i.test(name)) {
    return { error: 'audio-capture', message: msg || 'Microfono non disponibile.' };
  }
  if (/unauthenticated|failed-precondition|resource-exhausted|internal|unavailable|deadline/i.test(name)) {
    return { error: 'network', message: msg || 'Trascrizione non disponibile.' };
  }
  if (/invalid-argument/i.test(name)) {
    return { error: 'bad-grammar', message: msg || 'Audio non valido.' };
  }
  return { error: 'network', message: msg || 'Errore microfono.' };
}

/**
 * Costruisce l'evento `result` nello stesso formato di SpeechRecognitionEvent
 * (array-like di SpeechRecognitionResult con `isFinal` e alternative `{ transcript, confidence }`).
 * @param {string} transcript
 */
export function buildFinalResultEvent(transcript) {
  var alt = { transcript: String(transcript || ''), confidence: 0.9 };
  var result = [alt];
  result.isFinal = true;
  result.item = function (i) { return result[i]; };
  var results = [result];
  results.item = function (i) { return results[i]; };
  return { resultIndex: 0, results: results };
}

/**
 * Crea un oggetto compatibile con `SpeechRecognition` che registra e trascrive via CF.
 *
 * @param {object} deps
 * @param {function(payload: { mimeType: string, data: string, durationMs: number, lang: string }): Promise<{ transcript?: string, hasSpeech?: boolean }>} deps.transcribe
 * @param {function(constraints: object): Promise<MediaStream>} [deps.getUserMedia]
 * @param {Function} [deps.MediaRecorder]
 * @param {Function} [deps.AudioContext]
 * @param {function(): number} [deps.now]
 * @param {Function} [deps.setInterval]
 * @param {Function} [deps.clearInterval]
 * @param {Function} [deps.setTimeout]
 * @param {Function} [deps.clearTimeout]
 * @param {Function} [deps.blobToBase64]
 * @param {Partial<typeof RECORDER_STT_DEFAULTS>} [deps.options]
 * @param {function(string, any=): void} [deps.log]
 */
export function createRecorderSpeechRecognition(deps) {
  deps = deps || {};
  if (typeof deps.transcribe !== 'function') {
    throw new Error('createRecorderSpeechRecognition: deps.transcribe obbligatorio');
  }
  var g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var cfg = Object.assign({}, RECORDER_STT_DEFAULTS, deps.options || {});
  var getUserMedia = deps.getUserMedia || function (c) {
    if (!g.navigator || !g.navigator.mediaDevices || typeof g.navigator.mediaDevices.getUserMedia !== 'function') {
      return Promise.reject({ name: 'NotSupportedError', message: 'getUserMedia non disponibile.' });
    }
    return g.navigator.mediaDevices.getUserMedia(c);
  };
  var MediaRecorderCtor = deps.MediaRecorder || g.MediaRecorder;
  var AudioContextCtor = deps.AudioContext || g.AudioContext || g.webkitAudioContext;
  var now = deps.now || function () { return Date.now(); };
  var setIntervalFn = deps.setInterval || g.setInterval.bind(g);
  var clearIntervalFn = deps.clearInterval || g.clearInterval.bind(g);
  var setTimeoutFn = deps.setTimeout || g.setTimeout.bind(g);
  var clearTimeoutFn = deps.clearTimeout || g.clearTimeout.bind(g);
  var toBase64 = deps.blobToBase64 || blobToBase64;
  var log = deps.log || function () {};

  var rec = {
    lang: 'it-IT',
    continuous: false,
    interimResults: false,
    maxAlternatives: 1,
    engine: 'recorder',
    onstart: null,
    onaudiostart: null,
    onsoundstart: null,
    onspeechstart: null,
    onspeechend: null,
    onaudioend: null,
    onresult: null,
    onnomatch: null,
    onerror: null,
    onend: null,
  };

  var stream = null;
  var audioCtx = null;
  var analyser = null;
  var analyserBuf = null;
  var recorder = null;
  var chunks = [];
  var vad = null;
  var tickTimer = null;
  var releaseTimer = null;
  var sessionId = 0;
  var active = false;
  var finishing = false;
  var sessionStartedAt = 0;
  var speechStartedAt = 0;
  var mimeType = '';

  function emit(name, payload) {
    var fn = rec[name];
    if (typeof fn !== 'function') return;
    try { fn.call(rec, payload || { type: name.slice(2) }); } catch (e) { log('handler ' + name + ' error', e); }
  }

  function clearReleaseTimer() {
    if (releaseTimer) { clearTimeoutFn(releaseTimer); releaseTimer = null; }
  }

  function scheduleStreamRelease() {
    clearReleaseTimer();
    if (!stream) return;
    releaseTimer = setTimeoutFn(function () {
      releaseTimer = null;
      if (!active) releaseStream();
    }, cfg.releaseStreamAfterIdleMs);
  }

  function releaseStream() {
    clearReleaseTimer();
    if (stream) {
      try { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* ignore */ } }); } catch (e) { /* ignore */ }
      stream = null;
    }
    // L'AudioContext resta vivo: ricrearlo fuori da un gesto utente lo lascerebbe `suspended` su iOS.
    if (analyser) {
      try { analyser.disconnect(); } catch (e) { /* ignore */ }
    }
    analyser = null;
    analyserBuf = null;
  }

  function stopTick() {
    if (tickTimer) { clearIntervalFn(tickTimer); tickTimer = null; }
  }

  /**
   * L'AudioContext va creato dentro il gesto utente (tap sul mic): su iOS un contesto
   * creato fuori dal gesto resta `suspended` e l'analyser leggerebbe solo silenzio.
   */
  function ensureAudioContext() {
    if (!AudioContextCtor) return null;
    try {
      if (!audioCtx) audioCtx = new AudioContextCtor();
      if (audioCtx.state !== 'running' && typeof audioCtx.resume === 'function') {
        var p = audioCtx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () { /* ignore */ });
      }
    } catch (e) {
      log('AudioContext non disponibile', e);
      audioCtx = null;
    }
    return audioCtx;
  }

  function attachAnalyser() {
    if (!audioCtx || !stream) return false;
    var src = audioCtx.createMediaStreamSource(stream);
    var an = audioCtx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    analyser = an;
    analyserBuf = new Uint8Array(an.fftSize);
    return true;
  }

  function ensureAnalyser() {
    if (!stream || analyser) return;
    if (!ensureAudioContext()) return;
    try {
      attachAnalyser();
    } catch (e) {
      // Safari: sample rate del mic ≠ contesto creato prima di getUserMedia → ricrea una volta
      log('analyser: retry con nuovo AudioContext', e);
      try { if (typeof audioCtx.close === 'function') audioCtx.close(); } catch (e2) { /* ignore */ }
      audioCtx = null;
      analyser = null;
      try {
        if (ensureAudioContext()) attachAnalyser();
      } catch (e3) {
        log('analyser non disponibile', e3);
        analyser = null;
      }
    }
  }

  function currentRms() {
    if (!analyser || !analyserBuf) return null;
    try {
      analyser.getByteTimeDomainData(analyserBuf);
      return rmsFromByteTimeDomain(analyserBuf);
    } catch (e) {
      return null;
    }
  }

  function endSession(mySession) {
    if (mySession !== sessionId || !active) return;
    active = false;
    finishing = false;
    stopTick();
    recorder = null;
    chunks = [];
    scheduleStreamRelease();
    emit('onend');
  }

  function fail(mySession, err) {
    if (mySession !== sessionId || !active) return;
    // Chiudi prima la sessione: l'handler onerror del widget può richiamare stop()/release().
    finishing = true;
    stopTick();
    if (recorder) {
      try { recorder.onstop = null; if (recorder.state !== 'inactive') recorder.stop(); } catch (e) { /* ignore */ }
    }
    var mapped = mapRecorderErrorToSpeechError(err);
    log('errore', mapped.error + ' — ' + mapped.message);
    emit('onerror', { type: 'error', error: mapped.error, message: mapped.message });
    endSession(mySession);
  }

  function finalize(mySession, blob, hadSpeech, speechMs) {
    if (mySession !== sessionId) return;
    emit('onaudioend');
    if (!hadSpeech || speechMs < cfg.minSpeechMs || !blob || !blob.size) {
      log('nessun parlato utile, salto CF', { hadSpeech: hadSpeech, speechMs: speechMs, bytes: blob ? blob.size : 0 });
      emit('onerror', { type: 'error', error: 'no-speech', message: 'Nessun parlato rilevato.' });
      endSession(mySession);
      return;
    }
    var durationMs = Math.max(0, now() - sessionStartedAt);
    var blobMime = (blob && blob.type) || mimeType || 'audio/webm';
    toBase64(blob).then(function (b64) {
      if (mySession !== sessionId) return null;
      log('invio clip a CF', { mime: blobMime, kb: Math.round(blob.size / 1024), durationMs: durationMs });
      return deps.transcribe({ mimeType: blobMime, data: b64, durationMs: durationMs, lang: rec.lang });
    }).then(function (res) {
      if (mySession !== sessionId || res === null) return;
      var text = res && typeof res.transcript === 'string' ? res.transcript.trim() : '';
      var hasSpeech = res && res.hasSpeech != null ? !!res.hasSpeech : text.length > 0;
      if (!hasSpeech || !text) {
        emit('onerror', { type: 'error', error: 'no-speech', message: 'Nessun parlato riconosciuto.' });
        endSession(mySession);
        return;
      }
      emit('onresult', buildFinalResultEvent(text));
      emit('onspeechend');
      endSession(mySession);
    }).catch(function (err) {
      fail(mySession, err);
    });
  }

  /** Ferma il recorder; `discard` = abort (niente CF). */
  function stopRecording(mySession, discard) {
    if (mySession !== sessionId || finishing) return;
    finishing = true;
    stopTick();
    var hadSpeech = vad ? vad.hadSpeech() : false;
    var speechMs = vad ? vad.speechMs() : 0;
    var r = recorder;
    if (!r) {
      if (discard) { endSession(mySession); return; }
      finalize(mySession, null, hadSpeech, speechMs);
      return;
    }
    var settled = false;
    function onStopped() {
      if (settled) return;
      settled = true;
      if (discard) { endSession(mySession); return; }
      var blob;
      try { blob = new Blob(chunks, { type: (r && r.mimeType) || mimeType || 'audio/webm' }); } catch (e) { blob = null; }
      finalize(mySession, blob, hadSpeech, speechMs);
    }
    r.onstop = onStopped;
    try {
      if (r.state !== 'inactive') r.stop(); else onStopped();
    } catch (e) {
      onStopped();
    }
    // Safari a volte non emette `stop`: rete di sicurezza.
    setTimeoutFn(onStopped, 1500);
  }

  function tick(mySession) {
    if (mySession !== sessionId || finishing) return;
    var t = now();
    var rms = currentRms();
    if (rms == null) {
      // Senza analyser (nessun AudioContext): clip a durata fissa, poi CF decide se c'è parlato
      if (t - sessionStartedAt >= cfg.noAnalyserClipMs) {
        vad.forceSpeech(cfg.minSpeechMs);
        stopRecording(mySession, false);
      }
      return;
    }
    var out = vad.push(rms, t);
    if (out.event === 'speechStart') {
      speechStartedAt = t;
      emit('onsoundstart');
      emit('onspeechstart');
    } else if (out.event === 'speechEnd' || out.event === 'maxDuration') {
      log('fine frase (' + out.event + ')', { speechMs: out.speechMs });
      stopRecording(mySession, false);
    } else if (out.event === 'noSpeech') {
      log('nessun parlato entro ' + cfg.noSpeechTimeoutMs + ' ms');
      stopRecording(mySession, false);
    }
  }

  function beginRecording(mySession) {
    if (mySession !== sessionId) return;
    ensureAnalyser();
    vad = createVoiceActivityTracker(cfg);
    vad.reset(now());
    chunks = [];
    if (!mimeType) mimeType = pickRecorderMimeType(MediaRecorderCtor && MediaRecorderCtor.isTypeSupported);
    try {
      recorder = mimeType ? new MediaRecorderCtor(stream, { mimeType: mimeType }) : new MediaRecorderCtor(stream);
    } catch (e) {
      try { recorder = new MediaRecorderCtor(stream); mimeType = ''; } catch (e2) { fail(mySession, e2); return; }
    }
    recorder.ondataavailable = function (ev) {
      if (ev && ev.data && ev.data.size) chunks.push(ev.data);
    };
    recorder.onerror = function (ev) {
      fail(mySession, (ev && ev.error) || { name: 'NotReadableError', message: 'Errore registrazione.' });
    };
    try {
      recorder.start(cfg.timesliceMs);
    } catch (e) {
      fail(mySession, e);
      return;
    }
    sessionStartedAt = now();
    emit('onstart');
    emit('onaudiostart');
    tickTimer = setIntervalFn(function () { tick(mySession); }, cfg.tickMs);
  }

  rec.start = function () {
    if (active) {
      var err = new Error('recognition already started');
      err.name = 'InvalidStateError';
      throw err;
    }
    if (typeof MediaRecorderCtor !== 'function') {
      var e2 = new Error('MediaRecorder non disponibile');
      e2.name = 'NotSupportedError';
      throw e2;
    }
    active = true;
    finishing = false;
    clearReleaseTimer();
    var mySession = ++sessionId;
    ensureAudioContext();
    if (stream && stream.active !== false) {
      beginRecording(mySession);
      return;
    }
    releaseStream();
    getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      .then(function (s) {
        if (mySession !== sessionId) {
          try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* ignore */ }
          return;
        }
        stream = s;
        try {
          s.getAudioTracks().forEach(function (t) {
            t.onended = function () { if (stream === s) { releaseStream(); } };
          });
        } catch (e) { /* ignore */ }
        beginRecording(mySession);
      })
      .catch(function (err) { fail(mySession, err); });
  };

  /** Come SpeechRecognition.stop(): chiude la frase e restituisce ciò che ha sentito. */
  rec.stop = function () {
    if (!active) return;
    stopRecording(sessionId, false);
  };

  /** Come SpeechRecognition.abort(): scarta tutto, niente CF. */
  rec.abort = function () {
    if (!active) return;
    stopRecording(sessionId, true);
  };

  /** Rilascia il microfono (spegne l'indicatore rosso di iOS). */
  rec.release = function () {
    if (active) rec.abort();
    releaseStream();
  };

  rec.isActive = function () { return active; };

  return rec;
}
