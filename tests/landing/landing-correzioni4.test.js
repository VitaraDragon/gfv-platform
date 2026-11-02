/**
 * Correzioni 4 – anteprima landing Tony.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collegaTerreniAiPoderi,
  decidiDopoRisposta,
} from '../../landing/src/lib/tony-aiuto-account.js';
import {
  bussataAutomaticaConsentita,
  CHIAVE_RINUNCIA_AVVISO,
  percorsoVoceAiuto,
} from '../../landing/src/lib/tony-bussa-logica.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function leggi(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('correzioni 4 – riepilogo e torna-chat', () => {
  it('TonySchedaConferma emette torna-chat con i dati', () => {
    const scheda = leggi('landing/src/components/TonySchedaConferma.vue');
    expect(scheda).toMatch(/emit\('torna-chat',\s*\{/);
    expect(scheda).toContain('payloadCorrente()');
    expect(scheda).toContain('suggerimentoPiu');
  });

  it('TonyChat ripristina dati e consente di continuare dopo il ritorno', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toContain('onTornaDallaScheda(dati');
    expect(chat).toContain('collegaTerreniAiPoderi');
    expect(chat).toContain('tornatoDalRiepilogo');
    expect(chat).toContain('tornaDalRiepilogo');
    expect(chat).toMatch(/faseAccount:\s*inAccount/);
  });

  it('dati dalla scheda si uniscono ai terreni', () => {
    const uniti = collegaTerreniAiPoderi({
      sede: { citta: 'Faenza', indirizzo: 'Via Roma 1', cap: '48018', provincia: 'RA' },
      poderi: [{ nome: 'Nord' }],
      terreni: [
        { nome: 'Campo A', superficie: 1.2, coltura: 'Grano', podere: 'Nord' },
        { nome: 'Campo B', superficie: 0.5, coltura: 'Mais', podere: null },
      ],
    });
    expect(uniti.terreni).toHaveLength(2);
    expect(uniti.terreni[1].podere).toBe('Nord');
  });

  it('fatto:true senza richiesta esplicita non riapre se tornatoDalRiepilogo (logica in chat)', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toMatch(/tornatoDalRiepilogo\s*&&\s*!chiedeRiepilogo/);
    expect(chat).toMatch(/riepilogo\|basta\|ho finito\|fatto\|\^no\\b/);
  });

  it('decidiDopoRisposta con domandeRimaste 2 una sola volta', () => {
    expect(decidiDopoRisposta({ domandeRimaste: 2, passo: 'terreni' }).azione).toBe(
      'riepilogo'
    );
    expect(
      decidiDopoRisposta({
        domandeRimaste: 2,
        passo: 'terreni',
        giaRiaperturaLimiteDomande: true,
      }).azione
    ).toBe('resta');
  });
});

describe('correzioni 4 – Saluta Tony e pillola', () => {
  it('dopo saluta salva rinuncia; pillola Parla con Tony resta disponibile', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toContain('salvaRinunciaAvviso()');
    expect(home).toMatch(/function saluta\(\)[\s\S]*?salvaRinunciaAvviso\(\)/);
    expect(home).toContain('onRiapriTony');
    expect(home).toMatch(
      /v-if="tonyOn && tonyGiaApparso && !avvisoAperto && \(!stageAperto \|\| tonyRidotto\)"/
    );
    expect(testiLanding.tonyBussa.ripristina).toBe('Parla con Tony');
    expect(CHIAVE_RINUNCIA_AVVISO).toBeTruthy();
    expect(
      bussataAutomaticaConsentita({ rinunciaSalvata: true, utenteHaInteragito: true })
    ).toBe(false);
  });
});

describe('correzioni 4 – voci fisse e whoosh', () => {
  it('percorsoVoceAiuto e niente whoosh in entrata', () => {
    expect(percorsoVoceAiuto('invito').mp3).toBe('/tony-live/voci/tony-aiuto-invito.mp3');
    expect(percorsoVoceAiuto('tornaDalRiepilogo').mp3).toContain('tornaDalRiepilogo');
    const home = leggi('landing/src/views/LandingHome.vue');
    const fnEntrata = home.match(/function vaiEntrata\(\)[\s\S]*?\n\}/);
    expect(fnEntrata?.[0] || '').not.toContain('audioWhoosh');
  });

  it('testi aiuto contengono le nuove frasi', () => {
    const a = testiLanding.tonyBussa.aiuto;
    expect(a.tornaDalRiepilogo).toMatch(/altro terreno/);
    expect(a.tornaDalRiepilogoVoce).not.toMatch(/\bN\b/);
    expect(a.suggerimentoPiu).toMatch(/voce/);
  });
});
