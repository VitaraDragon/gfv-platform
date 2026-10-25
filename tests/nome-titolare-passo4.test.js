/**
 * Landing passo 4 — nome/cognome facoltativi titolare (Vitest puro).
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOME_TITOLARE_FACOLTATIVO_ATTIVO } from '../core/config/nome-titolare-config.js';
import { URL_REGISTRAZIONE } from '../landing/src/config/landing-config.js';
import {
  isDaLanding,
  isNomeCognomeFacoltativi,
  buildCampiNomeCognomeSeCompilati,
  displayNameDaNomeCognome,
  campiNomeDaInvitoSeVuoti,
  urlRegistrazioneConDaLanding,
  preservaDaLandingSuUrl
} from '../core/js/nome-titolare-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function leggi(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

describe('flag NOME_TITOLARE_FACOLTATIVO_ATTIVO', () => {
  it('nel repo è spento (false)', () => {
    expect(NOME_TITOLARE_FACOLTATIVO_ATTIVO).toBe(false);
  });
});

describe('link landing ?da=landing', () => {
  it('URL_REGISTRAZIONE include da=landing', () => {
    expect(URL_REGISTRAZIONE).toContain('registrazione-standalone.html');
    expect(URL_REGISTRAZIONE).toMatch(/[?&]da=landing(?:&|$)/);
  });

  it('urlRegistrazioneConDaLanding non duplica e usa & se ci sono già parametri', () => {
    expect(urlRegistrazioneConDaLanding('https://x/reg.html')).toBe('https://x/reg.html?da=landing');
    expect(urlRegistrazioneConDaLanding('https://x/reg.html?foo=1')).toBe('https://x/reg.html?foo=1&da=landing');
    expect(urlRegistrazioneConDaLanding('https://x/reg.html?da=landing')).toBe('https://x/reg.html?da=landing');
  });

  it('preservaDaLandingSuUrl solo se il search corrente ha da=landing', () => {
    expect(preservaDaLandingSuUrl('registrazione-standalone.html', '?da=landing'))
      .toBe('registrazione-standalone.html?da=landing');
    expect(preservaDaLandingSuUrl('registrazione-standalone.html', '')).toBe('registrazione-standalone.html');
  });
});

describe('quando nome/cognome sono facoltativi', () => {
  it('solo flag acceso E ?da=landing', () => {
    expect(isNomeCognomeFacoltativi({ flagAttivo: true, daLanding: true })).toBe(true);
    expect(isNomeCognomeFacoltativi({ flagAttivo: false, daLanding: true })).toBe(false);
    expect(isNomeCognomeFacoltativi({ flagAttivo: true, daLanding: false })).toBe(false);
    expect(isNomeCognomeFacoltativi({ flagAttivo: false, daLanding: false })).toBe(false);
  });

  it('isDaLanding legge il parametro', () => {
    expect(isDaLanding('?da=landing')).toBe(true);
    expect(isDaLanding('da=landing&x=1')).toBe(true);
    expect(isDaLanding(new URLSearchParams('da=landing'))).toBe(true);
    expect(isDaLanding('?da=altro')).toBe(false);
    expect(isDaLanding('')).toBe(false);
    expect(isDaLanding(null)).toBe(false);
  });
});

describe('buildCampiNomeCognomeSeCompilati (users senza stringhe vuote)', () => {
  it('flag acceso + landing: senza nome/cognome → oggetto senza chiavi nome/cognome', () => {
    const campi = buildCampiNomeCognomeSeCompilati('', '  ');
    expect(campi).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(campi, 'nome')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(campi, 'cognome')).toBe(false);
  });

  it('solo nome compilato → solo chiave nome', () => {
    expect(buildCampiNomeCognomeSeCompilati(' Mario ', '')).toEqual({ nome: 'Mario' });
  });

  it('entrambi → entrambi', () => {
    expect(buildCampiNomeCognomeSeCompilati('Mario', 'Rossi')).toEqual({ nome: 'Mario', cognome: 'Rossi' });
  });

  it('simulazione documento users con azienda obbligatoria', () => {
    const aziendaNome = 'Vigneto Rossi';
    expect(aziendaNome.trim()).toBeTruthy();
    const userData = {
      id: 'uid1',
      email: 'titolare@esempio.it',
      ...buildCampiNomeCognomeSeCompilati('', ''),
      tenantId: 'vigneto_rossi_uid1',
      ruoli: ['amministratore']
    };
    expect(userData.nome).toBeUndefined();
    expect(userData.cognome).toBeUndefined();
    expect(userData.email).toBe('titolare@esempio.it');
  });
});

describe('flag spento o senza ?da=landing → obbligo come oggi', () => {
  it('con flag spento (valore repo) la registrazione HTML ha ancora required su nome/cognome', () => {
    expect(NOME_TITOLARE_FACOLTATIVO_ATTIVO).toBe(false);
    const html = leggi('core/auth/registrazione-standalone.html');
    expect(html).toMatch(/id="nome"[\s\S]*?required/);
    expect(html).toMatch(/id="cognome"[\s\S]*?required/);
    expect(html).toContain("showError('nome', 'Nome obbligatorio')");
    expect(html).toContain("showError('cognome', 'Cognome obbligatorio')");
    expect(html).toContain('nomeCognomeFacoltativi');
  });

  it('senza daLanding la validazione obbligatoria resta attiva nel helper', () => {
    expect(isNomeCognomeFacoltativi({
      flagAttivo: NOME_TITOLARE_FACOLTATIVO_ATTIVO,
      daLanding: true
    })).toBe(false);
    expect(isNomeCognomeFacoltativi({ flagAttivo: true, daLanding: false })).toBe(false);
  });
});

describe('registrazione da invito: nome/cognome restano obbligatori', () => {
  it('registrazione-invito-standalone.html tiene required su nome e cognome', () => {
    const html = leggi('core/auth/registrazione-invito-standalone.html');
    expect(html).toMatch(/id="nome"[\s\S]*?required/);
    expect(html).toMatch(/id="cognome"[\s\S]*?required/);
  });
});

describe('invito accettato da utente esistente: completa solo campi vuoti', () => {
  it('riempie nome e cognome vuoti dall\'invito', () => {
    expect(campiNomeDaInvitoSeVuoti(
      { nome: '', cognome: null },
      { nome: 'Luca', cognome: 'Bianchi' }
    )).toEqual({ nome: 'Luca', cognome: 'Bianchi' });
  });

  it('non sovrascrive valori già presenti', () => {
    expect(campiNomeDaInvitoSeVuoti(
      { nome: 'Mario', cognome: 'Rossi' },
      { nome: 'Luca', cognome: 'Bianchi' }
    )).toEqual({});
  });

  it('completa solo il campo assente', () => {
    expect(campiNomeDaInvitoSeVuoti(
      { nome: 'Mario', cognome: '' },
      { nome: 'Luca', cognome: 'Bianchi' }
    )).toEqual({ cognome: 'Bianchi' });
  });

  it('accetta-invito.js usa campiNomeDaInvitoSeVuoti; il client non scrive nome/cognome su users', () => {
    const server = leggi('functions/accetta-invito.js');
    expect(server).toContain('function campiNomeDaInvitoSeVuoti');
    expect(server).toMatch(/campiNomeDaInvitoSeVuoti\s*\(/);
    const client = leggi('core/services/invito-service-standalone.js');
    expect(client).not.toContain('campiNomeDaInvitoSeVuoti');
    expect(client).not.toMatch(/updateDoc\([\s\S]{0,200}nome\s*:/s);
    expect(client).not.toMatch(/setDoc\([\s\S]{0,200}nome\s*:/s);
  });
});

describe('Impostazioni: salvataggio senza obbligo + displayName', () => {
  it('impostazioni-standalone.html: nome/cognome senza required HTML', () => {
    const html = leggi('core/admin/impostazioni-standalone.html');
    expect(html).toMatch(/id="account-nome"(?![^>]*required)/);
    expect(html).toMatch(/id="account-cognome"(?![^>]*required)/);
    expect(html).not.toMatch(/id="account-nome"\s+required/);
    expect(html).not.toMatch(/id="account-cognome"\s+required/);
    expect(html).toContain('Aggiungi nome e cognome: compariranno nei registri e negli elenchi');
    expect(html).toContain('updateProfile');
    expect(html).toContain('displayNameDaNomeCognome');
  });

  it('displayNameDaNomeCognome: con nome aggiorna; entrambi vuoti → stringa vuota', () => {
    expect(displayNameDaNomeCognome('Mario', 'Rossi')).toBe('Mario Rossi');
    expect(displayNameDaNomeCognome('Mario', '')).toBe('Mario');
    expect(displayNameDaNomeCognome('', '')).toBe('');
    expect(displayNameDaNomeCognome(null, undefined)).toBe('');
  });
});

describe('file protetti non toccati (smoke testo)', () => {
  it('Tony core, firestore.rules e Stripe non sono in questo passo (nessun cambio richiesto dai test)', () => {
    expect(fs.existsSync(path.join(repoRoot, 'core/js/tony/main.js'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'firestore.rules'))).toBe(true);
  });
});
