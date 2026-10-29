/**
 * Landing passo 1 — test Vitest puri (niente Firebase, rete, browser).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EMAIL_CONTATTO,
  GIORNI_GUIDA_TONY,
  IVA_CONFERMATA,
  LANDING_ATTIVA,
  LIMITI_LANDING,
  TESTI_LEGALI_PRONTI,
  TESTO_CHI_SIAMO,
} from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';
import {
  alzaSottotitoli,
  cosaMancaPerAccendere,
  formatoVideo,
  rigaPrezzi,
  scegliVistaHome,
  sorgentiVideo,
  vociPianiCosaGestisci,
} from '../../landing/src/lib/landing-logica.js';
import {
  monthlyToAnnual,
  SUBSCRIPTION_PLANS,
} from '../../core/config/subscription-plans.js';
import {
  TONY_GUIDA_ONBOARDING_DAILY_LIMIT,
  TONY_GUIDA_ONBOARDING_DAYS,
} from '../../core/config/tony-guida-onboarding.js';
import { FILE_FIREBASE_LANDING } from './aiuto-stringhe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function raccogliStringhe(valore, acc = []) {
  if (typeof valore === 'string') {
    acc.push(valore);
    return acc;
  }
  if (Array.isArray(valore)) {
    valore.forEach((v) => raccogliStringhe(v, acc));
    return acc;
  }
  if (valore && typeof valore === 'object') {
    Object.values(valore).forEach((v) => raccogliStringhe(v, acc));
  }
  return acc;
}

function leggiTestoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function elencaFileSorgenteLanding() {
  const radici = [
    path.join(repoRoot, 'landing/index.html'),
    path.join(repoRoot, 'landing/src'),
  ];
  const out = [];
  function cammina(p) {
    const st = fs.statSync(p);
    if (st.isFile()) {
      if (/\.(vue|ts|js|html)$/.test(p)) out.push(p);
      return;
    }
    for (const nome of fs.readdirSync(p)) {
      if (nome === 'node_modules' || nome === 'dist') continue;
      cammina(path.join(p, nome));
    }
  }
  for (const r of radici) cammina(r);
  return out;
}

describe('scegliVistaHome', () => {
  it('con flag spento e fuori dallo sviluppo restituisce coming-soon', () => {
    expect(scegliVistaHome({ landingAttiva: false, dev: false })).toBe('coming-soon');
  });

  it('con flag acceso restituisce landing', () => {
    expect(scegliVistaHome({ landingAttiva: true, dev: false })).toBe('landing');
  });

  it('in sviluppo restituisce landing', () => {
    expect(scegliVistaHome({ landingAttiva: false, dev: true })).toBe('landing');
  });
});

describe('LANDING_ATTIVA e cosaMancaPerAccendere', () => {
  it('LANDING_ATTIVA oggi è false', () => {
    expect(LANDING_ATTIVA).toBe(false);
  });

  it('oggi l’elenco di ciò che manca non è vuoto', () => {
    const manca = cosaMancaPerAccendere({
      emailContatto: EMAIL_CONTATTO,
      testoChiSiamo: TESTO_CHI_SIAMO,
      ivaConfermata: IVA_CONFERMATA,
      testiLegaliPronti: TESTI_LEGALI_PRONTI,
    });
    expect(manca.length).toBeGreaterThan(0);
  });

  it('se LANDING_ATTIVA è true, l’elenco deve essere vuoto (niente accensione a pezzi)', () => {
    const manca = cosaMancaPerAccendere({
      emailContatto: EMAIL_CONTATTO,
      testoChiSiamo: TESTO_CHI_SIAMO,
      ivaConfermata: IVA_CONFERMATA,
      testiLegaliPronti: TESTI_LEGALI_PRONTI,
    });
    if (LANDING_ATTIVA === true) {
      expect(manca).toEqual([]);
    }
  });
});

describe('rigaPrezzi e giorni guida', () => {
  it('contiene i numeri dai piani e i 7 giorni; IVA solo se confermata', () => {
    const senzaIva = rigaPrezzi(
      {
        free: SUBSCRIPTION_PLANS.free,
        base: SUBSCRIPTION_PLANS.base,
        monthlyToAnnual,
      },
      GIORNI_GUIDA_TONY,
      { ivaConfermata: false }
    );
    const testo = `${senzaIva.gratis} ${senzaIva.moduli}`;
    expect(testo).toContain(`${SUBSCRIPTION_PLANS.free.maxTerreni} terreni`);
    expect(testo).toContain(`${GIORNI_GUIDA_TONY} giorni`);
    expect(testo).toContain(
      `${monthlyToAnnual(SUBSCRIPTION_PLANS.base.price)} € l'anno`
    );
    expect(testo).toContain(`circa ${SUBSCRIPTION_PLANS.base.price} € al mese`);
    expect(testo).not.toContain('disdici quando vuoi dall\'app');
    expect(testo.toLowerCase()).not.toContain('iva');

    const conIva = rigaPrezzi(
      {
        free: SUBSCRIPTION_PLANS.free,
        base: SUBSCRIPTION_PLANS.base,
        monthlyToAnnual,
      },
      GIORNI_GUIDA_TONY,
      { ivaConfermata: true }
    );
    expect(conIva.gratis.toLowerCase()).toContain('iva');
  });

  it('GIORNI_GUIDA_TONY è uguale a TONY_GUIDA_ONBOARDING_DAYS', () => {
    expect(GIORNI_GUIDA_TONY).toBe(TONY_GUIDA_ONBOARDING_DAYS);
  });
});

describe('testi landing — regole del brief', () => {
  const stringhe = raccogliStringhe(testiLanding);
  const tutto = stringhe.join('\n');

  it('nessuna parola vietata', () => {
    const vietate = [
      /certificat/i,
      /SIAN/i,
      /a norma/i,
      /quaderno di campagna/i,
      /fattur/i,
      /trattament/i,
    ];
    for (const re of vietate) {
      expect(tutto).not.toMatch(re);
    }
  });

  it('nome del servizio: niente GFV Platform né GFVagri', () => {
    expect(tutto).not.toContain('GFV Platform');
    expect(tutto).not.toContain('GFVagri');
  });

  it('dopo ogni «hardware esterno» c’è anche smartphone o computer con internet', () => {
    const pezzi = tutto.split(/hardware esterno/i);
    for (let i = 1; i < pezzi.length; i += 1) {
      expect(pezzi[i].toLowerCase()).toContain('smartphone o un computer con internet');
    }
  });

  it('Come ti aiuta Tony: secondo punto spiega dove andare (senza portare)', () => {
    const secondo = testiLanding.comeAiuta.punti[1];
    expect(secondo.titolo).toBe('Chiedi e ti spiega dove andare.');
    expect(secondo.testo).toContain('ti dice in quale pagina andare e cosa fare');
    expect(secondo.testo).not.toMatch(/ti porta|ti mostra dove andare/i);
  });

  it('Cosa gestisci: Tony Avanzato è la prima voce dei moduli', () => {
    expect(testiLanding.cosaGestisci.moduli[0]).toBe('Tony Avanzato');
    expect(testiLanding.cosaGestisci.moduliTitolo).toBe(
      'Moduli da aggiungere al piano Base'
    );
  });
});

describe('Cosa gestisci — piani e limiti', () => {
  it('LIMITI_LANDING rispecchia subscription-plans e tony-guida-onboarding', () => {
    expect(LIMITI_LANDING.maxTerreniFree).toBe(SUBSCRIPTION_PLANS.free.maxTerreni);
    expect(LIMITI_LANDING.maxAttivitaMeseFree).toBe(
      SUBSCRIPTION_PLANS.free.maxAttivitaMese
    );
    expect(LIMITI_LANDING.prezzoBaseMese).toBe(SUBSCRIPTION_PLANS.base.price);
    expect(LIMITI_LANDING.giorniGuidaTony).toBe(TONY_GUIDA_ONBOARDING_DAYS);
    expect(LIMITI_LANDING.domandeGuidaGiorno).toBe(TONY_GUIDA_ONBOARDING_DAILY_LIMIT);
    expect(GIORNI_GUIDA_TONY).toBe(LIMITI_LANDING.giorniGuidaTony);
  });

  it('voci piano gratuito: nomi e limiti dai numeri in config', () => {
    const piani = vociPianiCosaGestisci(LIMITI_LANDING);
    expect(piani.gratisTitolo).toBe("Con l'account gratuito");
    expect(piani.gratis.map((v) => v.nome)).toEqual([
      'Terreni',
      'Poderi',
      'Diario attività',
      'Statistiche',
      'Tony Guida',
    ]);
    expect(piani.gratis.find((v) => v.id === 'terreni')?.dettaglio).toBe(
      `fino a ${LIMITI_LANDING.maxTerreniFree}`
    );
    expect(piani.gratis.find((v) => v.id === 'diario')?.dettaglio).toBe(
      `fino a ${LIMITI_LANDING.maxAttivitaMeseFree} al mese`
    );
    expect(piani.gratis.find((v) => v.id === 'tony-guida')?.dettaglio).toBe(
      `nell'app: i primi ${LIMITI_LANDING.giorniGuidaTony} giorni, fino a ${LIMITI_LANDING.domandeGuidaGiorno} domande al giorno`
    );
    expect(piani.gratis.map((v) => v.nome).join(' ')).not.toMatch(/Utenti|Lavori e attività/);
  });

  it('voci piano Base: illimitati / sempre con te e titolo con prezzo', () => {
    const piani = vociPianiCosaGestisci(LIMITI_LANDING);
    expect(piani.baseTitolo).toBe(
      `Con il piano Base — ${LIMITI_LANDING.prezzoBaseMese * 12} € l'anno`
    );
    expect(piani.base.map((v) => v.nome)).toEqual([
      'Terreni illimitati',
      'Poderi',
      'Diario attività illimitato',
      'Statistiche',
      'Tony Guida, sempre con te',
    ]);
    expect(piani.base.every((v) => v.dettaglio == null)).toBe(true);
  });
});

describe('niente da fuori', () => {
  it('nessun riferimento a font Google, YouTube, reCAPTCHA, Firebase JS o GTM', () => {
    const vietatiSempre = [
      'fonts.googleapis',
      'fonts.gstatic',
      'youtube',
      'gstatic.com/firebasejs',
      'googletagmanager',
    ];
    const files = elencaFileSorgenteLanding();
    for (const file of files) {
      const rel = path.relative(repoRoot, file).replaceAll('\\', '/');
      const testo = fs.readFileSync(file, 'utf8').toLowerCase();
      for (const v of vietatiSempre) {
        expect(testo, `${rel} non deve contenere ${v}`).not.toContain(v);
      }
      if (rel !== FILE_FIREBASE_LANDING) {
        expect(testo, `${rel} non deve contenere recaptcha`).not.toContain('recaptcha');
      }
    }
  });
});

describe('formatoVideo e sorgenti', () => {
  it('soglie 4x5 / 16x9', () => {
    expect(formatoVideo(375)).toBe('4x5');
    expect(formatoVideo(767)).toBe('4x5');
    expect(formatoVideo(768)).toBe('16x9');
    expect(formatoVideo(1440)).toBe('16x9');
  });

  it('WebM prima di MP4 e nomi file corretti', () => {
    const s16 = sorgentiVideo('16x9');
    expect(s16.sources[0].src).toContain('tony-landing-v2-16x9.webm');
    expect(s16.sources[1].src).toContain('tony-landing-v2-16x9.mp4');
    expect(s16.poster).toContain('tony-landing-v2-16x9-poster.jpg');

    const s45 = sorgentiVideo('4x5');
    expect(s45.sources[0].src).toContain('tony-landing-v2-4x5.webm');
    expect(s45.sources[1].src).toContain('tony-landing-v2-4x5.mp4');
    expect(s45.poster).toContain('tony-landing-v2-4x5-poster.jpg');
  });
});

describe('alzaSottotitoli', () => {
  const campione = `WEBVTT

1
00:00:00.230 --> 00:00:04.730
Ciao

2
00:00:05.180 --> 00:00:07.930
Secondo
`;

  it('ogni riga con --> finisce con line:-3; due applicazioni non raddoppiano', () => {
    const una = alzaSottotitoli(campione);
    const due = alzaSottotitoli(una);
    const righeTempo = una.split(/\r?\n/).filter((l) => l.includes('-->'));
    for (const r of righeTempo) {
      expect(r.endsWith('line:-3')).toBe(true);
    }
    expect(due).toBe(una);
    expect(una).toContain('Ciao');
    expect(una).toContain('Secondo');
    expect(una.startsWith('WEBVTT')).toBe(true);
  });

  it('il .vtt in public/video, se presente, ha già line:-3', () => {
    const vttPath = path.join(repoRoot, 'landing/public/video/tony-landing-v2-vo-v3.vtt');
    if (!fs.existsSync(vttPath)) return;
    const testo = fs.readFileSync(vttPath, 'utf8');
    const righeTempo = testo.split(/\r?\n/).filter((l) => l.includes('-->'));
    expect(righeTempo.length).toBeGreaterThan(0);
    for (const r of righeTempo) {
      expect(r.endsWith('line:-3')).toBe(true);
    }
  });
});

describe('root index.html intatta', () => {
  it('contiene ancora «Stiamo arrivando»', () => {
    const root = leggiTestoFile('index.html');
    expect(root).toContain('Stiamo arrivando');
  });
});
