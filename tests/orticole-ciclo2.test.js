/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applicaAvvisoTerreniOrtive } from '../modules/orticole/js/avviso-terreni-ortive.js';
import {
  leggiOperatoreDalForm,
  mostraOperatoreNelForm,
  operatoreDaLavoro,
  riconosciOperatore
} from '../shared/js/registro-operatore.js';
import {
  htmlPannelloOpenData,
  nomeProdottoPerRicercaScheda,
  richiestaLetturaScheda
} from '../shared/js/registro-trattamenti-form.js';
import {
  caricaProdottiMiscelaNelForm,
  installaMiscelaLavoro,
  MESSAGGIO_ERRORE_PRODOTTI_MISCELA,
  notificaSezioneMiscelaSeVisibile,
  registraCaricamentoProdottiMiscela
} from '../shared/js/registro-trattamenti-lavoro.js';

const PERSONE = [
  { id: 'capo-1', nome: 'Mario', cognome: 'Rossi' },
  { id: 'op-2', nome: 'Lucia', cognome: 'Bianchi' }
];

function domLavoro({ tipo = '', sezione = 'none', disabled = false } = {}) {
  document.body.innerHTML = `
    <form id="lavoro-form">
      <select id="lavoro-categoria-principale"><option value="cat">Trattamenti</option></select>
      <select id="lavoro-sottocategoria"><option value="sub">Fitosanitari</option></select>
      <select id="lavoro-tipo-lavoro">
        <option value="">-- Seleziona tipo lavoro --</option>
        <option ${tipo ? 'selected' : ''}>${tipo}</option>
      </select>
      <div id="lavoro-miscela-section" style="display:${sezione}">
        <div id="lavoro-miscela-prodotto-group">
          <select id="lavoro-miscela-prodotto" ${disabled ? 'disabled' : ''}>
            <option value="">— Nessun prodotto —</option>
          </select>
        </div>
      </div>
    </form>`;
}

let caricamentoPrecedente = null;

beforeEach(() => {
  caricamentoPrecedente = registraCaricamentoProdottiMiscela(null);
});

afterEach(() => {
  registraCaricamentoProdottiMiscela(caricamentoPrecedente);
  caricamentoPrecedente = null;
  document.body.innerHTML = '';
});

describe('ciclo 2 — tendina prodotti miscela', () => {
  it('tipo impostato senza change: la sezione visibile ricarica i prodotti', async () => {
    domLavoro({ tipo: 'Trattamento Anticrittogamico Meccanico' });
    const carica = vi.fn();
    registraCaricamentoProdottiMiscela(carica);
    notificaSezioneMiscelaSeVisibile();
    expect(document.getElementById('lavoro-miscela-section').style.display).toBe('block');
    expect(carica).toHaveBeenCalledTimes(1);
  });

  it('cambio sottocategoria mostra la sezione e ricarica, senza change sul tipo', () => {
    domLavoro({ tipo: 'Trattamento fogliare' });
    const carica = vi.fn();
    registraCaricamentoProdottiMiscela(carica);
    installaMiscelaLavoro();
    document.getElementById('lavoro-sottocategoria').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('lavoro-miscela-section').style.display).toBe('block');
    expect(carica).toHaveBeenCalled();
  });

  it('caricamento saltato a sezione nascosta, poi riprovato quando il tipo è un trattamento', async () => {
    domLavoro();
    const getProdotti = vi.fn(async () => [{ id: 'p1', nome: 'Sivanto Prime', attivo: true }]);
    const saltato = await caricaProdottiMiscelaNelForm({ getProdotti });
    expect(saltato.esito).toBe('saltato');
    expect(getProdotti).not.toHaveBeenCalled();
    expect(document.getElementById('lavoro-miscela-section').dataset.prodottiSaltati).toBe('1');

    const tipo = document.getElementById('lavoro-tipo-lavoro');
    tipo.innerHTML = '<option selected>Trattamento fogliare</option>';
    const ok = await caricaProdottiMiscelaNelForm({ getProdotti });
    expect(ok.esito).toBe('ok');
    expect(document.getElementById('lavoro-miscela-prodotto').textContent).toContain('Sivanto Prime');
    expect(document.getElementById('lavoro-miscela-section').dataset.prodottiSaltati).toBeUndefined();
  });

  it('select disabilitata salta; appena è abilitata la tendina si riempie', async () => {
    domLavoro({ tipo: 'Trattamento fogliare', sezione: 'block', disabled: true });
    const getProdotti = vi.fn(async () => [{ id: 'p1', nome: 'Rame', attivo: true }]);
    expect((await caricaProdottiMiscelaNelForm({ getProdotti })).esito).toBe('saltato');
    document.getElementById('lavoro-miscela-prodotto').disabled = false;
    expect((await caricaProdottiMiscelaNelForm({ getProdotti })).esito).toBe('ok');
    expect(document.getElementById('lavoro-miscela-prodotto').textContent).toContain('Rame');
  });

  it('se il magazzino non risponde mostra il messaggio e lascia il nome a mano', async () => {
    domLavoro({ tipo: 'Trattamento fogliare', sezione: 'block' });
    const esito = await caricaProdottiMiscelaNelForm({
      getProdotti: async () => { throw new Error('rete'); }
    });
    expect(esito.esito).toBe('errore');
    const avviso = document.getElementById('lavoro-miscela-prodotti-errore');
    expect(avviso.textContent).toBe(MESSAGGIO_ERRORE_PRODOTTI_MISCELA);
    expect(avviso.style.display).toBe('block');
  });
});

