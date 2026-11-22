/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dati = path.join(root, 'shared/data/fitofarmaci-etichette');
const folpan = JSON.parse(readFileSync(path.join(dati, 'per-registrazione/008601.json'), 'utf8'));
const indice = JSON.parse(readFileSync(path.join(dati, 'indice.json'), 'utf8'));
const vocabolario = JSON.parse(readFileSync(path.join(dati, 'colture-vocabolario.json'), 'utf8'));

vi.mock('../shared/js/registro-trattamenti-passaggi.js', async () => {
  const actual = await vi.importActual('../shared/js/registro-trattamenti-passaggi.js');
  return {
    ...actual,
    contestoRegistroTerreno: async () => ({ specie: 'vite da vino', passaggi: [] })
  };
});

vi.mock('../modules/magazzino/services/prodotti-service.js', () => ({
  getAllProdotti: async () => []
}));

function fetchMock(url) {
  const u = String(url);
  let json = null;
  if (u.includes('indice.json')) json = indice;
  else if (u.includes('colture-vocabolario')) json = vocabolario;
  else if (u.includes('008601')) json = folpan;
  if (!json) return Promise.resolve({ ok: false, json: async () => null });
  return Promise.resolve({ ok: true, json: async () => json });
}

function formLavoro(tipo = 'Trattamento fitosanitario') {
  document.body.innerHTML = `
    <form id="lavoro-form">
      <input id="lavoro-id" value="">
      <select id="lavoro-tipo-lavoro"><option value="${tipo}">${tipo}</option></select>
      <select id="lavoro-terreno"><option value="t1">Vigna</option></select>
      <input id="lavoro-data-inizio" value="2026-08-01">
      <div id="lavoro-avviso-carenza" hidden></div>
      <div id="lavoro-miscela-section">
        <div id="lavoro-semaforo-banner" hidden></div>
        <select id="lavoro-miscela-prodotto"><option value="">— Nessun prodotto —</option></select>
        <input id="lavoro-miscela-nome" value="FOLPAN 80 WDG">
        <button type="button" class="btn btn-sm btn-secondary btn-leggi-scheda" id="btn-leggi-scheda-miscela">Leggi scheda</button>
        <button type="button" id="btn-miscela-aggiungi">Aggiungi</button>
        <div id="lavoro-scheda-esito"></div>
        <select id="lavoro-miscela-avversita"><option value="">— da scegliere —</option></select>
        <input id="lavoro-miscela-dose-ha" value="">
        <span id="lavoro-semaforo-riga"></span>
        <p id="lavoro-dose-etichetta"></p>
        <p id="lavoro-miscela-anteprima"></p>
        <p id="lavoro-registro-avviso"></p>
        <table><tbody id="tbody-miscela-lavoro"></tbody></table>
      </div>
    </form>`;
  document.getElementById('lavoro-tipo-lavoro').selectedIndex = 0;
  document.getElementById('lavoro-terreno').value = 't1';
}

describe('semaforo nel modale lavoro', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    formLavoro();
  });

  it('il banner compare solo con un tipo trattamento e la dose non si precompila', async () => {
    const { aggiornaSemaforoPianificazione } = await import('../shared/js/registro-trattamenti-lavoro-semaforo.js');
    document.getElementById('lavoro-miscela-dose-ha').value = '';
    await aggiornaSemaforoPianificazione({
      specie: 'vite da vino',
      terrenoId: 't1',
      data: '2026-08-01',
      precedenti: [],
      prodotti: []
    });
    const banner = document.getElementById('lavoro-semaforo-banner');
    expect(banner.hidden).toBe(false);
    expect(banner.innerHTML).toContain('gfv-semaforo-banner');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('');
    const select = document.getElementById('lavoro-miscela-avversita');
    expect(select.innerHTML).toContain('Peronospora');
    formLavoro('Potatura');
    await aggiornaSemaforoPianificazione({ specie: 'vite da vino' });
    expect(document.getElementById('lavoro-semaforo-banner').hidden).toBe(true);
  });
});

