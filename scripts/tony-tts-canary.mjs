#!/usr/bin/env node
/**
 * Canary TTS Tony — verifica wiring latenza/velocità parlato nel sorgente + bundle locale.
 * Uso: npm run tony:tts-canary
 *      node scripts/tony-tts-canary.mjs [--local-port=8000]
 *
 * In browser (con Tony aperto): __tonyTtsCanary()
 */

import { readFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  })
);

const LOCAL_PORT = Number(args['local-port'] || 8000);
const EXPECTED_BUILD = '2026-06-20g';
const EXPECTED_SPEAKING_RATE = '1.0';

const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}

function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}

function readSrc(relPath) {
  return readFileSync(relPath, 'utf8');
}

function checkIncludes(id, src, patterns, label) {
  const missing = patterns.filter((p) => !src.includes(p));
  if (missing.length === 0) {
    pass(id, label);
    return true;
  }
  fail(id, `mancano: ${missing.join(', ')}`);
  return false;
}

function extractBuild(src, pattern) {
  const m = src.match(pattern);
  return m ? m[1] : null;
}

async function main() {
  console.log('\n=== Tony TTS canary ===');
  console.log(`Build atteso: ${EXPECTED_BUILD} | speakingRate default: ${EXPECTED_SPEAKING_RATE}\n`);

  let voiceSrc = '';
  let mainSrc = '';
  let loaderSrc = '';
  let indexSrc = '';

  try {
    voiceSrc = readSrc('core/js/tony/voice.js');
    mainSrc = readSrc('core/js/tony/main.js');
    loaderSrc = readSrc('core/js/tony-widget-standalone.js');
    indexSrc = readSrc('functions/index.js');
  } catch (e) {
    fail('read:sources', e.message || String(e));
    process.exit(1);
  }

  checkIncludes(
    'voice:pipeline',
    voiceSrc,
    [
      'fetchTonyAudioMp3',
      'ttsInflightFetches',
      'resolveGetTonyAudioCallable',
      'buildMinimalTtsContextPayload',
      'warmTonyTtsPipeline',
      'prepareTextForTTS',
      'window.__tonyWarmTTS',
    ],
    'callable cached, dedup in-flight, payload minimale, warm pipeline'
  );

  checkIncludes(
    'main:typing-warm',
    mainSrc,
    ['__tonyWarmTTS', 'Sto controllando...', 'tonySpeakAssistantText', 'speakTextInSentenceChunks'],
    'warm TTS su typing + chunking risposte complete'
  );

  checkIncludes(
    'chunk:stream-tts',
    readSrc('core/js/tony/stream-tts-chunk.js'),
    ['speakTextInSentenceChunks', 'applyStreamingTtsChunks'],
    'chunking frasi per TTS'
  );

  const mainBuild = extractBuild(mainSrc, /TONY_CLIENT_BUILD\s*=\s*'([^']+)'/);
  const loaderBuild = extractBuild(loaderSrc, /TONY_LOADER_BUILD\s*=\s*'([^']+)'/);

  if (mainBuild === EXPECTED_BUILD) pass('build:main.js', mainBuild);
  else fail('build:main.js', `atteso ${EXPECTED_BUILD}, trovato ${mainBuild || '?'}`);

  if (loaderBuild === EXPECTED_BUILD) pass('build:widget-loader', loaderBuild);
  else fail('build:widget-loader', `atteso ${EXPECTED_BUILD}, trovato ${loaderBuild || '?'}`);

  const rateMatch = indexSrc.match(
    /TONY_TTS_SPEAKING_RATE\s*=\s*Number\(process\.env\.TONY_TTS_SPEAKING_RATE\s*\|\|\s*"([^"]+)"\)/
  );
  const rateDefault = rateMatch ? rateMatch[1] : null;
  if (rateDefault === EXPECTED_SPEAKING_RATE) {
    pass('cf:speaking-rate', `default ${rateDefault} (deploy CF per applicare)`);
  } else {
    fail('cf:speaking-rate', `atteso ${EXPECTED_SPEAKING_RATE}, trovato ${rateDefault || '?'}`);
  }

  if (voiceSrc.includes('JSON.parse(JSON.stringify(window.Tony.context))')) {
    fail('voice:context-payload', 'ancora serializza tutto Tony.context — usa payload minimale');
  } else {
    pass('voice:context-payload', 'nessuna serializzazione completa di Tony.context');
  }

  if (voiceSrc.includes('window.__tonyTtsCanary')) {
    pass('voice:browser-canary', '__tonyTtsCanary() disponibile in console browser');
  } else {
    fail('voice:browser-canary', 'manca window.__tonyTtsCanary');
  }

  try {
    const url = `http://127.0.0.1:${LOCAL_PORT}/core/js/tony/main.js?v=${encodeURIComponent(EXPECTED_BUILD)}`;
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (!res.ok) {
      fail('local:main.js', `HTTP ${res.status} in ${ms} ms`);
    } else {
      const body = await res.text();
      if (body.includes(`TONY_CLIENT_BUILD = '${EXPECTED_BUILD}'`)) {
        pass('local:main.js', `bundle servito con build ${EXPECTED_BUILD} (${ms} ms)`);
      } else {
        const served = extractBuild(body, /TONY_CLIENT_BUILD\s*=\s*'([^']+)'/);
        fail('local:main.js', `HTTP ${res.status} ma build servito ${served || '?'} (${ms} ms)`);
      }
    }
  } catch (e) {
    fail('local:main.js', e.name === 'AbortError' ? 'timeout — avvia npm start' : (e.message || String(e)));
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log('\n--- Riepilogo ---');
  console.log(`  PASS: ${passed}  FAIL: ${failed}`);
  console.log('\nIn browser (pagina con Tony):');
  console.log('  __tonyTtsCanary()              → manifest build + feature');
  console.log('  __tonyTtsCanary({ speakTest: true })  → + prova voce breve\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
