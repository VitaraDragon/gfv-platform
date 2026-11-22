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
    expect(accetto.miscela.prodotti[0].avversita).toBe('Peronospora (Plasmopara viticola)');
    expect(accetto.miscela.prodotti[0].dosePerEttaro).toBe(3);
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

  it('in Conto Terzi il box non compare', async () => {
    const { installaAvvisoCarenzaAttivita } = await import('../shared/js/avviso-carenza-raccolta.js');
    installaAvvisoCarenzaAttivita({ contoTerzi: () => true });
    document.getElementById('attivita-data').dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('avviso-carenza-attivita').hidden).toBe(true);
  });
});
