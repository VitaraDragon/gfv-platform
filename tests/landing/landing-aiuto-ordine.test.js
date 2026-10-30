/**
 * @vitest-environment node
 * Ordine fisso sede → poderi → terreni → riepilogo (correzioni anteprima 2).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decidiDopoRisposta,
  unisciDati,
} from '../../landing/src/lib/tony-aiuto-account.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('ordine aiuto account', () => {
  it('comune poi via → sede con entrambi', () => {
    const a = unisciDati(
      { sede: null, poderi: [], terreni: [] },
      { sede: { citta: 'Faenza', indirizzo: null, cap: null, provincia: null } },
      'sede'
    );
    const b = unisciDati(
      a.dati,
      { sede: { citta: null, indirizzo: 'Via Roma 1', cap: null, provincia: null } },
      'sede'
    );
    expect(b.dati.sede.citta).toBe('Faenza');
    expect(b.dati.sede.indirizzo).toBe('Via Roma 1');
  });

  it('2 turni senza novità: sede→poderi, poderi→terreni, terreni→riepilogo', () => {
    expect(
      decidiDopoRisposta({
        turniSenzaNovitaNelPasso: 2,
        domandeRimaste: 10,
        passo: 'sede',
      }).azione
    ).toBe('prossimoPasso');
    expect(
      decidiDopoRisposta({
        turniSenzaNovitaNelPasso: 2,
        domandeRimaste: 10,
        passo: 'poderi',
      }).azione
    ).toBe('prossimoPasso');
    expect(
      decidiDopoRisposta({
        turniSenzaNovitaNelPasso: 2,
        domandeRimaste: 10,
        passo: 'terreni',
      }).azione
    ).toBe('riepilogo');
  });

  it('con 3 domande rimaste → riepilogo', () => {
    expect(
      decidiDopoRisposta({ domandeRimaste: 3, passo: 'sede' }).azione
    ).toBe('riepilogo');
  });

  it('TonyChat usa azione prossimoPasso di decidiDopoRisposta', () => {
    const chat = fs.readFileSync(
      path.join(root, 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(chat).toContain("dopoRisposta.azione === 'prossimoPasso'");
    expect(chat).toContain('passo: passoAiuto.value');
  });
});

describe('CTA account in chat', () => {
  it('con moduloDisponibile è button, altrimenti link a URL_REGISTRAZIONE', () => {
    const chat = fs.readFileSync(
      path.join(root, 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(chat).toMatch(
      /v-if="moduloDisponibile && !moduloAperto && !faseAiuto"[\s\S]*?type="button"[\s\S]*?apriModulo/
    );
    expect(chat).toMatch(
      /v-else-if="!moduloAperto && !faseAiuto"[\s\S]*?:href="URL_REGISTRAZIONE"/
    );
  });
});
