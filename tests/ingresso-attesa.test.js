import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { indizioRuoliCampo } from '../core/js/tony/tony-ingresso-login.js';

const codice = readFileSync(new URL('../core/js/ingresso-attesa.js', import.meta.url), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(codice, sandbox);

const devoMostrareAttesa = sandbox.gfvDevoMostrareAttesa;
const ruoloRestaInDashboard = sandbox.gfvRuoloRestaInDashboard;
const ruoliDalDocumentoUtente = sandbox.gfvRuoliDalDocumentoUtente;
const specchio = sandbox.gfvIndizioRuoliCampoSpecchio;

describe('devoMostrareAttesa', () => {
  it('indizio dashboard e sessione campo: attesa, così il menu non lampeggia', () => {
    expect(devoMostrareAttesa({ ultimo: 'dashboard', ruoliSessione: ['operaio'] })).toBe(true);
    expect(devoMostrareAttesa({ ultimo: 'dashboard', ruoliSessione: ['caposquadra'] })).toBe(true);
  });

  it('indizio dashboard e sessione manager, o senza sessione: niente attesa', () => {
    expect(devoMostrareAttesa({ ultimo: 'dashboard', ruoliSessione: ['manager'] })).toBe(false);
    expect(devoMostrareAttesa({ ultimo: 'dashboard', ruoliSessione: ['manager', 'caposquadra'] })).toBe(false);
    expect(devoMostrareAttesa({ ultimo: 'dashboard', ruoliSessione: [] })).toBe(false);
    expect(devoMostrareAttesa({ ultimo: 'dashboard' })).toBe(false);
  });

  it('indizio workspace: attesa', () => {
    expect(devoMostrareAttesa({ ultimo: 'workspace', ruoliSessione: [] })).toBe(true);
    expect(devoMostrareAttesa({ ultimo: 'workspace', ruoliSessione: ['manager'] })).toBe(true);
  });

  it('indizio ignoto: manager no, solo capo o operaio sì, nulla di noto sì', () => {
    expect(devoMostrareAttesa({ ultimo: '', ruoliSessione: ['manager'] })).toBe(false);
    expect(devoMostrareAttesa({ ultimo: '', ruoliSessione: ['amministratore'] })).toBe(false);
    expect(devoMostrareAttesa({ ultimo: '', ruoliSessione: ['manager', 'caposquadra'] })).toBe(false);
    expect(devoMostrareAttesa({ ultimo: '', ruoliSessione: ['caposquadra'] })).toBe(true);
    expect(devoMostrareAttesa({ ultimo: '', ruoliSessione: ['operaio'] })).toBe(true);
    expect(devoMostrareAttesa({ ultimo: '', ruoliSessione: [] })).toBe(true);
    expect(devoMostrareAttesa({})).toBe(true);
  });

  it('usa indizioRuoliCampo vero, non una regola diversa', () => {
    const casi = [
      { ultimo: 'dashboard', ruoliSessione: ['operaio'] },
      { ultimo: 'dashboard', ruoliSessione: ['manager'] },
      { ultimo: 'dashboard', ruoliSessione: [] },
      { ultimo: 'workspace', ruoliSessione: ['caposquadra'] },
      { ultimo: '', ruoliSessione: ['manager', 'caposquadra'] },
      { ultimo: '', ruoliSessione: ['operaio'] },
      { ultimo: '', ruoliSessione: [] },
    ];
    for (const caso of casi) {
      const conOriginale = devoMostrareAttesa({ ...caso, classifica: indizioRuoliCampo });
      expect(conOriginale, JSON.stringify(caso)).toBe(devoMostrareAttesa(caso));
    }
  });

  it('lo specchio dei ruoli coincide con indizioRuoliCampo', () => {
    const matrici = [
      { ultimo: 'dashboard', ruoli: ['operaio'] },
      { ultimo: 'workspace', ruoli: ['manager'] },
      { ultimo: '', ruoli: ['caposquadra'] },
      { ultimo: '', ruoli: ['manager', 'operaio'] },
      { ultimo: '', ruoli: [] },
    ];
    for (const input of matrici) {
      expect(specchio(input)).toEqual(indizioRuoliCampo(input));
    }
  });
});

describe('ruoli già sul documento utente', () => {
  it('manager e amministratore liberano la dashboard prima dei moduli', () => {
    expect(ruoloRestaInDashboard(['manager'])).toBe(true);
    expect(ruoloRestaInDashboard(['amministratore', 'caposquadra'])).toBe(true);
    expect(ruoloRestaInDashboard(['caposquadra'])).toBe(false);
    expect(ruoloRestaInDashboard(['operaio'])).toBe(false);
    expect(ruoloRestaInDashboard([])).toBe(false);
  });

  it('legge i ruoli della membership senza un’altra lettura', () => {
    const userData = {
      ruoli: ['operaio'],
      tenantMemberships: {
        'az-1': { stato: 'attivo', ruoli: ['manager', 'caposquadra'] },
      },
    };
    expect(ruoliDalDocumentoUtente(userData, 'az-1')).toEqual(['manager', 'caposquadra']);
    expect(ruoloRestaInDashboard(ruoliDalDocumentoUtente(userData, 'az-1'))).toBe(true);
    expect(ruoliDalDocumentoUtente({ ruoli: ['operaio'] }, '')).toEqual(['operaio']);
  });
});

describe('stile attesa dashboard', () => {
  const html = readFileSync(new URL('../core/dashboard-standalone.html', import.meta.url), 'utf8');

  it('nasconde il guscio del menu mentre l’attesa è accesa', () => {
    expect(html).toContain('html[data-ingresso="attesa"] #gfv-pelle-shell');
    expect(html).toContain('html[data-ingresso="attesa"] .gfv-pelle-backdrop');
    expect(html).toContain('html[data-ingresso="attesa"] .gfv-pelle-lab');
    expect(html).toContain('html[data-ingresso="attesa"] #tony-fab');
    expect(html).toContain('#gfv-apertura-lavoro');
    expect(html).toContain('gfvDevoMostrareAttesa');
  });
});
