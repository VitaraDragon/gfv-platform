/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { showAlert } from '../core/js/gfv-page-utils.js';
import { selezionaRigheTrattamento } from '../modules/seminativo/models/SeminativoTrattamento.js';
import {
  apriConAvviso,
  bindAzioniLista,
  impiantiPerFiltro,
  impiantiPerInserimento,
  mostraArchiviatiSelezionato,
  nomeAppezzamentoConsumo,
  terreniPerFiltro
} from '../shared/js/filtri-storico.js';
import { htmlAzioniRegistro, isRegistroSolaLettura } from '../shared/js/storico-sola-lettura.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (rel) => readFileSync(join(root, rel), 'utf8');

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('schede trattamenti e storico archiviati', () => {
  it('Modifica e Completa partono dalla tabella e dalla scheda copiata', async () => {
    document.body.innerHTML = `
      <div id="table-wrap" class="table-container">
        <table>
          <tbody>
            <tr><td><button type="button" data-edit-row="0">Modifica</button></td></tr>
            <tr><td><button type="button" data-completa-row="2">Completa</button></td></tr>
          </tbody>
        </table>
        <div class="gfv-pelle-cards">
          <button type="button" data-edit-row="1">Modifica</button>
          <button type="button" data-completa-row="3">Completa</button>
        </div>
      </div>`;
    const visti = [];
    bindAzioniLista(document.getElementById('table-wrap'), {
      onEdit: (idx) => visti.push(['edit', idx]),
      onCompleta: (idx) => visti.push(['completa', idx])
    });
    click(document.querySelector('table [data-edit-row]'));
    click(document.querySelector('.gfv-pelle-cards [data-edit-row]'));
    click(document.querySelector('table [data-completa-row]'));
    click(document.querySelector('.gfv-pelle-cards [data-completa-row]'));
    await Promise.resolve();
    expect(visti).toEqual([
      ['edit', 0],
      ['edit', 1],
      ['completa', 2],
      ['completa', 3]
    ]);
  });

  it('un errore in apertura mostra un avviso, anche dalla scheda', async () => {
    document.body.innerHTML = `
      <div id="table-wrap">
        <div class="gfv-pelle-cards"><button type="button" data-edit-row="4">Modifica</button></div>
      </div>`;
    bindAzioniLista(document.getElementById('table-wrap'), {
      onEdit: () => { throw new Error('data illeggibile'); },
      onError: (err) => showAlert(err.message, 'error')
    });
    click(document.querySelector('.gfv-pelle-cards [data-edit-row]'));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById('gfv-standalone-toast-layer').textContent).toContain('data illeggibile');

    const visti = [];
    await apriConAvviso(() => { throw new Error('scheda non aperta'); }, (msg, tipo) => visti.push([msg, tipo]));
    expect(visti).toEqual([['scheda non aperta', 'error']]);
  });

  it('Mostra archiviati rimette chiusi e archiviati nel filtro, non nella tendina di inserimento', () => {
    document.body.innerHTML = '<input type="checkbox" id="filter-mostra-archiviati">';
    const impianti = [
      { id: 'aperto', statoImpianto: 'attivo' },
      { id: 'chiuso', statoImpianto: 'chiuso' }
    ];
    const terreni = [
      { id: 't-attivo', nome: 'Vigna', stato: 'attivo' },
      { id: 't-archivio', nome: 'S349', stato: 'archiviato' }
    ];
    expect(mostraArchiviatiSelezionato()).toBe(false);
    expect(impiantiPerFiltro(impianti, false).map((item) => item.id)).toEqual(['aperto']);
    expect(terreniPerFiltro(terreni, false).map((item) => item.id)).toEqual(['t-attivo']);
    expect(impiantiPerInserimento(impianti).map((item) => item.id)).toEqual(['aperto']);

    document.getElementById('filter-mostra-archiviati').checked = true;
    expect(mostraArchiviatiSelezionato()).toBe(true);
    expect(impiantiPerFiltro(impianti, true).map((item) => item.id)).toEqual(['aperto', 'chiuso']);
    expect(terreniPerFiltro(terreni, true).map((item) => item.id)).toEqual(['t-attivo', 't-archivio']);
    expect(impiantiPerInserimento(impianti).map((item) => item.id)).toEqual(['aperto']);
  });

  it('la riga di un terreno archiviato ha (archiviato) e resta in sola consultazione', () => {
    expect(nomeAppezzamentoConsumo(
      { nome: 'S349', stato: 'archiviato' },
      'nome copiato sul movimento'
    )).toBe('S349 (archiviato)');
    expect(nomeAppezzamentoConsumo({ nome: 'Vigna', stato: 'attivo' }, 'altro')).toBe('Vigna');
    expect(nomeAppezzamentoConsumo(null, 'S349 (archiviato)')).toBe('S349 (archiviato)');

    const righe = selezionaRigheTrattamento({
      terreni: [{ id: 't-archivio', nome: 'S349', stato: 'archiviato' }],
      nomiTipi: ['trattamento meccanico'],
      campagne: [{ id: 'c1', terrenoId: 't-archivio', campagna: '2025/2026', colturaNome: 'Grano' }],
      lavori: [{ id: 'l1', terrenoId: 't-archivio', stato: 'completato', tipoLavoro: 'Trattamento Meccanico', dataInizio: '2026-03-04' }]
    });
    expect(righe[0].terrenoNome).toContain(' (archiviato)');
    expect(isRegistroSolaLettura({
      terreno: { stato: 'archiviato' },
      impianto: { statoImpianto: 'attivo' }
    })).toBe(true);
    expect(htmlAzioniRegistro(true, '<button data-edit-row="0">Modifica</button>')).toContain('Solo consultazione');
  });

  it('le pagine usano la delega, l’avviso e il filtro, e la tendina di inserimento resta sugli aperti', () => {
    const pagina = leggi('shared/js/trattamenti-coltura-page.js');
    const seminativo = leggi('modules/seminativo/js/trattamenti-page.js');
    const consumi = leggi('modules/magazzino/views/tracciabilita-consumi-standalone.html');
    expect(pagina).toContain('bindAzioniLista(document.getElementById(\'table-wrap\')');
    expect(pagina).toContain('apriConAvviso(() => apriModificaTrattamento(idx), showAlert)');
    expect(pagina).toContain('impiantiPerFiltro(colture, mostraArchiviatiSelezionato())');
    expect(pagina).toContain('impiantiPerInserimento(colture)');
    expect(pagina).not.toContain('querySelectorAll(\'[data-edit-row]\')');
    expect(seminativo).toContain('bindAzioniLista(document.querySelector(\'.table-container\')');
    expect(seminativo).toContain('apriConAvviso(() => compilaModuloTrattamento(row)');
    expect(seminativo).toContain('terreniPerFiltro(terreni, mostraArchiviatiSelezionato())');
    expect(consumi).toContain('id="filter-mostra-archiviati"');
    expect(consumi).toContain('terreniPerFiltro(Object.values(terreniById), mostra)');
    expect(consumi).toContain('nomeAppezzamentoConsumo(terrenoAtt, a.terrenoNome)');
    expect(leggi('modules/vigneto/views/trattamenti-standalone.html')).toContain('Mostra archiviati');
    expect(leggi('modules/frutteto/views/trattamenti-standalone.html')).toContain('Mostra archiviati');
    expect(leggi('modules/seminativo/views/trattamenti-standalone.html')).toContain('Mostra archiviati');
  });
});
