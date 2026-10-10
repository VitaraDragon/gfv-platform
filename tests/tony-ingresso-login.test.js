import { describe, it, expect } from 'vitest';
import {
  spiegaIngressoDopoLogin,
  scegliIngresso,
  eProfiloCampo,
  percorsoConsentitoAlCampo,
  paginaStrumentoDev,
  guardiaRottaCampo,
  indizioRuoliCampo,
  urlWorkspaceDaPercorso,
} from '../core/js/tony/tony-ingresso-login.js';

describe('scegliIngresso', () => {
  it('operaio con Manodopera va nell’area di lavoro', () => {
    const esito = scegliIngresso({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('workspace');
    expect(esito.motivo).toMatch(/operaio/i);
  });

  it('il caposquadra va nell’area di lavoro', () => {
    const esito = scegliIngresso({
      ruoli: ['caposquadra'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('workspace');
  });

  it('operaio e caposquadra insieme vanno nell’area di lavoro', () => {
    const esito = scegliIngresso({
      ruoli: ['operaio', 'caposquadra'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('workspace');
    expect(eProfiloCampo(['operaio', 'caposquadra'], ['manodopera'])).toBe(true);
  });

  it('il manager resta in dashboard', () => {
    const esito = scegliIngresso({
      ruoli: ['manager'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('dashboard');
    expect(esito.motivo).toBe('manager');
  });

  it('manager e caposquadra restano in dashboard', () => {
    const esito = scegliIngresso({
      ruoli: ['manager', 'caposquadra'],
      moduli: ['manodopera'],
      preferenza: 'classic',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('dashboard');
    expect(esito.motivo).toBe('manager');
    expect(eProfiloCampo(['manager', 'caposquadra'], ['manodopera'])).toBe(false);
  });

  it('l’amministratore resta in dashboard anche dopo i rimbalzi', () => {
    const esito = scegliIngresso({
      ruoli: ['amministratore'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 2,
    });
    expect(esito.scelta).toBe('dashboard');
  });

  it('operaio senza Manodopera resta in dashboard', () => {
    const esito = scegliIngresso({
      ruoli: ['operaio'],
      moduli: ['magazzino'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('dashboard');
    expect(esito.motivo).toBe('senza manodopera');
  });

  it('la preferenza classica non porta il profilo campo in dashboard', () => {
    const esito = scegliIngresso({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'classic',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('workspace');
  });

  it('la preferenza classica del caposquadra resta sul workspace', () => {
    const esito = scegliIngresso({
      ruoli: ['caposquadra'],
      moduli: ['manodopera'],
      preferenza: 'classic',
      rimbalzi: 1,
    });
    expect(esito.scelta).toBe('workspace');
  });

  it('la preferenza classica del manager lascia la dashboard', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['manager'],
      moduli: ['manodopera'],
      preferenza: 'classic',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('dashboard');
    expect(esito.motivo).toBe('manager');
  });

  it('dopo un solo rimbalzo si riprova l’area di lavoro', () => {
    const esito = scegliIngresso({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 1,
    });
    expect(esito.scelta).toBe('workspace');
  });

  it('al secondo rimbalzo si ferma', () => {
    const esito = scegliIngresso({
      ruoli: ['caposquadra'],
      moduli: ['manodopera'],
      preferenza: 'classic',
      rimbalzi: 2,
    });
    expect(esito.scelta).toBe('errore');
    expect(esito.motivo).toBe('secondo rimbalzo');
  });
});

describe('percorsoConsentitoAlCampo', () => {
  const consentiti = [
    '/gfv-platform/core/mobile/field-workspace-standalone.html',
    '/core/mobile/statistiche-lavoratore-standalone.html',
    '/core/segnatura-ore-standalone.html',
    '/core/admin/lavori-caposquadra-standalone.html',
    '/core/admin/validazione-ore-standalone.html',
    '/core/admin/impostazioni-standalone.html',
    '/core/admin/segnalazione-guasti-standalone.html',
    '/core/auth/login-standalone.html',
    '/core/auth/registrazione-standalone.html',
    '/core/auth/reset-password-standalone.html',
    '/documentazione-utente/guida-manodopera-utente.html',
    '/core/js/dashboard-utils.js',
  ];
  const desktop = [
    '/core/dashboard-standalone.html',
    '/core/terreni-standalone.html',
    '/core/attivita-standalone.html',
    '/core/mappa-aziendale-standalone.html',
    '/core/statistiche-standalone.html',
    '/core/admin/gestione-lavori-standalone.html',
    '/modules/vigneto/views/vigneto-dashboard-standalone.html',
    '/modules/frutteto/views/frutteti-standalone.html',
    '/modules/magazzino/views/prodotti-standalone.html',
    '/modules/macchine/views/guasti-list-standalone.html',
    '/modules/conto-terzi/views/clienti-standalone.html',
    '/modules/manodopera/views/manodopera-home-standalone.html',
    '/modules/seminativo/views/seminativo-dashboard-standalone.html',
    '/modules/vendemmia-meccanica/views/calcolatore-standalone.html',
  ];

  it('consente le pagine compito, il login e la guida', () => {
    consentiti.forEach((p) => {
      expect(percorsoConsentitoAlCampo(p), p).toBe(true);
    });
  });

  it('tratta come desktop dashboard, anagrafiche e moduli', () => {
    desktop.forEach((p) => {
      expect(percorsoConsentitoAlCampo(p), p).toBe(false);
    });
  });
});

describe('paginaStrumentoDev', () => {
  it('il simulatore non è una pagina da rimandare al workspace', () => {
    expect(paginaStrumentoDev('/core/dev/simulator-dev-standalone.html')).toBe(true);
    expect(paginaStrumentoDev('/core/terreni-standalone.html')).toBe(false);
    expect(paginaStrumentoDev('/core/dashboard-standalone.html')).toBe(false);
  });
});

describe('guardiaRottaCampo', () => {
  it('il caposquadra che apre i terreni torna al workspace', () => {
    const esito = guardiaRottaCampo({
      ruoli: ['caposquadra'],
      moduli: ['manodopera'],
      pathname: '/core/terreni-standalone.html',
    });
    expect(esito.azione).toBe('workspace');
  });

  it('l’operaio resta sulla pagina compito', () => {
    const esito = guardiaRottaCampo({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      pathname: '/core/admin/segnalazione-guasti-standalone.html',
    });
    expect(esito.azione).toBe('consenti');
  });

  it('manager e capo restano sulla dashboard', () => {
    const esito = guardiaRottaCampo({
      ruoli: ['manager', 'caposquadra'],
      moduli: ['manodopera'],
      pathname: '/core/dashboard-standalone.html',
    });
    expect(esito.azione).toBe('consenti');
  });

  it('senza manodopera la guardia non sposta nessuno', () => {
    const esito = guardiaRottaCampo({
      ruoli: ['operaio'],
      moduli: [],
      pathname: '/core/terreni-standalone.html',
    });
    expect(esito.azione).toBe('consenti');
  });

  it('l’indizio workspace non è un permesso: apre solo il rimando di interfaccia', () => {
    const indizio = indizioRuoliCampo({ ultimo: 'workspace', ruoli: ['manager'] });
    const esito = guardiaRottaCampo({
      ruoli: indizio.ruoli,
      moduli: indizio.moduli,
      pathname: '/core/admin/gestione-lavori-standalone.html',
    });
    expect(indizio.fonte).toBe('indizio-workspace');
    expect(esito.azione).toBe('workspace');
  });

  it('l’indizio dashboard lascia aprire la pagina', () => {
    const indizio = indizioRuoliCampo({ ultimo: 'dashboard', ruoli: ['operaio'] });
    const esito = guardiaRottaCampo({
      ruoli: indizio.ruoli,
      moduli: indizio.moduli,
      pathname: '/modules/vigneto/views/vigneto-dashboard-standalone.html',
    });
    expect(esito.azione).toBe('consenti');
  });

  it('costruisce l’indirizzo del workspace dalla cartella del sito', () => {
    expect(urlWorkspaceDaPercorso('/gfv-platform/core/terreni-standalone.html'))
      .toBe('/gfv-platform/core/mobile/field-workspace-standalone.html');
    expect(urlWorkspaceDaPercorso('/gfv-platform/modules/vigneto/views/x.html'))
      .toBe('/gfv-platform/core/mobile/field-workspace-standalone.html');
  });
});
