/**
 * Voce finta per prove in locale (solo con npm run dev e modello finto).
 * Nessuna rete, nessun ElevenLabs. Non deve finire nella build di produzione.
 */

/** Aggiunta alla nota del modello finto, solo in sviluppo. */
export const NOTA_VOCE_FINTA = 'voce finta';

/**
 * @param {string} [query]
 * @returns {'ok' | 'lenta' | 'errore' | 'tetto' | 'no'}
 */
export function parametroVoceFinta(query) {
  const testo = String(query ?? '');
  const inizio = testo.indexOf('?');
  let q = inizio >= 0 ? testo.slice(inizio + 1) : testo;
  const hash = q.indexOf('#');
  if (hash >= 0) q = q.slice(0, hash);
  let valore = null;
  try {
    valore = new URLSearchParams(q).get('tonyvoce');
  } catch {
    return 'ok';
  }
  if (valore === null || valore === '' || valore === '1') return 'ok';
  const ammessi = ['ok', 'lenta', 'errore', 'tetto', 'no'];
  if (ammessi.indexOf(valore) >= 0) return /** @type {any} */ (valore);
  return 'ok';
}

/**
 * Stessa firma di chiediVoce; ignora ottieniToken.
 * @param {{
 *   idVoce?: string,
 *   sessione?: string,
 *   testo?: string,
 *   ottieniToken?: () => Promise<string | null>,
 *   segnale?: AbortSignal,
 *   scenario?: string,
 *   sleepFn?: (ms: number) => Promise<void>,
 * }} args
 */
export async function chiediVoceFinta({
  testo = '',
  segnale,
  scenario = 'ok',
  sleepFn,
}) {
  const sleep =
    typeof sleepFn === 'function'
      ? sleepFn
      : (ms) =>
          new Promise((resolve, reject) => {
            const id = setTimeout(resolve, ms);
            if (segnale) {
              if (segnale.aborted) {
                clearTimeout(id);
                reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                return;
              }
              segnale.addEventListener(
                'abort',
                () => {
                  clearTimeout(id);
                  reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                },
                { once: true }
              );
            }
          });

  const sc = String(scenario || 'ok');
  try {
    if (sc === 'errore') return { ok: false, codice: 'voce-errore' };
    if (sc === 'tetto') return { ok: false, codice: 'tetto-voce' };
    if (sc === 'no') return { ok: false, codice: 'voce-spenta' };

    const attesa = sc === 'lenta' ? 3000 : 400;
    await sleep(attesa);

    const blob = generaWav(String(testo || ''));
    return { ok: true, blob };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, codice: 'voce-errore' };
    }
    return { ok: false, codice: 'rete' };
  }
}

/**
 * WAV generato nel codice: tono basso con volume a campana.
 * 60 ms per carattere, massimo 8 s.
 * @param {string} testo
 * @returns {Blob}
 */
function generaWav(testo) {
  const sampleRate = 22050;
  const msPerChar = 60;
  const maxMs = 8000;
  const durataMs = Math.min(maxMs, Math.max(200, testo.length * msPerChar));
  const nSamples = Math.floor((sampleRate * durataMs) / 1000);
  const dataSize = nSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  scriviAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  scriviAscii(view, 8, 'WAVE');
  scriviAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  scriviAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const freq = 180;
  for (let i = 0; i < nSamples; i += 1) {
    const t = i / sampleRate;
    const inviluppo = Math.sin((Math.PI * i) / nSamples);
    const campione = Math.sin(2 * Math.PI * freq * t) * inviluppo * 0.35;
    const int16 = Math.max(-32767, Math.min(32767, Math.floor(campione * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function scriviAscii(view, offset, testo) {
  for (let i = 0; i < testo.length; i += 1) {
    view.setUint8(offset + i, testo.charCodeAt(i));
  }
}
