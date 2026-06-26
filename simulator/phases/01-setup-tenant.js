/**
 * Fase 1 — Setup tenant + utente Auth/Firestore.
 * @module simulator/phases/01-setup-tenant
 */

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ensureAuthUser, initEmulatorAdmin } from '../lib/emulator-context.js';
import { setRootDocument } from '../lib/firestore-write.js';
import { appendManifestEntry } from '../lib/manifest.js';
import { loadTemplate } from '../lib/load-template.js';
import { generaProfilo, slugify } from '../generators/nomi-italiani.js';
import { setSimContext, resetSimContext } from '../lib/sim-context.js';
import { ensureCleanSimTenant } from '../lib/cleanup-tenant.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDefaults() {
  return JSON.parse(readFileSync(join(__dirname, '../config/defaults.json'), 'utf-8'));
}

/**
 * @param {{ templateId?: string, seed?: number, appendManifest?: boolean, templateOverrides?: object }} [options]
 */
export async function runSetupTenant(options = {}) {
  resetSimContext();
  const templateId = options.templateId || 'solo-titolare-viticola';
  const template = loadTemplate(templateId, options.templateOverrides || {});
  const defaults = loadDefaults();
  const seed = options.seed ?? Date.now();
  const profile = generaProfilo(seed);
  const runId = randomUUID();
  const tenantId = `${defaults.tenantPrefix}${slugify(profile.aziendaNome)}_${String(seed).slice(-6)}`;

  const password = defaults.defaultPassword;
  const { db, auth } = initEmulatorAdmin();
  await ensureCleanSimTenant(db, auth, tenantId);

  const authUser = await ensureAuthUser({
    email: profile.email,
    password,
    displayName: profile.displayName
  });

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
    profile: { ...profile, password, templateId, template, seed }
  });

  if (options.appendManifest !== false) {
    appendManifestEntry({
      runId,
      templateId,
      tenantId,
      userId: authUser.uid,
      email: profile.email,
      aziendaNome: profile.aziendaNome
    });
  }

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
