/**
 * Fase 6 v2 — Auth + users/{uid} per caposquadra e operai (no inviti).
 * @module simulator/phases/06-setup-personas
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { generaPersonaCampo } from '../generators/nomi-italiani.js';
import { ensureAuthUser, getEmulatorDb } from '../lib/emulator-context.js';
import { setRootDocument } from '../lib/firestore-write.js';
import { updateLastManifestEntry } from '../lib/manifest.js';
import {
  getSimProfile,
  getSimTenantId,
  getSimUserId,
  requireSimTenantId,
  setSimContext
} from '../lib/sim-context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDefaults() {
  return JSON.parse(readFileSync(join(__dirname, '../config/defaults.json'), 'utf-8'));
}

/**
 * @returns {Promise<{ personas: object[], caposquadra: object[], operai: object[], counts: object }>}
 */
export async function runSetupPersonas() {
  const tenantId = requireSimTenantId();
  const profile = getSimProfile();
  const template = profile?.template;
  const q = template?.quantities || {};
  const seed = profile?.seed ?? Date.now();
  const slug = profile?.slug;
  const password = profile?.password || loadDefaults().defaultPassword;
  const db = getEmulatorDb();
  const now = new Date();

  const nCapo = q.caposquadra ?? 1;
  const nOperai = q.operai ?? 3;

  const managerUid = getSimUserId();
  const manifestPersonas = [
    {
      userId: managerUid,
      email: profile.email,
      displayName: profile.displayName,
      ruoli: ['amministratore']
    }
  ];
  const personas = [
    {
      id: managerUid,
      uid: managerUid,
      userId: managerUid,
      email: profile.email,
      nome: profile.nome,
      cognome: profile.cognome,
      displayName: profile.displayName,
      ruoli: ['amministratore']
    }
  ];

  const caposquadra = [];
  for (let i = 1; i <= nCapo; i++) {
    const p = generaPersonaCampo('caposquadra', i, seed, slug);
    const authUser = await ensureAuthUser({
      email: p.email,
      password,
      displayName: p.displayName
    });

    const userDoc = {
      email: p.email,
      nome: p.nome,
      cognome: p.cognome,
      ruoli: ['caposquadra'],
      tenantId,
      tenantMemberships: {
        [tenantId]: {
          ruoli: ['caposquadra'],
          stato: 'attivo'
        }
      },
      stato: 'attivo',
      createdAt: now,
      updatedAt: now
    };

    await setRootDocument(db, 'users', authUser.uid, userDoc);

    const persona = {
      id: authUser.uid,
      uid: authUser.uid,
      userId: authUser.uid,
      email: p.email,
      nome: p.nome,
      cognome: p.cognome,
      displayName: p.displayName,
      ruoli: ['caposquadra']
    };
    caposquadra.push(persona);
    manifestPersonas.push({
      userId: persona.userId,
      email: persona.email,
      displayName: persona.displayName,
      ruoli: persona.ruoli
    });
  }

  const operai = [];
  for (let i = 1; i <= nOperai; i++) {
    const p = generaPersonaCampo('operaio', i, seed, slug);
    const authUser = await ensureAuthUser({
      email: p.email,
      password,
      displayName: p.displayName
    });

    const userDoc = {
      email: p.email,
      nome: p.nome,
      cognome: p.cognome,
      ruoli: ['operaio'],
      tenantId,
      tenantMemberships: {
        [tenantId]: {
          ruoli: ['operaio'],
          stato: 'attivo'
        }
      },
      stato: 'attivo',
      createdAt: now,
      updatedAt: now
    };

    await setRootDocument(db, 'users', authUser.uid, userDoc);

    const persona = {
      id: authUser.uid,
      uid: authUser.uid,
      userId: authUser.uid,
      email: p.email,
      nome: p.nome,
      cognome: p.cognome,
      displayName: p.displayName,
      ruoli: ['operaio']
    };
    operai.push(persona);
    manifestPersonas.push({
      userId: persona.userId,
      email: persona.email,
      displayName: persona.displayName,
      ruoli: persona.ruoli
    });
  }

  setSimContext({
    profile: {
      ...profile,
      personas: manifestPersonas,
      personasFull: { manager: personas[0], caposquadra, operai }
    }
  });

  updateLastManifestEntry({ personas: manifestPersonas }, tenantId);

  return {
    personas: manifestPersonas,
    caposquadra,
    operai,
    counts: {
      manager: 1,
      caposquadra: caposquadra.length,
      operai: operai.length,
      totalPersonas: manifestPersonas.length
    }
  };
}
