/**
 * Quattro correzioni post-prova Pier (landing Tony / prova-tony).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  BUSSATA_AUTOMATICA_ATTIVA,
  bussataAutomaticaConsentita,
  deveRiprovareBussataQuandoVisibile,
  precaricoScenaConsentito,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  correggiTerreniEstratti,
  interpretaFraseTerreni,
  preparaTurnoOnboarding,
  serializzaRaccolti,
  testoLimiteCinqueRaggiunto,
} from '../../landing/src/lib/tony-aiuto-account.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';
import { LIMITI } from '../../landing/src/lib/generati/tony-landing-setup-core.js';

const require = createRequire(import.meta.url);
const {
  applicaNomeTerrenoDaDomanda: applicaNomeServer,
  rispostaAccountDaTesto,
  troncaNomePrimaDiMisura: troncaServer,
} = require('../../functions/lib/tony-landing-account.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function leggi(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function statoPulito() {
  return { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
}

function turno(stato, domanda, modello) {
  const raccolti = serializzaRaccolti(stato.dati);
  const grezzo = typeof modello === 'string' ? modello : JSON.stringify(modello);
  let pulita = rispostaAccountDaTesto(grezzo, {
    raccolti,
    argomento: stato.passo,
    domanda,
  });
  if (pulita.dati) {
    pulita.dati = applicaNomeServer(domanda, pulita.dati);
  }
  const client = preparaTurnoOnboarding({
    domanda,
    passo: stato.passo,
    datiAttuali: stato.dati,
    datiNuovi: pulita.dati,
    testo: pulita.testo,
  });
  stato.dati = client.dati.dati;
  stato.passo = client.passo || stato.passo;
  return {
    testo: client.testo != null ? client.testo : pulita.testo,
    apriRiepilogo: client.apriRiepilogo === true,
    troppi: client.dati.troppiTerreni === true,
    terreni: stato.dati.terreni || [],
    passo: stato.passo,
  };
}

describe('Pier – 1) bussata automatica spenta', () => {
  it('BUSSATA_AUTOMATICA_ATTIVA è false e il gate timer non consente', () => {
    expect(BUSSATA_AUTOMATICA_ATTIVA).toBe(false);
    expect(bussataAutomaticaConsentita({})).toBe(false);
    expect(
      deveRiprovareBussataQuandoVisibile({ paginaNascosta: true, bussateAutomatiche: 0 })
    ).toBe(false);
  });

  it('precarico clip resta consentito; CTA e onVuoiProvare restano', () => {
    expect(precaricoScenaConsentito({})).toBe(true);
    expect(testiLanding.hero.ctaPrincipale).toBe('Vuoi provare GFV?');
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toContain('onVuoiProvare');
    expect(home).toContain('BUSSATA_AUTOMATICA_ATTIVA');
    expect(home).toMatch(/if\s*\(\s*BUSSATA_AUTOMATICA_ATTIVA\s*\)/);
    const cfg = leggi('landing/src/config/landing-config.js');
    expect(cfg).toMatch(/TONY_BUSSA_ATTIVO\s*=\s*false/);
  });
});

describe('Pier – 3) nome da «si chiama X N ha coltura»', () => {
  it('interpretaFraseTerreni ferma il nome prima della misura', () => {
    expect(interpretaFraseTerreni('si chiama lago 12 ha kiwi')[0]).toMatchObject({
      nome: 'lago',
      superficie: 12,
      varieta: 'kiwi',
    });
    expect(interpretaFraseTerreni('si chiama lago, 12 ha kiwi')[0]).toMatchObject({
      nome: 'lago',
      superficie: 12,
      varieta: 'kiwi',
    });
    expect(interpretaFraseTerreni('si chiama noceto...ho 6 ha di noci')[0]).toMatchObject({
      nome: 'noceto',
      superficie: 6,
      varieta: 'noci',
    });
    expect(
      interpretaFraseTerreni('ho 5 ha di pinot bianco e si chiama storto')[0]
    ).toMatchObject({
      nome: 'storto',
      superficie: 5,
    });
    expect(interpretaFraseTerreni('8 ha di noci che si chiama pozzo')[0]).toMatchObject({
      nome: 'pozzo',
      superficie: 8,
      varieta: 'noci',
    });
  });

  it('correggiTerreniEstratti e server non producono «Lago 12 ha kiwi»', () => {
    const domanda = 'si chiama lago 12 ha kiwi';
    const corretti = correggiTerreniEstratti(
      domanda,
      [{ nome: 'Lago', superficie: 12, coltura: 'Kiwi' }],
      []
    );
    expect(corretti[0].nome).toBe('Lago');
    expect(String(corretti[0].nome)).not.toMatch(/12\s*ha/i);

    const dalServer = applicaNomeServer(domanda, {
      terreni: [{ nome: 'Lago', superficie: 12, coltura: 'Kiwi' }],
    });
    expect(dalServer.terreni[0].nome).toBe('Lago');
    expect(String(dalServer.terreni[0].nome)).not.toMatch(/12\s*ha/i);
    expect(troncaServer('lago 12 ha kiwi')).toBe('lago');
  });
});

describe('Pier – 4) coltura canonica dopo nome chiesto', () => {
  it('albicocche → Albicocche; noci → Noce; albicocco → Albicocche', () => {
    const albicocche = preparaTurnoOnboarding({
      domanda: 'penduto',
      passo: 'terreni',
      datiAttuali: {
        sede: { citta: 'Faenza', indirizzo: 'via monte coralli 13' },
        poderi: [{ nome: 'Carisa' }],
        terreni: [{ nome: null, superficie: 8, coltura: 'albicocche' }],
      },
      datiNuovi: { terreni: [{ nome: 'Penduto', superficie: 8, coltura: 'albicocche' }] },
      testo: 'Come si chiama?',
    });
    expect(albicocche.dati.dati.terreni[0]).toMatchObject({
      nome: 'Penduto',
      coltura: 'Albicocche',
    });

    const noci = preparaTurnoOnboarding({
      domanda: 'noceto',
      passo: 'terreni',
      datiAttuali: {
        terreni: [{ nome: null, superficie: 6, coltura: 'noci' }],
      },
      datiNuovi: { terreni: [{ nome: 'Noceto', superficie: 6, coltura: 'noci' }] },
      testo: 'Come si chiama?',
    });
    expect(noci.dati.dati.terreni[0]).toMatchObject({
      nome: 'Noceto',
      coltura: 'Noce',
    });

    const albicocco = correggiTerreniEstratti(
      'penduto',
      [{ nome: 'Penduto' }],
      [{ nome: null, superficie: 8, coltura: 'albicocco' }]
    );
    expect(albicocco[0]).toMatchObject({ nome: 'Penduto', coltura: 'Albicocche' });
  });
});

describe('Pier – 2) quinto terreno apre il riepilogo', () => {
  it('al 5° completo: testo limite, niente «Ne hai altri», apriRiepilogo', () => {
    const quattro = [
      { nome: 'Lago', superficie: 12, coltura: 'Kiwi' },
      { nome: 'Collina', superficie: 3, coltura: 'Pesco' },
      { nome: 'Storto', superficie: 5, coltura: 'Vite da Vino' },
      { nome: 'Noceto', superficie: 6, coltura: 'Noce' },
    ];
    const esito = preparaTurnoOnboarding({
      domanda: 'penduto',
      passo: 'terreni',
      datiAttuali: {
        sede: { citta: 'Faenza', indirizzo: 'via monte coralli 13' },
        poderi: [{ nome: 'Carisa' }],
        terreni: [
          ...quattro,
          { nome: null, superficie: 8, coltura: 'Albicocche' },
        ],
      },
      datiNuovi: {
        terreni: [{ nome: 'Penduto', superficie: 8, coltura: 'Albicocche' }],
      },
      testo: 'Ok, un terreno Penduto. Ne hai cinque su cinque terreni. Ne hai altri o vediamo il riepilogo?',
    });
    expect(esito.dati.dati.terreni).toHaveLength(LIMITI.MAX_TERRENI_PER_RICHIESTA);
    expect(esito.apriRiepilogo).toBe(true);
    expect(esito.testo).toMatch(/limite di cinque terreni/i);
    expect(esito.testo).not.toMatch(/Ne hai altri/i);
    expect(testoLimiteCinqueRaggiunto()).toBe(
      testiLanding.tonyBussa.aiuto.limiteCinqueRaggiunto
    );
  });

  it('il sesto resta rifiutato con cinqueTerreni (senza riaprire da solo)', () => {
    const cinque = [
      { nome: 'Lago', superficie: 12, coltura: 'Kiwi' },
      { nome: 'Collina', superficie: 3, coltura: 'Pesco' },
      { nome: 'Storto', superficie: 5, coltura: 'Vite da Vino' },
      { nome: 'Noceto', superficie: 6, coltura: 'Noce' },
      { nome: 'Penduto', superficie: 8, coltura: 'Albicocche' },
    ];
    const esito = preparaTurnoOnboarding({
      domanda: 'campo nuovo 2 ha mais',
      passo: 'terreni',
      datiAttuali: { terreni: cinque },
      datiNuovi: {
        terreni: [{ nome: 'Campo nuovo', superficie: 2, coltura: 'Mais' }],
      },
      testo: 'Va bene.',
    });
    expect(esito.dati.troppiTerreni).toBe(true);
    expect(esito.dati.dati.terreni).toHaveLength(5);
    expect(esito.apriRiepilogo).toBe(false);
  });
});

describe('Pier – giro completo dialogo di riferimento', () => {
  it('Faenza / Carisa / cinque terreni: Lago non include ettari, al 5° apre riepilogo', () => {
    const stato = statoPulito();
    const sede = turno(stato, 'faenza via monte coralli 13', {
      testo: 'Ok, ho la sede. Hai uno o più poderi?',
      sede: {
        indirizzo: 'via monte coralli 13',
        citta: 'Faenza',
        cap: null,
        provincia: 'RA',
      },
      poderi: [],
      terreni: [],
      fatto: false,
    });
    expect(sede.terreni).toHaveLength(0);
    expect(stato.dati.sede.citta).toMatch(/Faenza/i);

    turno(stato, 'carisa', {
      testo: 'Ok, podere Carisa. ' + testiLanding.tonyBussa.aiuto.domandaTerreni,
      poderi: [{ nome: 'Carisa' }],
      terreni: [],
      fatto: false,
    });
    expect(stato.dati.poderi[0].nome).toBe('Carisa');

    const lago = turno(stato, 'si chiama lago 12 ha kiwi', {
      testo: 'Ok, Lago 12 ha a Kiwi. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Lago 12 ha kiwi', superficie: 12, coltura: 'Kiwi' }],
      fatto: false,
    });
    expect(lago.terreni[0].nome).toBe('Lago');
    expect(lago.terreni[0].nome).not.toMatch(/12/);
    expect(lago.terreni[0].coltura).toMatch(/Kiwi/i);
    expect(lago.apriRiepilogo).toBe(false);
    expect(lago.testo).toMatch(/Ne hai altri/i);

    turno(stato, 'collina 3 ha di pesco', {
      testo: 'Ok, Collina. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Collina', superficie: 3, coltura: 'Pesco' }],
      fatto: false,
    });

    turno(stato, 'ho 5 ha di pinot bianco e si chiama storto', {
      testo: 'Ok, Storto. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Storto', superficie: 5, coltura: 'Vite da Vino' }],
      fatto: false,
    });
    expect(stato.dati.terreni[2]).toMatchObject({
      nome: 'Storto',
      coltura: 'Vite da Vino',
    });

    turno(stato, 'si chiama noceto...ho 6 ha di noci', {
      testo: 'Ok, Noceto. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Noceto', superficie: 6, coltura: 'Noce' }],
      fatto: false,
    });
    expect(stato.dati.terreni[3]).toMatchObject({ nome: 'Noceto', coltura: 'Noce' });

    const senzaNome = turno(stato, 'ho 8 ha di albicocche', {
      testo: 'Come si chiama il terreno da 8 ettari a Albicocche?',
      terreni: [{ nome: null, superficie: 8, coltura: 'Albicocche' }],
      fatto: false,
    });
    expect(senzaNome.apriRiepilogo).toBe(false);
    expect(senzaNome.terreni).toHaveLength(5);
    expect(senzaNome.terreni[4].nome).toBeFalsy();

    const quinto = turno(stato, 'penduto', {
      testo:
        'Ok, un terreno Penduto. Ne hai cinque su cinque. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Penduto', superficie: 8, coltura: 'Albicocche' }],
      fatto: false,
    });
    expect(quinto.apriRiepilogo).toBe(true);
    expect(quinto.testo).not.toMatch(/Ne hai altri/i);
    expect(quinto.testo).toMatch(/limite di cinque terreni/i);
    expect(quinto.terreni.map((t) => t.nome)).toEqual([
      'Lago',
      'Collina',
      'Storto',
      'Noceto',
      'Penduto',
    ]);
    expect(quinto.terreni[4].coltura).toBe('Albicocche');
    expect(quinto.terreni[0].nome).toBe('Lago');

    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toMatch(/turno\.apriRiepilogo/);
    expect(chat).toContain("suonaFraseFissa('limiteCinqueRaggiunto')");

    const prompt = leggi('functions/lib/tony-landing-account.js');
    expect(prompt).toMatch(/quinto terreno è completo/);
    expect(prompt).toMatch(/NON chiedere «Ne hai altri\?»/);
  });
});
