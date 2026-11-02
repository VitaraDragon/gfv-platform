import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chiudiConsensoInvioSenzaAccettare,
} from '../../landing/src/lib/tony-chat-logica.js';
import {
  leggiPresaVisione,
  salvaPresaVisione,
} from '../../landing/src/lib/tony-bussa-logica.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('consenso invio chiudibile', () => {
  it('chiudi → niente invio, testo intatto, consenso spento', () => {
    const esito = chiudiConsensoInvioSenzaAccettare({
      testoInvioInAttesa: { testo: 'Ho 5 ettari di vigneto', daChip: false },
      campoCorrente: '',
    });
    expect(esito.mostraConsensoInvio).toBe(false);
    expect(esito.testoInvioInAttesa).toBe(null);
    expect(esito.campo).toBe('Ho 5 ettari di vigneto');
  });

  it('Ho capito → salva presa visione; alla domanda dopo il blocco non ricompare', () => {
    const store = {};
    const storage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
    };
    expect(leggiPresaVisione(storage, 1).vista).toBe(false);
    salvaPresaVisione(storage, 1, new Date().toISOString(), true);
    expect(leggiPresaVisione(storage, 1).vista).toBe(true);
  });

  it('TonyChat ha X, Chiudi, Esc e consenso nella conversazione', () => {
    const chat = fs.readFileSync(
      path.join(ROOT, 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(chat).toContain('aria-label="Chiudi"');
    expect(chat).toContain('onChiudiConsensoInvio');
    expect(chat).toContain('onEscConsenso');
    expect(chat).toContain('chiudiConsensoInvioSenzaAccettare');
    expect(chat).toContain('consensoInvioChiudi');
    expect(chat).toMatch(/messaggi\.length \|\| mostraConsensoInvio/);
    expect(chat).not.toMatch(/chiediATony[\s\S]{0,80}onChiudiConsensoInvio/);
  });
});
