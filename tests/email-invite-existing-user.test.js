/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildInviteHtml } = require('../functions/email-resend.js');

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

  it('showInviteLinkModal riceve isExistingUser e testo alternativo', () => {
    expect(html).toMatch(/function showInviteLinkModal\(link, email, nome, cognome, ruoli, isExistingUser\)/);
    expect(html).toMatch(/Link per aggiungere l\\'azienda/);
    expect(html).toMatch(/Ha già un account/);
  });
});
