import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { validaPienoCampo, utenteAssegnatoAlLavoro } = require('../functions/lib/registra-pieno-campo-core.js');

const base = {
  userIds: ['op1'],
  ruoli: ['operaio'],
  lavoro: { id: 'lav1', macchinaId: 't5', stato: 'assegnato', operaioId: 'op1' },
  prodotto: { id: 'gas', categoria: 'carburante', giacenza: 800, attivo: true },
  macchina: { id: 't5', tipo: 'trattore', stato: 'attivo' },
  quantita: 80,
  capoIdsSquadra: [],
  haModuloMagazzino: true
};

describe('validaPienoCampo', () => {
  it('accetta il pieno dell\'operaio sul mezzo del lavoro', () => {
    expect(validaPienoCampo(base).ok).toBe(true);
  });

  it('rifiuta la potatura senza mezzo', () => {
    const r = validaPienoCampo(Object.assign({}, base, {
      lavoro: { id: 'lav2', attrezzoId: 'forbici', stato: 'assegnato', operaioId: 'op1' }
    }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/mezzo/);
  });

  it('rifiuta un lavoro non assegnato', () => {
    const r = validaPienoCampo(Object.assign({}, base, {
      lavoro: { id: 'lav3', macchinaId: 't5', stato: 'assegnato', operaioId: 'altro' }
    }));
    expect(r.ok).toBe(false);
    expect(r.code).toBe('permission-denied');
  });

  it('accetta l\'operaio di squadra tramite il capo', () => {
    const lavoro = { id: 'lav4', macchinaId: 't5', stato: 'in_corso', caposquadraId: 'capo1' };
    expect(utenteAssegnatoAlLavoro(['op1'], lavoro, ['capo1'])).toBe(true);
    const r = validaPienoCampo(Object.assign({}, base, { lavoro, capoIdsSquadra: ['capo1'] }));
    expect(r.ok).toBe(true);
  });

  it('rifiuta se in cisterna non basta', () => {
    const r = validaPienoCampo(Object.assign({}, base, {
      prodotto: { id: 'gas', categoria: 'carburante', giacenza: 10, attivo: true },
      quantita: 80
    }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cisterna/);
  });
});
