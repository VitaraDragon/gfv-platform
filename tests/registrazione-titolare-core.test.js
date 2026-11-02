/**
 * Funzione condivisa registrazione titolare (passo 13).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  MS_ATTESA_VERIFICA,
  annullaRegistrazioneParziale,
  codiceErroreRegistrazione,
  creaAccountTitolare,
  datiTenantTitolare,
  datiUtenteTitolare,
  normalizzaEmailRegistrazione,
  tenantIdDaNomeAzienda,
} from '../core/services/registrazione-titolare-core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Espressione copiata dalla pagina PRIMA della modifica (riferimento). */
function tenantIdEspressionePagina(aziendaNome, uid, adessoMs) {
  let tenantIdBase = aziendaNome
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!tenantIdBase || tenantIdBase.length === 0) {
    tenantIdBase = 'azienda_' + adessoMs;
  }
  return `${tenantIdBase}_${uid.substring(0, 8)}`;
}

function creaFbFinto(opzioni = {}) {
  const log = [];
  const docs = new Map();
  const utenti = new Map();
  let uidCounter = 0;

  const fb = {
    auth: {},
    db: {},
    createUserWithEmailAndPassword: async (_auth, email, password) => {
      log.push({ op: 'createUser', email, password });
      if (opzioni.failCreateUser) {
        const err = new Error('in use');
        err.code = opzioni.failCreateUser;
        throw err;
      }
      uidCounter += 1;
      const uid = opzioni.uid || `uid${String(uidCounter).padStart(8, '0')}`;
      const user = { uid, email };
      utenti.set(uid, user);
      return { user };
    },
    deleteUser: async (user) => {
      log.push({ op: 'deleteUser', uid: user && user.uid });
      if (opzioni.failDeleteUser) throw new Error('delete fail');
      if (user) utenti.delete(user.uid);
    },
    doc: (_db, col, id) => {
      const ref = { path: `${col}/${id}`, col, id };
      log.push({ op: 'doc', col, id });
      return ref;
    },
    setDoc: async (ref, data) => {
      log.push({ op: 'setDoc', path: ref.path, data: { ...data } });
      if (ref.col === 'tenants' && opzioni.failTenant) {
        const err = new Error(opzioni.failTenantMessage || 'permission');
        err.code = opzioni.failTenantCode || 'permission-denied';
        throw err;
      }
      docs.set(ref.path, { ...data });
    },
    getDoc: async (ref) => {
      log.push({ op: 'getDoc', path: ref.path });
      if (ref.col === 'users' && opzioni.profiloEsistente && !docs.has(ref.path)) {
        return {
          exists: () => true,
          data: () => ({ id: ref.id }),
        };
      }
      const data = docs.get(ref.path);
      return {
        exists: () => !!data,
        data: () => (data ? { ...data } : undefined),
      };
    },
    deleteDoc: async (ref) => {
      log.push({ op: 'deleteDoc', path: ref.path });
      if (opzioni.failDeleteTenant) {
        const err = new Error('denied');
        err.code = 'permission-denied';
        throw err;
      }
      docs.delete(ref.path);
    },
    serverTimestamp: () => {
      log.push({ op: 'serverTimestamp' });
      return { __server: true };
    },
  };

  return { fb, log, docs, utenti };
}