describe('miscelaPrevistaPerSalvataggio', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    formLavoro();
    document.getElementById('lavoro-miscela-dose-ha').value = '3';
    const select = document.getElementById('lavoro-miscela-avversita');
    const opt = document.createElement('option');
    opt.value = 'Peronospora (Plasmopara viticola)';
    opt.textContent = 'Peronospora (Plasmopara viticola)';
    select.appendChild(opt);
    select.value = opt.value;
  });

  it('con esito rosso chiede conferma e salva l\'avversità solo se si accetta', async () => {
    const { miscelaPrevistaPerSalvataggio } = await import('../core/admin/js/gestione-lavori-events.js');
    const state = { terreniList: [{ id: 't1', superficie: 1 }], attrezziList: [], lavoriList: [] };
    const rifiuto = await miscelaPrevistaPerSalvataggio(state, 't1', '2026-08-01', 'Trattamento fitosanitario', null, {
      confirmFn: (testo) => {
        expect(testo.startsWith('Il trattamento pianificato non è conforme all\'etichetta:')).toBe(true);
        return false;
      }
    });
    expect(rifiuto.annullato).toBe(true);
    const accetto = await miscelaPrevistaPerSalvataggio(state, 't1', '2026-08-01', 'Trattamento fitosanitario', null, {
      confirmFn: () => true
    });
    expect(accetto.annullato).toBe(false);
    expect(accetto.miscela.prodotti[0].avversitaPianificata).toBe('Peronospora (Plasmopara viticola)');
    expect(accetto.miscela.prodotti[0].avversita).toBeUndefined();
    expect(accetto.miscela.prodotti[0].dosePerEttaro).toBe(3);
  });

  it('in modifica conserva l\'avversità anche se la tendina non ha ancora le voci', async () => {
    const { miscelaPrevistaPerSalvataggio } = await import('../core/admin/js/gestione-lavori-events.js');
    const select = document.getElementById('lavoro-miscela-avversita');
    select.value = '';
    select.setAttribute('data-avversita', 'Peronospora (Plasmopara viticola)');
    document.getElementById('lavoro-miscela-dose-ha').value = '3';
    let chiesto = false;
    const esito = await miscelaPrevistaPerSalvataggio(
      { terreniList: [{ id: 't1', superficie: 1 }], attrezziList: [], lavoriList: [] },
      't1',
      '2026-08-01',
      'Trattamento fitosanitario',
      null,
      {
        stato: 'assegnato',
        lavoroOriginale: {
          terrenoId: 't1',
          dataInizio: '2026-08-01',
          stato: 'assegnato',
          miscelaPrevista: {
            prodotti: [{
              nome: 'FOLPAN 80 WDG',
              dosePerEttaro: 3,
              avversitaPianificata: 'Peronospora (Plasmopara viticola)'
            }]
          },
          conformitaPianificazione: { colore: 'rosso', confermatoIl: '2026-08-01T00:00:00.000Z' }
        },
        confirmFn: () => {
          chiesto = true;
          return false;
        }
      }
    );
    expect(chiesto).toBe(false);
    expect(esito.annullato).toBe(false);
    expect(esito.miscela.prodotti[0].avversitaPianificata).toBe('Peronospora (Plasmopara viticola)');
    expect(esito.miscela.prodotti[0].avversita).toBeUndefined();
  });
});

