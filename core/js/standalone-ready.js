/**
 * Promise `GFVStandaloneReady` condivisa tra bootstrap e pagine.
 * Se la pagina fa `await window.GFVStandaloneReady` prima che il bootstrap
 * assegni la promise, senza placeholder l'await è `undefined` e Firebase non è pronto.
 * @module core/js/standalone-ready
 */

/**
 * Crea il placeholder se manca. Idempotente.
 * @returns {Promise<void>}
 */
export function ensureStandaloneReadyPlaceholder() {
  const g = globalThis;
  if (g.GFVStandaloneReady) return g.GFVStandaloneReady;
  g.GFVStandaloneReady = new Promise((resolve, reject) => {
    g.__gfvStandaloneReadyResolve = resolve;
    g.__gfvStandaloneReadyReject = reject;
  });
  return g.GFVStandaloneReady;
}

/**
 * Chiude il placeholder (e chiunque lo stia attendendo).
 * @param {boolean} ok
 * @param {unknown} [err]
 */
export function settleStandaloneReady(ok, err) {
  const g = globalThis;
  const resolveFn = g.__gfvStandaloneReadyResolve;
  const rejectFn = g.__gfvStandaloneReadyReject;
  g.__gfvStandaloneReadyResolve = undefined;
  g.__gfvStandaloneReadyReject = undefined;
  if (ok) {
    if (typeof resolveFn === 'function') resolveFn();
    return;
  }
  if (typeof rejectFn === 'function') rejectFn(err);
}
