import { describe, expect, it } from 'vitest';
import {
  MSG_ZONA_NON_PERMESSA,
  idPulito,
  isLavoroAutonomoPerZone,
  isSostitutoSuLavoroAutonomo,
  puoSegnareZona,
} from '../../core/services/zone-lavorate-permessi.js';

const MSG = 'Su questo lavoro le zone le segna il caposquadra (o il manager).';

function user(ruoli, uid, id) {
  const u = { ruoli, uid };
  if (id !== undefined) u.id = id;
  return u;
}

describe('zone-lavorate-permessi', () => {
  it('il messaggio è quello deciso', () => {
    expect(MSG_ZONA_NON_PERMESSA).toBe(MSG);
  });

  it('idPulito toglie gli spazi e tratta null come vuoto', () => {
    expect(idPulito('  abc  ')).toBe('abc');
    expect(idPulito(null)).toBe('');
    expect(idPulito(undefined)).toBe('');
  });

  it('manager e amministratore segnano su squadra e su autonomo', () => {
    const squadra = { caposquadraId: 'capo-1', operaioId: 'op-1' };
    const autonomo = { operaioId: 'op-1' };
    expect(puoSegnareZona(squadra, user(['manager'], 'mgr'))).toBe(true);
    expect(puoSegnareZona(autonomo, user([' Manager '], 'mgr'))).toBe(true);
    expect(puoSegnareZona(squadra, user(['amministratore'], 'adm'))).toBe(true);
    expect(puoSegnareZona(autonomo, user(['Amministratore'], 'adm'))).toBe(true);
  });

  it('il caposquadra segna solo il proprio lavoro di squadra', () => {
    expect(puoSegnareZona({ caposquadraId: 'capo-1' }, user(['caposquadra'], 'capo-1'))).toBe(true);
    expect(puoSegnareZona({ caposquadraId: 'capo-2' }, user(['caposquadra'], 'capo-1'))).toBe(false);
    expect(puoSegnareZona({ operaioId: 'capo-1' }, user(['caposquadra'], 'capo-1'))).toBe(false);
  });

  it('l’operaio segna solo il proprio autonomo, non la squadra', () => {
    expect(puoSegnareZona({ operaioId: 'op-1' }, user(['operaio'], 'op-1'))).toBe(true);
    expect(puoSegnareZona({ operaioId: 'op-1', caposquadraId: '' }, user(['operaio'], 'op-1'))).toBe(true);
    expect(puoSegnareZona({ caposquadraId: 'capo-1', operaioId: 'op-1' }, user(['operaio'], 'op-1'))).toBe(false);
    expect(puoSegnareZona({ operaioId: 'op-2' }, user(['operaio'], 'op-1'))).toBe(false);
  });

  it('dato sporco: vale il capo, l’operaio no', () => {
    const sporco = { caposquadraId: 'capo-1', operaioId: 'op-1' };
    expect(isLavoroAutonomoPerZone(sporco)).toBe(false);
    expect(puoSegnareZona(sporco, user(['caposquadra'], 'capo-1'))).toBe(true);
    expect(puoSegnareZona(sporco, user(['operaio'], 'op-1'))).toBe(false);
  });

  it('doppio ruolo capo e operaio: sui propri lavori sì, sulla squadra altrui no', () => {
    const dual = user(['caposquadra', 'operaio'], 'dual-1');
    expect(puoSegnareZona({ caposquadraId: 'dual-1' }, dual)).toBe(true);
    expect(puoSegnareZona({ operaioId: 'dual-1' }, dual)).toBe(true);
    expect(puoSegnareZona({ caposquadraId: 'capo-2', operaioId: 'dual-1' }, dual)).toBe(false);
  });

  it('user.id diverso da uid: vale l’id che coincide', () => {
    const capo = { ruoli: ['caposquadra'], uid: 'altro', id: 'capo-1' };
    expect(puoSegnareZona({ caposquadraId: 'capo-1' }, capo)).toBe(true);
    expect(puoSegnareZona({ caposquadraId: 'altro' }, capo)).toBe(true);
    expect(puoSegnareZona({ caposquadraId: 'sconosciuto' }, capo)).toBe(false);
  });

  it('lavoro o utente null non possono segnare', () => {
    expect(puoSegnareZona(null, user(['manager'], 'mgr'))).toBe(false);
    expect(puoSegnareZona({ operaioId: 'op-1' }, null)).toBe(false);
    expect(puoSegnareZona(undefined, undefined)).toBe(false);
    expect(isLavoroAutonomoPerZone(null)).toBe(false);
  });

  it('il sostituto segna sull’autonomo, anche se operaioId è un altro', () => {
    const lavoro = { operaioId: 'op-1', assenzaSostitutoOperaioId: 'sost-1' };
    const sost = user(['operaio'], 'sost-1');
    expect(isLavoroAutonomoPerZone(lavoro)).toBe(true);
    expect(isSostitutoSuLavoroAutonomo(lavoro, sost)).toBe(true);
    expect(puoSegnareZona(lavoro, sost)).toBe(true);
  });

  it('il sostituto non segna su una squadra', () => {
    const lavoro = {
      caposquadraId: 'capo-1',
      operaioId: 'op-1',
      assenzaSostitutoOperaioId: 'sost-1',
    };
    const sost = user(['operaio'], 'sost-1');
    expect(isSostitutoSuLavoroAutonomo(lavoro, sost)).toBe(false);
    expect(puoSegnareZona(lavoro, sost)).toBe(false);
  });

  it('senza ruolo operaio il sostituto non segna', () => {
    const lavoro = { operaioId: 'op-1', assenzaSostitutoOperaioId: 'sost-1' };
    const sost = user(['caposquadra'], 'sost-1');
    expect(isSostitutoSuLavoroAutonomo(lavoro, sost)).toBe(false);
    expect(puoSegnareZona(lavoro, sost)).toBe(false);
  });

  it('campo sostituto vuoto o null: no', () => {
    const sost = user(['operaio'], 'sost-1');
    expect(puoSegnareZona({ operaioId: 'op-1', assenzaSostitutoOperaioId: '' }, sost)).toBe(false);
    expect(puoSegnareZona({ operaioId: 'op-1', assenzaSostitutoOperaioId: null }, sost)).toBe(false);
    expect(isSostitutoSuLavoroAutonomo({ operaioId: 'op-1' }, sost)).toBe(false);
  });

  it('il sostituto coincide anche se l’id è user.id e non uid', () => {
    const lavoro = { operaioId: 'op-1', assenzaSostitutoOperaioId: 'sost-1' };
    const sost = { ruoli: ['operaio'], uid: 'altro-uid', id: 'sost-1' };
    expect(isSostitutoSuLavoroAutonomo(lavoro, sost)).toBe(true);
    expect(puoSegnareZona(lavoro, sost)).toBe(true);
  });
});
