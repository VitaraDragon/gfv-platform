/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildInviteHtml, handleSendTransactionalEmail } = require('../functions/email-resend.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('buildInviteHtml utente esistente', () => {
  it('con isExistingUser:true non parla di registrazione né password', () => {
    const html = buildInviteHtml({
      nome: 'Mario',
      cognome: 'Rossi',
      ruoli: 'Operaio',
      scadeIl: '01/01/2027',
      linkRegistrazione: 'https://example.com/invito',
      nome_azienda: 'Cascina Test',
      isExistingUser: true,
    });
    expect(html).not.toMatch(/Completa registrazione/i);
    expect(html).not.toMatch(/impostare la propria password/i);
    expect(html).toMatch(/Entra e unisciti a Cascina Test/);
    expect(html).toMatch(/Hai già un account/);
  });

  it('utente nuovo resta invariato (Completa registrazione)', () => {
    const html = buildInviteHtml({
      nome: 'Nuovo',
      cognome: 'User',
      ruoli: 'Operaio',
      scadeIl: '01/01/2027',
      linkRegistrazione: 'https://example.com/invito',
      isExistingUser: false,
    });
    expect(html).toMatch(/Completa registrazione/);
  });
});

describe('sendTransactionalEmail invite — niente oracolo', () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return { id: 'email-1' };
      },
    }));
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  function fakeDb(seed) {
    const docs = new Map(Object.entries(seed || {}));
    return {
      collection(name) {
        return {
          doc(id) {
            const path = `${name}/${id}`;
            return {
              async get() {
                if (!docs.has(path)) return { exists: false, data: () => undefined };
                return {
                  exists: true,
                  data: () => docs.get(path),
                  ref: {
                    async update(data) {
                      docs.set(path, Object.assign({}, docs.get(path), data));
                    },
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  const authAdminExisting = {
    async getUserByEmail() {
      return { uid: 'u1' };
    },
  };
  const authAdminMissing = {
    async getUserByEmail() {
      const err = new Error('not found');
      err.code = 'auth/user-not-found';
      throw err;
    },
  };

  it('senza invitoId non restituisce isExistingUser (anche se Auth avrebbe trovato)', async () => {
    const db = fakeDb({
      'users/mgr': {
        tenantMemberships: { T1: { ruoli: ['manager'], stato: 'attivo' } },
      },
    });
    const res = await handleSendTransactionalEmail(
      db,
      're_test_key',
      {
        auth: { uid: 'mgr' },
        data: {
          type: 'invite',
          tenantId: 'T1',
          to: 'exist@x.it',
          nome: 'E',
          cognome: 'X',
          linkRegistrazione: 'https://example.com/i',
        },
      },
      authAdminExisting
    );
    expect(res.isExistingUser).toBeUndefined();
  });

  it('con invitoId valido: risolve Auth, salva su invito, restituisce flag', async () => {
    const db = fakeDb({
      'users/mgr': {
        tenantMemberships: { T1: { ruoli: ['manager'], stato: 'attivo' } },
      },
      'inviti/inv1': {
        tenantId: 'T1',
        stato: 'invitato',
        email: 'exist@x.it',
      },
    });
    const res = await handleSendTransactionalEmail(
      db,
      're_test_key',
      {
        auth: { uid: 'mgr' },
        data: {
          type: 'invite',
          tenantId: 'T1',
          invitoId: 'inv1',
          to: 'exist@x.it',
          nome: 'E',
          cognome: 'X',
          nome_azienda: 'Azienda',
          linkRegistrazione: 'https://example.com/i',
        },
      },
      authAdminExisting
    );
    expect(res.isExistingUser).toBe(true);
    expect(db.collection('inviti').doc('inv1')); // path exists
    const snap = await db.collection('inviti').doc('inv1').get();
    expect(snap.data().isExistingUser).toBe(true);
  });

  it('con invitoId valido e utente nuovo: isExistingUser false', async () => {
    const db = fakeDb({
      'users/mgr': {
        tenantMemberships: { T1: { ruoli: ['manager'], stato: 'attivo' } },
      },
      'inviti/inv2': {
        tenantId: 'T1',
        stato: 'invitato',
        email: 'new@x.it',
      },
    });
    const res = await handleSendTransactionalEmail(
      db,
      're_test_key',
      {
        auth: { uid: 'mgr' },
        data: {
          type: 'invite',
          tenantId: 'T1',
          invitoId: 'inv2',
          to: 'new@x.it',
          linkRegistrazione: 'https://example.com/i',
        },
      },
      authAdminMissing
    );
    expect(res.isExistingUser).toBe(false);
  });
});

describe('Gestisci Utenti statico', () => {
  const html = readFileSync(
    path.join(root, 'core/admin/gestisci-utenti-standalone.html'),
    'utf8'
  );

  it('non usa più updateDoc/setDoc/deleteDoc su users per Disattiva/Rimuovi/Ruoli', () => {
    expect(html).toMatch(/gestisciMembershipUtente/);
    expect(html).toMatch(/elencaUtentiTenant/);
    expect(html).not.toMatch(/updateDoc\(doc\(db,\s*['"]users['"]/);
    expect(html).not.toMatch(/setDoc\(doc\(db,\s*['"]users['"]/);
    expect(html).not.toMatch(/deleteDoc\(doc\(db,\s*['"]users['"]/);
  });

  it('fallback elenco client se callable fallisce + avviso elenco parziale', () => {
    expect(html).toMatch(/loadUsersFromClientQuery/);
    expect(html).toMatch(/Elenco parziale/);
    expect(html).toMatch(/where\('tenantId',\s*'==',\s*tenantId\)/);
  });

  it('non fa più updateDoc isExistingUser sull\'invito dal client', () => {
    expect(html).not.toMatch(/updateDoc\(invitoRef,\s*\{\s*isExistingUser/);
  });

  it('showInviteLinkModal riceve isExistingUser e testo alternativo', () => {
    expect(html).toMatch(/function showInviteLinkModal\(link, email, nome, cognome, ruoli, isExistingUser\)/);
    expect(html).toMatch(/Link per aggiungere l\\'azienda/);
    expect(html).toMatch(/Ha già un account/);
  });
});
