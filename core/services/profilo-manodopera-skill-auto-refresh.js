/**
 * Aggiornamento automatico skillCalcolate (debounced) dopo validazione ore.
 *
 * @module core/services/profilo-manodopera-skill-auto-refresh
 */

const DEBOUNCE_MS = 2500;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const debounceTimers = new Map();

/**
 * Schedula ricalcolo stelline per un operaio (evita N scan se si validano più ore insieme).
 *
 * @param {string} tenantId
 * @param {string} operaioId
 * @param {string} aggiornatoDa uid utente che ha validato
 * @param {{ immediate?: boolean }} [options]
 */
export function requestSkillCalcolateRefresh(tenantId, operaioId, aggiornatoDa, options = {}) {
  if (!tenantId || !operaioId || !aggiornatoDa) return;

  const key = `${tenantId}:${operaioId}`;
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);

  const delay = options.immediate ? 0 : DEBOUNCE_MS;
  const timer = setTimeout(async () => {
    debounceTimers.delete(key);
    try {
      const { recalculateSkillCalcolateForOperaio } = await import(
        './profilo-manodopera-skill-batch-service.js'
      );
      await recalculateSkillCalcolateForOperaio({
        tenantId,
        operaioId,
        aggiornatoDa
      });
    } catch (error) {
      console.warn('[manodopera] Aggiornamento automatico stelline non riuscito:', error);
    }
  }, delay);

  debounceTimers.set(key, timer);
}
