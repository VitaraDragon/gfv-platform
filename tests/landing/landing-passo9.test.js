/**
 * Landing passo 9 — App Check (Vitest puro: legge file e funzioni pure, senza caricare Firebase).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANDING_ATTIVA, TONY_BUSSA_ATTIVO } from '../../landing/src/config/landing-config.js';
import {
  CHIAVE_SITO_APP_CHECK,
  CONFIG_FIREBASE_WEB,
} from '../../landing/src/config/firebase-landing-config.js';
import {
  codiceErrore,
  protezioneConfigurata,
  usaTokenDebug,
} from '../../landing/src/lib/firebase-landing-logica.js';
import { FILE_FIREBASE_ACCOUNT_LANDING, FILE_FIREBASE_LANDING } from './aiuto-stringhe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function leggi(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function fileSorgenteLanding() {
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
      if (nome === 'node_modules' || nome === 'dist' || nome === 'dist-anteprima') continue;
      cammina(path.join(p, nome));
    }
  }
  for (const r of radici) cammina(r);
  return out;
}

function relPosix(pieno) {
  return path.relative(repoRoot, pieno).replaceAll('\\', '/');
}

const MARKER_FIREBASE = [
  /from\s+['"]firebase(?:\/[^'"]*)?['"]/,
  /from\s+["']firebase(?:\/[^"']*)?["']/,
  /import\s*\(\s*['"]firebase(?:\/[^'"]*)?['"]\s*\)/,
  /initializeApp\b/,
  /initializeAppCheck\b/,
  /ReCaptchaEnterpriseProvider\b/,
  /FIREBASE_APPCHECK_DEBUG_TOKEN/,
  /recaptcha/i,
];

describe('solo un file con Firebase', () => {
  it('solo FILE_FIREBASE_LANDING contiene Firebase / App Check / reCAPTCHA', () => {
    for (const pieno of fileSorgenteLanding()) {
      const rel = relPosix(pieno);
      const testo = fs.readFileSync(pieno, 'utf8');
      if (rel === FILE_FIREBASE_LANDING) {
        expect(testo).toMatch(/from\s+['"]firebase\/app['"]/);
        expect(testo).toMatch(/from\s+['"]firebase\/app-check['"]/);
        expect(testo).toMatch(/initializeAppCheck/);
        expect(testo).toMatch(/ReCaptchaEnterpriseProvider/);
        continue;
      }
      if (rel === FILE_FIREBASE_ACCOUNT_LANDING) {
        expect(testo).not.toMatch(/initializeApp\b/);
        expect(testo).not.toMatch(/recaptcha/i);
        expect(testo).not.toMatch(/firebase-landing-config/);
        expect(testo).toMatch(/from\s+['"]firebase\//);
        continue;
      }
      for (const re of MARKER_FIREBASE) {
        expect(testo, `${rel} non deve matchare ${re}`).not.toMatch(re);
      }
    }
  });

  it('landing/index.html non contiene firebase né recaptcha', () => {
    const html = leggi('landing/index.html').toLowerCase();
    expect(html).not.toContain('firebase');
    expect(html).not.toContain('recaptcha');
  });
});

describe('solo il pezzo caricato dopo', () => {
  it('firebase-landing.js è nominato solo in TonyStage con import()', () => {
    const stage = leggi('landing/src/components/TonyStage.vue');
    expect(stage).toMatch(/import\(\s*['"]\.\.\/lib\/firebase-landing\.js['"]\s*\)/);
    expect(stage).not.toMatch(/import\s+.+from\s+['"][^'"]*firebase-landing/);

    for (const pieno of fileSorgenteLanding()) {
      const rel = relPosix(pieno);
      if (rel === 'landing/src/components/TonyStage.vue') continue;
      if (rel === FILE_FIREBASE_LANDING) continue;
      if (rel === FILE_FIREBASE_ACCOUNT_LANDING) continue;
      const testo = fs.readFileSync(pieno, 'utf8');
      expect(testo, rel).not.toMatch(/firebase-landing\.js/);
      expect(testo, rel).not.toMatch(/import\s+.+from\s+['"][^'"]*firebase-landing/);
    }

    for (const rel of [
      'landing/src/views/LandingHome.vue',
      'landing/src/App.vue',
      'landing/src/main.ts',
      'landing/src/router/index.ts',
    ]) {
      const testo = leggi(rel);
      expect(testo, rel).not.toMatch(/firebase-landing/);
    }
  });

  it('firebase-landing-config.js è importato solo da firebase-landing.js', () => {
    for (const pieno of fileSorgenteLanding()) {
      const rel = relPosix(pieno);
      const testo = fs.readFileSync(pieno, 'utf8');
      if (rel === FILE_FIREBASE_LANDING) {
        expect(testo).toMatch(/firebase-landing-config\.js/);
        continue;
      }
      expect(testo, rel).not.toMatch(/firebase-landing-config/);
    }
  });

  it('LandingHome carica ancora TonyStage in modo pigro e con v-if', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toMatch(/import\(\s*['"]\.\.\/components\/TonyStage\.vue['"]\s*\)/);
    expect(home).toMatch(/v-if\s*=\s*["']tonyOn\s*&&\s*stageAperto["']/);
  });
});

describe('solo i moduli leggeri', () => {
  it('firebase-landing importa solo app e app-check, Enterprise, auto-refresh', () => {
    const testo = leggi(FILE_FIREBASE_LANDING);
    expect(testo).toMatch(/from\s+['"]firebase\/app['"]/);
    expect(testo).toMatch(/from\s+['"]firebase\/app-check['"]/);
    expect(testo).not.toMatch(/firebase\/auth/);
    expect(testo).not.toMatch(/firebase\/firestore/);
    expect(testo).not.toMatch(/firebase\/functions/);
    expect(testo).not.toMatch(/firebase\/analytics/);
    expect(testo).not.toMatch(/from\s+['"]firebase['"]/);
    expect(testo).toMatch(/ReCaptchaEnterpriseProvider/);
    expect(testo).not.toMatch(/ReCaptchaV3Provider/);
    expect(testo).toMatch(/isTokenAutoRefreshEnabled:\s*true/);
  });
});

describe('token di debug sicuro', () => {
  it('assegnazione solo = true, usaTokenDebug, niente VITE_/host/log del token', () => {
    const testo = leggi(FILE_FIREBASE_LANDING);
    expect(testo).toMatch(/FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*true/);
    expect(testo).not.toMatch(/FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*['"`]/);
    expect(testo).toMatch(/usaTokenDebug\s*\(/);
    expect(testo).not.toMatch(/VITE_/);
    expect(testo).not.toContain('localhost');
    expect(testo).not.toContain('127.0.0.1');
    expect(testo).not.toMatch(/console\.\w+\([^)]*\btoken\b/i);
  });
});

describe('usaTokenDebug', () => {
  it('true solo in sviluppo/anteprima su localhost o 127.0.0.1', () => {
    expect(usaTokenDebug({ dev: true, modo: 'development', hostname: 'localhost' })).toBe(true);
    expect(usaTokenDebug({ dev: true, modo: 'development', hostname: '127.0.0.1' })).toBe(true);
    expect(usaTokenDebug({ dev: false, modo: 'anteprima', hostname: 'localhost' })).toBe(true);
    expect(usaTokenDebug({ dev: false, modo: 'production', hostname: 'localhost' })).toBe(false);
    expect(usaTokenDebug({ dev: true, modo: 'development', hostname: '192.168.1.10' })).toBe(false);
    expect(usaTokenDebug({ dev: true, modo: 'development', hostname: 'gfvagri.com' })).toBe(false);
    expect(usaTokenDebug({ dev: false, modo: 'production', hostname: 'gfvagri.com' })).toBe(false);
    expect(
      usaTokenDebug({ dev: false, modo: 'production', hostname: 'globalfarmview.net' })
    ).toBe(false);
    expect(
      usaTokenDebug({ dev: false, modo: 'production', hostname: 'gfv-platform.web.app' })
    ).toBe(false);
    expect(usaTokenDebug({ dev: true, modo: 'development', hostname: '' })).toBe(false);
    expect(usaTokenDebug({ dev: true, modo: 'development' })).toBe(false);
  });
});

describe('protezioneConfigurata e codiceErrore', () => {
  it('accetta solo chiavi valide', () => {
    expect(protezioneConfigurata('')).toBe(false);
    expect(protezioneConfigurata('   ')).toBe(false);
    expect(protezioneConfigurata(null)).toBe(false);
    expect(protezioneConfigurata('chiave con spazi in mezzoxxxxx')).toBe(false);
    expect(protezioneConfigurata('AbcdefghijAbcdefghijAbcdefghijAbcdefghij')).toBe(true);
  });

  it('codiceErrore espone solo il codice breve', () => {
    expect(codiceErrore({ code: 'appCheck/fetch-network-error' })).toBe(
      'appCheck/fetch-network-error'
    );
    expect(codiceErrore({ code: 'due parole' })).toBe('sconosciuto');
    expect(codiceErrore({})).toBe('sconosciuto');
    expect(codiceErrore(null)).toBe('sconosciuto');
  });
});

describe('configurazione uguale all\'app', () => {
  it('CONFIG_FIREBASE_WEB coincide con core/config/firebase-config.js (6 chiavi)', () => {
    const testo = leggi('core/config/firebase-config.js');
    const campi = [
      'apiKey',
      'authDomain',
      'projectId',
      'storageBucket',
      'messagingSenderId',
      'appId',
    ];
    const estratti = {};
    for (const campo of campi) {
      const m = testo.match(new RegExp(`${campo}:\\s*["']([^"']+)["']`));
      expect(m, campo).toBeTruthy();
      estratti[campo] = m[1];
    }
    expect(Object.keys(CONFIG_FIREBASE_WEB).sort()).toEqual([...campi].sort());
    for (const campo of campi) {
      expect(CONFIG_FIREBASE_WEB[campo], campo).toBe(estratti[campo]);
    }
    expect(CONFIG_FIREBASE_WEB).not.toHaveProperty('vapidKey');
    expect(CONFIG_FIREBASE_WEB.projectId).toBe('gfv-platform');
  });
});

describe('chiave sito', () => {
  it('CHIAVE_SITO_APP_CHECK è stringa; se non vuota, protezioneConfigurata la accetta', () => {
    expect(typeof CHIAVE_SITO_APP_CHECK).toBe('string');
    if (CHIAVE_SITO_APP_CHECK.trim() !== '') {
      expect(protezioneConfigurata(CHIAVE_SITO_APP_CHECK)).toBe(true);
    }
  });
});

describe('dipendenze della landing', () => {
  it('dependencies esatte e firebase non in devDependencies', () => {
    const pkg = JSON.parse(leggi('landing/package.json'));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      ['@fontsource/plus-jakarta-sans', 'firebase', 'vue', 'vue-router'].sort()
    );
    expect(pkg.devDependencies?.firebase).toBeUndefined();
  });
});

describe('flag', () => {
  it('TONY_BUSSA_ATTIVO e LANDING_ATTIVA restano false', () => {
    expect(TONY_BUSSA_ATTIVO).toBe(false);
    expect(LANDING_ATTIVA).toBe(false);
  });
});
