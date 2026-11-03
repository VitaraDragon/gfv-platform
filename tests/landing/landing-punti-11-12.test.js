/**
 * Landing punti 11 e 12: conteggio terreni dopo il riepilogo,
 * sessione intervista in sessionStorage, categoria Ortive.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  serializzaRaccolti,
  storiaDopoRiepilogo,
  unisciDati,
} from '../../landing/src/lib/tony-aiuto-account.js';
import {
  CHIAVE_SESSIONE_INTERVISTA,
  TTL_SESSIONE_INTERVISTA_MS,
  cancellaSessioneIntervista,
  leggiSessioneIntervista,
  salvaSessioneIntervista,
} from '../../landing/src/lib/tony-sessione-intervista.js';

const require = createRequire(import.meta.url);
const {
  categoriaOrtiveDaTesto,
  promptSistemaAccount,
  pulisciTerreni,
  rispostaAccountDaTesto,
  terreniDaRaccolti,
} = require('../../functions/lib/tony-landing-account.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function t(nome, extra) {
  return Object.assign({ nome, superficie: 1, coltura: 'Grano', podere: null }, extra);
}

function dati(nomi) {
  return { sede: null, poderi: [], terreni: nomi.map((n) => t(n)) };
}

function finto() {
  const mappa = new Map();
  return {
    getItem: (k) => (mappa.has(k) ? mappa.get(k) : null),
    setItem: (k, v) => void mappa.set(k, String(v)),
    removeItem: (k) => void mappa.delete(k),
    _mappa: mappa,
  };
}

describe('punto 11 – conteggio terreni dopo il riepilogo', () => {
  it('serializzaRaccolti passa il conteggio esatto «N di 5»', () => {
    const s = serializzaRaccolti(dati(['Campo Nord', 'Campo Sud', 'Prato']));
    expect(s).toContain('Terreni già raccolti: 3 di 5');
    expect(serializzaRaccolti(dati([]))).not.toContain('Terreni già raccolti');
  });

  it('il server legge il conteggio dai raccolti e lo mette nel prompt', () => {
    const raccolti = serializzaRaccolti(dati(['A1', 'B2', 'C3', 'D4']));
    const info = terreniDaRaccolti(raccolti);
    expect(info.conteggio).toBe(4);
    expect(info.nomi).toEqual(['A1', 'B2', 'C3', 'D4']);
    const prompt = promptSistemaAccount('terreni', { raccolti });
    expect(prompt).toContain('Terreni già raccolti: 4 di 5');
    expect(prompt).toMatch(/SOLO i terreni nuovi o modificati/);
    expect(prompt).toContain('ne hai N su 5');
  });

  it('lista cumulativa del modello con 4 già raccolti: il 5° passa, nessun troppiTerreni', () => {
    const raccolti = serializzaRaccolti(dati(['A1', 'B2', 'C3', 'D4']));
    const json = JSON.stringify({
      testo: 'Ne hai 5 su 5.',
      fatto: false,
      terreni: [t('A1'), t('B2'), t('C3'), t('D4'), t('E5')],
    });
    const r = rispostaAccountDaTesto(json, { raccolti, argomento: 'terreni' });
    expect(r.troppiTerreni).toBe(false);
    expect(r.dati.terreni.map((x) => x.nome)).toEqual(['A1', 'B2', 'C3', 'D4', 'E5']);
  });

  it('solo il 6° è rifiutato: limite = raccolti + nuovi', () => {
    const raccolti = serializzaRaccolti(dati(['A1', 'B2', 'C3', 'D4', 'E5']));
    const json = JSON.stringify({
      testo: 'ok',
      fatto: false,
      terreni: [t('A1'), t('F6')],
    });
    const r = rispostaAccountDaTesto(json, { raccolti, argomento: 'terreni' });
    expect(r.troppiTerreni).toBe(true);
    expect(r.dati.terreni.map((x) => x.nome)).toEqual(['A1']);
  });

  it('il modello restituisce solo i nuovi: raccolti 3 + 2 nuovi = 5', () => {
    const raccolti = serializzaRaccolti(dati(['A1', 'B2', 'C3']));
    const r = rispostaAccountDaTesto(
      JSON.stringify({ testo: 'ok', fatto: false, terreni: [t('D4'), t('E5')] }),
      { raccolti }
    );
    expect(r.troppiTerreni).toBe(false);
    expect(r.dati.terreni).toHaveLength(2);
  });

  it('dedupe con prefisso podere/tenuta anche sul server', () => {
    const out = pulisciTerreni(
      [t('Podere Nord'), t('Nord'), t('Tenuta Sud')],
      { nomi: ['Nord'], conteggio: 1 }
    );
    expect(out.terreni.map((x) => x.nome)).toEqual(['Podere Nord', 'Tenuta Sud']);
    expect(out.troppiTerreni).toBe(false);
  });

  it('senza raccolti il limite resta 5 (compatibilità)', () => {
    const sei = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'].map((n) => t(n));
    const out = pulisciTerreni(sei);
    expect(out.terreni).toHaveLength(5);
    expect(out.troppiTerreni).toBe(true);
    expect(pulisciTerreni(sei.slice(0, 5)).troppiTerreni).toBe(false);
  });

  it('client: unisciDati dedupe con nomeSenzaPrefissoPodere; 5° ok, 6° no', () => {
    const base = dati(['Podere Nord', 'B2', 'C3', 'D4']);
    const u = unisciDati(
      base,
      { terreni: [t('Nord', { superficie: 2 }), t('E5')] },
      'terreni'
    );
    expect(u.troppiTerreni).toBe(false);
    expect(u.dati.terreni).toHaveLength(5);
    expect(u.dati.terreni[0].nome).toBe('Podere Nord');
    expect(u.dati.terreni[0].superficie).toBe(2);
    const sesto = unisciDati(u.dati, { terreni: [t('F6')] }, 'terreni');
    expect(sesto.troppiTerreni).toBe(true);
    expect(sesto.dati.terreni).toHaveLength(5);
  });

  it('client: troppiTerreni non scatta guardando solo la lista del modello', () => {
    const base = dati(['A1', 'B2', 'C3', 'D4', 'E5']);
    const cumulativa = unisciDati(
      base,
      { terreni: base.terreni.map((x) => ({ ...x })) },
      'terreni'
    );
    expect(cumulativa.troppiTerreni).toBe(false);
    expect(cumulativa.dati.terreni).toHaveLength(5);
  });

  it('dopo il riepilogo: vecchi elenchi superati + riassunto con stato aggiornato', () => {
    const storia = [
      { ruolo: 'utente', testo: 'Ho Campo Nord e Prato' },
      { ruolo: 'tony', testo: 'Ne hai 2 su 5. Altri?' },
      { ruolo: 'tony', testo: 'Quale podere?' },
    ];
    const nuova = storiaDopoRiepilogo(storia, dati(['Campo Nord', 'Prato', 'Vigna']));
    expect(nuova[0].testo).toBe('Ho Campo Nord e Prato');
    expect(nuova[1].testo).toMatch(/^\[Elenco superato dal riepilogo\] Ne hai 2 su 5/);
    expect(nuova[2].testo).toBe('Quale podere?');
    const ultimo = nuova[nuova.length - 1];
    expect(ultimo.ruolo).toBe('tony');
    expect(ultimo.testo).toContain('ne hai 3 su 5');
    expect(ultimo.testo).toContain('Vigna');
    // Secondo riepilogo: il vecchio riassunto diventa superato, nessun doppio marchio.
    const di_nuovo = storiaDopoRiepilogo(nuova, dati(['Campo Nord', 'Prato', 'Vigna', 'Orto']));
    expect(di_nuovo.filter((b) => b.testo.indexOf('[Elenco superato') === 0).length).toBe(2);
    expect(di_nuovo[di_nuovo.length - 1].testo).toContain('ne hai 4 su 5');
    expect(di_nuovo.some((b) => /\[Elenco superato dal riepilogo\] \[Elenco/.test(b.testo))).toBe(false);
    expect(di_nuovo.length).toBeLessThanOrEqual(10);
  });

  it('TonyChat usa storiaDopoRiepilogo in onTornaDallaScheda', () => {
    const src = fs.readFileSync(
      path.join(root, 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    const m = src.match(/function onTornaDallaScheda[\s\S]*?\r?\n}\r?\n/);
    expect(m?.[0] || '').toContain('storiaDopoRiepilogo(storia.value');
  });
});

describe('punto 12 – sessione intervista in sessionStorage', () => {
  const stato = () => ({
    faseAiuto: true,
    aiutoFatto: false,
    messaggi: [
      { ruolo: 'tony', testo: 'Ciao' },
      { ruolo: 'utente', testo: 'Scrivi a mario@esempio.it per favore', live: true },
      { ruolo: 'nascosta', testo: 'x' },
    ],
    storia: [{ ruolo: 'utente', testo: 'Ho un terreno' }],
    datiAiuto: {
      sede: { indirizzo: 'Via Roma 1', citta: 'Lugo', cap: null, provincia: 'RA' },
      poderi: [{ nome: 'Nord' }],
      terreni: [t('Campo', { categoria: 'Ortive', coltura: null })],
      email: 'a@b.it',
      password: 'segreta',
    },
    passoAiuto: 'terreni',
    schedaAperta: false,
    tornatoDalRiepilogo: true,
    giaRiaperturaLimiteDomande: false,
    turniSenzaNovitaNelPasso: 1,
    consecutiviFuoriTema: 0,
    sessione: 'abcdef0123456789abcdef',
    email: 'x@y.it',
    password: 'pw',
  });

  it('salva e ripristina messaggi, dati, passo e flag', () => {
    const s = finto();
    expect(salvaSessioneIntervista(s, stato(), 1000)).toBe(true);
    const rec = leggiSessioneIntervista(s, 1000 + 60_000);
    expect(rec.passoAiuto).toBe('terreni');
    expect(rec.schedaAperta).toBe(false);
    expect(rec.tornatoDalRiepilogo).toBe(true);
    expect(rec.datiAiuto.sede.citta).toBe('Lugo');
    expect(rec.datiAiuto.terreni[0].categoria).toBe('Ortive');
    expect(rec.storia).toHaveLength(1);
    expect(rec.sessione).toBe('abcdef0123456789abcdef');
    expect(rec.messaggi.map((m) => m.ruolo)).toEqual(['tony', 'utente']);
  });

  it('non salva mai email né password', () => {
    const s = finto();
    salvaSessioneIntervista(s, stato(), 1000);
    const grezzo = s.getItem(CHIAVE_SESSIONE_INTERVISTA);
    expect(grezzo).not.toMatch(/mario@esempio|a@b\.it|x@y\.it|segreta|"password"|"email"/);
  });

  it('versione diversa, scaduta (2 ore) o corrotta → nessun ripristino', () => {
    const s = finto();
    salvaSessioneIntervista(s, stato(), 1000);
    expect(leggiSessioneIntervista(s, 1000 + TTL_SESSIONE_INTERVISTA_MS + 1)).toBeNull();
    expect(s.getItem(CHIAVE_SESSIONE_INTERVISTA)).toBeNull();

    salvaSessioneIntervista(s, stato(), 1000);
    const rec = JSON.parse(s.getItem(CHIAVE_SESSIONE_INTERVISTA));
    rec.versione = 99;
    s.setItem(CHIAVE_SESSIONE_INTERVISTA, JSON.stringify(rec));
    expect(leggiSessioneIntervista(s, 2000)).toBeNull();

    s.setItem(CHIAVE_SESSIONE_INTERVISTA, '{non json');
    expect(leggiSessioneIntervista(s, 2000)).toBeNull();
    expect(leggiSessioneIntervista(null, 2000)).toBeNull();
  });

  it('entro le 2 ore ripristina; intervista conclusa o non avviata → cancella', () => {
    const s = finto();
    salvaSessioneIntervista(s, stato(), 5000);
    expect(leggiSessioneIntervista(s, 5000 + TTL_SESSIONE_INTERVISTA_MS - 1)).not.toBeNull();
    expect(salvaSessioneIntervista(s, { ...stato(), aiutoFatto: true }, 6000)).toBe(false);
    expect(s.getItem(CHIAVE_SESSIONE_INTERVISTA)).toBeNull();
    salvaSessioneIntervista(s, stato(), 7000);
    expect(salvaSessioneIntervista(s, { ...stato(), faseAiuto: false }, 8000)).toBe(false);
    expect(s.getItem(CHIAVE_SESSIONE_INTERVISTA)).toBeNull();
    cancellaSessioneIntervista(s);
  });

  it('con la scheda aperta ricorda schedaAperta', () => {
    const s = finto();
    salvaSessioneIntervista(s, { ...stato(), schedaAperta: true, passoAiuto: 'scheda' }, 1000);
    const rec = leggiSessioneIntervista(s, 2000);
    expect(rec.schedaAperta).toBe(true);
    expect(rec.passoAiuto).toBe('scheda');
  });

  it('TonyChat ripristina all’avvio e salva con watcher', () => {
    const src = fs.readFileSync(
      path.join(root, 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(src).toContain('ripristinaSessioneIntervista()');
    expect(src).toContain('salvaSessioneIntervista(');
    expect(src).toContain('leggiSessioneIntervista(');
  });
});

describe('punto 12 – ortaggi → categoria Ortive', () => {
  it('riconosce ortaggi / orto / ortive / verdure', () => {
    for (const s of ['ortaggi', 'Orto', 'ortive', 'verdure', 'verdura', 'ortaggi misti']) {
      expect(categoriaOrtiveDaTesto(s)).toBe(true);
    }
    for (const s of ['Grano', 'vari', 'misti', 'frutteto', 'Pomodoro', '']) {
      expect(categoriaOrtiveDaTesto(s)).toBe(false);
    }
  });

  it('coltura «ortaggi» → categoria Ortive e coltura ancora vuota (poi chiede ortaggio concreto; non si salva così)', () => {
    // Round2: la sola categoria non va al salvataggio (scheda + prompt). Qui resta lo stato intermedio.
    const r = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Quali ortaggi soprattutto?',
        fatto: false,
        terreni: [{ nome: 'Orto Sud', superficie: 0.5, coltura: 'ortaggi' }],
      }),
      { argomento: 'terreni' }
    );
    expect(r.dati.terreni[0].coltura).toBeNull();
    expect(r.dati.terreni[0].categoria).toBe('Ortive');
    expect(r.fatto).toBeFalsy();
  });

  it('un ortaggio reale resta una coltura (niente categoria)', () => {
    const r = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'ok',
        fatto: false,
        terreni: [{ nome: 'Orto', superficie: 1, coltura: 'Pomodoro' }],
      }),
      {}
    );
    expect(r.dati.terreni[0].coltura).toBe('Pomodoro');
    expect(r.dati.terreni[0].categoria).toBeUndefined();
  });

  it('il prompt chiede «Quali ortaggi soprattutto?» una sola volta', () => {
    const prima = promptSistemaAccount('terreni', { raccolti: '' });
    expect(prima).toContain('Quali ortaggi soprattutto?');
    expect(prima).toContain('UNA sola volta');
    const raccolti = serializzaRaccolti({
      terreni: [{ nome: 'Orto', superficie: 1, coltura: null, categoria: 'Ortive' }],
    });
    expect(raccolti).toContain('categoria Ortive');
    const dopo = promptSistemaAccount('terreni', { raccolti });
    expect(dopo).toContain('NON richiederlo');
  });

  it('prompt dopo categoria Ortive: chiede ortaggio concreto, non riepilogo solo categoria', () => {
    const raccolti = serializzaRaccolti({
      terreni: [{ nome: 'Orto', superficie: 1, coltura: null, categoria: 'Ortive' }],
    });
    const prompt = promptSistemaAccount('terreni', { raccolti });
    expect(prompt).toMatch(/Insalata|Pomodoro|Zucchine/i);
    expect(prompt).toMatch(/non mettere fatto:true|non mandare al riepilogo/i);
  });
});

describe('punto 12 – whoosh non usato in LandingHome', () => {
  it('niente audioWhoosh in LandingHome.vue (knock resta)', () => {
    const src = fs.readFileSync(
      path.join(root, 'landing/src/views/LandingHome.vue'),
      'utf8'
    );
    expect(src).not.toContain('audioWhoosh');
    expect(src).toContain('audioBussata');
    expect(src).toContain('audioTerzo');
  });
});
