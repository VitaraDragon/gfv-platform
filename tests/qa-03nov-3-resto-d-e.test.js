/**
 * @vitest-environment node
 * QA 03 nov (3) — resto: D1–D5, E1–E5.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  pickTipoLavoroByNome,
  shouldAutoSwitchGeneraleToTraLeFile,
} from '../core/js/attivita-tipo-lavoro-pick.js';
import { getTitoloLavoriContoTerzi } from '../core/admin/js/gestione-lavori-utils.js';
import { getTerrenoColturaLabel, isIdCategoriaSeed } from '../modules/conto-terzi/services/terreno-coltura-label.js';
import {
  isVoceTutti,
  dedupeCategorieColture,
  popolaSelectCategorieColture,
  rimuoviOpzioniTuttiDaSelectForm,
} from '../core/js/terreni-categorie-colture.js';
import { messaggioErroreAuth, messaggioDaErrore, codiceErroreAuth } from '../core/js/auth-errors.js';
import { primoErroreForm, etichettaCampo } from '../core/js/auth-form-validation.js';
import {
  segnaLogoutVolontario,
  logoutVolontarioPendente,
  loginPathDopoUtenteNullo,
  queryLoginSenzaSessionePersa,
} from '../core/js/login-motivo-helpers.js';
import { dateLikeToDate } from '../core/js/date-format-it.js';
import { accountMenuEntries, puoGestireUtenti } from '../core/js/ui-pelle-state.js';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe('D1 — Diario Modifica non perde il tipo', () => {
  const tipi = [
    { nome: 'Trinciatura', categoriaId: 'sub-generale' },
    { nome: 'Trinciatura', categoriaId: 'sub-file' },
    { nome: 'Aratura', categoriaId: 'cat-x' },
  ];
  const nomi = { 'sub-generale': 'Generale', 'sub-file': 'Tra le File' };

  it('unico match per nome → quello', () => {
    expect(pickTipoLavoroByNome(tipi, 'Aratura').categoriaId).toBe('cat-x');
  });
  it('duplicati: preferisce la sottocategoria salvata', () => {
    expect(pickTipoLavoroByNome(tipi, 'Trinciatura', { preferCategoriaIds: ['sub-file'] }).categoriaId).toBe('sub-file');
  });
  it('duplicati: terreno arboreo → «tra le file»', () => {
    const t = pickTipoLavoroByNome(tipi, 'Trinciatura', {
      preferSottocategoriaNome: 'tra le file',
      getNomeCategoria: (id) => nomi[id] || '',
    });
    expect(t.categoriaId).toBe('sub-file');
  });
  it('senza preferenze → primo (comportamento storico)', () => {
    expect(pickTipoLavoroByNome(tipi, 'Trinciatura').categoriaId).toBe('sub-generale');
  });
  it('nome assente → null', () => {
    expect(pickTipoLavoroByNome(tipi, 'Boh')).toBeNull();
  });
  it('auto-switch Generale→Tra le File solo su NUOVA attività e non da precompilazione', () => {
    expect(shouldAutoSwitchGeneraleToTraLeFile({ currentAttivitaId: null })).toBe(true);
    expect(shouldAutoSwitchGeneraleToTraLeFile({ currentAttivitaId: 'abc' })).toBe(false);
    expect(shouldAutoSwitchGeneraleToTraLeFile({ currentAttivitaId: null, detail: { precompilazione: true } })).toBe(false);
  });
  it('la pagina usa il guard e la modifica usa il picker', () => {
    expect(read('core/attivita-standalone.html')).toMatch(/isVigneto && autoSwitchTraLeFile/);
    expect(read('core/js/attivita-events.js')).toMatch(/pickTipoLavoroByNome\(tipiLavoroList, attivita\.tipoLavoro/);
  });
});

describe('D2 — titolo lavori Conto Terzi da ?stato=', () => {
  it('titoli per stato', () => {
    expect(getTitoloLavoriContoTerzi('in_corso')).toContain('Lavori in corso – Conto Terzi');
    expect(getTitoloLavoriContoTerzi('completato')).toContain('Lavori completati – Conto Terzi');
    expect(getTitoloLavoriContoTerzi('da_pianificare')).toContain('Lavori da pianificare – Conto Terzi');
  });
  it('accetta query string e URLSearchParams; default da pianificare', () => {
    expect(getTitoloLavoriContoTerzi('?contoTerzi=true&stato=completato')).toContain('completati');
    expect(getTitoloLavoriContoTerzi(new URLSearchParams('stato=in_corso'))).toContain('in corso');
    expect(getTitoloLavoriContoTerzi(null)).toContain('da pianificare');
  });
});

describe('D3 — coltura leggibile nei terreni clienti', () => {
  const cat = [{ id: 'seed_seminativo', nome: 'Seminativo' }];
  it('mai seed_*: nome categoria dal catalogo', () => {
    expect(getTerrenoColturaLabel({ coltura: 'seed_seminativo', colturaCategoria: 'seed_seminativo' }, cat)).toBe('Seminativo');
  });
  it('senza catalogo: ripulisce lo slug', () => {
    expect(getTerrenoColturaLabel({ coltura: 'seed_seminativo' }, [])).toBe('Seminativo');
    expect(getTerrenoColturaLabel({ colturaCategoria: 'seed_orto_in_serra' }, [])).toBe('Orto In Serra');
  });
  it('preferisce la coltura (sottocategoria) leggibile', () => {
    expect(getTerrenoColturaLabel({ colturaSottocategoria: 'Grano tenero', coltura: 'Grano tenero', colturaCategoria: 'seed_seminativo' }, cat)).toBe('Grano tenero');
  });
  it('«—» se manca', () => {
    expect(getTerrenoColturaLabel({}, cat)).toBe('—');
    expect(getTerrenoColturaLabel(null, cat)).toBe('—');
    expect(getTerrenoColturaLabel({ coltura: '  ' }, cat)).toBe('—');
  });
  it('isIdCategoriaSeed', () => {
    expect(isIdCategoriaSeed('seed_vite')).toBe(true);
    expect(isIdCategoriaSeed('Vite')).toBe(false);
  });
  it('la pagina usa il helper', () => {
    const html = read('modules/conto-terzi/views/terreni-clienti-standalone.html');
    expect(html).toContain('getTerrenoColturaLabel(terreno, categorieColture)');
  });
});

describe('D4 — «Tutti» solo nei filtri, mai nel form terreno', () => {
  it('isVoceTutti', () => {
    expect(isVoceTutti('Tutti')).toBe(true);
    expect(isVoceTutti(' tutte ')).toBe(true);
    expect(isVoceTutti({ nome: 'Tutti' })).toBe(true);
    expect(isVoceTutti('Vite')).toBe(false);
    expect(isVoceTutti(null)).toBe(false);
  });
  it('le categorie «Tutti» sono scartate dal select del form', () => {
    const cats = [{ id: 'a', nome: 'Vite' }, { id: 't', nome: 'Tutti' }];
    expect(dedupeCategorieColture(cats, {}).map((c) => c.id)).toEqual(['a']);
    const el = { innerHTML: '', value: '', options: [], appendChild(o) { this.options.push(o); } };
    popolaSelectCategorieColture(el, cats, {}, { createElement: () => ({}) });
    expect(el.options.map((o) => o.textContent)).toEqual(['-- Seleziona categoria --', 'Vite']);
  });
  it('rimuoviOpzioniTuttiDaSelectForm toglie solo «Tutti»', () => {
    const mk = (text) => ({ text, remove() { sel.options = sel.options.filter((o) => o !== this); } });
    const sel = { options: [mk('-- Seleziona --'), mk('Tutti'), mk('Vite')] };
    expect(rimuoviOpzioniTuttiDaSelectForm(sel)).toBe(1);
    expect(sel.options.map((o) => o.text)).toEqual(['-- Seleziona --', 'Vite']);
  });
  it('i filtri (filter-coltura / filter-categoria) restano con «Tutti»', () => {
    const html = read('core/terreni-standalone.html');
    expect(html).toMatch(/id="filter-categoria"[\s\S]*?<option value="">Tutti<\/option>/);
    expect(html).toMatch(/id="filter-coltura"[\s\S]*?<option value="">Tutti<\/option>/);
    const form = html.slice(html.indexOf('id="terreno-coltura-categoria"'), html.indexOf('id="terreno-podere"'));
    expect(form).not.toMatch(/Tutti/);
  });
});

describe('D5 — VM preventivo: moduli effettivi (prova inclusa)', () => {
  const { syncPreventivoAccettatoToPianoAdmin } = require('../functions/vm-preventivo-piano-sync.js');

  function fakeDb(tenant) {
    const updates = [];
    const terreno = { exists: true, data: () => ({}) };
    return {
      updates,
      doc(path) {
        if (path.startsWith('tenants/') && path.split('/').length === 2) {
          return { get: async () => ({ exists: true, data: () => tenant }) };
        }
        return { path };
      },
      collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }),
      runTransaction: async (fn) => {
        await fn({ get: async () => terreno, update: (ref, data) => updates.push({ ref, data }) });
      },
    };
  }
  const preventivo = { id: 'p1', tipoLavoro: 'Vendemmia meccanica', terrenoId: 't1', dataPrevista: '2026-09-10' };

  it('prova attiva di vendemmiaMeccanica → sincronizza', async () => {
    const fra7gg = new Date(Date.now() + 7 * 86400000);
    const db = fakeDb({ modules: [], moduleTrials: { vendemmiaMeccanica: { status: 'active', endsAt: fra7gg } } });
    const res = await syncPreventivoAccettatoToPianoAdmin(db, 'tenant1', preventivo);
    expect(res.synced).toBe(true);
    expect(db.updates).toHaveLength(1);
  });
  it('prova scaduta e non pagato → non sincronizza', async () => {
    const ieri = new Date(Date.now() - 86400000);
    const db = fakeDb({ modules: [], moduleTrials: { vendemmiaMeccanica: { status: 'active', endsAt: ieri } } });
    expect((await syncPreventivoAccettatoToPianoAdmin(db, 'tenant1', preventivo)).synced).toBe(false);
  });
  it('modulo pagato → sincronizza', async () => {
    const db = fakeDb({ modules: ['vendemmiaMeccanica'] });
    expect((await syncPreventivoAccettatoToPianoAdmin(db, 'tenant1', preventivo)).synced).toBe(true);
  });
});

describe('E1 — messaggi errore auth in italiano', () => {
  it('codici principali', () => {
    expect(messaggioErroreAuth('auth/invalid-credential')).toMatch(/Email o password errati/);
    expect(messaggioErroreAuth('auth/too-many-requests')).toMatch(/Troppi tentativi/);
    expect(messaggioErroreAuth('auth/network-request-failed')).toMatch(/Connessione/);
    expect(messaggioErroreAuth({ code: 'auth/wrong-password' })).toMatch(/Email o password errati/);
  });
  it('mai «Firebase: Error» nel fallback', () => {
    const err = new Error('Firebase: Error (auth/qualcosa-di-nuovo).');
    expect(messaggioDaErrore(err)).not.toMatch(/Firebase/i);
    expect(messaggioErroreAuth('auth/boh', 'Firebase: Error (auth/boh).')).not.toMatch(/Firebase/i);
    expect(messaggioErroreAuth('')).not.toMatch(/Firebase/i);
  });
  it('estrae il codice dal testo Firebase', () => {
    expect(codiceErroreAuth(new Error('Firebase: Error (auth/invalid-credential).'))).toBe('invalid-credential');
    expect(messaggioDaErrore(new Error('Firebase: Error (auth/invalid-credential).'))).toMatch(/Email o password errati/);
  });
  it('errori applicativi con testo proprio passano', () => {
    expect(messaggioDaErrore(new Error('Account non attivo. Contatta l\'amministratore.'))).toMatch(/Account non attivo/);
  });
  it('le 4 pagine importano il modulo condiviso', () => {
    for (const f of [
      'core/auth/login-standalone.html',
      'core/auth/registrazione-standalone.html',
      'core/auth/registrazione-invito-standalone.html',
      'core/auth/reset-password-standalone.html',
    ]) {
      expect(read(f), f).toContain('auth-errors.js');
    }
  });
});

describe('E2 — novalidate + messaggi italiani', () => {
  it('form auth e macchina con novalidate', () => {
    expect(read('core/auth/login-standalone.html')).toMatch(/<form id="login-form"[^>]*\bnovalidate\b/);
    expect(read('core/auth/registrazione-standalone.html')).toMatch(/<form id="register-form"[^>]*\bnovalidate\b/);
    expect(read('core/auth/registrazione-invito-standalone.html')).toMatch(/<form id="register-form"[^>]*\bnovalidate\b/);
    expect(read('core/auth/reset-password-standalone.html')).toMatch(/<form id="reset-form"[^>]*\bnovalidate\b/);
    expect(read('core/admin/gestione-macchine-standalone.html')).toMatch(/<form id="macchina-form"[^>]*\bnovalidate\b/);
  });
  it('registrazione valida Nome Azienda con messaggio italiano', () => {
    expect(read('core/auth/registrazione-standalone.html')).toContain("'Nome azienda obbligatorio'");
  });
  it('primoErroreForm: campo obbligatorio vuoto con etichetta', () => {
    const campo = (over) => ({
      disabled: false, type: 'text', required: true, value: '', id: 'azienda-nome', tagName: 'INPUT',
      offsetParent: {}, getAttribute: () => null, ...over,
    });
    const form = {
      elements: [campo({ id: 'email', type: 'email', value: 'a@b.it' }), campo({})],
      querySelector: (sel) => (sel.includes('azienda-nome') ? { textContent: 'Nome Azienda *' } : null),
    };
    const err = primoErroreForm(form);
    expect(err.messaggio).toBe('Compila il campo «Nome Azienda».');
    expect(etichettaCampo(campo({}), form)).toBe('Nome Azienda');
  });
  it('email non valida', () => {
    const el = { disabled: false, type: 'email', required: true, value: 'xx', id: 'e', offsetParent: {}, getAttribute: () => null };
    expect(primoErroreForm({ elements: [el], querySelector: () => null }).messaggio).toBe('Email non valida.');
  });
});

describe('E3 — logout volontario vs sessione persa', () => {
  it('senza flag → sessione-persa; con flag → login pulito e flag consumato', () => {
    const s = fakeStorage();
    expect(loginPathDopoUtenteNullo('./auth/login-standalone.html', s)).toBe('./auth/login-standalone.html?motivo=sessione-persa');
    segnaLogoutVolontario(s);
    expect(loginPathDopoUtenteNullo('./auth/login-standalone.html', s)).toBe('./auth/login-standalone.html');
    expect(logoutVolontarioPendente(s)).toBe(false);
  });
  it('logoutVolontarioPendente può non consumare', () => {
    const s = fakeStorage();
    segnaLogoutVolontario(s);
    expect(logoutVolontarioPendente(s, { consuma: false })).toBe(true);
    expect(logoutVolontarioPendente(s)).toBe(true);
    expect(logoutVolontarioPendente(s)).toBe(false);
  });
  it('queryLoginSenzaSessionePersa toglie solo quel motivo', () => {
    expect(queryLoginSenzaSessionePersa('?motivo=sessione-persa')).toBe('');
    expect(queryLoginSenzaSessionePersa('?motivo=sessione-persa&registered=true')).toBe('?registered=true');
    expect(queryLoginSenzaSessionePersa('?motivo=utente-cambiato')).toBe('?motivo=utente-cambiato');
  });
  it('i punti di logout impostano il flag prima di signOut', () => {
    const dash = read('core/dashboard-standalone.html');
    expect(dash.indexOf('segnaLogoutVolontario();')).toBeGreaterThan(-1);
    expect(dash.indexOf('segnaLogoutVolontario();')).toBeLessThan(dash.indexOf('await signOut(auth);\n                window.location.href = await loginPageUrl(\'./auth/login-standalone.html\');'));
    expect(dash).toContain("loginPathDopoUtenteNullo('./auth/login-standalone.html')");
    expect(read('core/js/dashboard-events.js')).toContain('segnaLogoutVolontario');
    expect(read('core/js/ui-pelle.js')).toContain('segnaLogoutVolontario');
    expect(read('core/mobile/js/field-workspace-controller.js')).toContain('segnaLogoutVolontario');
  });
});

describe('E4 — Ultimo accesso', () => {
  const { serializeTimestamp, serializeUserForTenant } = require('../functions/gestisci-membership.js');
  it('server: Timestamp → ISO', () => {
    const ts = { toDate: () => new Date('2026-11-03T10:00:00.000Z') };
    expect(serializeTimestamp(ts)).toBe('2026-11-03T10:00:00.000Z');
    expect(serializeTimestamp({ _seconds: 1793700000 })).toBe(new Date(1793700000 * 1000).toISOString());
    expect(serializeTimestamp(null)).toBeNull();
    expect(serializeTimestamp('non-una-data')).toBeNull();
  });
  it('serializeUserForTenant restituisce ultimoAccesso/lastSeen serializzabili', () => {
    const ts = { toDate: () => new Date('2026-11-03T10:00:00.000Z') };
    const u = serializeUserForTenant('u1', { tenantId: 't', ruoli: ['operaio'], ultimoAccesso: ts, lastSeen: ts }, 't');
    expect(typeof u.ultimoAccesso).toBe('string');
    expect(typeof u.lastSeen).toBe('string');
    expect(() => JSON.stringify(u)).not.toThrow();
  });
  it('client: accetta {_seconds}, {seconds}, ISO, Timestamp, Date', () => {
    expect(dateLikeToDate({ _seconds: 100 }).getTime()).toBe(100000);
    expect(dateLikeToDate({ seconds: 100 }).getTime()).toBe(100000);
    expect(dateLikeToDate('2026-11-03T10:00:00.000Z').toISOString()).toBe('2026-11-03T10:00:00.000Z');
    expect(dateLikeToDate({ toDate: () => new Date(5) }).getTime()).toBe(5);
    expect(dateLikeToDate(null)).toBeNull();
    expect(dateLikeToDate('xx')).toBeNull();
  });
  it('scritture: dashboard prima dell\'ingresso, workspace dopo guardia, invito', () => {
    const dash = read('core/dashboard-standalone.html');
    const iw = dash.indexOf('ultimoAccesso: serverTimestamp()');
    expect(iw).toBeGreaterThan(-1);
    expect(iw).toBeLessThan(dash.indexOf('const ingresso = applicaIngressoDopoLogin'));
    const ws = read('core/mobile/js/field-workspace-controller.js');
    expect(ws.indexOf('ultimoAccesso: serverTimestamp()')).toBeGreaterThan(ws.indexOf('if (!guardia.entra)'));
    expect(read('core/auth/registrazione-invito-standalone.html')).toContain('ultimoAccesso: serverTimestamp()');
  });
});

describe('E5 — Gestisci utenti nel menu ingranaggio', () => {
  it('manager/amministratore lo vedono, senza requireManodopera', () => {
    expect(puoGestireUtenti(['manager'])).toBe(true);
    expect(puoGestireUtenti(['amministratore'])).toBe(true);
    expect(puoGestireUtenti(['operaio', 'caposquadra'])).toBe(false);
    expect(puoGestireUtenti(undefined)).toBe(false);
    const ids = accountMenuEntries([], ['manager']).map((e) => e.id);
    expect(ids).toEqual(['impostazioni', 'gestisciUtenti', 'guide', 'logout']);
    expect(accountMenuEntries([], ['manager']).find((e) => e.id === 'gestisciUtenti').href).toBe('admin/gestisci-utenti-standalone.html');
  });
  it('gli altri ruoli e chi non ha ruoli non lo vedono', () => {
    expect(accountMenuEntries([], ['operaio']).map((e) => e.id)).not.toContain('gestisciUtenti');
    expect(accountMenuEntries([]).map((e) => e.id)).not.toContain('gestisciUtenti');
  });
  it('ui-pelle passa i ruoli alla costruzione del menu', () => {
    expect(read('core/js/ui-pelle.js')).toContain('accountMenuEntries(entries, indizioPelleCampo().ruoli)');
  });
});
