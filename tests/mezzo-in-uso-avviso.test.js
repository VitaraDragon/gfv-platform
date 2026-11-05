/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import {
  isMezzoInUso,
  etichettaOpzioneMezzo,
  trovaUtilizzoMezzo,
  messaggioAvvisoMezzoInUso,
  messaggioConfermaMezzoInUso,
  mezzoGiaDellEntitaInModifica,
  aggiornaAvvisoSottoTendina,
  confermaSalvataggioMezzoInUso,
  ensureAvvisoElement
} from '../core/js/mezzo-in-uso-avviso.js';

describe('mezzo-in-uso-avviso (B6)', () => {
  it('etichetta: trattore in uso resta con testo leggibile «— in uso»', () => {
    expect(etichettaOpzioneMezzo('Fiat 100 (100 CV)', { stato: 'in_uso' }))
      .toBe('Fiat 100 (100 CV) — in uso');
    expect(etichettaOpzioneMezzo('Fiat 100', { stato: 'disponibile' }))
      .toBe('Fiat 100');
    expect(isMezzoInUso({ stato: 'in-uso' })).toBe(true);
  });

  it('trovaUtilizzoMezzo: attività senza fine; esclude attività in modifica', () => {
    const attivita = [
      { id: 'a1', macchinaId: 't1', tipoLavoro: 'Erpicatura', terrenoNome: 'Campo Nord', data: '2026-11-03', orarioInizio: '08:00' },
      { id: 'a2', macchinaId: 't1', tipoLavoro: 'Altro', orarioFine: '12:00', orarioInizio: '09:00' }
    ];
    const u = trovaUtilizzoMezzo('t1', { attivita, escludiAttivitaId: null });
    expect(u.titolo).toContain('Erpicatura');
    expect(u.titolo).toContain('Campo Nord');
    expect(trovaUtilizzoMezzo('t1', { attivita, escludiAttivitaId: 'a1' })).toBeNull();
  });

  it('messaggio avviso con nome attività; fallback generico', () => {
    const msg = messaggioAvvisoMezzoInUso({
      tipo: 'attivita',
      titolo: 'Erpicatura – Campo Nord',
      data: '2026-11-03',
      orario: '08:00'
    });
    expect(msg).toContain('Erpicatura – Campo Nord');
    expect(msg).toContain('03/11/2026');
    expect(msg).toContain('8:00'.replace('8:00', '08:00'));
    expect(messaggioAvvisoMezzoInUso(null)).toBe('Questo trattore risulta già in uso.');
  });

  it('nessun avviso se mezzo già dell\'entità in modifica', () => {
    expect(mezzoGiaDellEntitaInModifica('t1', { macchinaIdCorrente: 't1' })).toBe(true);
    expect(mezzoGiaDellEntitaInModifica('t1', { macchinaIdCorrente: 't2' })).toBe(false);
  });

  it('jsdom: select in_uso non disabled; selezione mostra avviso; libero no', () => {
    document.body.innerHTML = '<div class="form-group"><select id="attivita-macchina"><option value="">--</option></select></div>';
    const select = document.getElementById('attivita-macchina');
    const opt = document.createElement('option');
    opt.value = 't1';
    opt.textContent = etichettaOpzioneMezzo('Trattore X', { stato: 'in_uso' });
    opt.disabled = false;
    select.appendChild(opt);
    expect(opt.disabled).toBe(false);
    expect(opt.textContent).toContain('— in uso');

    select.value = 't1';
    aggiornaAvvisoSottoTendina(select, { id: 't1', stato: 'in_uso', nome: 'Trattore X' }, {
      utilizzo: { tipo: 'attivita', titolo: 'Erpicatura – Campo Nord', data: '2026-11-03', orario: '08:00' },
      tipoMezzo: 'trattore'
    });
    const avviso = document.getElementById('attivita-macchina-in-uso-avviso');
    expect(avviso).toBeTruthy();
    expect(avviso.style.display).toBe('block');
    expect(avviso.textContent).toContain('Erpicatura – Campo Nord');

    aggiornaAvvisoSottoTendina(select, { id: 't2', stato: 'disponibile' }, { silenzioso: false, tipoMezzo: 'trattore' });
    expect(avviso.style.display).toBe('none');
  });

  it('conferma salvataggio: OK salva, Annulla no; silenzioso se non in uso', () => {
    const ok = confermaSalvataggioMezzoInUso({ nome: 'X', stato: 'in_uso' }, { confirmFn: () => true });
    const no = confermaSalvataggioMezzoInUso({ nome: 'X', stato: 'in_uso' }, { confirmFn: () => false });
    const libero = confermaSalvataggioMezzoInUso({ nome: 'Y', stato: 'disponibile' }, { confirmFn: vi.fn() });
    expect(ok).toBe(true);
    expect(no).toBe(false);
    expect(libero).toBe(true);
    expect(messaggioConfermaMezzoInUso('X')).toContain('già in uso');
    expect(ensureAvvisoElement(document.createElement('select'))).toBeNull();
  });
});
