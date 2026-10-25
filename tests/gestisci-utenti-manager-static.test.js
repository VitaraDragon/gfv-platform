/**
 * Statico: Gestisci Utenti — accesso manager + ruoli tenant + moduli effettivi.
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

describe('gestisci-utenti manager access (static)', () => {
  const html = read('core/admin/gestisci-utenti-standalone.html');

  it('risolve tenant e ruoli con helper membership, non ruoli globali deprecati', () => {
    expect(html).toMatch(/resolveTenantIdForUser/);
    expect(html).toMatch(/getUserRolesFromData/);
    expect(html).not.toMatch(
      /if\s*\(\s*!currentUserData\.ruoli\s*\|\|\s*!currentUserData\.ruoli\.includes\(['"]amministratore['"]\)/
    );
    expect(html).toMatch(/currentUserRoles\.includes\(['"]manager['"]\)/);
    expect(html).toMatch(/Non hai i permessi per accedere a questa pagina/);
  });

  it('usa getEffectiveModulesFromTenant per Manodopera e Tony', () => {
    expect(html).toMatch(/getEffectiveModulesFromTenant/);
    expect(html).not.toMatch(
      /const modules = Array\.isArray\(tenantData\?\.modules\)\s*\?\s*tenantData\.modules/
    );
  });

  it('UI manager: Impostazioni solo admin, casella admin nascosta, azioni su admin condizionate', () => {
    expect(html).toMatch(/isCurrentUserAdmin\s*\?\s*['"]inline-flex['"]\s*:\s*['"]none['"]/);
    expect(html).toMatch(/role-admin-item/);
    expect(html).toMatch(/updateAdminRoleCheckboxVisibility/);
    expect(html).toMatch(/canManageTarget/);
    expect(html).toMatch(/data-is-admin/);
  });

  it('permission-denied mostra messaggio callable', () => {
    expect(html).toMatch(/callableErrorMessage/);
  });
});

describe('dashboard entry Gestisci Utenti / Invita (static)', () => {
  it('Invita Collaboratore: manager o admin con Manodopera (moduli già effettivi in dashboard)', () => {
    const ctrl = read('core/js/dashboard-controller.js');
    expect(ctrl).toMatch(/invita-collaboratore-link/);
    expect(ctrl).toMatch(/hasRole\(userData,\s*['"]manager['"]\)/);
    expect(ctrl).toMatch(/hasManodopera/);
  });

  it('quick-bar gestisciUtenti: Manodopera + manager/admin', () => {
    const qb = read('core/js/dashboard-quick-bar.js');
    expect(qb).toMatch(/gestisciUtenti:\s*\{[\s\S]*?requireManodopera:\s*true/m);
    expect(qb).toMatch(/gestisciUtenti:\s*\{[\s\S]*?visibleForRoles:\s*\[[\s\S]*?manager[\s\S]*?amministratore/m);
  });
});
