import { describe, it, expect } from 'vitest';
import { conTimeout, prossimaAttesaRiprova } from '../core/js/tony/tony-attesa-riprova.js';

describe('conTimeout', () => {
  it('si risolve se la promessa arriva prima del limite', async () => {
    await expect(conTimeout(Promise.resolve('ok'), 200)).resolves.toBe('ok');
  });

  it('scade se la promessa non arriva', async () => {
    const appesa = new Promise(() => {});
    await expect(conTimeout(appesa, 40)).rejects.toThrow(/Tempo scaduto/);
  });
});

describe('prossimaAttesaRiprova', () => {
  it('il primo tentativo aspetta 3 secondi', () => {
    expect(prossimaAttesaRiprova(1)).toBe(3000);
  });

  it('il secondo tentativo non riprova da solo', () => {
    expect(prossimaAttesaRiprova(2)).toBe(0);
  });

  it('il terzo tentativo non riprova da solo', () => {
    expect(prossimaAttesaRiprova(3)).toBe(0);
  });
});
