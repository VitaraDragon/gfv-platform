import { describe, expect, it } from 'vitest';
import { eseguiConLimite } from '../../core/services/esegui-con-limite.js';

describe('eseguiConLimite', () => {
  it('mantiene l’ordine anche se le chiamate finiscono al contrario', async () => {
    const attivi = [];
    let picco = 0;
    const out = await eseguiConLimite([1, 2, 3, 4, 5], 2, async (n) => {
      attivi.push(n);
      picco = Math.max(picco, attivi.length);
      await new Promise((resolve) => setTimeout(resolve, n === 1 ? 30 : 5));
      attivi.splice(attivi.indexOf(n), 1);
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(picco).toBeLessThanOrEqual(2);
  });

  it('con elenco vuoto non chiama fn', async () => {
    let chiamate = 0;
    const out = await eseguiConLimite([], 6, async () => {
      chiamate += 1;
      return 1;
    });
    expect(out).toEqual([]);
    expect(chiamate).toBe(0);
  });
});
