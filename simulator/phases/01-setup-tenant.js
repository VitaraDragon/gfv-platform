/**
 * Fase 1 — Setup tenant + utente Auth/Firestore.
 * @module simulator/phases/01-setup-tenant
 */

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ensureAuthUser, getEmulatorDb } from '../lib/emulator-context.js';
import { setRootDocument } from '../lib/firestore-write.js';
import { appendManifestEntry } from '../lib/manifest.js';
import { generaProfilo, slugify } from '../generators/nomi-italiani.js';
import { setSimContext } from '../lib/sim-context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDefaults() {
  return JSON.parse(readFileSync(join(__dirname, '../config/defaults.json'), 'utf-8'));
}

function loadTemplate(templateId) {
  const path = join(__dirname, '../templates', `${templateId}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * @param {{ templateId?: string, seed?: number }} [options]
 */
export async function runSetupTenant(options = {}) {
  const templateId = options.templateId || 'solo-titolare-viticola';
  const template = loadTemplate(templateId);
  const defaults = loadDefaults();
  const seed = options.seed ?? Date.now();
  const profile = generaProfilo(seed);
  const runId = randomUUID();
  const tenantId = `${defaults.tenantPrefix}${slugify(profile.aziendaNome)}_${String(seed).slice(-6)}`;

  const password = defaults.defaultPassword;
  const authUser = await ensureAuthUser({
    email: profile.email,
    password,
    displayName: profile.displayName
  });

  const db = getEmulatorDb();
  const now = new Date();

  await setRootDocument(db, 'tenants', tenantId, {
    name: profile.aziendaNome,
    plan: template.piano,
    piano: template.piano,
    modules: template.moduli,
    moduli: template.moduli,
    status: 'active',
    createdBy: authUser.uid,
    simRunId: runId,
    simTemplate: templateId,
    createdAt: now,
    updatedAt: now
  });

  await setRootDocument(db, 'users', authUser.uid, {
    email: profile.email,
    nome: profile.nome,
    cognome: profile.cognome,
    ruoli: ['amministratore'],
    tenantId,
    tenantMemberships: {
      [tenantId]: {
        ruoli: ['amministratore'],
        stato: 'attivo',
        tenantIdPredefinito: true
      }
    },
    stato: 'attivo',
    createdAt: now,
    updatedAt: now
  });

  setSimContext({
    tenantId,
    userId: authUser.uid,
    runId,
    profile: { ...profile, password, templateId, template }
  });

  appendManifestEntry({
    runId,
    templateId,
    tenantId,
    userId: authUser.uid,
    email: profile.email,
    aziendaNome: profile.aziendaNome
  });

  return {
    runId,
    templateId,
    tenantId,
    userId: authUser.uid,
    email: profile.email,
    password,
    aziendaNome: profile.aziendaNome,
    template
  };
}
