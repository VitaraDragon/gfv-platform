/**
 * @vitest-environment jsdom
 *
 * In Modifica, miscelaPrevista (prodotto/dose/avversità) deve comparire subito,
 * senza aspettare magazzino o pacchetto etichetta (~16 s nel ritest).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  assicuratiOpzioneSelect,
  scriviMiscelaNelForm
} from '../shared/js/registro-trattamenti-lavoro.js';
import { aggiornaSemaforoPianificazione } from '../shared/js/registro-trattamenti-lavoro-semaforo.js';

function formMiscela() {
  document.body.innerHTML = `
    <form id="lavoro-form">
      <select id="lavoro-tipo-lavoro">
        <option value="Trattamento Insetticida Manuale" selected>Trattamento Insetticida Manuale</option>
      </select>
      <select id="lavoro-terreno"><option value="t1" selected>Grano</option></select>
      <input id="lavoro-data-inizio" value="2026-06-01">
      <input id="lavoro-id" value="lav-1">
      <div id="lavoro-miscela-section" style="display:block">
        <select id="lavoro-miscela-prodotto"><option value="">— Nessun prodotto —</option></select>
        <input id="lavoro-miscela-nome">
        <input id="lavoro-miscela-dose-ha">
        <select id="lavoro-miscela-avversita"><option value="">— da scegliere —</option></select>
        <input id="lavoro-acqua-hl-ha">
        <input id="lavoro-acqua-hl-tot">
        <tbody id="tbody-miscela-lavoro"></tbody>
        <div id="lavoro-miscela-anteprima"></div>
        <div id="lavoro-semaforo-banner" hidden></div>
        <div id="lavoro-semaforo-riga"></div>
        <div id="lavoro-dose-etichetta"></div>
        <div id="lavoro-nota-passaggio" hidden></div>
      </div>
    </form>
  `;
}

describe('miscela/avversità subito in Modifica', () => {
  beforeEach(() => {
    formMiscela();
  });

  it('scriviMiscelaNelForm seleziona avversità e prodotto senza opzioni precaricate', () => {
    scriviMiscelaNelForm({
      prodotti: [{
        prodottoId: 'prod-karate',
        nome: 'KARATE ZEON 1.5',
        dosePerEttaro: 1.5,
        avversitaPianificata: 'Afidi'
      }],
      ettolitriPerEttaro: 4
    });

    const avversita = document.getElementById('lavoro-miscela-avversita');
    const prodotto = document.getElementById('lavoro-miscela-prodotto');
    const dose = document.getElementById('lavoro-miscela-dose-ha');

    expect(avversita.value).toBe('Afidi');
    expect(avversita.getAttribute('data-avversita')).toBe('Afidi');
    expect(prodotto.value).toBe('prod-karate');
    expect(dose.value).toBe('1.5');
  });

  it('assicuratiOpzioneSelect non duplica e seleziona', () => {
    const sel = document.getElementById('lavoro-miscela-avversita');
    assicuratiOpzioneSelect(sel, 'Oidio');
    assicuratiOpzioneSelect(sel, 'Oidio');
    expect(Array.from(sel.options).filter((o) => o.value === 'Oidio')).toHaveLength(1);
    expect(sel.value).toBe('Oidio');
  });

  it('con etichetta assente il semaforo non azzera l\'avversità già scritta', async () => {
    scriviMiscelaNelForm({
      prodotti: [{
        nome: 'CIDELY',
        dosePerEttaro: 0.2,
        avversitaPianificata: 'Oidio (Sphaerotheca pannosa)'
      }]
    });
    expect(document.getElementById('lavoro-miscela-avversita').value).toBe('Oidio (Sphaerotheca pannosa)');

    await aggiornaSemaforoPianificazione({
      specie: 'pesco',
      terrenoId: 't1',
      data: '2026-06-01',
      precedenti: [],
      prodotti: [],
      terreni: [{ id: 't1', superficie: 1 }]
    });

    expect(document.getElementById('lavoro-miscela-avversita').value).toBe('Oidio (Sphaerotheca pannosa)');
  });
});
