/**
 * Inviti: lookup pubblico via CF (token) e sanitizzazione campi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isInvitoTokenValid,
  sanitizeInvitoForPublic,
  isInvitoScaduto,
  pickInvitoFromDocs,
  handleGetInvitoPubblico,
  InvitoPubblicoError,
} = require('../../functions/invito-pubblico.js');

import { mapInvitoPubblicoError, fetchInvitoByToken } from '../../core/services/invito-service-standalone.js';

vi.mock('../../core/services/firebase-service.js', () => ({
  getHttpsCallable: vi.fn(),
}));

import { getHttpsCallable } from '../../core/services/firebase-service.js';

const LONG_TOKEN = 'inv-canary-token-abcdefghij';

function fakeDoc(id, data) {
  return { id, data: () => data };
}

function fakeDb(docs) {
  return {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            empty: !docs.length,
            docs,
          }),
        }),
      }),
    }),
  };
}

describe('invito-pubblico — token e sanitize', () => {
  it('rifiuta token corti o non stringa', () => {
    expect(isInvitoTokenValid('short')).toBe(false);
    expect(isInvitoTokenValid(null)).toBe(false);
    expect(isInvitoTokenValid(LONG_TOKEN)).toBe(true);
  });

  it('sanitize espone solo allowlist, niente campi extra', () => {
    const out = sanitizeInvitoForPublic('abc', {
      email: 'a@b.c',
      nome: 'Ada',
      cognome: 'Lovelace',
      ruoli: ['operaio'],
      stato: 'invitato',
      scadeIl: new Date('2026-12-01T00:00:00.000Z'),
      isExistingUser: false,
      tenantId: 't1',
      token: LONG_TOKEN,
      inviatoDa: 'uid-manager',
      cellulare: '333',
      secretInterno: 'NON_LEAK',
      noteAdmin: 'NON_LEAK',
    });
    expect(out.id).toBe('abc');
    expect(out.email).toBe('a@b.c');
    expect(out.secretInterno).toBeUndefined();
    expect(out.noteAdmin).toBeUndefined();
    expect(Object.keys(out).sort()).toEqual([
      'cellulare',
      'cognome',
      'email',
      'id',
      'inviatoDa',
      'isExistingUser',
      'nome',
      'ruoli',
      'scadeIl',
      'stato',
      'tenantId',
      'token',
    ]);
  });

  it('pick preferisce stato invitato se il token è duplicato', () => {
    const picked = pickInvitoFromDocs([
      fakeDoc('old', { stato: 'accettato', token: LONG_TOKEN }),
      fakeDoc('live', { stato: 'invitato', token: LONG_TOKEN }),
    ]);
    expect(picked.id).toBe('live');
  });

  it('isInvitoScaduto su Date e ISO', () => {
    expect(isInvitoScaduto(new Date('2020-01-01'), new Date('2026-01-01'))).toBe(true);
    expect(isInvitoScaduto('2027-01-01T00:00:00.000Z', new Date('2026-01-01'))).toBe(false);
    expect(isInvitoScaduto(null, new Date())).toBe(false);
  });
});

describe('handleGetInvitoPubblico', () => {
  it('invalid-argument se token corto', async () => {
    await expect(handleGetInvitoPubblico(fakeDb([]), 'x')).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('not-found se assente o già usato', async () => {
    await expect(handleGetInvitoPubblico(fakeDb([]), LONG_TOKEN)).rejects.toBeInstanceOf(InvitoPubblicoError);
    await expect(
      handleGetInvitoPubblico(fakeDb([fakeDoc('u', { stato: 'accettato', token: LONG_TOKEN })]), LONG_TOKEN)
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('failed-precondition se scaduto', async () => {
    const past = new Date('2020-01-01T00:00:00.000Z');
    await expect(
      handleGetInvitoPubblico(
        fakeDb([fakeDoc('e', { stato: 'invitato', token: LONG_TOKEN, email: 'a@b.c', scadeIl: past })]),
        LONG_TOKEN,
        new Date('2026-01-01')
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('restituisce invito sanitizzato se valido', async () => {
    const future = new Date('2027-01-01T00:00:00.000Z');
    const res = await handleGetInvitoPubblico(
      fakeDb([
        fakeDoc('ok1', {
          stato: 'invitato',
          token: LONG_TOKEN,
          email: 'ada@gfv.test',
          nome: 'Ada',
          cognome: 'L',
          ruoli: ['operaio'],
          tenantId: 't1',
          inviatoDa: 'm1',
          scadeIl: future,
          leak: 'no',
        }),
      ]),
      LONG_TOKEN,
      new Date('2026-09-18')
    );
    expect(res.ok).toBe(true);
    expect(res.invito.id).toBe('ok1');
    expect(res.invito.email).toBe('ada@gfv.test');
    expect(res.invito.leak).toBeUndefined();
  });
});

describe('mapInvitoPubblicoError / fetchInvitoByToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mappa codes callable in messaggi utente', () => {
    expect(mapInvitoPubblicoError({ code: 'functions/not-found', message: 'x' }).message)
      .toMatch(/già utilizzato/);
    expect(mapInvitoPubblicoError({ code: 'functions/failed-precondition', message: 'Token scaduto' }).message)
      .toMatch(/scaduto/);
    expect(mapInvitoPubblicoError({ code: 'functions/invalid-argument', message: 'Token non valido.' }).message)
      .toMatch(/non valido/);
  });

  it('fetchInvitoByToken legge data.invito dalla callable', async () => {
    getHttpsCallable.mockReturnValue(async () => ({
      data: { ok: true, invito: { id: 'i1', email: 'a@b.c', token: LONG_TOKEN } },
    }));
    const invito = await fetchInvitoByToken(LONG_TOKEN);
    expect(invito.id).toBe('i1');
    expect(getHttpsCallable).toHaveBeenCalledWith('getInvitoPubblico');
  });
});
