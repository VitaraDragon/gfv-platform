/**
 * Player per le clip MP4 «stacked»: metà alta = colore, metà bassa = trasparenza
 * (bianco = visibile, nero = trasparente). Serve a Safari e iPhone.
 * Più sessioni insieme (entrata e idle sovrapposte). ferma() senza argomenti le chiude tutte.
 */

const sessioni = new Set();

/**
 * Copia il canale rosso della maschera nel canale alfa del colore.
 * @param {Uint8ClampedArray | number[]} datiColore
 * @param {Uint8ClampedArray | number[]} datiAlfa
 */
export function applicaMascheraAlfa(datiColore, datiAlfa) {
  const n = datiColore.length;
  for (let i = 3; i < n; i += 4) {
    datiColore[i] = datiAlfa[i - 3];
  }
  return datiColore;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} src
 * @param {{ loop?: boolean, onFine?: () => void, onPrimoFotogramma?: () => void }} [opzioni]
 * @returns {{ ferma: () => void }}
 */
export function avvia(canvas, src, opzioni = {}) {
  if (!canvas || typeof document === 'undefined') {
    return { ferma() {} };
  }

  const loop = opzioni.loop === true;
  const onFine = typeof opzioni.onFine === 'function' ? opzioni.onFine : null;
  const onPrimoFotogramma =
    typeof opzioni.onPrimoFotogramma === 'function' ? opzioni.onPrimoFotogramma : null;

  const v = document.createElement('video');
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.loop = loop;
  v.src = src;
  v.setAttribute('aria-hidden', 'true');
  v.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  const host = canvas.parentNode || document.body;
  host.appendChild(v);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { willReadFrequently: true });

  let stopped = false;
  let modo = '';
  let handle = 0;
  let primo = false;
  let fineNotificata = false;

  function paint() {
    if (stopped || !ctx || !bctx) return;
    const w = v.videoWidth;
    const h = Math.floor(v.videoHeight / 2);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      buf.width = w;
      buf.height = h * 2;
    }
    bctx.drawImage(v, 0, 0);
    let col;
    let al;
    try {
      col = bctx.getImageData(0, 0, w, h);
      al = bctx.getImageData(0, h, w, h);
    } catch {
      return;
    }
    applicaMascheraAlfa(col.data, al.data);
    ctx.putImageData(col, 0, 0);
    if (!primo) {
      primo = true;
      if (onPrimoFotogramma) onPrimoFotogramma();
    }
  }

  function loopFrame() {
    if (stopped) return;
    paint();
    if (typeof v.requestVideoFrameCallback === 'function') {
      modo = 'vfc';
      handle = v.requestVideoFrameCallback(loopFrame);
    } else {
      modo = 'raf';
      handle = requestAnimationFrame(loopFrame);
    }
  }

  function onEnded() {
    if (stopped || loop || fineNotificata) return;
    fineNotificata = true;
    if (onFine) onFine();
  }

  v.addEventListener('ended', onEnded);
  const playPromise = v.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
  loopFrame();

  function fermaQuesta() {
    if (stopped) return;
    stopped = true;
    v.removeEventListener('ended', onEnded);
    if (modo === 'vfc' && typeof v.cancelVideoFrameCallback === 'function') {
      try {
        v.cancelVideoFrameCallback(handle);
      } catch {
        /* il browser non aveva un fotogramma in coda */
      }
    } else if (handle) {
      cancelAnimationFrame(handle);
    }
    try {
      v.pause();
    } catch {
      /* già fermo */
    }
    v.removeAttribute('src');
    try {
      v.load();
    } catch {
      /* elemento già staccato */
    }
    if (v.parentNode) v.parentNode.removeChild(v);
    sessioni.delete(api);
  }

  const api = { ferma: fermaQuesta };
  sessioni.add(api);
  return api;
}

/**
 * Chiude una sessione, oppure tutte se chiamata senza argomenti.
 * @param {{ ferma?: () => void }} [sessione]
 */
export function ferma(sessione) {
  if (sessione && typeof sessione.ferma === 'function') {
    sessione.ferma();
    return;
  }
  for (const s of [...sessioni]) s.ferma();
}