describe('letture e apertura', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  it('più eventi ravvicinati fanno una sola lettura e un lavoro non trattamento non legge', async () => {
    const {
      chiudiSemaforoPianificazione,
      collegaSemaforoPianificazione
    } = await import('../shared/js/registro-trattamenti-lavoro-semaforo.js');
    chiudiSemaforoPianificazione();
    formLavoro();
    const nome = document.createElement('input');
    nome.id = 'lavoro-nome';
    document.getElementById('lavoro-form').appendChild(nome);
    const leggi = vi.fn(async () => ({ specie: 'vite da vino', prodotti: [], precedenti: [], terreni: [] }));
    collegaSemaforoPianificazione(leggi);
    vi.useFakeTimers();
    nome.value = 'nota libera';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    const dose = document.getElementById('lavoro-miscela-dose-ha');
    dose.value = '1';
    dose.dispatchEvent(new Event('input', { bubbles: true }));
    dose.value = '2';
    dose.dispatchEvent(new Event('input', { bubbles: true }));
    dose.value = '3';
    dose.dispatchEvent(new Event('input', { bubbles: true }));
    expect(leggi).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(leggi).toHaveBeenCalledTimes(1);
    vi.useRealTimers();

    chiudiSemaforoPianificazione();
    formLavoro('Potatura');
    const leggiPotatura = vi.fn(async () => ({}));
    collegaSemaforoPianificazione(leggiPotatura);
    vi.useFakeTimers();
    document.getElementById('lavoro-miscela-dose-ha').dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(400);
    expect(leggiPotatura).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('all\'apertura il banner compare subito e si azzera alla chiusura', async () => {
    const {
      chiudiSemaforoPianificazione,
      chiediSemaforoPianificazione,
      collegaSemaforoPianificazione
    } = await import('../shared/js/registro-trattamenti-lavoro-semaforo.js');
    const { aggiornaAvvisoCarenzaRaccolta, azzeraBoxCarenza, scriviBoxCarenza } = await import('../shared/js/avviso-carenza-raccolta.js');
    chiudiSemaforoPianificazione();
    formLavoro();
    document.getElementById('lavoro-miscela-dose-ha').value = '3';
    const leggi = vi.fn(async () => ({
      specie: 'vite da vino',
      prodotti: [],
      precedenti: [],
      terreni: [{ id: 't1', superficie: 1 }],
      terrenoId: 't1',
      data: '2026-08-01'
    }));
    collegaSemaforoPianificazione(leggi);
    await chiediSemaforoPianificazione({ subito: true });
    const banner = document.getElementById('lavoro-semaforo-banner');
    expect(leggi).toHaveBeenCalledTimes(1);
    expect(banner.hidden).toBe(false);
    expect(banner.innerHTML).toMatch(/fuori dall'intervallo|data-colore="rosso"/);
    const box = document.getElementById('lavoro-avviso-carenza');
    scriviBoxCarenza(box, { testo: 'avviso vecchio' });
    azzeraBoxCarenza(box);
    expect(box.hidden).toBe(true);
    expect(box.textContent).toBe('');
    await aggiornaAvvisoCarenzaRaccolta({
      box,
      dataRaccolta: '2026-08-20',
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti: [{
        data: '2026-08-15',
        prodotti: [{ prodotto: 'FOLPAN 80 WDG', avversita: 'Peronospora (Plasmopara viticola)', dosaggio: 1.4 }]
      }],
      lavori: []
    });
    expect(box.textContent).toContain('12/09/2026');
    chiudiSemaforoPianificazione();
    azzeraBoxCarenza(box);
    expect(banner.hidden).toBe(true);
    expect(banner.innerHTML).toBe('');
    expect(box.textContent).toBe('');

    formLavoro('Potatura');
    const leggiSeconda = vi.fn(async () => ({}));
    collegaSemaforoPianificazione(leggiSeconda);
    await chiediSemaforoPianificazione({ subito: true });
    expect(leggiSeconda).not.toHaveBeenCalled();
    expect(document.getElementById('lavoro-semaforo-banner').hidden).toBe(true);
  });
});

describe('diario carenza', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    document.body.innerHTML = `
      <form id="attivita-form">
        <input id="attivita-data" value="2026-09-01">
        <div id="avviso-carenza-attivita" hidden></div>
        <select id="attivita-terreno"><option value="t1">Vigna</option></select>
        <select id="attivita-tipo-lavoro"><option value="Vendemmia manuale">Vendemmia manuale</option></select>
        <select id="attivita-tipo-lavoro-gerarchico"></select>
      </form>`;
  });

  it('mostra la data in gg/mm/aaaa e non chiede conferma', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { scriviBoxCarenza } = await import('../shared/js/avviso-carenza-raccolta.js');
    const { avvisoCarenzaRaccolta } = await import('../shared/js/semaforo-etichetta-pianificazione.js');
    const esito = avvisoCarenzaRaccolta({
      dataRaccolta: '2026-09-01',
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti: [{
        id: 't',
        data: '2026-08-15',
        prodotti: [{ prodotto: 'FOLPAN 80 WDG', avversita: 'Peronospora (Plasmopara viticola)' }]
      }],
      vocabolario,
      schedaPerRiga: () => folpan
    });
    const box = document.getElementById('avviso-carenza-attivita');
    scriviBoxCarenza(box, esito);
    expect(box.hidden).toBe(false);
    expect(box.textContent).toContain('12/09/2026');
    scriviBoxCarenza(box, avvisoCarenzaRaccolta({ trattamenti: [], verbo: 'raccogliere' }));
    document.getElementById('attivita-tipo-lavoro').innerHTML = '<option value="Potatura">Potatura</option>';
    const { tipoLavoroRaccolta } = await import('../shared/js/semaforo-etichetta-pianificazione.js');
    if (!tipoLavoroRaccolta(document.getElementById('attivita-tipo-lavoro').value).eRaccolta) {
      scriviBoxCarenza(box, null);
    }
    expect(box.hidden).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('nome libero: Leggi scheda aggancia Folpan, semaforo e riapertura senza conferma', async () => {
    const { attaccaLeggiSchedaLavoro, componiMiscelaDalForm, scriviMiscelaNelForm } = await import('../shared/js/registro-trattamenti-lavoro.js');
    const { aggiornaSemaforoPianificazione } = await import('../shared/js/registro-trattamenti-lavoro-semaforo.js');
    const { rigaHaConferma, righeTrattamentoDaMiscela } = await import('../shared/js/registro-trattamenti.js');
    const { cercaProdottiEtichetta } = await import('../shared/js/registro-trattamenti-conformita.js');
    formLavoro();
    document.getElementById('lavoro-miscela-nome').value = 'Folpan';
    document.getElementById('lavoro-miscela-dose-ha').value = '3';
    attaccaLeggiSchedaLavoro();
    const ctx = {
      specie: 'vite da vino',
      terrenoId: 't1',
      data: '2026-08-01',
      precedenti: [],
      prodotti: [],
      terreni: [{ id: 't1', superficie: 1 }]
    };
    const prima = await aggiornaSemaforoPianificazione(ctx);
    expect(prima.colore).toBe('grigio');
    expect(document.getElementById('lavoro-semaforo-banner').textContent).toContain('Leggi scheda');
    expect(document.getElementById('btn-leggi-scheda-miscela').textContent).toContain('Leggi scheda');
    expect(cercaProdottiEtichetta('Folpan', indice).map((p) => p.numero_registrazione)).toContain('008601');

    document.getElementById('btn-leggi-scheda-miscela').click();
    await vi.waitFor(() => {
      expect(document.querySelector('#lavoro-scheda-esito [data-scegli-prodotto]')).toBeTruthy();
    });
    expect(document.getElementById('lavoro-scheda-esito').textContent).toContain('FOLPAN 80 WDG');
    expect(document.getElementById('lavoro-scheda-esito').textContent).toContain('008601');
    document.querySelector('#lavoro-scheda-esito [data-scegli-prodotto]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('lavoro-miscela-nome').getAttribute('data-numero-registrazione')).toBe('008601');
    });
    expect(document.getElementById('lavoro-miscela-nome').value).toBe('Folpan');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('3');

    const rosso = await aggiornaSemaforoPianificazione(ctx);
    expect(rosso.colore).toBe('rosso');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('3');
    const select = document.getElementById('lavoro-miscela-avversita');
    expect(select.innerHTML).toContain('Peronospora');
    const voce = Array.from(select.options).find((opt) => /peronospora/i.test(opt.textContent));
    select.value = voce.value;
    select.setAttribute('data-avversita', voce.value);
    document.getElementById('lavoro-miscela-dose-ha').value = '1.4';
    const verde = await aggiornaSemaforoPianificazione(ctx);
    expect(verde.colore).toBe('verde');
    expect(document.getElementById('lavoro-dose-etichetta').textContent).toContain('Da etichetta');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('1.4');

    const miscela = componiMiscelaDalForm(1, null);
    const nata = righeTrattamentoDaMiscela(miscela, 1).prodotti[0];
    expect(nata.numeroRegistrazioneLetto).toBe('008601');
    expect(nata.riferimentoRiga.nomeProdotto).toBe('FOLPAN 80 WDG');
    expect(nata.avversitaPianificata).toContain('Peronospora');
    expect(nata.avversita).toBeUndefined();
    expect(rigaHaConferma(nata)).toBe(false);

    formLavoro();
    document.getElementById('lavoro-miscela-nome').value = '';
    scriviMiscelaNelForm(miscela);
    expect(document.getElementById('lavoro-miscela-nome').value).toBe('Folpan');
    expect(document.getElementById('lavoro-miscela-nome').getAttribute('data-numero-registrazione')).toBe('008601');
    expect(document.getElementById('lavoro-miscela-nome').getAttribute('data-nome-scheda')).toBe('FOLPAN 80 WDG');
    expect(document.getElementById('lavoro-miscela-avversita').getAttribute('data-avversita')).toContain('Peronospora');
    const riaperto = await aggiornaSemaforoPianificazione(ctx);
    expect(document.getElementById('lavoro-miscela-avversita').value).toContain('Peronospora');
    expect(riaperto.colore).toBe('verde');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('1.4');

    scriviMiscelaNelForm({
      prodotti: [
        miscela.prodotti[0],
        { nome: 'Altro libero', dosePerEttaro: 1 }
      ]
    });
    const extra = document.querySelector('#tbody-miscela-lavoro .btn-leggi-scheda');
    expect(extra).toBeTruthy();
    expect(extra.textContent).toContain('Leggi scheda');

    const sel = document.getElementById('lavoro-miscela-prodotto');
    sel.innerHTML = '<option value="">— Nessun prodotto —</option><option value="p1">Prodotto a magazzino</option>';
    sel.value = 'p1';
    document.getElementById('lavoro-miscela-nome').setAttribute('data-numero-registrazione', '008601');
    const daMagazzino = componiMiscelaDalForm(1, null).prodotti[0];
    expect(daMagazzino.prodottoId).toBe('p1');
    expect(daMagazzino.numeroRegistrazioneLetto).toBeUndefined();
  });

  it('cambiare il nome a mano stacca il legame e il semaforo torna grigio', async () => {
    const { attaccaLeggiSchedaLavoro, componiMiscelaDalForm, scriviMiscelaNelForm } = await import('../shared/js/registro-trattamenti-lavoro.js');
    const { aggiornaSemaforoPianificazione } = await import('../shared/js/registro-trattamenti-lavoro-semaforo.js');
    formLavoro();
    const nome = document.getElementById('lavoro-miscela-nome');
    nome.value = 'Folpan';
    document.getElementById('lavoro-miscela-dose-ha').value = '1.4';
    attaccaLeggiSchedaLavoro();
    const ctx = {
      specie: 'vite da vino',
      terrenoId: 't1',
      data: '2026-08-01',
      precedenti: [],
      prodotti: [],
      terreni: [{ id: 't1', superficie: 1 }]
    };
    document.getElementById('btn-leggi-scheda-miscela').click();
    await vi.waitFor(() => {
      expect(document.querySelector('#lavoro-scheda-esito [data-scegli-prodotto]')).toBeTruthy();
    });
    document.querySelector('#lavoro-scheda-esito [data-scegli-prodotto]').click();
    await vi.waitFor(() => {
      expect(nome.getAttribute('data-numero-registrazione')).toBe('008601');
    });
    expect(nome.getAttribute('data-nome-legato')).toBe('Folpan');
    const select = document.getElementById('lavoro-miscela-avversita');
    await aggiornaSemaforoPianificazione(ctx);
    const voce = Array.from(select.options).find((opt) => /peronospora/i.test(opt.textContent));
    select.value = voce.value;
    select.setAttribute('data-avversita', voce.value);
    const verde = await aggiornaSemaforoPianificazione(ctx);
    expect(verde.colore).toBe('verde');
    expect(document.getElementById('lavoro-dose-etichetta').textContent).toContain('Da etichetta');
    const agganciata = componiMiscelaDalForm(1, null);

    nome.value = 'Folpan';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    expect(nome.getAttribute('data-numero-registrazione')).toBe('008601');
    expect(document.getElementById('lavoro-scheda-esito').textContent).toContain('FOLPAN 80 WDG');
    nome.value = '  FOLPAN  ';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    expect(nome.getAttribute('data-numero-registrazione')).toBe('008601');
    expect(nome.getAttribute('data-nome-scheda')).toBe('FOLPAN 80 WDG');
    expect(componiMiscelaDalForm(1, null).prodotti[0].numeroRegistrazioneLetto).toBe('008601');

    nome.value = 'Rame';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    expect(nome.getAttribute('data-numero-registrazione')).toBeNull();
    expect(nome.getAttribute('data-nome-scheda')).toBeNull();
    expect(nome.getAttribute('data-nome-legato')).toBeNull();
    expect(document.getElementById('lavoro-scheda-esito').innerHTML).toBe('');
    expect(document.getElementById('lavoro-dose-etichetta').textContent).toBe('');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('1.4');
    const staccata = componiMiscelaDalForm(1, null).prodotti[0];
    expect(staccata.nome).toBe('Rame');
    expect(staccata.numeroRegistrazioneLetto).toBeUndefined();
    expect(staccata.riferimentoRiga).toBeUndefined();
    const grigio = await aggiornaSemaforoPianificazione(ctx);
    expect(grigio.colore).toBe('grigio');
    expect(document.getElementById('lavoro-semaforo-banner').textContent).toContain('Leggi scheda');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('1.4');

    nome.value = 'Folpan';
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    expect(nome.getAttribute('data-numero-registrazione')).toBeNull();
    expect(componiMiscelaDalForm(1, null).prodotti[0].numeroRegistrazioneLetto).toBeUndefined();
    const ancoraGrigio = await aggiornaSemaforoPianificazione(ctx);
    expect(ancoraGrigio.colore).toBe('grigio');

    formLavoro();
    attaccaLeggiSchedaLavoro();
    scriviMiscelaNelForm(agganciata);
    const riaperto = document.getElementById('lavoro-miscela-nome');
    expect(riaperto.value).toBe('Folpan');
    expect(riaperto.getAttribute('data-nome-legato')).toBe('Folpan');
    expect(riaperto.getAttribute('data-numero-registrazione')).toBe('008601');
    riaperto.dispatchEvent(new Event('input', { bubbles: true }));
    expect(riaperto.getAttribute('data-numero-registrazione')).toBe('008601');
    expect(componiMiscelaDalForm(1, null).prodotti[0].numeroRegistrazioneLetto).toBe('008601');
    riaperto.value = 'Rame';
    riaperto.dispatchEvent(new Event('input', { bubbles: true }));
    expect(riaperto.getAttribute('data-numero-registrazione')).toBeNull();
    expect(componiMiscelaDalForm(1, null).prodotti[0].numeroRegistrazioneLetto).toBeUndefined();
  });

  it('scegliere un prodotto di magazzino toglie il legame libero', async () => {
    const { installaMiscelaLavoro } = await import('../shared/js/registro-trattamenti-lavoro.js');
    formLavoro();
    installaMiscelaLavoro();
    const nome = document.getElementById('lavoro-miscela-nome');
    nome.value = 'Folpan';
    nome.setAttribute('data-numero-registrazione', '008601');
    nome.setAttribute('data-nome-scheda', 'FOLPAN 80 WDG');
    nome.setAttribute('data-nome-legato', 'Folpan');
    const sel = document.getElementById('lavoro-miscela-prodotto');
    sel.innerHTML = '<option value="">— Nessun prodotto —</option><option value="p1">Prodotto a magazzino</option>';
    sel.value = 'p1';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nome.getAttribute('data-numero-registrazione')).toBeNull();
    expect(nome.getAttribute('data-nome-scheda')).toBeNull();
    expect(nome.getAttribute('data-nome-legato')).toBeNull();

    nome.setAttribute('data-numero-registrazione', '008601');
    nome.setAttribute('data-nome-scheda', 'FOLPAN 80 WDG');
    nome.setAttribute('data-nome-legato', 'Folpan');
    document.getElementById('lavoro-miscela-dose-ha').value = '1';
    document.getElementById('btn-miscela-aggiungi').click();
    const extra = document.querySelector('#tbody-miscela-lavoro tr[data-extra]');
    expect(extra.getAttribute('data-prodotto-id')).toBe('p1');
    expect(extra.getAttribute('data-nome')).toBe('Prodotto a magazzino');
    expect(extra.getAttribute('data-numero-registrazione')).toBeNull();
    expect(extra.getAttribute('data-nome-scheda')).toBeNull();
    expect(nome.getAttribute('data-numero-registrazione')).toBeNull();
  });

  it('in Conto Terzi il box non compare', async () => {
    const { installaAvvisoCarenzaAttivita } = await import('../shared/js/avviso-carenza-raccolta.js');
    installaAvvisoCarenzaAttivita({ contoTerzi: () => true });
    document.getElementById('attivita-data').dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('avviso-carenza-attivita').hidden).toBe(true);
  });
});