describe('funzioni pure', () => {
  it('normalizzaEmailRegistrazione', () => {
    expect(normalizzaEmailRegistrazione('  Mario@Esempio.IT ')).toBe('mario@esempio.it');
  });

  it('tenantIdDaNomeAzienda allineato alla pagina', () => {
    const uid = 'abcdef0123456789';
    const nome = 'Az. Agricola Rossi & C.';
    expect(tenantIdDaNomeAzienda(nome, uid, 123)).toBe(
      tenantIdEspressionePagina(nome, uid, 123)
    );
    expect(tenantIdDaNomeAzienda(nome, uid)).toMatch(/^az_agricola_rossi_c_abcdef01$/);
    const vuoto = tenantIdDaNomeAzienda('!!!', uid, 9999);
    expect(vuoto).toBe(tenantIdEspressionePagina('!!!', uid, 9999));
    expect(vuoto).toBe('azienda_9999_abcdef01');
  });

  it('datiTenantTitolare e datiUtenteTitolare', () => {
    const ts = () => 'TS';
    const tenant = datiTenantTitolare({
      aziendaNome: 'Mia Az',
      uid: 'u1',
      serverTimestamp: ts,
      adesso: new Date('2026-01-01T00:00:00Z'),
    });
    expect(tenant.piano).toBe('free');
    expect(tenant.moduli).toEqual([]);
    expect(tenant.stato).toBe('attivo');
    expect(tenant.tonyGuidaOnboardingEndsAt).toBeInstanceOf(Date);

    const utente = datiUtenteTitolare({
      uid: 'u1',
      email: 'A@B.it',
      tenantId: 't1',
      campiNome: { nome: 'Mario', cognome: 'Rossi' },
      serverTimestamp: ts,
    });
    expect(utente.email).toBe('a@b.it');
    expect(utente.nome).toBe('Mario');
    expect(utente.ruoli).toEqual(['amministratore']);
    expect(utente.tenantMemberships.t1).toEqual({
      ruoli: ['amministratore'],
      stato: 'attivo',
      tenantIdPredefinito: true,
    });

    const senza = datiUtenteTitolare({
      uid: 'u1',
      email: 'a@b.it',
      tenantId: 't1',
      campiNome: {},
      serverTimestamp: ts,
    });
    expect(senza).not.toHaveProperty('nome');
    expect(senza).not.toHaveProperty('cognome');
  });

  it('codiceErroreRegistrazione', () => {
    expect(codiceErroreRegistrazione({ code: 'auth/email-already-in-use' })).toBe('email-usata');
    expect(codiceErroreRegistrazione({ code: 'auth/invalid-email' })).toBe('email-non-valida');
    expect(codiceErroreRegistrazione({ code: 'auth/weak-password' })).toBe('password-debole');
    expect(
      codiceErroreRegistrazione({ code: 'auth/password-does-not-meet-requirements' })
    ).toBe('password-debole');
    expect(codiceErroreRegistrazione({ code: 'auth/network-request-failed' })).toBe('rete');
    expect(codiceErroreRegistrazione({ code: 'unavailable' })).toBe('rete');
    expect(codiceErroreRegistrazione({ name: 'TypeError' })).toBe('rete');
    expect(codiceErroreRegistrazione({ code: 'auth/too-many-requests' })).toBe('troppi-tentativi');
    expect(
      codiceErroreRegistrazione({ message: 'Esiste già un profilo per questo account.' })
    ).toBe('profilo-esistente');
    expect(codiceErroreRegistrazione({ code: 'permission-denied' })).toBe('permessi');
    expect(codiceErroreRegistrazione({ message: 'Errore durante creazione tenant: x' })).toBe(
      'azienda'
    );
    expect(codiceErroreRegistrazione({})).toBe('sconosciuto');
  });
});

