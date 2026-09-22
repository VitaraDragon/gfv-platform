/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  computePelleState,
  isFieldWorkspacePath,
  isPelleSkippedPath,
  moduleFromPath,
  moduleFromLocation,
  visibleShellEntries,
  homeActionsFromShell,
  moduleMenuEntries,
  accountMenuEntries,
  cardsModelFromRows,
  PELLE_ACCENT
} from '../core/js/ui-pelle-state.js';

const catalog = {
  terreni: { label: 'Terreni', href: 'terreni-standalone.html' },
  frutteto: { label: 'Frutteto', href: '../modules/frutteto/views/frutteto-dashboard-standalone.html' },
  manodopera: { label: 'Manodopera', href: '../modules/manodopera/views/manodopera-home-standalone.html' },
  statistiche: {
    label: 'Statistiche',
    href: 'statistiche-standalone.html',
    hrefManodopera: 'admin/statistiche-manodopera-standalone.html'
  },
  abbonamento: { label: 'Abbonamento', href: 'admin/abbonamento-standalone.html' },
  diarioAttivita: { label: 'Diario attività', href: 'attivita-standalone.html' }
};

describe('ui-pelle stato', () => {
  test('flag spento: data-pelle oggi, niente shell', () => {
    const state = computePelleState({ host: true, flagOn: false, desktop: false, surface: 'home' });
    expect(state.apply).toBe(true);
    expect(state.pelle).toBe('oggi');
    expect(state.mountShell).toBe(false);
    expect(state.mountCards).toBe(false);
    expect(state.mountHome).toBe(false);
  });

  test('Sabbie + Prova: proposta, schede solo sotto 1024', () => {
    const phone = computePelleState({ host: true, flagOn: true, desktop: false, surface: 'home' });
    expect(phone.pelle).toBe('proposta');
    expect(phone.shell).toBe('phone');
    expect(phone.mountShell).toBe(true);
    expect(phone.mountCards).toBe(true);
    expect(phone.mountHome).toBe(true);

    const desk = computePelleState({ host: true, flagOn: true, desktop: true, surface: 'lista' });
    expect(desk.shell).toBe('desktop');
    expect(desk.mountCards).toBe(false);
    expect(desk.mountHome).toBe(false);
  });

  test('pagina senza host e workspace campo non applicano la pelle', () => {
    expect(computePelleState({ host: false, flagOn: true }).apply).toBe(false);
    expect(computePelleState({ host: true, fieldWorkspace: true, flagOn: true }).apply).toBe(false);
    expect(isFieldWorkspacePath('/modules/manodopera/views/field-workspace-standalone.html')).toBe(true);
    expect(isFieldWorkspacePath('/core/dashboard-standalone.html')).toBe(false);
    expect(isPelleSkippedPath('/core/mobile/field-workspace-standalone.html')).toBe(true);
    expect(isPelleSkippedPath('/core/auth/login-standalone.html')).toBe(true);
    expect(isPelleSkippedPath('/modules/magazzino/views/magazzino-home-standalone.html')).toBe(false);
    expect(moduleFromPath('/modules/magazzino/views/magazzino-home-standalone.html')).toBe('magazzino');
    expect(moduleFromPath('/modules/vigneto/views/vigneto-dashboard-standalone.html')).toBe('vigneto');
    expect(moduleFromPath('/core/dashboard-standalone.html')).toBe('home');
    expect(moduleFromPath('/core/admin/gestione-lavori-standalone.html')).toBe('lavori');
    expect(moduleFromLocation(
      '/modules/vigneto/views/calcolo-materiali-standalone.html',
      '?coltura=frutteto'
    )).toBe('frutteto');
    expect(moduleFromLocation(
      '/modules/vigneto/views/calcolo-materiali-standalone.html',
      ''
    )).toBe('vigneto');
  });

  test('shell legge il catalogo e nasconde i moduli non attivi', () => {
    const entries = visibleShellEntries(catalog, ['frutteto'], undefined);
    const ids = entries.map((e) => e.id);
    expect(ids[0]).toBe('home');
    expect(ids).toContain('frutteto');
    expect(ids).toContain('lavori');
    expect(ids).toContain('impostazioni');
    expect(moduleMenuEntries(entries).map((e) => e.id)).not.toContain('impostazioni');
    expect(accountMenuEntries().map((e) => e.id)).toEqual(['impostazioni', 'guide']);
    expect(ids).not.toContain('manodopera');
    const frutteto = entries.find((e) => e.id === 'frutteto');
    expect(frutteto.href).toBe('../modules/frutteto/views/frutteto-dashboard-standalone.html');
    expect(frutteto.label).toBe('Frutteto');
  });

  test('statistiche manodopera usa href del catalogo', () => {
    const entries = visibleShellEntries(catalog, ['manodopera'], undefined);
    const stats = entries.find((e) => e.id === 'statistiche');
    expect(stats.href).toBe('admin/statistiche-manodopera-standalone.html');
  });

  test('home: al massimo 6 azioni, il catalogo non è la home', () => {
    const entries = visibleShellEntries(catalog, ['frutteto', 'manodopera'], undefined);
    const actions = homeActionsFromShell(entries);
    expect(actions.length).toBeLessThanOrEqual(6);
    expect(actions.map((a) => a.id)).not.toContain('home');
    expect(actions.map((a) => a.id)).not.toContain('impostazioni');
    expect(actions[0].id).toBe('terreni');
    expect(actions[1].id).toBe('lavori');
  });

  test('scheda lista: titolo, 3 fatti, stato e azioni', () => {
    const cards = cardsModelFromRows(
      ['Nome', 'Terreno', 'Data', 'Stato', 'Azioni'],
      [{
        alert: true,
        cells: [
          { text: 'Potatura' },
          { text: 'Campo Olmo' },
          { text: '22 settembre' },
          { text: 'Assegnato', html: '<span class="badge">Assegnato</span>' },
          { text: 'Apri', html: '<button type="button">Apri</button>' }
        ]
      }]
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('Potatura');
    expect(cards[0].facts).toEqual(['Terreno: Campo Olmo', 'Data: 22 settembre']);
    expect(cards[0].statoHtml).toContain('Assegnato');
    expect(cards[0].actionsHtml).toContain('Apri');
    expect(cards[0].alert).toBe(true);
    expect(PELLE_ACCENT.frutteto).toBe('#FF6F00');
  });
});

describe('icone a tratto', () => {
  test('modulo e emoji già in pagina scelgono la stessa famiglia di segni', async () => {
    const { iconNameForModule, iconNameForEmoji, iconSvg } = await import('../core/js/ui-pelle-icons.js');
    expect(iconNameForModule('frutteto')).toBe('apple');
    expect(iconNameForModule('vigneto')).toBe('grape');
    expect(iconNameForEmoji('🍎')).toBe('apple');
    expect(iconNameForEmoji('👷‍♂️')).toBe('user');
    expect(iconNameForEmoji('sconosciuto')).toBe('mark');
    expect(iconSvg('apple')).toContain('<svg');
    expect(iconSvg('nonesiste')).toContain('circle');
  });
});
