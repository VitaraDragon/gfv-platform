/**
 * Timeout E2E sim — gate (CI) vs explore/fast (diagnostica rapida).
 * @module tests/e2e/sim/helpers/sim-e2e-timeouts
 */

/**
 * Gate CI: timeout ridotti senza explore (perf/post-save), v. TONY_E2E_GUIDA §8.
 * @returns {boolean}
 */
export function isTonyE2eGateFast() {
  return (
    process.env.GFV_TONY_E2E_GATE_FAST === '1' ||
    process.env.GFV_TONY_E2E_GATE_FAST === 'true' ||
    (process.env.CI === 'true' &&
      (process.env.GFV_TONY_E2E_MODE === 'gate' || !process.env.GFV_TONY_E2E_MODE))
  );
}

/**
 * @returns {boolean}
 */
export function isSimE2eFastMode() {
  return (
    isTonyE2eGateFast() ||
    process.env.GFV_E2E_FAST === '1' ||
    process.env.GFV_E2E_FAST === 'true' ||
    process.env.GFV_E2E_MODE === 'explore'
  );
}

/**
 * @param {number} [fallback=60000]
 * @returns {number}
 */
export function simE2eTimeout(fallback = 60_000) {
  const envMs = Number(process.env.GFV_E2E_TIMEOUT_MS);
  if (Number.isFinite(envMs) && envMs > 0) return envMs;
  if (!isSimE2eFastMode()) return fallback;
  if (fallback >= 60_000) return 18_000;
  if (fallback >= 45_000) return 12_000;
  if (fallback >= 30_000) return 10_000;
  return Math.max(5_000, Math.round(fallback * 0.35));
}

/**
 * @returns {number} pausa UI tra step (ms) — ridotta in fast/explore
 */
export function simE2ePause(fallback = 600) {
  if (!isSimE2eFastMode()) return fallback;
  if (fallback >= 1500) return 400;
  if (fallback >= 800) return 250;
  if (fallback >= 600) return 200;
  if (fallback >= 400) return 150;
  if (fallback >= 350) return 120;
  return Math.max(80, Math.round(fallback * 0.35));
}

/**
 * @returns {number}
 */
export function simE2eBrowserLaunchTimeout() {
  return isSimE2eFastMode() ? 30_000 : 60_000;
}

/**
 * Attesa hook metriche turno Tony (`__tonyLastPerf`) — non allineare al reply timeout.
 * @param {number} [fallback=12_000]
 * @returns {number}
 */
export function simE2eTonyPerfWaitTimeout(fallback = 12_000) {
  if (isTonyE2eGateFast()) return 8_000;
  if (isSimE2eFastMode()) return Math.min(fallback, 10_000);
  return fallback;
}

/**
 * Attesa post-save Firestore/DOM (liste) in gate CI.
 * @param {number} [fallback=90_000]
 * @returns {number}
 */
export function simE2eTonyPostSaveWaitTimeout(fallback = 90_000) {
  if (isTonyE2eGateFast()) return 45_000;
  return simE2eTimeout(fallback);
}

/** Soglia fail-fast se il modal resta aperto dopo save (ms). */
export const TONY_E2E_MODAL_STUCK_MS = 8_000;
