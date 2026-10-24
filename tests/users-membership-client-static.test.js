/**
 * Statico: nessun client scrive tenantMemberships/ruoli/tenantId su users
 * (allowlist esplicita); pagina invito ferma il listener; già-membro usa codice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'gfv-platform') continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(js|html)$/.test(name)) out.push(full);
  }
  return out;
}

/** Scritture legittime di autorizzazione residue (create registrazione / commenti disabilitati). */
const ALLOWLIST = [
  // Registrazione nuova azienda: unica create client con ruoli+tenantId+membership
  path.normalize('core/auth/registrazione-standalone.html'),
  // Messaggi / errori disabilitati (non eseguono più scritture autorizzative)
  path.normalize('core/admin/fix-utente-mancante.html'),
  path.normalize('core/services/auth-service.js'),
  path.normalize('core/services/role-service.js'),
  // Gestisci Utenti: ancora tenta (PARTE 2); rules negano — tenuto per UX errore chiaro
  path.normalize('core/admin/gestisci-utenti-standalone.html'),
];

/** Scritture (update/set) di campi autorizzativi su users — non letture. */
const DANGEROUS = [
  /(?:updateDoc|setDoc)\([\s\S]{0,500}tenantMemberships/s,
  /(?:updateDoc|setDoc)\([\s\S]{0,500}['"]users['"][\s\S]{0,400}\bruoli\s*:/s,
  /(?:updateDoc|setDoc)\([\s\S]{0,500}['"]users['"][\s\S]{0,400}\btenantId\s*:/s,
];

describe('client static — no auth field writes (allowlist)', () => {
  it('fuori allowlist non ci sono scritture di membership/ruoli/tenantId su users', () => {
    const files = walk(path.join(root, 'core')).concat(walk(path.join(root, 'modules')));
    const offenders = [];
    for (const full of files) {
      const rel = path.relative(root, full).split(path.sep).join('/');
      const norm = path.normalize(rel);
      if (ALLOWLIST.some((a) => a === norm || a.replace(/\\/g, '/') === rel)) continue;
      if (rel.includes('tony')) continue;
      const src = readFileSync(full, 'utf8');
      // Solo file che toccano users
      if (!/['"]users['"]/.test(src) && !/`users`/.test(src)) continue;
      for (const re of DANGEROUS) {
        if (re.test(src)) {
          // registrazione setDoc con userData che include membership: già in allowlist
          offenders.push(`${rel} ~ ${re}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('registrazione-invito ha accettazioneInCorso e already-exists', () => {
    const html = read('core/auth/registrazione-invito-standalone.html');
    expect(html).toMatch(/accettazioneInCorso/);
    expect(html).toMatch(/already-exists/);
    expect(html).not.toMatch(/tenantMemberships\s*=/);
    expect(html).not.toMatch(/updateDoc\(doc\(db,\s*'inviti'/);
  });

  it('invito-service usa callable accettaInvito, non setDoc users con membership', () => {
    const src = read('core/services/invito-service-standalone.js');
    expect(src).toMatch(/getHttpsCallable\('accettaInvito'\)/);
    expect(src).toMatch(/already-exists/);
    expect(src).not.toMatch(/setDoc\(doc\(db,\s*'users'/);
    expect(src).not.toMatch(/updateDoc\(doc\(db,\s*'inviti'/);
  });

  it('index.js esporta accettaInvito', () => {
    const src = read('functions/index.js');
    expect(src).toMatch(/exports\.accettaInvito\s*=\s*onCall/);
  });

  it('registrazione-standalone crea membership e non ripiega su updateDoc ruoli/tenantId', () => {
    const html = read('core/auth/registrazione-standalone.html');
    expect(html).toMatch(/tenantMemberships/);
    expect(html).toMatch(/Esiste già un profilo/);
    expect(html).not.toMatch(/riprovo con updateDoc/);
    expect(html).not.toMatch(/deleteDoc\(doc\(db,\s*'users'/);
  });
});