describe('creaAccountTitolare', () => {
  it('ordine chiamate e dati come la pagina (con nome/cognome)', async () => {
    const { fb, log } = creaFbFinto({ uid: 'abcdefghijklmnop' });
    const attese = [];
    const esito = await creaAccountTitolare({
      email: 'Mario@Esempio.IT',
      password: 'segreta1',
      aziendaNome: 'Azienda Test',
      campiNome: { nome: 'Mario', cognome: 'Rossi' },
      fb,
      attendi: async (ms) => {
        attese.push(ms);
      },
      adesso: new Date('2026-01-01T00:00:00Z'),
    });
    expect(esito.uid).toBe('abcdefghijklmnop');
    expect(esito.tenantId).toBe('azienda_test_abcdefgh');
    expect(attese).toEqual([MS_ATTESA_VERIFICA]);

    const ops = log.map((l) => l.op);
    expect(ops[0]).toBe('createUser');
    expect(ops).toContain('setDoc');
    expect(ops.filter((o) => o === 'getDoc').length).toBeGreaterThanOrEqual(2);

    const setTenant = log.find((l) => l.op === 'setDoc' && l.path.startsWith('tenants/'));
    expect(setTenant.data.piano).toBe('free');
    expect(setTenant.data.moduli).toEqual([]);
    expect(setTenant.data.stato).toBe('attivo');
    expect(setTenant.data.tonyGuidaOnboardingEndsAt).toBeInstanceOf(Date);

    const setUser = log.find((l) => l.op === 'setDoc' && l.path.startsWith('users/'));
    expect(setUser.data.email).toBe('mario@esempio.it');
    expect(setUser.data.nome).toBe('Mario');
    expect(setUser.data.cognome).toBe('Rossi');
    expect(setUser.data.ruoli).toEqual(['amministratore']);
    expect(setUser.data.tenantMemberships).toBeTruthy();
  });

  it('campiNome vuoto → nessuna chiave nome/cognome', async () => {
    const { fb, log } = creaFbFinto({ uid: 'zzzzzzzzzzzzzzzz' });
    await creaAccountTitolare({
      email: 'a@b.it',
      password: 'segreta1',
      aziendaNome: 'Az',
      campiNome: {},
      fb,
      attendi: async () => {},
    });
    const setUser = log.find((l) => l.op === 'setDoc' && l.path.startsWith('users/'));
    expect(setUser.data).not.toHaveProperty('nome');
    expect(setUser.data).not.toHaveProperty('cognome');
  });

  it('email usata: nessuno documento, utente null', async () => {
    const { fb, log } = creaFbFinto({ failCreateUser: 'auth/email-already-in-use' });
    let caught;
    try {
      await creaAccountTitolare({
        email: 'a@b.it',
        password: 'x',
        aziendaNome: 'Az',
        campiNome: {},
        fb,
        attendi: async () => {},
      });
    } catch (e) {
      caught = e;
    }
    expect(caught.statoRegistrazione.utente).toBe(null);
    expect(log.some((l) => l.op === 'setDoc')).toBe(false);
  });

  it('errore tenant: utente presente, tenantCreato false', async () => {
    const { fb } = creaFbFinto({
      uid: 'aaaaaaaaaaaaaaaa',
      failTenant: true,
      failTenantCode: 'permission-denied',
    });
    let caught;
    try {
      await creaAccountTitolare({
        email: 'a@b.it',
        password: 'x',
        aziendaNome: 'Az',
        campiNome: {},
        fb,
        attendi: async () => {},
      });
    } catch (e) {
      caught = e;
    }
    expect(caught.statoRegistrazione.utente).toBeTruthy();
    expect(caught.statoRegistrazione.tenantCreato).toBe(false);
    expect(String(caught.message)).toMatch(/permessi Firestore|creazione tenant/);
  });

  it('profilo esistente', async () => {
    const { fb } = creaFbFinto({ uid: 'bbbbbbbbbbbbbbbb', profiloEsistente: true });
    let caught;
    try {
      await creaAccountTitolare({
        email: 'a@b.it',
        password: 'x',
        aziendaNome: 'Az',
        campiNome: {},
        fb,
        attendi: async () => {},
      });
    } catch (e) {
      caught = e;
    }
    expect(String(caught.message)).toMatch(/^Esiste già un profilo/);
  });

  it('strumenti mancanti', async () => {
    await expect(
      creaAccountTitolare({
        email: 'a@b.it',
        password: 'x',
        aziendaNome: 'Az',
        campiNome: {},
        fb: {},
      })
    ).rejects.toThrow('strumenti Firebase mancanti');
  });
});

describe('annullaRegistrazioneParziale', () => {
  it('tenant non cancellabile + utente sì', async () => {
    const { fb, log } = creaFbFinto({ failDeleteTenant: true });
    const utente = { uid: 'u1' };
    const out = await annullaRegistrazioneParziale({
      fb,
      stato: { utente, tenantId: 't1', tenantCreato: true },
    });
    expect(out).toEqual({ tenantEliminato: false, utenteEliminato: true });
    expect(log.some((l) => l.op === 'deleteUser')).toBe(true);
  });

  it('deleteUser fallisce senza lanciare', async () => {
    const { fb } = creaFbFinto({ failDeleteUser: true, failDeleteTenant: true });
    const out = await annullaRegistrazioneParziale({
      fb,
      stato: { utente: { uid: 'u1' }, tenantId: 't1', tenantCreato: true },
    });
    expect(out.utenteEliminato).toBe(false);
  });

  it('senza utente: nessuna chiamata', async () => {
    const { fb, log } = creaFbFinto();
    const out = await annullaRegistrazioneParziale({ fb, stato: {} });
    expect(out).toEqual({ tenantEliminato: false, utenteEliminato: false });
    expect(log.length).toBe(0);
  });
});

describe('file pulito', () => {
  it('nessun firebase né console', () => {
    const src = readFileSync(
      path.join(root, 'core/services/registrazione-titolare-core.js'),
      'utf8'
    );
    expect(src).not.toMatch(/from\s+['"]firebase/);
    expect(src).not.toMatch(/gstatic/);
    expect(src).not.toMatch(/console\./);
  });
});
