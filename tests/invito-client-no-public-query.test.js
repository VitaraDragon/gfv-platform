/**
 * Regressione: la registrazione non deve più interrogare /inviti per token
 * (richiede list pubblico). Gestione utenti non elenca inviti senza tenantId.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('inviti — niente query pubblica per token', () => {
  it('registrazione usa fetchInvitoByToken, non where token', () => {
    const html = read('core/auth/registrazione-invito-standalone.html');
    expect(html).toMatch(/fetchInvitoByToken/);
    expect(html).not.toMatch(/where\(\s*['"]token['"]/);
    expect(html).not.toMatch(/collection\(db,\s*['"]inviti['"]\)/);
  });

  it('invito-service non interroga la collection per verify', () => {
    const src = read('core/services/invito-service-standalone.js');
    expect(src).toMatch(/getHttpsCallable\('getInvitoPubblico'\)/);
    expect(src).not.toMatch(/where\(\s*['"]token['"]/);
  });

  it('gestisci-utenti elenca inviti solo con tenantId', () => {
    const html = read('core/admin/gestisci-utenti-standalone.html');
    expect(html).toMatch(/where\('tenantId',\s*'==',\s*currentTenantId\)/);
    expect(html).not.toMatch(/invitesQuery = query\(\s*collection\(db,\s*'inviti'\),\s*where\('stato'/);
  });

  it('index.js esporta getInvitoPubblico', () => {
    const src = read('functions/index.js');
    expect(src).toMatch(/exports\.getInvitoPubblico\s*=\s*onCall/);
    expect(src).toMatch(/require\("\.\/invito-pubblico"\)/);
  });
});
