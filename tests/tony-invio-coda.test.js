import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  accodaInvio,
  prossimoDaInviare,
  scadutoInAttesa,
  testoDaRimettereNelCampo,
  unisciChatRipristinata,
  LIMITE_ATTESA_MS,
} from '../core/js/tony/tony-invio-coda.js';

function turno(role, text) {
  return { role, parts: [{ text }] };
}

const pronto = { pronto: true, inInvio: false, rispostaInCorso: false };

describe('accodaInvio', () => {
  it('tiene l\'ordine di arrivo', () => {
    let coda = [];
    coda = accodaInvio(coda, { id: 'a', text: 'uno', ts: 1 }).coda;
    coda = accodaInvio(coda, { id: 'b', text: 'due', ts: 2 }).coda;
    coda = accodaInvio(coda, { id: 'c', text: 'tre', ts: 3 }).coda;
    expect(coda.map((v) => v.text)).toEqual(['uno', 'due', 'tre']);
  });

  it('con il tetto a 3 scarta il più vecchio', () => {
    let coda = [];
    coda = accodaInvio(coda, { id: 'a', text: 'uno', ts: 1 }, { max: 3 }).coda;
    coda = accodaInvio(coda, { id: 'b', text: 'due', ts: 2 }, { max: 3 }).coda;
    coda = accodaInvio(coda, { id: 'c', text: 'tre', ts: 3 }, { max: 3 }).coda;
    const esito = accodaInvio(coda, { id: 'd', text: 'quattro', ts: 4 }, { max: 3 });
    expect(esito.scartata && esito.scartata.text).toBe('uno');
    expect(esito.coda.map((v) => v.text)).toEqual(['due', 'tre', 'quattro']);
  });

  it('non duplica lo stesso testo dell\'ultimo', () => {
    const prima = accodaInvio([], { id: 'a', text: 'ciao', ts: 1 });
    const dopo = accodaInvio(prima.coda, { id: 'b', text: 'ciao', ts: 2 });
    expect(dopo.duplicata).toBe(true);
    expect(dopo.coda).toHaveLength(1);
    expect(dopo.coda[0].id).toBe('a');
  });
});

describe('prossimoDaInviare', () => {
  function codaDue() {
    return accodaInvio(
      accodaInvio([], { id: 'a', text: 'uno', ts: 1 }).coda,
      { id: 'b', text: 'due', ts: 2 }
    ).coda;
  }

  it('non manda nulla se un invio è già in corso', () => {
    const esito = prossimoDaInviare(codaDue(), { pronto: true, inInvio: true, rispostaInCorso: false });
    expect(esito.voce).toBe(null);
    expect(esito.coda.map((v) => v.text)).toEqual(['uno', 'due']);
  });

  it('non manda nulla se una risposta è in corso', () => {
    const esito = prossimoDaInviare(codaDue(), { pronto: true, inInvio: false, rispostaInCorso: true });
    expect(esito.voce).toBe(null);
    expect(esito.coda).toHaveLength(2);
  });

  it('non manda nulla se Tony non è pronto', () => {
    const esito = prossimoDaInviare(codaDue(), { pronto: false, inInvio: false, rispostaInCorso: false });
    expect(esito.voce).toBe(null);
  });

  it('al pronto manda il primo e lascia il resto', () => {
    const esito = prossimoDaInviare(codaDue(), pronto);
    expect(esito.voce && esito.voce.text).toBe('uno');
    expect(esito.coda.map((v) => v.text)).toEqual(['due']);
  });
});

describe('scadutoInAttesa', () => {
  it('scade a 45 secondi', () => {
    expect(LIMITE_ATTESA_MS).toBe(45000);
    expect(scadutoInAttesa(1000, 45999, 45000)).toBe(false);
    expect(scadutoInAttesa(1000, 46000, 45000)).toBe(true);
    expect(scadutoInAttesa(0, 45000)).toBe(true);
  });
});

describe('testoDaRimettereNelCampo', () => {
  it('restituisce l\'ultimo testo accodato', () => {
    const coda = accodaInvio(
      accodaInvio([], { text: 'prima', ts: 1 }).coda,
      { text: 'dopo', ts: 2 }
    ).coda;
    expect(testoDaRimettereNelCampo(coda)).toBe('dopo');
    expect(testoDaRimettereNelCampo([])).toBe('');
  });
});

describe('unisciChatRipristinata', () => {
  it('con la chat corrente vuota resta la vecchia', () => {
    const vecchia = [turno('user', 'ieri'), turno('model', 'ok')];
    expect(unisciChatRipristinata(vecchia, [])).toEqual(vecchia);
  });

  it('un messaggio già scritto resta in coda, una volta sola', () => {
    const vecchia = [turno('user', 'ieri'), turno('model', 'ok')];
    const corrente = [turno('user', 'appena scritto')];
    const uniti = unisciChatRipristinata(vecchia, corrente);
    expect(uniti.map((m) => m.parts[0].text)).toEqual(['ieri', 'ok', 'appena scritto']);
  });

  it('un duplicato identico consecutivo compare una volta', () => {
    const vecchia = [turno('user', 'ciao')];
    const corrente = [turno('user', 'ciao')];
    expect(unisciChatRipristinata(vecchia, corrente)).toHaveLength(1);
  });

  it('tiene prima la chat salvata e poi quella già in memoria', () => {
    const uniti = unisciChatRipristinata(
      [turno('model', 'salvata')],
      [turno('user', 'nuova')]
    );
    expect(uniti.map((m) => m.parts[0].text)).toEqual(['salvata', 'nuova']);
  });
});

describe('niente polling nella coda', () => {
  it('il modulo puro non ha timer né il lock di invio', () => {
    const src = readFileSync(join(process.cwd(), 'core/js/tony/tony-invio-coda.js'), 'utf8');
    expect(src).not.toMatch(/setInterval|setTimeout|document\.|_isSendingMessage/);
  });

  it('main non riprende il ciclo di attesa della prima coda', () => {
    const src = readFileSync(join(process.cwd(), 'core/js/tony/main.js'), 'utf8');
    expect(src).toMatch(/var TONY_QUEUE_ENABLED = true/);
    expect(src).not.toMatch(/attendiRispostaCodaTony|avviaControlloCodaTony/);
    expect(src).not.toMatch(/setInterval\(\s*function\s*\(\)\s*\{[^}]*[Cc]oda/);
  });
});
