import { describe, it, expect } from 'vitest';
import {
  accodaInvio,
  prossimoDaInviare,
  scadutoInAttesa,
  unisciCronologiaChat,
} from '../core/js/tony/tony-invio-coda.js';

describe('coda invio Tony', () => {
  it('accoda e tiene al massimo 5, scartando i più vecchi', () => {
    let coda = [];
    for (let i = 1; i <= 6; i++) {
      coda = accodaInvio(coda, { text: 'm' + i, ts: i }, 5);
    }
    expect(coda.map((v) => v.text)).toEqual(['m2', 'm3', 'm4', 'm5', 'm6']);
  });

  it('prossimoDaInviare toglie il primo e lascia il resto', () => {
    const coda = [
      { text: 'uno', ts: 1 },
      { text: 'due', ts: 2 },
    ];
    const step = prossimoDaInviare(coda);
    expect(step.voce.text).toBe('uno');
    expect(step.coda.map((v) => v.text)).toEqual(['due']);
    expect(coda).toHaveLength(2);
    expect(prossimoDaInviare([]).voce).toBeNull();
  });

  it('scadutoInAttesa scatta al limite, non prima', () => {
    expect(scadutoInAttesa(1000, 20999, 20000)).toBe(false);
    expect(scadutoInAttesa(1000, 21000, 20000)).toBe(true);
    expect(scadutoInAttesa('no', 100, 20)).toBe(false);
  });

  it('unisce la chat salvata senza cancellare i messaggi già in memoria', () => {
    const salvata = [
      { role: 'user', parts: [{ text: 'Ciao' }] },
      { role: 'model', parts: [{ text: 'Eccomi.' }] },
    ];
    const corrente = [
      { role: 'user', parts: [{ text: 'Ciao' }] },
      { role: 'user', parts: [{ text: 'segnami le ore' }] },
    ];
    const unita = unisciCronologiaChat(corrente, salvata);
    expect(unita.map((m) => m.parts[0].text)).toEqual(['Ciao', 'Eccomi.', 'segnami le ore']);
  });
});