describe('ciclo 2 — operatore', () => {
  it('preferisce il caposquadra e poi l\'operaio', () => {
    expect(operatoreDaLavoro({ caposquadraId: 'capo-1', operaioId: 'op-2' })).toBe('capo-1');
    expect(operatoreDaLavoro({ caposquadraId: '', operaioId: 'op-2' })).toBe('op-2');
    expect(operatoreDaLavoro(null)).toBeNull();
  });

  it('riconosce id, nome e testo libero', async () => {
    expect(riconosciOperatore('capo-1', PERSONE).tipo).toBe('elenco');
    expect(riconosciOperatore('Lucia Bianchi', PERSONE)).toMatchObject({ tipo: 'elenco', id: 'op-2' });
    expect(riconosciOperatore('Pinco Pallo', PERSONE)).toMatchObject({ tipo: 'altro', testo: 'Pinco Pallo' });

    document.body.innerHTML = '<select id="trattamento-operatore"></select>';
    await mostraOperatoreNelForm('capo-1', { persone: PERSONE, risolviNome: null });
    expect(document.getElementById('trattamento-operatore').value).toBe('capo-1');
    expect(leggiOperatoreDalForm()).toBe('Mario Rossi');

    await mostraOperatoreNelForm('Lucia Bianchi', { persone: PERSONE, risolviNome: null });
    expect(document.getElementById('trattamento-operatore').value).toBe('op-2');

    await mostraOperatoreNelForm('Pinco Pallo', { persone: PERSONE, risolviNome: null });
    expect(document.getElementById('trattamento-operatore').value).toBe('__altro__');
    const altro = document.getElementById('trattamento-operatore-altro');
    expect(altro.value).toBe('Pinco Pallo');
    expect(altro.autocomplete).toBe('off');
    expect(leggiOperatoreDalForm()).toBe('Pinco Pallo');
  });
});

describe('ciclo 2 — leggi scheda', () => {
  it('normalizza il nome di magazzino con prefisso e confezione', () => {
    expect(nomeProdottoPerRicercaScheda('Inse. SIVANTO PRIME da 1 lt.').toLowerCase()).toBe('sivanto prime');
  });

  it('manda il numero di anagrafica, altrimenti il nome pulito', () => {
    const conNumero = richiestaLetturaScheda({
      nome: 'Inse. SIVANTO PRIME da 1 lt.',
      prodotto: { numeroRegistrazione: '16273' },
      specie: 'pomodoro'
    });
    expect(conNumero.numero).toBe('16273');
    expect(conNumero.numeroRegistrazione).toBe('16273');
    const senza = richiestaLetturaScheda({ nome: 'Inse. SIVANTO PRIME da 1 lt.' });
    expect(senza.numero).toBeUndefined();
    expect(senza.nome).toBe('SIVANTO PRIME');
    expect(senza.nome).not.toContain('Inse.');
  });

  it('senza candidati lascia il campo per il numero di registrazione', () => {
    const html = htmlPannelloOpenData({ esito: { prodotti: [] }, nome: 'Inse. SIVANTO PRIME da 1 lt.' });
    expect(html).toContain('Non trovo');
    expect(html).toContain('registro-numero-manuale');
    expect(html).toContain('data-riprova-numero');
    expect(html).not.toContain('data-conferma-manuale');
  });
});

describe('ciclo 2 — avviso terreni in pagina e nel modal', () => {
  it('compare con soli archiviati e sparisce con un terreno operativo', () => {
    document.body.innerHTML = '<div id="avviso-terreni-ortive" hidden></div><div id="avviso-terreni-ortive-modal" hidden></div>';
    applicaAvvisoTerreniOrtive([]);
    expect(document.querySelector('#avviso-terreni-ortive a').getAttribute('href')).toContain('terreni-standalone.html');
    expect(document.getElementById('avviso-terreni-ortive-modal').textContent).toContain('zucchina');
    applicaAvvisoTerreniOrtive([{ id: 't1', stato: 'attivo' }]);
    expect(document.getElementById('avviso-terreni-ortive').hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('avviso-terreni-ortive-modal').innerHTML).toBe('');
  });
});
