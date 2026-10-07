import { describe, it, expect } from 'vitest';
import { pulisciTestoPerVoce } from '../core/js/tony/voice.js';

describe('Tony voice — normalizzazione italiano TTS', () => {
  it('c\'è / c\'e / C\'E\' → ci è', () => {
    expect(pulisciTestoPerVoce('Oggi c\'è sole.')).toContain('ci è');
    expect(pulisciTestoPerVoce('Oggi c\'e vento.')).toContain('ci è');
    expect(pulisciTestoPerVoce('C\'E\' un trattore in uso.')).toContain('Ci è');
  });

  it('c\'era / c\'erano → ci era / ci erano', () => {
    expect(pulisciTestoPerVoce('Ieri c\'era pioggia.')).toContain('ci era');
    expect(pulisciTestoPerVoce('Prima c\'erano tre squadre.')).toContain('ci erano');
  });

  it('1 davanti a un nome maschile → un, non uno', () => {
    expect(pulisciTestoPerVoce('C\'è 1 trattore in uso.')).toContain('un trattore');
    expect(pulisciTestoPerVoce('C\'è 1 trattore in uso.')).not.toMatch(/\buno trattore\b/);
    expect(pulisciTestoPerVoce('Manca 1 ettaro.')).toContain('un ettaro');
    expect(pulisciTestoPerVoce('Ho 1 problema aperto.')).toContain('un problema');
    expect(pulisciTestoPerVoce('1 trattore è fermo.')).toMatch(/^Un trattore/);
  });

  it('1 davanti a s impura, z, gn, ps resta uno', () => {
    expect(pulisciTestoPerVoce('Manca 1 studente.')).toContain('uno studente');
    expect(pulisciTestoPerVoce('C\'è 1 zaino.')).toContain('uno zaino');
    expect(pulisciTestoPerVoce('Serve 1 pneumatico.')).toContain('uno pneumatico');
  });

  it('1 femminile → una o un\'', () => {
    expect(pulisciTestoPerVoce('C\'è 1 macchina libera.')).toContain('una macchina');
    expect(pulisciTestoPerVoce('Manca 1 squadra.')).toContain('una squadra');
    expect(pulisciTestoPerVoce('Serve 1 ora.')).toContain("un'ora");
    expect(pulisciTestoPerVoce('Apri 1 attività.')).toContain("un'attività");
    expect(pulisciTestoPerVoce('C\'è 1 grande macchina.')).toContain('una grande macchina');
  });

  it('1 da solo, in elenco o prima di una preposizione → uno', () => {
    expect(pulisciTestoPerVoce('Ne ho 1.')).toContain('uno.');
    expect(pulisciTestoPerVoce('Da 1 a 5.')).toContain('uno a 5');
    expect(pulisciTestoPerVoce('Ne ho 1 solo.')).toContain('uno solo');
    expect(pulisciTestoPerVoce('Ho 1 solo trattore.')).toContain('un solo trattore');
    expect(pulisciTestoPerVoce('Uno due tre.')).toContain('Uno due tre');
    expect(pulisciTestoPerVoce('1. Apri il modulo.')).toContain('Uno.');
  });

  it('uno già scritto davanti a un nome che vuole un si accorcia', () => {
    expect(pulisciTestoPerVoce('C\'è uno trattore.')).toContain('un trattore');
    expect(pulisciTestoPerVoce('C\'è uno studente.')).toContain('uno studente');
    expect(pulisciTestoPerVoce('Ne ho uno.')).toContain('uno.');
    expect(pulisciTestoPerVoce("È l'uno.")).toContain("l'uno");
    expect(pulisciTestoPerVoce('Non manca nessuno.')).toContain('nessuno');
  });

  it('non tocca 11, 21, decimali, orari e date con barra', () => {
    expect(pulisciTestoPerVoce('Ci sono 11 trattori.')).toContain('11 trattori');
    expect(pulisciTestoPerVoce('Ci sono 21 ettari.')).toContain('21 ettari');
    expect(pulisciTestoPerVoce('Sono 1,5 ettari.')).toContain('1,5 ettari');
    expect(pulisciTestoPerVoce('Dalle 1:30 alle 3.')).toContain('1:30');
    expect(pulisciTestoPerVoce('Il 1/10/2026.')).toContain('1/10/2026');
  });

  it('ore e primo del mese', () => {
    expect(pulisciTestoPerVoce('Dalle 1 alle 3.')).toContain("Dall'una alle 3");
    expect(pulisciTestoPerVoce('Alle 1 di notte.')).toContain("All'una di notte");
    expect(pulisciTestoPerVoce('Sono le 1.')).toContain("l'una");
    expect(pulisciTestoPerVoce('Il 1 gennaio.')).toContain('primo gennaio');
  });

  it('1 + unità di misura al singolare', () => {
    expect(pulisciTestoPerVoce('Sono 1 kg.')).toContain('un chilogrammo');
    expect(pulisciTestoPerVoce('Manca 1 ha.')).toContain('un ettaro');
    expect(pulisciTestoPerVoce('Aggiungi 1 L.')).toContain('un litro');
    expect(pulisciTestoPerVoce('Sono 12 kg.')).toContain('12 chilogrammi');
  });
});
