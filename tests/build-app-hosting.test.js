import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { motiviRifiutoDeployApp } from '../scripts/deploy-app-hosting.mjs';
import { isAllowedGuideMd, isIncluded } from '../scripts/build-app-hosting.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('build app hosting', () => {
  it('allow-list: guide sì, repo e legacy no', () => {
    expect(isIncluded('core/auth/login-standalone.html')).toBe(true);
    expect(isIncluded('core/GUIDA/CORE/utente/guida.md')).toBe(true);
    expect(isIncluded('core/GUIDA/CORE/tony/guida.md')).toBe(true);
    expect(isIncluded('core/guida-app/moduli/esempio.md')).toBe(true);
    expect(isAllowedGuideMd('core/GUIDA/README.md')).toBe(false);
    expect(isIncluded('core/GUIDA/README.md')).toBe(false);
    expect(isIncluded('core/guida-app/README.md')).toBe(false);
    expect(isIncluded('core/guida-app/altro.md')).toBe(false);
    expect(isIncluded('core/dev/x.html')).toBe(false);
    expect(isIncluded('core/terreni-test-bootstrap.html')).toBe(false);
    expect(isIncluded('core/auth/login.html')).toBe(false);
    expect(isIncluded('core/dashboard.html')).toBe(false);
    expect(isIncluded('core/init.js')).toBe(false);
    expect(isIncluded('core/admin/fix-utente-mancante.html')).toBe(false);
    expect(isIncluded('core/config/firebase-config.example.js')).toBe(false);
    expect(isIncluded('core/admin/template-email-invito-semplice.html')).toBe(false);
    expect(isIncluded('modules/conto-terzi/template-email-preventivo.html')).toBe(false);
    expect(isIncluded('docs-sviluppo/DEPLOY_RUNBOOK.md')).toBe(false);
    expect(isIncluded('icons/README.txt')).toBe(false);
    expect(isIncluded('icons/icon-192x192.png')).toBe(true);
    expect(isIncluded('documentazione-utente/index.html')).toBe(true);
    expect(isIncluded('documentazione-utente/README.md')).toBe(false);
    expect(isIncluded('service-worker.js')).toBe(true);
    expect(isIncluded('index.html')).toBe(false);
    expect(isIncluded('package.json')).toBe(false);
  });

  it('deploy:app solo da origin/main pulito', () => {
    expect(motiviRifiutoDeployApp({
      head: 'abc',
      originMain: 'abc',
      porcelain: '',
    })).toEqual([]);
    expect(motiviRifiutoDeployApp({
      head: 'abc',
      originMain: 'def',
      porcelain: '',
    }).join(' ')).toMatch(/origin\/main/);
    expect(motiviRifiutoDeployApp({
      head: 'abc',
      originMain: 'abc',
      porcelain: ' M firebase.json',
    }).join(' ')).toMatch(/sporco/);
  });

  it('gli script npm non pubblicano tutti i target hosting', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['build:app']).toContain('scripts/build-app-hosting.mjs');
    expect(pkg.scripts['deploy:landing']).toContain('--only hosting:default');
    expect(pkg.scripts['deploy:hosting']).toContain('--only hosting:default');
    expect(pkg.scripts['deploy:app']).toContain('scripts/deploy-app-hosting.mjs');
    expect(pkg.scripts['deploy:landing']).not.toMatch(/--only hosting(?!:)/);
    expect(pkg.scripts['deploy:hosting']).not.toMatch(/--only hosting(?!:)/);
  });

  it('build:app e --check', () => {
    execFileSync(process.execPath, ['scripts/build-app-hosting.mjs'], {
      cwd: root,
      stdio: 'pipe',
      timeout: 180000,
    });
    execFileSync(process.execPath, ['scripts/build-app-hosting.mjs', '--check'], {
      cwd: root,
      stdio: 'pipe',
      timeout: 180000,
    });
  }, 180000);
});
