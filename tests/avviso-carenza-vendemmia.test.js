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

const trattamento = {
  id: 'tr1',
  data: '2026-08-15',
  prodotti: [{
    prodotto: 'Folpan',
    dosaggio: 1.4,
    avversitaPianificata: 'Peronospora (Plasmopara viticola)',
    numeroRegistrazioneLetto: '008601',
    riferimentoRiga: {
      nomeProdotto: 'FOLPAN 80 WDG',
      numeroRegistrazione: '008601',
      colturaScheda: 'vite da vino'
    }
  }]
};

const getTrattamenti = vi.fn(async () => [trattamento]);

vi.mock('../modules/vigneto/services/trattamenti-vigneto-service.js', () => ({
  getTrattamenti: (...args) => getTrattamenti(...args)
}));

vi.mock('../core/services/lavori-service.js', () => ({
  getLavoriByTerreno: async () => []
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

describe('carenza in creazione vendemmia', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    getTrattamenti.mockReset();
    getTrattamenti.mockResolvedValue([trattamento]);
    document.body.innerHTML = `
      <form id="vendemmia-form">
        <select id="vignetoId"><option value="">—</option><option value="v1">Sangiovese</option></select>
        <input id="data" value="">
        <div id="avviso-carenza-raccolta" hidden></div>
      </form>`;
  });

  it('tiene il numero di registrazione e avvisa appena ci sono vigneto e data', async () => {
    const { caricaTrattamentiPerCarenza, installaAvvisoCarenzaVendemmia } = await import('../shared/js/avviso-carenza-raccolta.js');
    const letti = await caricaTrattamentiPerCarenza({ vignetoId: 'v1', terrenoId: 't1' });
    expect(letti[0].prodotti[0].numeroRegistrazioneLetto).toBe('008601');
    expect(letti[0].prodotti[0].riferimentoRiga.nomeProdotto).toBe('FOLPAN 80 WDG');

    document.getElementById('vignetoId').value = 'v1';
    document.getElementById('data').value = '2026-09-01';
    installaAvvisoCarenzaVendemmia({
      vigneti: () => [{ id: 'v1', destinazioneUva: 'vino', terrenoId: 't1' }]
    });
    document.getElementById('data').dispatchEvent(new Event('input', { bubbles: true }));
    const box = document.getElementById('avviso-carenza-raccolta');
    await vi.waitFor(() => {
      expect(box.textContent).toContain('Non si può vendemmiare');
    });
    expect(box.textContent).toContain('12/09/2026');
  });

  it('una lettura lenta precedente non cancella l\'avviso della data scelta', async () => {
    let rilascia;
    getTrattamenti.mockImplementationOnce(() => new Promise((resolve) => {
      rilascia = () => resolve([]);
    }));
    const { installaAvvisoCarenzaVendemmia } = await import('../shared/js/avviso-carenza-raccolta.js');
    installaAvvisoCarenzaVendemmia({
      vigneti: () => [{ id: 'v1', destinazioneUva: 'vino', terrenoId: 't1' }]
    });
    document.getElementById('vignetoId').value = 'v1';
    const data = document.getElementById('data');
    data.value = '2026-09-01';
    data.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    data.value = '2026-09-02';
    data.dispatchEvent(new Event('input', { bubbles: true }));
    const box = document.getElementById('avviso-carenza-raccolta');
    await vi.waitFor(() => {
      expect(box.textContent).toContain('Non si può vendemmiare');
    });
    rilascia();
    await Promise.resolve();
    await Promise.resolve();
    expect(box.textContent).toContain('Non si può vendemmiare');
  });
});
