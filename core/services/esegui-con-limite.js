/**
 * Esegue fn sugli elementi con al massimo `limite` chiamate insieme.
 * Il risultato resta nello stesso ordine dell'elenco.
 *
 * @param {Array} items
 * @param {number} limite
 * @param {(item: *, index: number) => Promise<*>} fn
 * @returns {Promise<Array>}
 */
export async function eseguiConLimite(items, limite, fn) {
  const list = Array.isArray(items) ? items : [];
  const max = Math.max(1, Number(limite) || 1);
  const results = new Array(list.length);
  let next = 0;

  async function worker() {
    while (next < list.length) {
      const index = next;
      next += 1;
      results[index] = await fn(list[index], index);
    }
  }

  const n = Math.min(max, list.length);
  const workers = [];
  for (let i = 0; i < n; i += 1) workers.push(worker());
  await Promise.all(workers);
  return results;
}
