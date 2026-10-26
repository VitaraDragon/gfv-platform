/**
 * Landing passo 6 — voce già pronta del saluto e bocca a tempo (Vitest puro).
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GIORNI_GUIDA_TONY, TONY_BUSSA_ATTIVO, VERSIONE_AVVISO_TONY } from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';
import {
  deveParlare,
  leggiPresaVisione,
  livelloVoce,
  percorsoClip,
  percorsiVoce,
  percorsoTonyStatico,
  prossimoStato,
  prossimaBocca,
  salvaPresaVisione,
  tempiVoce,
  testoDaVtt,
} from '../../landing/src/lib/tony-bussa-logica.js';
import { raccogliStringhe } from './aiuto-stringhe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const SALUTO_DESKTOP =
  'Ehi, ciao! Sono Tony. Mi hai chiamato? Ti spiego Global Farm View in un minuto, o mi fai una domanda?';
const SALUTO_MOBILE = 'Ciao! Sono Tony. Chiedimi pure di GFV.';
const CIAO = 'Ci vediamo dentro GFV!';

const MD5_ATTESI = {
  'landing/public/tony-live/voci/tony-saluto-desktop.mp3': '6cc928a478571d74783aa6165cbb00dc',
  'landing/public/tony-live/voci/tony-saluto-mobile.mp3': '6b0753f5666c19b425d7b08ba35b91b8',
  'landing/public/tony-live/voci/tony-ciao.mp3': '7aafd3cacca1b1b70256323fc0975e5a',
  'landing/public/tony-live/static/tony-static.png': '003ae14af111556be7f3f6d0532d7a8c',
};

function leggi(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function fileDaPercorsoWeb(webPath) {
  const rel = String(webPath || '').replace(/^\/+/, '');
  return path.join(repoRoot, 'landing', 'public', rel);
}

function md5(rel) {
  return createHash('md5').update(fs.readFileSync(path.join(repoRoot, rel))).digest('hex');
}

function memoria() {
  const dati = new Map();
  return {
    getItem(chiave) {
      return dati.has(chiave) ? dati.get(chiave) : null;
    },
    setItem(chiave, valore) {
      dati.set(chiave, String(valore));
    },
  };
}

function fileSorgenteLanding() {
  const radice = path.join(repoRoot, 'landing', 'src');
  const file = [];
  function cammina(dir) {
    for (const nome of fs.readdirSync(dir)) {
      const pieno = path.join(dir, nome);
      if (fs.statSync(pieno).isDirectory()) {
        cammina(pieno);
        continue;
      }
      if (/\.(vue|ts|js|html)$/.test(nome)) file.push(pieno);
    }
  }
  cammina(radice);
  const indice = path.join(repoRoot, 'landing', 'index.html');
  if (fs.existsSync(indice)) file.push(indice);
  return file;
}

describe('flag ancora spento', () => {
  it('TONY_BUSSA_ATTIVO è false', () => {
    expect(TONY_BUSSA_ATTIVO).toBe(false);
  });
});

describe('asset del passo 6', () => {
  const varianti = ['desktop', 'mobile'];
  const formati = ['webm', 'stacked'];

  it('talking, voci e immagine statica esistono', () => {
    for (const variante of varianti) {
      for (const formato of formati) {
        const web = percorsoClip('talking', variante, formato);
        expect(fs.existsSync(fileDaPercorsoWeb(web)), web).toBe(true);
      }
      const voci = percorsiVoce(variante);
      for (const ruolo of ['saluto', 'ciao']) {
        expect(fs.existsSync(fileDaPercorsoWeb(voci[ruolo].mp3)), voci[ruolo].mp3).toBe(true);
        expect(fs.existsSync(fileDaPercorsoWeb(voci[ruolo].vtt)), voci[ruolo].vtt).toBe(true);
      }
    }
    expect(fs.existsSync(fileDaPercorsoWeb(percorsoTonyStatico()))).toBe(true);
  });

  it('in tony-live non ci sono file wav', () => {
    const radice = path.join(repoRoot, 'landing', 'public', 'tony-live');
    function cammina(dir) {
      for (const nome of fs.readdirSync(dir)) {
        const pieno = path.join(dir, nome);
        if (fs.statSync(pieno).isDirectory()) {
          cammina(pieno);
          continue;
        }
        expect(nome.toLowerCase().endsWith('.wav'), pieno).toBe(false);
      }
    }
    cammina(radice);
  });

  it('gli MD5 dei file binari sono quelli del pacchetto', () => {
    for (const [rel, atteso] of Object.entries(MD5_ATTESI)) {
      expect(md5(rel), rel).toBe(atteso);
    }
  });

  it('rispetta i pesi di loop, voci e immagine', () => {
    const limiteLoop = { desktop: 800 * 1024, mobile: 500 * 1024 };
    const limiteVoci = { desktop: 160 * 1024, mobile: 100 * 1024 };
    for (const variante of varianti) {
      for (const formato of formati) {
        const peso = fs.statSync(
          fileDaPercorsoWeb(percorsoClip('talking', variante, formato))
        ).size;
        expect(peso, `${variante} ${formato}`).toBeLessThanOrEqual(limiteLoop[variante]);
      }
      const voci = percorsiVoce(variante);
      const somma =
        fs.statSync(fileDaPercorsoWeb(voci.saluto.mp3)).size +
        fs.statSync(fileDaPercorsoWeb(voci.ciao.mp3)).size;
      expect(somma, variante).toBeLessThanOrEqual(limiteVoci[variante]);
    }
    expect(fs.statSync(fileDaPercorsoWeb(percorsoTonyStatico())).size).toBeLessThanOrEqual(
      800 * 1024
    );
  });
});

describe('audio che comanda i testi', () => {
  it('ogni vtt dice la stessa frase del fumetto', () => {
    const coppie = [
      ['desktop', 'saluto', SALUTO_DESKTOP],
      ['mobile', 'saluto', SALUTO_MOBILE],
      ['desktop', 'ciao', CIAO],
    ];
    for (const [variante, ruolo, atteso] of coppie) {
      const web = percorsiVoce(variante)[ruolo].vtt;
      expect(testoDaVtt(fs.readFileSync(fileDaPercorsoWeb(web), 'utf8'))).toBe(atteso);
    }
    expect(testiLanding.tonyBussa.salutoDesktop).toBe(SALUTO_DESKTOP);
    expect(testiLanding.tonyBussa.salutoMobile).toBe(SALUTO_MOBILE);
    expect(testiLanding.tonyBussa.ciao).toBe(CIAO);
  });

  it('nei saluti non restano le frasi del passo 5', () => {
    expect(testiLanding.tonyBussa.salutoDesktop).not.toContain('Ho bussato');
    expect(testiLanding.tonyBussa.salutoMobile).not.toContain('Ho bussato');
    expect(testiLanding.tonyBussa.salutoDesktop).not.toContain('Presto potrai');
    expect(testiLanding.tonyBussa.salutoMobile).not.toContain('Presto potrai');
    expect(testiLanding.tonyBussa.notaSaluto).toContain('ti guido');
    expect(testiLanding.tonyBussa.notaSaluto).toContain(String(GIORNI_GUIDA_TONY));
  });
});

describe('volume e bocca', () => {
  it('livelloVoce: silenzio, onda piena, vuoto', () => {
    expect(livelloVoce(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(livelloVoce(new Uint8Array([]))).toBe(0);
    expect(livelloVoce(null)).toBe(0);
    const piena = new Uint8Array(1024);
    for (let i = 0; i < piena.length; i += 1) piena[i] = i % 2 === 0 ? 0 : 255;
    expect(livelloVoce(piena)).toBeCloseTo(1, 2);
  });

  it('prossimaBocca tiene la bocca aperta tra una sillaba e l’altra', () => {
    expect(prossimaBocca({ aperta: false, livello: 0.02, msDaUltimoSopra: 0 })).toBe(false);
    expect(prossimaBocca({ aperta: false, livello: 0.05, msDaUltimoSopra: 0 })).toBe(true);
    expect(prossimaBocca({ aperta: true, livello: 0.03, msDaUltimoSopra: 1000 })).toBe(true);
    expect(prossimaBocca({ aperta: true, livello: 0.02, msDaUltimoSopra: 249 })).toBe(true);
    expect(prossimaBocca({ aperta: true, livello: 0.02, msDaUltimoSopra: 250 })).toBe(false);
  });

  it('deveParlare copre i quattro casi', () => {
    expect(
      deveParlare({ audioAttivo: false, riduciMovimento: false, analizzatoreDisponibile: true })
    ).toEqual({ voce: false, bocca: 'ferma' });
    expect(
      deveParlare({ audioAttivo: true, riduciMovimento: true, analizzatoreDisponibile: true })
    ).toEqual({ voce: true, bocca: 'ferma' });
    expect(
      deveParlare({ audioAttivo: true, riduciMovimento: false, analizzatoreDisponibile: false })
    ).toEqual({ voce: true, bocca: 'continua' });
    expect(
      deveParlare({ audioAttivo: true, riduciMovimento: false, analizzatoreDisponibile: true })
    ).toEqual({ voce: true, bocca: 'volume' });
  });

  it('tempiVoce sono quelli del brief', () => {
    expect(tempiVoce()).toEqual({
      ritardoSalutoMs: 200,
      attesaMaxVoceMs: 4000,
      dissolvenzaBoccaMs: 150,
      attesaMaxUscitaMs: 5000,
    });
  });
});

describe('stato parla', () => {
  it('la voce fa parlare e poi tornare fermo; lo statico non si anima', () => {
    let stato = 'idle';
    stato = prossimoStato(stato, 'voceIniziata');
    expect(stato).toBe('parla');
    stato = prossimoStato(stato, 'voceFinita');
    expect(stato).toBe('idle');
    expect(prossimoStato('parla', 'saluta')).toBe('esce');
    expect(prossimoStato('statico', 'voceIniziata')).toBe('statico');
  });

  it('il percorso del passo 5 non cambia', () => {
    let stato = 'nascosto';
    stato = prossimoStato(stato, 'apri');
    stato = prossimoStato(stato, 'conferma');
    stato = prossimoStato(stato, 'bussataFinita');
    stato = prossimoStato(stato, 'entrataFinita');
    expect(stato).toBe('idle');
    expect(prossimoStato(stato, 'saluta')).toBe('esce');
    expect(prossimoStato('bussa', 'clipNonPronta')).toBe('statico');
    expect(prossimoStato('idle', 'apri')).toBe('idle');
  });
});

describe('presa visione con la scelta dell’audio', () => {
  it('salva e rilegge audio spento', () => {
    const storage = memoria();
    expect(salvaPresaVisione(storage, VERSIONE_AVVISO_TONY, '2026-10-26T10:00:00.000Z', false)).toBe(
      true
    );
    expect(leggiPresaVisione(storage, VERSIONE_AVVISO_TONY).audio).toBe(false);
  });

  it('i dati vecchi senza audio restano con l’audio acceso', () => {
    const storage = memoria();
    storage.setItem(
      'gfv-avviso-tony',
      JSON.stringify({ versione: VERSIONE_AVVISO_TONY, data: '2026-10-26T10:00:00.000Z' })
    );
    const letta = leggiPresaVisione(storage, VERSIONE_AVVISO_TONY);
    expect(letta.vista).toBe(true);
    expect(letta.audio).toBe(true);
  });

  it('se localStorage lancia errori non si rompe', () => {
    const rotto = {
      getItem() {
        throw new Error('bloccato');
      },
      setItem() {
        throw new Error('bloccato');
      },
    };
    expect(() => salvaPresaVisione(rotto, VERSIONE_AVVISO_TONY, 'adesso', false)).not.toThrow();
    expect(salvaPresaVisione(rotto, VERSIONE_AVVISO_TONY, 'adesso', false)).toBe(false);
    expect(() => leggiPresaVisione(rotto, VERSIONE_AVVISO_TONY)).not.toThrow();
    expect(leggiPresaVisione(rotto, VERSIONE_AVVISO_TONY).vista).toBe(false);
  });
});

describe('sottotitoli', () => {
  it('fine riga Windows e Unix danno lo stesso testo', () => {
    const lf = 'WEBVTT\n\n1\n00:00:00.300 --> 00:00:01.000\nCiao! Sono Tony. Chiedimi pure di GFV.\n';
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(testoDaVtt(crlf)).toBe(SALUTO_MOBILE);
    expect(testoDaVtt(crlf)).toBe(testoDaVtt(lf));
  });
});

describe('testi e caricamento pigro', () => {
  const testoTony = raccogliStringhe(testiLanding.tonyBussa).join('\n');

  it('nessuna parola vietata e nessuna promessa di fare lui le operazioni', () => {
    const vietate = [
      /certificat/i,
      /collegato al SIAN/i,
      /a norma/i,
      /\bregistro\b/i,
      /quaderno di campagna/i,
      /fattur/i,
    ];
    for (const re of vietate) expect(testoTony).not.toMatch(re);
    expect(testoTony).not.toMatch(/ti porto/i);
    expect(testoTony).not.toMatch(/\bapro\b/i);
    expect(testoTony).not.toMatch(/ti apro/i);
    expect(testoTony).not.toMatch(/registro io/i);
    expect(testoTony).not.toMatch(/compilo/i);
  });

  it('nessun sorgente della landing contiene la parola della protezione scritta attaccata', () => {
    for (const pieno of fileSorgenteLanding()) {
      const rel = path.relative(repoRoot, pieno);
      expect(fs.readFileSync(pieno, 'utf8').toLowerCase(), rel).not.toContain('recaptcha');
    }
  });

  it('voci e immagine statica stanno solo nella logica, e TonyStage resta un import pigro', () => {
    for (const pieno of fileSorgenteLanding()) {
      const rel = path.relative(repoRoot, pieno).replaceAll('\\', '/');
      if (rel === 'landing/src/lib/tony-bussa-logica.js') continue;
      const testo = fs.readFileSync(pieno, 'utf8');
      expect(testo, rel).not.toContain('/tony-live/voci/');
      expect(testo, rel).not.toContain('/tony-live/static/');
    }
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).not.toMatch(/import\s+TonyStage\s+from/);
    expect(home).toMatch(/import\(\s*['"]\.\.\/components\/TonyStage\.vue['"]\s*\)/);
  });
});
